/**
 * TEST-ONLY: a "live" devnet for the A0 deposit flow (never imported by app code).
 *
 * The REAL web3.js `Connection` (the suite's `realWeb3` mock line) with a `fetch` that answers
 * JSON-RPC from the recorded devnet history (recordedRpc.ts — `getSignaturesForAddress`,
 * `getTransaction`, the tree's `getAccountInfo`) plus the state a deposit needs: rho-marker
 * accounts, the depositor's token accounts, a blockhash and block heights per commitment, the
 * genesis hash, `simulateTransaction`, `sendTransaction` and `getSignatureStatuses`. Anything
 * else — another method or config — is a JSON-RPC error, so a flow that asks for it fails its test.
 *
 * `sendTransaction` takes the wire bytes the flow signed, deserializes them with the real
 * web3.js, verifies every required Ed25519 signature over the message (`@noble/curves`), records
 * them (`sent`), and then does what the test scripted (`onSend`):
 *   - 'land'  — the deposit lands: a clone of the landed `3DR6F7oW…` (ownHistory.appendDeposit, the
 *     tree account advanced as the program does it) under OUR signature, whose message is then
 *     replaced by OUR signed message (keys, header, blockhash, instructions) with the template's
 *     meta remapped to our key order and its token amounts set to this deposit's — so the tree
 *     sync parses the very transaction the flow built; the rho marker becomes a pool account;
 *     the status is `confirmed`. If the rho marker already exists (a foreign front-run) the tx
 *     fails like the program's `init` would: status `err`, nothing lands;
 *   - 'drop'  — accepted, never lands (status null forever);
 *   - 'kill'  — accepted and landed or not (`killLands`), and from then on every request hangs
 *     forever: the app was killed between submit and confirmation (the flow's promise never
 *     settles; the test abandons it, as the OS would).
 *
 * `holdWhen` / `release()` pause a flow at a chosen request (it and every later one wait until
 * the release) so a test can wipe and re-open the encrypted store while the flow is in flight
 * (R1-C1 / R2-N1 / R3-N5); `onRequest` sees each request before it is answered (R1-I2's growing
 * chain).
 *
 * M1c Task 7 adds the three generic requests an unshield makes besides the sync: `getSlot` and
 * `getBlockTime` (the chain's clock, `clock` — `blockTime: null` answers null) and
 * `getMinimumBalanceForRentExemption(0)` (`rent0`, the quote's grant floor). The relayer is
 * `liveRelayer.ts`, which lands on this same chain.
 */
import {Connection, PublicKey, VersionedTransaction} from '@solana/web3.js';
import {base58} from '@scure/base';
import {ed25519} from '@noble/curves/ed25519.js';
import {answer, RpcRefusal} from './recordedRpc';
import type {RecordedChain, RecordedTx, RpcRequest} from './recordedRpc';
import {appendDeposit, rhoPda} from './ownHistory';
import {toHex} from './chainEdits';

const PROGRAM = 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH';
const MINT = 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const DEPOSIT_DISC = 'f223c68952e1f2b6';
export const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
/** a valid base58 32-byte blockhash */
export const LIVE_BLOCKHASH = base58.encode(Uint8Array.from({length: 32}, (_v, i) => i + 1));

export type SendOutcome = 'land' | 'drop' | 'kill';

export interface LiveDevnet {
  connection: Connection;
  requests: RpcRequest[];
  chain: RecordedChain;
  genesisHash: string;
  /** block heights by commitment; getLatestBlockhash's lastValidBlockHeight = confirmed + 150 */
  height: {confirmed: number; finalized: number};
  /** rho-marker (or any) accounts by address: owner, and whether a `finalized` read sees it */
  accounts: Map<string, {owner: string; finalized: boolean}>;
  tokenAccounts: {pubkey: string; owner: string; mint: string; amount: bigint}[];
  /** the simulation's err (null = success) */
  simulateErr: unknown;
  /** what the next sends do (default 'land') */
  onSend: () => SendOutcome;
  /** for 'kill': whether the killed deposit landed before the app died */
  killLands: boolean;
  /** a preflight refusal on send (JSON-RPC error), when set */
  sendError: string | null;
  sent: {signature: string; tx: VersionedTransaction; outcome: SendOutcome | 'failed-init'}[];
  statuses: Map<string, {err: unknown; confirmationStatus: string}>;
  /** every request hangs from now on (the app was killed) */
  killed: boolean;
  /** land a deposit someone ELSE made (a template clone with these args), marker included */
  landForeign(d: {amount: bigint; commitment: string; rho: string}): string;
  /** when it returns true for a request, that request and every later one wait for `release()` */
  holdWhen: ((method: string, params: unknown[]) => boolean) | null;
  /** requests waiting on the hold now */
  held: number;
  /** let the held requests (and later ones) through; clears `holdWhen` */
  release(): void;
  /** called with every request (after a hold, before the answer) */
  onRequest: ((method: string, params: unknown[]) => void) | null;
  /**
   * M1c: the chain's clock (getSlot / getBlockTime). `earlier[k − 1]` is the block time of
   * `slot − k` for k = 1 … 4 (default null: no block time); `errorAt` lists slots whose getBlockTime
   * answers a JSON-RPC error (devnet's "block not available"). Any other slot is refused.
   */
  clock: {slot: number; blockTime: number | null; earlier?: (number | null)[]; errorAt?: number[]};
  /** M1c: getMinimumBalanceForRentExemption(0) — devnet's, measured 2026-11-17 */
  rent0: number;
}

const NEVER = new Promise<never>(() => undefined);

function ixArgs(data: Uint8Array): {amount: bigint; commitment: string; rho: string} {
  if (data.length !== 340 || toHex(data.subarray(0, 8)) !== DEPOSIT_DISC) {
    throw new Error('liveDevnet: the pool instruction is not a 340-byte deposit');
  }
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    amount: dv.getBigUint64(8, true),
    commitment: toHex(data.subarray(16, 48)),
    rho: toHex(data.subarray(48, 80)),
  };
}

/** The account at each role of a deposit message: the 8 DepositCtx accounts + the two programs. */
function roles(keys: string[], depositAccounts: number[]): Map<string, number> {
  const r = new Map<string, number>();
  ['pool', 'tree', 'vault', 'depositor', 'dta', 'rho', 'token', 'system'].forEach((name, k) =>
    r.set(name, depositAccounts[k]!),
  );
  r.set('budget', keys.indexOf('ComputeBudget111111111111111111111111111111'));
  r.set('program', keys.indexOf(PROGRAM));
  return r;
}

/** Replace a landed clone's message with OUR signed tx, remapping the template's meta to our key order. */
function adoptMessage(rec: RecordedTx, tx: VersionedTransaction, amount: bigint, holding: bigint): void {
  const msg = rec.transaction.message;
  const tplKeys = [...msg.accountKeys];
  const tplDeposit = msg.instructions.find(i => tplKeys[i.programIdIndex] === PROGRAM)!;
  const tplRoles = roles(tplKeys, tplDeposit.accounts);
  const ours = tx.message;
  const keys = ours.staticAccountKeys.map(k => k.toBase58());
  const ourDeposit = ours.compiledInstructions.find(i => keys[i.programIdIndex] === PROGRAM)!;
  const ourRoles = roles(keys, ourDeposit.accountKeyIndexes);
  if (keys.length !== tplKeys.length || ourRoles.size !== 10 || [...ourRoles.values()].some(v => v < 0)) {
    throw new Error('liveDevnet: our deposit message does not have the template\'s 10 accounts');
  }
  const toTpl = new Map<number, number>(); // our index → template index
  for (const [role, j] of ourRoles) {
    toTpl.set(j, tplRoles.get(role)!);
  }
  const fromTpl = new Map([...toTpl].map(([a, b]) => [b, a]));
  const meta = rec.meta as RecordedTx['meta'] & {
    postBalances: number[];
    preTokenBalances: {accountIndex: number; owner: string; uiTokenAmount: {amount: string}}[];
    postTokenBalances: {accountIndex: number; owner: string; uiTokenAmount: {amount: string}}[];
    innerInstructions: {index: number; instructions: {accounts: number[]; programIdIndex: number}[]}[];
  };
  const remap = (arr: number[]) => keys.map((_k, j) => arr[toTpl.get(j)!]!);
  meta.preBalances = remap(meta.preBalances);
  meta.postBalances = remap(meta.postBalances);
  const depositorKey = keys[ourRoles.get('depositor')!]!;
  const tplVault = tplRoles.get('vault')!;
  for (const side of ['pre', 'post'] as const) {
    for (const b of meta[`${side}TokenBalances`]) {
      const isVault = b.accountIndex === tplVault;
      b.accountIndex = fromTpl.get(b.accountIndex)!;
      if (isVault) {
        b.uiTokenAmount.amount = side === 'pre' ? '0' : amount.toString();
      } else {
        b.owner = depositorKey;
        b.uiTokenAmount.amount = (side === 'pre' ? holding : holding - amount).toString();
      }
    }
  }
  for (const inner of meta.innerInstructions) {
    inner.index = ours.compiledInstructions.indexOf(ourDeposit);
    for (const i of inner.instructions) {
      i.accounts = i.accounts.map(a => fromTpl.get(a)!);
      i.programIdIndex = fromTpl.get(i.programIdIndex)!;
    }
  }
  msg.accountKeys = keys;
  msg.header = {...ours.header};
  (msg as {recentBlockhash?: string}).recentBlockhash = ours.recentBlockhash;
  msg.instructions = ours.compiledInstructions.map(i => ({
    programIdIndex: i.programIdIndex,
    accounts: [...i.accountKeyIndexes],
    data: base58.encode(Uint8Array.from(i.data)),
    stackHeight: null,
  })) as typeof msg.instructions;
  rec.transaction.signatures = tx.signatures.map(s => base58.encode(Uint8Array.from(s)));
}

/** A live devnet over a copy of the recorded chain (the caller's `chain` is edited in place). */
export function liveDevnet(chain: RecordedChain): LiveDevnet {
  const requests: RpcRequest[] = [];
  let gate: Promise<void> | null = null;
  let openGate: (() => void) | null = null;
  const net: LiveDevnet = {
    connection: undefined as unknown as Connection,
    requests,
    chain,
    genesisHash: DEVNET_GENESIS,
    height: {confirmed: 400_000_000, finalized: 399_999_968},
    accounts: new Map(),
    tokenAccounts: [],
    simulateErr: null,
    onSend: () => 'land',
    killLands: false,
    sendError: null,
    sent: [],
    statuses: new Map(),
    killed: false,
    landForeign(d) {
      const a = appendDeposit(chain, d);
      net.accounts.set(rhoPda(d.rho), {owner: PROGRAM, finalized: true});
      return a.signature;
    },
    holdWhen: null,
    held: 0,
    release() {
      net.holdWhen = null;
      const open = openGate;
      gate = null;
      openGate = null;
      open?.();
    },
    onRequest: null,
    clock: {slot: 523_400_000, blockTime: 1_794_200_000},
    rent0: 650_240,
  };

  const land = (sig: string, tx: VersionedTransaction): 'land' | 'failed-init' => {
    const keys = tx.message.staticAccountKeys.map(k => k.toBase58());
    const ix = tx.message.compiledInstructions.find(i => keys[i.programIdIndex] === PROGRAM)!;
    const args = ixArgs(Uint8Array.from(ix.data));
    const marker = rhoPda(args.rho);
    if (net.accounts.has(marker)) {
      net.statuses.set(sig, {err: {InstructionError: [1, {Custom: 0}]}, confirmationStatus: 'confirmed'});
      return 'failed-init';
    }
    const dta = keys[ix.accountKeyIndexes[4]!]!;
    const holding = net.tokenAccounts.find(t => t.pubkey === dta)?.amount ?? 0n;
    appendDeposit(chain, args, {signature: sig});
    adoptMessage(chain.transactions[sig]!, tx, args.amount, holding);
    net.accounts.set(marker, {owner: PROGRAM, finalized: false});
    net.statuses.set(sig, {err: null, confirmationStatus: 'confirmed'});
    return 'land';
  };

  const respond = (method: string, params: unknown[]): unknown => {
    const cfg = (params[params.length - 1] ?? {}) as Record<string, unknown>;
    switch (method) {
      case 'getGenesisHash':
        return net.genesisHash;
      case 'getSlot':
        if (cfg.commitment !== 'confirmed') {
          throw new RpcRefusal(`getSlot ${JSON.stringify(cfg)}`);
        }
        return net.clock.slot;
      case 'getBlockTime': {
        const k = typeof params[0] === 'number' ? net.clock.slot - params[0] : -1;
        if (!(Number.isInteger(k) && k >= 0 && k <= 4)) {
          throw new RpcRefusal(`getBlockTime of slot ${String(params[0])}, not the current one or the 4 before it`);
        }
        if (net.clock.errorAt?.includes(params[0] as number)) {
          throw new RpcRefusal(`getBlockTime of slot ${String(params[0])}: block not available`);
        }
        return k === 0 ? net.clock.blockTime : (net.clock.earlier?.[k - 1] ?? null);
      }
      case 'getMinimumBalanceForRentExemption':
        if (params[0] !== 0) {
          throw new RpcRefusal(`getMinimumBalanceForRentExemption(${String(params[0])})`);
        }
        return net.rent0;
      case 'getBlockHeight': {
        const c = cfg.commitment;
        if (c !== 'confirmed' && c !== 'finalized') {
          throw new RpcRefusal(`getBlockHeight ${JSON.stringify(cfg)}`);
        }
        return net.height[c];
      }
      case 'getLatestBlockhash':
        return {
          context: {slot: net.height.confirmed},
          value: {blockhash: LIVE_BLOCKHASH, lastValidBlockHeight: net.height.confirmed + 150},
        };
      case 'getAccountInfo': {
        const addr = String(params[0]);
        if (addr === chain.tree) {
          return answer(chain, method, params);
        }
        if (cfg.encoding !== 'base64' || (cfg.commitment !== 'confirmed' && cfg.commitment !== 'finalized')) {
          throw new RpcRefusal(`getAccountInfo config ${JSON.stringify(cfg)}`);
        }
        const a = net.accounts.get(addr);
        const visible = a && (cfg.commitment === 'confirmed' || a.finalized);
        return {
          context: {slot: net.height.confirmed},
          value: visible
            ? {data: ['', 'base64'], executable: false, lamports: 1_002_240, owner: a.owner, rentEpoch: 0, space: 0}
            : null,
        };
      }
      case 'getTokenAccountsByOwner': {
        const [owner, filter] = params as [string, {mint?: string}];
        if (cfg.encoding !== 'jsonParsed' || !filter.mint) {
          throw new RpcRefusal(`getTokenAccountsByOwner ${JSON.stringify(params)}`);
        }
        return {
          context: {slot: net.height.confirmed},
          value: net.tokenAccounts
            .filter(t => t.owner === owner && t.mint === filter.mint)
            .map(t => ({
              pubkey: t.pubkey,
              account: {
                data: {
                  program: 'spl-token',
                  parsed: {
                    type: 'account',
                    info: {
                      mint: t.mint,
                      owner: t.owner,
                      state: 'initialized',
                      isNative: false,
                      tokenAmount: {amount: t.amount.toString(), decimals: 9, uiAmount: null, uiAmountString: '0'},
                    },
                  },
                  space: 165,
                },
                executable: false,
                lamports: 2_039_280,
                owner: TOKEN,
                rentEpoch: 0,
                space: 165,
              },
            })),
        };
      }
      case 'simulateTransaction': {
        if (cfg.encoding !== 'base64') {
          throw new RpcRefusal(`simulateTransaction ${JSON.stringify(cfg)}`);
        }
        return {
          context: {slot: net.height.confirmed},
          value: {
            err: net.simulateErr,
            logs: [`Program ${PROGRAM} invoke [1]`, `Program ${PROGRAM} success`],
            accounts: null,
            unitsConsumed: 142_287,
            returnData: null,
          },
        };
      }
      case 'sendTransaction': {
        if (cfg.encoding !== 'base64') {
          throw new RpcRefusal(`sendTransaction ${JSON.stringify(cfg)}`);
        }
        if (net.sendError) {
          throw new RpcRefusal(net.sendError);
        }
        const tx = VersionedTransaction.deserialize(Buffer.from(String(params[0]), 'base64'));
        const msgBytes = tx.message.serialize();
        const signers = tx.message.staticAccountKeys.slice(0, tx.message.header.numRequiredSignatures);
        signers.forEach((k, j) => {
          if (!ed25519.verify(Uint8Array.from(tx.signatures[j]!), msgBytes, k.toBytes())) {
            throw new RpcRefusal(`signature ${j} does not verify`);
          }
        });
        const sig = base58.encode(Uint8Array.from(tx.signatures[0]!));
        const outcome = net.onSend();
        let recorded: SendOutcome | 'failed-init' = outcome;
        if (outcome === 'land' || (outcome === 'kill' && net.killLands)) {
          recorded = land(sig, tx) === 'failed-init' ? 'failed-init' : outcome;
        }
        net.sent.push({signature: sig, tx, outcome: recorded});
        if (outcome === 'kill') {
          net.killed = true;
        }
        return sig;
      }
      case 'getSignatureStatuses': {
        const sigs = params[0] as string[];
        return {
          context: {slot: net.height.confirmed},
          value: sigs.map(s => {
            const st = net.statuses.get(s);
            return st ? {slot: net.height.confirmed, confirmations: null, err: st.err, confirmationStatus: st.confirmationStatus} : null;
          }),
        };
      }
      default:
        return answer(chain, method, params);
    }
  };

  const fakeFetch = async (_url: unknown, init?: {body?: unknown}) => {
    const body = JSON.parse(String(init?.body)) as {id: unknown; method: string; params?: unknown[]};
    const params = body.params ?? [];
    if (gate || net.holdWhen?.(body.method, params)) {
      gate ??= new Promise<void>(r => {
        openGate = r;
      });
      net.held++;
      await gate;
      net.held--;
    }
    if (net.killed) {
      return NEVER;
    }
    requests.push({method: body.method, params: JSON.parse(JSON.stringify(params)) as unknown[]});
    net.onRequest?.(body.method, params);
    let payload: unknown;
    try {
      payload = {jsonrpc: '2.0', id: body.id, result: respond(body.method, params)};
    } catch (e) {
      if (!(e instanceof RpcRefusal)) {
        throw e;
      }
      payload = {jsonrpc: '2.0', id: body.id, error: {code: -32602, message: `liveDevnet: ${e.message}`}};
    }
    const text = JSON.stringify(payload);
    return {ok: true, status: 200, statusText: 'OK', text: async () => text, json: async () => payload};
  };
  net.connection = new Connection('https://live.invalid', {
    commitment: 'confirmed',
    fetch: fakeFetch as unknown as typeof fetch,
    disableRetryOnRateLimit: true,
  });
  return net;
}

/** A token account of `owner` for the pool's mint (a fresh address), registered on the devnet. */
export function fundTokenAccount(net: LiveDevnet, owner: string, amount: bigint, seed = 7): string {
  const pubkey = new PublicKey(Uint8Array.from({length: 32}, (_v, i) => (i * 31 + seed) % 251)).toBase58();
  net.tokenAccounts.push({pubkey, owner, mint: MINT, amount});
  return pubkey;
}
