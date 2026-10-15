import {ed25519} from '@noble/curves/ed25519.js';
import {base64} from '@scure/base';
import {PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import type {SimulationOutcome, SolanaReader} from '../../../../../core/solana/rpc';
import {handleMessage} from '../../messages';
import {setSession} from '../../session';
import {VAULT_KEY} from '../../accountsStore';
import {GRANTS_KEY, type Grant} from '../grants';
import {runUnlockHook} from '../queue';
import {readDappSession, type Entry} from '../store';
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

export interface Chain {
  /** simulateTransaction's error (null: it runs). */
  err: unknown;
  /** Calls per method. */
  calls: Map<string, number>;
  /** getBalance throws while set. */
  down: boolean;
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
      return addresses.map(() => null);
    },
    simulateTransaction: async (txBase64, opts): Promise<SimulationOutcome> => {
      count('simulateTransaction');
      if (chain.err !== null) return {err: chain.err, logs: [], unitsConsumed: 0, slot: 777, accounts: null};
      const m = VersionedTransaction.deserialize(base64.decode(txBase64)).message;
      const keys = m.staticAccountKeys.map(k => k.toBase58());
      let out = 0n;
      for (const ix of m.compiledInstructions) {
        if (keys[ix.programIdIndex] === SystemProgram.programId.toBase58() && ix.data[0] === 2 && keys[ix.accountKeyIndexes[0] ?? -1] === ME.toBase58()) out += new DataView(ix.data.buffer, ix.data.byteOffset + 4, 8).getBigUint64(0, true);
      }
      const fee = keys[0] === ME.toBase58() ? 5_000n * BigInt(m.header.numRequiredSignatures) : 0n;
      return {err: null, logs: [], unitsConsumed: 450, slot: 777, accounts: (opts?.accounts ?? []).map(a => (a === ME.toBase58() ? {lamports: SOL - out - fee, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null))};
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

export const newChain = (): Chain => ({err: null, calls: new Map(), down: false});

export async function txScene(o: {grant?: Partial<Grant> | null; known?: string[]} = {}) {
  const ext = fakeExt();
  const chain = newChain();
  const deps = fakeDeps({reader: chainReader(chain)});
  await ext.local.set(VAULT_KEY, {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}]});
  await setSession(ext, [ACCOUNT]);
  await runUnlockHook(ext, deps);
  if (o.grant !== null) await ext.local.set(GRANTS_KEY, [{origin: DAPP, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: [], ...o.grant}]);
  if (o.known !== undefined) await ext.local.set('v1_known_recipients', o.known.map(address => ({address, at: 1})));
  const approveSender = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/approve.html`};
  const vaultSender = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/unlock.html`};
  const page: Page = openPage(ext, deps, DAPP);
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
