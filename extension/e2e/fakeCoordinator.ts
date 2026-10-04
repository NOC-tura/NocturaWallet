import type {BrowserContext, Route} from '@playwright/test';
import {randomBytes} from 'node:crypto';
import {base58, base64} from '@scure/base';

/** The chain's height when the fake starts; a blockhash handed out at height h is valid through h + 150. */
export const FAKE_START_HEIGHT = 1000;
export const BLOCKHASH_LIFETIME = 150;
const RPC = 'https://api.noc-tura.io/api/v1/rpc';
const BROADCAST = 'https://api.noc-tura.io/api/v1/tx/broadcast';
const PRICES = 'https://api.noc-tura.io/api/v1/wallet/prices';
const STATS = 'https://api.noc-tura.io/api/v1/stats';
/** rpcResult's answer for a method it does not implement (listed in `unexpected` too). */
const METHOD_NOT_FOUND: unique symbol = Symbol('method not found');

export interface FakeCoordinator {
  /** 'confirm': a signature is confirmed at its second status check. 'expire': the network never sees it. */
  mode: 'confirm' | 'expire';
  /** What getBlockHeight answers; the test moves it past a blockhash's life to drive expiry. */
  blockHeight: number;
  hits: {url: string; rpcMethod: string | null}[];
  /** Signatures, in the order the broadcast route received them. */
  broadcasts: string[];
  /** The signed wire bytes (base64), in the same order: each distinct set is a distinct transaction. */
  broadcastWires: string[];
  /** Full-history status checks (searchTransactionHistory: true) and when they were answered. */
  historyChecks: {signature: string; at: number}[];
  /** Anything the fake was asked that it does not implement, or asked in the wrong shape. */
  unexpected: string[];
  /**
   * B1b-2a: 'ok' answers; 'forbidden' answers every request 403 (the D26 cool-down); 'unreachable'
   * aborts every request — no answer at all (#42).
   */
  network: 'ok' | 'forbidden' | 'unreachable';
  /** SOL per address, lamports; anything unlisted holds `defaultLamports`. */
  lamports: Map<string, number>;
  /** What an unlisted address holds (10 SOL unless a spec sets an empty chain). */
  defaultLamports: number;
  /** What getAccountInfo says an address is (E2); anything unlisted does not exist. */
  accountKinds: Map<string, 'wallet' | 'program' | 'other'>;
  /** The simulation's error switch (E2): err set and accounts null, as the real RPC answers. */
  simulateError: boolean;
  /** Every simulateTransaction's requested addresses (null = the field was missing). */
  simulations: (string[] | null)[];
  /** Plan 3: the payer's lamports after each simulated transaction, fee included — what the node answered. */
  simulatedPayerAfter: number[];
  /**
   * Plan 3: SPL token accounts per owner, answered by getTokenAccountsByOwner in the node's jsonParsed shape
   * (what core/solana/rpc.ts reads: pubkey, account.data.parsed.info.{mint, owner, tokenAmount.{amount,
   * decimals}}). No E2E sends a token: they are for the balances #11 and #43 show.
   */
  tokenAccounts: Map<string, {pubkey: string; mint: string; amount: string; decimals: number}[]>;
  /** Per owner, newest first: the signatures getSignaturesForAddress pages through, and each getTransaction result. */
  history: Map<string, {signature: string; tx: unknown}[]>;
  /**
   * Holds every answer until the returned function is called — how a visual spec keeps a loading
   * state (#40's, #8's "Checking…") on screen deterministically while it is asserted and shot.
   */
  hold(): () => void;
}

/** Compact-u16: the signature count that opens a serialized transaction. */
function shortVec(bytes: Uint8Array): {value: number; size: number} {
  let value = 0;
  for (let size = 0; size < 3; size++) {
    const b = bytes[size] ?? 0;
    value |= (b & 0x7f) << (7 * size);
    if ((b & 0x80) === 0) return {value, size: size + 1};
  }
  return {value, size: 3};
}

/**
 * The static keys and instructions of a serialized v0 transaction: signature count and slots, then
 * the message (0x80 prefix, 3-byte header, keys, blockhash, instructions). Read by hand: the E2E runs
 * under Playwright's loader, where @solana/web3.js's CommonJS dependencies do not load.
 */
function parseV0(wire: Uint8Array): {signers: number; keys: string[]; instructions: {program: number; accounts: number[]; data: Uint8Array}[]} {
  let at = 0;
  const vec = (): number => {
    const {value, size} = shortVec(wire.subarray(at));
    at += size;
    return value;
  };
  const signatures = vec();
  at += 64 * signatures;
  if (wire[at] !== 0x80) throw new Error('not a v0 message');
  // The header's first byte: the required signatures (each pays the 5 000-lamport base fee).
  const signers = wire[at + 1] ?? 0;
  at += 4;
  const keys: string[] = [];
  for (let n = vec(), i = 0; i < n; i++, at += 32) keys.push(base58.encode(wire.subarray(at, at + 32)));
  at += 32;
  const instructions: {program: number; accounts: number[]; data: Uint8Array}[] = [];
  for (let n = vec(), i = 0; i < n; i++) {
    const program = wire[at++] ?? 0;
    const accounts: number[] = [];
    const count = vec();
    for (let j = 0; j < count; j++) accounts.push(wire[at++] ?? 0);
    const len = vec();
    instructions.push({program, accounts, data: wire.slice(at, at + len)});
    at += len;
  }
  return {signers, keys, instructions};
}

/**
 * A simulated coordinator: the read proxy for the methods the engine uses, the broadcast route
 * with the contract this plan defines (docs/superpowers/specs/2026-09-29-coordinator-broadcast-route.md),
 * prices and /stats. 10 SOL, no token accounts unless a spec lists some, quiet fees, a simulation that applies the
 * fee and the System transfers. Every
 * getLatestBlockhash hands out a fresh blockhash valid for BLOCKHASH_LIFETIME blocks from the
 * current height, as a real node does.
 */
export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeCoordinator> {
  let held: Promise<void> | null = null;
  const fake: FakeCoordinator = {
    mode: 'confirm',
    blockHeight: FAKE_START_HEIGHT,
    hits: [],
    broadcasts: [],
    broadcastWires: [],
    historyChecks: [],
    unexpected: [],
    network: 'ok',
    lamports: new Map(),
    defaultLamports: 10_000_000_000,
    accountKinds: new Map(),
    simulateError: false,
    simulations: [],
    simulatedPayerAfter: [],
    tokenAccounts: new Map(),
    history: new Map(),
    hold: () => {
      let release: () => void = () => undefined;
      held = new Promise<void>(r => (release = r));
      return () => {
        held = null;
        release();
      };
    },
  };
  const statusChecks = new Map<string, number>();
  const context = () => ({slot: fake.blockHeight + 50});

  const signatureStatuses = (signatures: string[], history: boolean): unknown => ({
    context: context(),
    value: signatures.map(signature => {
      if (history) fake.historyChecks.push({signature, at: Date.now()});
      if (fake.mode === 'expire') return null;
      const seen = (statusChecks.get(signature) ?? 0) + 1;
      statusChecks.set(signature, seen);
      return seen >= 2 ? {slot: context().slot, confirmations: 1, err: null, status: {Ok: null}, confirmationStatus: 'confirmed'} : null;
    }),
  });

  const lamportsOf = (address: string): number => fake.lamports.get(address) ?? fake.defaultLamports;

  /**
   * What a node answers: the requested accounts after the transaction WITH its fee paid, as the coordinator
   * measured a real node answer (spec §11.5: a payer that sends `balance − 5 000` ends at exactly 0) — the
   * payer's lamports less every System transfer it makes, less 5 000 per signature and the priority fee its
   * ComputeBudget instructions set (price × limit / 10⁶, rounded up). Its error switch answers err with
   * accounts: null, as the real RPC does (review H2).
   */
  const simulate = (params: unknown[]): unknown => {
    const config = params[1] as {accounts?: {encoding?: string; addresses?: unknown}} | undefined;
    const addresses = Array.isArray(config?.accounts?.addresses) ? (config.accounts.addresses as string[]) : null;
    fake.simulations.push(addresses);
    if (addresses === null || config?.accounts?.encoding !== 'base64') fake.unexpected.push('simulateTransaction without accounts {encoding: base64, addresses}');
    if (fake.simulateError) return {context: context(), value: {err: {InstructionError: [2, {Custom: 1}]}, logs: [], accounts: null, unitsConsumed: 0, returnData: null}};
    const {signers, keys, instructions} = parseV0(base64.decode(params[0] as string));
    const payer = keys[0] ?? '';
    let out = 0;
    let price = 0n;
    let limit = 0n;
    for (const ix of instructions) {
      const data = ix.data;
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      if (keys[ix.program] === '11111111111111111111111111111111' && data[0] === 2 && keys[ix.accounts[0] ?? -1] === payer) out += Number(view.getBigUint64(4, true));
      if (keys[ix.program] === 'ComputeBudget111111111111111111111111111111' && data[0] === 2) limit = BigInt(view.getUint32(1, true));
      if (keys[ix.program] === 'ComputeBudget111111111111111111111111111111' && data[0] === 3) price = view.getBigUint64(1, true);
    }
    const fee = 5_000 * signers + Number((price * limit + 999_999n) / 1_000_000n);
    const after = lamportsOf(payer) - out - fee;
    fake.simulatedPayerAfter.push(after);
    const accounts = (addresses ?? []).map(a =>
      a === payer ? {lamports: after, owner: '11111111111111111111111111111111', data: ['', 'base64'], executable: false, rentEpoch: 18446744073709552000, space: 0} : null,
    );
    return {context: context(), value: {err: null, logs: ['Program 11111111111111111111111111111111 success'], accounts, unitsConsumed: 450, returnData: null}};
  };

  /** getTokenAccountsByOwner in the node's jsonParsed shape, filtered by `mint` or `programId` as a node filters. */
  const tokenAccountsOf = (owner: string, filter: {mint?: string; programId?: string} | undefined): unknown[] =>
    (fake.tokenAccounts.get(owner) ?? [])
      .filter(t => filter?.mint === undefined || t.mint === filter.mint)
      // Every listed account is owned by the classic SPL Token program: another programId (Token-2022) matches none.
      .filter(() => filter?.programId === undefined || filter.programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
      .map(t => ({
        pubkey: t.pubkey,
        account: {
          data: {
            parsed: {info: {isNative: false, mint: t.mint, owner, state: 'initialized', tokenAmount: {amount: t.amount, decimals: t.decimals, uiAmount: Number(t.amount) / 10 ** t.decimals, uiAmountString: String(Number(t.amount) / 10 ** t.decimals)}}, type: 'account'},
            program: 'spl-token',
            space: 165,
          },
          executable: false,
          lamports: 2_039_280,
          owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          rentEpoch: 18446744073709552000,
          space: 165,
        },
      }));

  const rpcResult = (method: string, params: unknown[]): unknown => {
    switch (method) {
      case 'getBalance':
        return {context: context(), value: lamportsOf(params[0] as string)};
      case 'getLatestBlockhash':
        return {context: context(), value: {blockhash: base58.encode(randomBytes(32)), lastValidBlockHeight: fake.blockHeight + BLOCKHASH_LIFETIME}};
      case 'getRecentPrioritizationFees':
        return [];
      case 'simulateTransaction':
        return simulate(params);
      case 'getTokenAccountsByOwner':
        return {context: context(), value: tokenAccountsOf(params[0] as string, params[1] as {mint?: string; programId?: string} | undefined)};
      case 'getMultipleAccounts':
        // Each address as the node reports it: a system account holding its lamports, or null when it holds
        // none (the import probe reads balances this way — the same `lamports` table as getBalance).
        return {
          context: context(),
          value: (params[0] as string[]).map(a => {
            const lamports = lamportsOf(a);
            return lamports > 0 ? {lamports, owner: '11111111111111111111111111111111', data: ['', 'base64'], executable: false, rentEpoch: 18446744073709552000, space: 0} : null;
          }),
        };
      case 'getAccountInfo': {
        const kind = fake.accountKinds.get(params[0] as string);
        if (kind === undefined) return {context: context(), value: null};
        const owner = kind === 'wallet' ? '11111111111111111111111111111111' : 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        return {context: context(), value: {lamports: 1_000_000, owner, executable: kind === 'program', data: ['', 'base64'], rentEpoch: 0, space: 0}};
      }
      case 'getBlockHeight':
        return fake.blockHeight;
      case 'getSignatureStatuses': {
        const config = params[1] as {searchTransactionHistory?: boolean} | undefined;
        return signatureStatuses(params[0] as string[], config?.searchTransactionHistory === true);
      }
      case 'getSignaturesForAddress': {
        const list = fake.history.get(params[0] as string) ?? [];
        const o = params[1] as {limit?: number; before?: string} | undefined;
        // An unknown `before` is an empty page, as a node answers — never a restart at page 0.
        const at = o?.before === undefined ? -1 : list.findIndex(e => e.signature === o.before);
        if (o?.before !== undefined && at < 0) return [];
        // Each entry as the node reports it: the transaction's own err and blockTime, when it has them.
        return list.slice(at + 1, at + 1 + (o?.limit ?? 10)).map(e => {
          const t = e.tx as {blockTime?: unknown; meta?: {err?: unknown}} | null;
          const blockTime = typeof t?.blockTime === 'number' ? t.blockTime : null;
          return {signature: e.signature, slot: 1, err: t?.meta?.err ?? null, memo: null, blockTime, confirmationStatus: 'finalized'};
        });
      }
      case 'getTransaction': {
        for (const list of fake.history.values()) {
          const hit = list.find(e => e.signature === params[0]);
          if (hit !== undefined) return hit.tx;
        }
        return null;
      }
      default:
        fake.unexpected.push(`rpc ${method}`);
        return METHOD_NOT_FOUND;
    }
  };

  const json = (route: Route, status: number, body: unknown) => route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)});

  await ctx.route('https://api.noc-tura.io/**', async route => {
    if (held !== null) await held;
    const req = route.request();
    const url = req.url();
    // B1b-2a: the two failure switches, counted as hits (the request did leave the extension).
    if (fake.network === 'unreachable') {
      fake.hits.push({url, rpcMethod: null});
      return route.abort('internetdisconnected');
    }
    if (fake.network === 'forbidden') {
      fake.hits.push({url, rpcMethod: null});
      return json(route, 403, {error: 'forbidden'});
    }
    if (url === RPC && req.method() === 'POST') {
      const body = JSON.parse(req.postData() ?? '{}') as {jsonrpc?: string; id?: number; method?: string; params?: unknown[]};
      const method = body.method ?? '';
      fake.hits.push({url, rpcMethod: method});
      if (body.jsonrpc !== '2.0' || !Array.isArray(body.params)) fake.unexpected.push(`rpc ${method}: not a JSON-RPC 2.0 request`);
      const result = rpcResult(method, body.params ?? []);
      // A method the fake does not implement answers as the coordinator's proxy answers a method outside its
      // allowlist (docs/superpowers/specs/2026-09-29-coordinator-broadcast-route.md §3): JSON-RPC -32601
      // "Method not allowed", never a result. The rest of the fake stays lenient on purpose: it checks no
      // params shapes beyond what `unexpected` lists.
      if (result === METHOD_NOT_FOUND) return json(route, 200, {jsonrpc: '2.0', id: body.id ?? 0, error: {code: -32601, message: 'Method not allowed'}});
      return json(route, 200, {jsonrpc: '2.0', id: body.id ?? 0, result});
    }
    fake.hits.push({url, rpcMethod: null});
    if (url === BROADCAST && req.method() === 'POST') {
      const {transaction} = JSON.parse(req.postData() ?? '{}') as {transaction?: string};
      const wire = base64.decode(transaction ?? '');
      // The route's contract: 200 with the FIRST signature of the bytes it received.
      const {value: count, size} = shortVec(wire);
      if (count < 1 || wire.length < size + 64) return json(route, 400, {error: 'malformed', message: 'no signature'});
      const signature = base58.encode(wire.subarray(size, size + 64));
      fake.broadcasts.push(signature);
      fake.broadcastWires.push(transaction ?? '');
      return json(route, 200, {signature});
    }
    if (url.startsWith(PRICES) && req.method() === 'GET') {
      return json(route, 200, {success: true, data: {solana: {usd: 150}, 'usd-coin': {usd: 1}, tether: {usd: 1}}});
    }
    if (url === STATS && req.method() === 'GET') {
      // The presale stage, for NOC's value in the dollar re-auth rule (owner decision B).
      return json(route, 200, {success: true, data: {currentStage: 0, totalNocSold: 0, isPaused: false}});
    }
    fake.unexpected.push(`${req.method()} ${url}`);
    return json(route, 404, {error: 'not in the fake coordinator'});
  });
  return fake;
}
