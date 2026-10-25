import {ed25519} from '@noble/curves/ed25519.js';
import {base64} from '@scure/base';
import {PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import type {AccountData, SimulationOutcome, SolanaReader} from '../../../../../core/solana/rpc';
import {handleMessage} from '../../messages';
import {setSession} from '../../session';
import {VAULT_KEY} from '../../accountsStore';
import {GRANTS_KEY, type Grant} from '../grants';
import {runUnlockHook} from '../queue';
import {readDappSession, type Entry} from '../store';
import {ATA_PROGRAM, PRESALE_PROGRAM, TOKEN_PROGRAM} from '../decode/decode';
import {PRESALE_INSTRUCTIONS} from '../decode/presaleIdl';
import {fakeExt} from '../../__tests__/fakeExt';
import {fakeDeps, fakeReader} from '../../__tests__/fakeDeps';
import {ACCOUNT, BLOCKHASH, RECIPIENT} from '../../__tests__/fixtures';
import {openPage, type Page} from './pageHarness';

/**
 * B1c-2's transaction requests against the real background: an unlocked wallet (ACCOUNT, "Main"), a persistent grant
 * for https://dapp.test, its page, and a chain the tests steer — every simulation answers the payer's lamports less
 * what its System transfers move and its fee (as a node does, spec §11.5), unless `chain.err` is set.
 */
export const DAPP = 'https://dapp.test';
export const ME = new PublicKey(ACCOUNT.publicKey);
export const TO = new PublicKey(RECIPIENT);
export const SOL = 10_000_000_000n;
/** A co-signer (a dApp's own key): a real keypair, 32 × 0x03. */
export const CO_SEED = new Uint8Array(32).fill(3);
export const CO = new PublicKey(ed25519.getPublicKey(CO_SEED));

export const transfer = (lamports: number | bigint = 1, from = ME, to = TO) => SystemProgram.transfer({fromPubkey: from, toPubkey: to, lamports: BigInt(lamports)});
export const v0 = (instructions: TransactionInstruction[] = [transfer()], payer = ME): string =>
  base64.encode(new VersionedTransaction(new TransactionMessage({payerKey: payer, recentBlockhash: BLOCKHASH, instructions}).compileToV0Message()).serialize());
/** Paid and signed by the co-signer; the account is a required signer whose slot is still empty. */
export function coSigned(instructions: TransactionInstruction[] = [transfer(1, ME)]): string {
  const tx = new VersionedTransaction(new TransactionMessage({payerKey: CO, recentBlockhash: BLOCKHASH, instructions}).compileToV0Message());
  tx.addSignature(CO, ed25519.sign(tx.message.serialize(), CO_SEED));
  return base64.encode(tx.serialize());
}

/**
 * Fix round 1, I1: a Token setAuthority to None — the Option tag is 0, decode.ts's own `{kind: 'none'}` field, not a
 * resolution failure. Data `[6, 3, 0]`: tag 6 (setAuthority), authorityType 3 (closeAccount), Option tag 0 (none).
 */
export const setAuthorityToNone = (account = TO, currentAuthority = ME): TransactionInstruction =>
  new TransactionInstruction({
    programId: new PublicKey(TOKEN_PROGRAM),
    data: Buffer.from([6, 3, 0]),
    keys: [
      {pubkey: account, isSigner: false, isWritable: true},
      {pubkey: currentAuthority, isSigner: true, isWritable: false},
    ],
  });

/** u64 LE, byte by byte (never `writeBigUInt64LE` — the buffer polyfill on-device lacks it, project convention). */
const u64le = (n: bigint): number[] => Array.from({length: 8}, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));

/** Fix round 1, I3: a Token mintTo — a known tag outside the decoded list, named with no fields (decode.ts). */
export const mintTo = (mint = TO, destination = ME, authority = ME, amount = 1n): TransactionInstruction =>
  new TransactionInstruction({
    programId: new PublicKey(TOKEN_PROGRAM),
    data: Buffer.from([7, ...u64le(amount)]),
    keys: [
      {pubkey: mint, isSigner: false, isWritable: true},
      {pubkey: destination, isSigner: false, isWritable: true},
      {pubkey: authority, isSigner: true, isWritable: false},
    ],
  });

/**
 * B1c-3: System assign of `account` (the wallet's, by default) to another program — F3, a block (ASSIGN) decoded from
 * the instruction alone, whatever the chain says.
 */
export const assign = (account = ME, programId = new PublicKey(new Uint8Array(32).fill(71))): TransactionInstruction => SystemProgram.assign({accountPubkey: account, programId});

/** B1c-3: an associated-token-account createIdempotent (tag 1) of `account` for `wallet`, paid by the account — one of F10's creators; `tokenProgram` its account 5. */
export const ataCreate = (account: PublicKey, wallet = TO, mint = new PublicKey(new Uint8Array(32).fill(72)), tokenProgram = new PublicKey(TOKEN_PROGRAM)): TransactionInstruction =>
  new TransactionInstruction({
    programId: new PublicKey(ATA_PROGRAM),
    data: Buffer.from([1]),
    keys: [
      {pubkey: ME, isSigner: true, isWritable: true},
      {pubkey: account, isSigner: false, isWritable: true},
      {pubkey: wallet, isSigner: false, isWritable: false},
      {pubkey: mint, isSigner: false, isWritable: false},
      {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
      {pubkey: tokenProgram, isSigner: false, isWritable: false},
    ],
  });

/** B1c-3: a Token transfer (tag 3) from `source` to `destination`, the account its authority. */
export const tokenTransfer = (destination: PublicKey, source = new PublicKey(new Uint8Array(32).fill(73)), amount = 1n): TransactionInstruction =>
  new TransactionInstruction({
    programId: new PublicKey(TOKEN_PROGRAM),
    data: Buffer.from([3, ...u64le(amount)]),
    keys: [
      {pubkey: source, isSigner: false, isWritable: true},
      {pubkey: destination, isSigner: false, isWritable: true},
      {pubkey: ME, isSigner: true, isWritable: false},
    ],
  });

/** B1c-3 (Task 5): a Token approve (tag 4) of `amount` from `source` to `delegate`, the account its owner. */
export const tokenApprove = (source: PublicKey, delegate: PublicKey, amount: bigint): TransactionInstruction =>
  new TransactionInstruction({
    programId: new PublicKey(TOKEN_PROGRAM),
    data: Buffer.from([4, ...u64le(amount)]),
    keys: [
      {pubkey: source, isSigner: false, isWritable: true},
      {pubkey: delegate, isSigner: false, isWritable: false},
      {pubkey: ME, isSigner: true, isWritable: false},
    ],
  });

/**
 * B1d §3.6: a presale instruction exactly as its IDL row reads — every argument in order (u64s of 1 000 000, tier and
 * bool 0, pubkeys and byte arrays filled), every account (the account as `user`, the signer) — or `data` as given.
 */
export function presaleIx(name: string, o: {data?: number[]} = {}): TransactionInstruction {
  const row = PRESALE_INSTRUCTIONS.find(x => x.name === name);
  if (row === undefined) throw new Error(`no presale instruction ${name}`);
  const args = row.args.flatMap(a => (a.type === 'u64' || a.type === 'i64' ? u64le(1_000_000n) : a.type === 'pubkey' ? [...TO.toBytes()] : typeof a.type === 'object' ? new Array<number>(a.type.bytes).fill(1) : [0]));
  return new TransactionInstruction({
    programId: new PublicKey(PRESALE_PROGRAM),
    data: Buffer.from(o.data ?? [...row.discriminator, ...args]),
    keys: row.accounts.map((a, i) => (a === 'user' ? {pubkey: ME, isSigner: true, isWritable: true} : {pubkey: new PublicKey(new Uint8Array(32).fill(100 + i)), isSigner: false, isWritable: i < 3})),
  });
}

export interface Chain {
  /** simulateTransaction's error (null: it runs). */
  err: unknown;
  /** B1c-3: an error for one transaction by its static keys (null: it runs) — a batch whose later step fails alone. */
  errFor: ((keys: string[]) => unknown) | null;
  /** Calls per method. */
  calls: Map<string, number>;
  /** getBalance throws while set. */
  down: boolean;
  /**
   * B1c-3 (Task 5): accounts besides the wallet's (a token account, a mint) — what getAccountsData reads, and each one's
   * post-state in a simulation (unchanged by it).
   */
  accounts: Map<string, AccountData>;
}

/** The steered chain (exported for the approval window's tests). */
export function chainReader(chain: Chain): SolanaReader {
  const count = (m: string) => chain.calls.set(m, (chain.calls.get(m) ?? 0) + 1);
  const up = (m: string) => {
    count(m);
    if (chain.down) throw new Error('the proxy is unreachable');
  };
  return fakeReader({
    getBalance: async () => {
      up('getBalance');
      return SOL;
    },
    getTokenAccountsByOwner: async () => {
      count('getTokenAccountsByOwner');
      return [];
    },
    getLatestBlockhash: async () => {
      count('getLatestBlockhash');
      return {blockhash: BLOCKHASH, lastValidBlockHeight: 5_000};
    },
    getAccountsData: async addresses => {
      count('getAccountsData');
      return addresses.map(a => chain.accounts.get(a) ?? null);
    },
    simulateTransaction: async (txBase64, opts): Promise<SimulationOutcome> => {
      count('simulateTransaction');
      const m = VersionedTransaction.deserialize(base64.decode(txBase64)).message;
      const keys = m.staticAccountKeys.map(k => k.toBase58());
      const err = chain.err !== null ? chain.err : (chain.errFor?.(keys) ?? null);
      if (err !== null) return {err, logs: [], unitsConsumed: 0, slot: 777, accounts: null};
      let out = 0n;
      for (const ix of m.compiledInstructions) {
        if (keys[ix.programIdIndex] === SystemProgram.programId.toBase58() && ix.data[0] === 2 && keys[ix.accountKeyIndexes[0] ?? -1] === ME.toBase58()) out += new DataView(ix.data.buffer, ix.data.byteOffset + 4, 8).getBigUint64(0, true);
      }
      const fee = keys[0] === ME.toBase58() ? 5_000n * BigInt(m.header.numRequiredSignatures) : 0n;
      return {err: null, logs: [], unitsConsumed: 450, slot: 777, accounts: (opts?.accounts ?? []).map(a => (a === ME.toBase58() ? {lamports: SOL - out - fee, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : (chain.accounts.get(a) ?? null)))};
    },
  });
}

/** Lets fire-and-forget work (a simulation started by dapp.pending) finish: up to `turns` macrotask turns, until `done`. */
export async function until(done: () => Promise<boolean>, turns = 400): Promise<void> {
  for (let i = 0; i < turns; i++) {
    if (await done()) return;
    await new Promise<void>(r => setTimeout(r, 0));
  }
  throw new Error('never settled');
}

export const newChain = (): Chain => ({err: null, errFor: null, calls: new Map(), down: false, accounts: new Map()});

export async function txScene(o: {grant?: Partial<Grant> | null; known?: string[]; origin?: string} = {}) {
  const origin = o.origin ?? DAPP;
  const ext = fakeExt();
  const chain = newChain();
  const deps = fakeDeps({reader: chainReader(chain)});
  await ext.local.set(VAULT_KEY, {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}]});
  await setSession(ext, [ACCOUNT]);
  await runUnlockHook(ext, deps);
  if (o.grant !== null) await ext.local.set(GRANTS_KEY, [{origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: [], ...o.grant}]);
  if (o.known !== undefined) await ext.local.set('v1_known_recipients', o.known.map(address => ({address, at: 1})));
  const approveSender = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/approve.html`};
  const vaultSender = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/unlock.html`};
  const page: Page = openPage(ext, deps, origin);
  const queue = async (): Promise<Entry[]> => (await readDappSession(ext)).queue;
  const entry = async (requestId: string): Promise<Entry | undefined> => (await queue()).find(e => e.requestId === requestId);
  type View = {state: string; request: {tx: Record<string, unknown> & {simulation: {status: string; id?: string}; reauth: {state: string} | null}} | null};
  const pend = async (): Promise<View> => ((await handleMessage(ext, {type: 'dapp.pending'}, approveSender, deps)) as {data: View}).data;
  /** dapp.pending until its simulation answered (the first, or one newer than `after`), then the view. */
  const simulated = async (after?: string): Promise<View> => {
    let view = await pend();
    await until(async () => {
      view = await pend();
      const s = view.request?.tx?.simulation;
      return s !== undefined && s.status !== 'simulating' && s.id !== after;
    });
    return view;
  };
  const decide = (m: Record<string, unknown>) => handleMessage(ext, {type: 'dapp.decide', ...m}, approveSender, deps);
  const approve = async (requestId: string, simulation?: string) => decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, ...(simulation === undefined ? {} : {simulation})});
  const reauthOk = (challengeId: string) => handleMessage(ext, {type: 'vault.reauthOk', challengeId}, vaultSender, deps);
  const challengeInfo = (challengeId: string) => handleMessage(ext, {type: 'vault.challengeInfo', challengeId}, vaultSender, deps);
  const signTx = (id: string, transactions: string[]) => page.ask({type: 'page.signTransaction', id, account: ACCOUNT.publicKey, transactions});
  const send = (id: string, transaction: string) => page.ask({type: 'page.signAndSendTransaction', id, account: ACCOUNT.publicKey, transaction});
  return {ext, deps, chain, page, queue, entry, pend, simulated, decide, approve, reauthOk, challengeInfo, signTx, send};
}
