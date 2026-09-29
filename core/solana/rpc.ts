/**
 * The JSON-RPC client for the coordinator's read proxy (spec §4 "RPC — reads").
 *
 * The proxy answers a method outside its allowlist with HTTP 403, and a few 403s in a burst make
 * the host's CrowdSec bouncer ban the user's IP from the whole domain for hours. So:
 *  - the methods are a compile-time list: `call` accepts only an `RpcMethod`, and refuses any
 *    other string at run time as well, before a request exists;
 *  - a 403 is terminal: typed (`RpcForbidden`), never retried, and it trips a latch that refuses
 *    every further call through the same latch for FORBIDDEN_COOLDOWN_MS without touching the
 *    network — a burst is what gets an IP banned, so the second request must not happen. The
 *    latch also serialises requests, so concurrent reads cannot all be in flight when it trips;
 *  - nothing here retries at all. Callers that poll do so no faster than every 2 s.
 * extension/scripts/check-rpc-methods.mjs proves that every method name the extension bundles is
 * on this list and that this list equals the spec's.
 */

export const API_ORIGIN = 'https://api.noc-tura.io';
/** Already ends in /api/v1: append bare paths (never another /v1). */
export const API_BASE = `${API_ORIGIN}/api/v1`;
export const RPC_ENDPOINT = `${API_BASE}/rpc`;

export const ALLOWED_RPC_METHODS = [
  'getBalance',
  'getAccountInfo',
  'getMultipleAccounts',
  'getLatestBlockhash',
  'simulateTransaction',
  'getSignaturesForAddress',
  'getTransaction',
  'getSignatureStatuses',
  'getRecentPrioritizationFees',
  'getTokenAccountsByOwner',
  'getBlockHeight',
] as const;
export type RpcMethod = (typeof ALLOWED_RPC_METHODS)[number];

/** After a 403, how long every call through the same latch is refused locally. */
export const FORBIDDEN_COOLDOWN_MS = 10 * 60_000;

export interface FetchInit {
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  credentials?: 'omit';
}
/** The narrowest fetch this needs; `globalThis.fetch` satisfies it. Tests pass a fake. */
export type FetchLike = (url: string, init: FetchInit) => Promise<{status: number; json(): Promise<unknown>}>;

export class RpcForbidden extends Error {
  constructor(what: string) {
    super(`${what}: refused by the coordinator (HTTP 403); not retried`);
    this.name = 'RpcForbidden';
  }
}
export class RpcMethodRefused extends Error {
  constructor(method: string) {
    super(`${method} is not on the RPC allowlist; no request was sent`);
    this.name = 'RpcMethodRefused';
  }
}
export class RpcHttpError extends Error {
  readonly status: number;
  constructor(what: string, status: number) {
    super(`${what}: HTTP ${status}`);
    this.name = 'RpcHttpError';
    this.status = status;
  }
}
export class RpcResponseError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(`RPC error ${code}: ${message}`);
    this.name = 'RpcResponseError';
    this.code = code;
  }
}
export class RpcMalformed extends Error {
  constructor(what: string) {
    super(`malformed RPC response: ${what}`);
    this.name = 'RpcMalformed';
  }
}

export type FetchResponse = {status: number; json(): Promise<unknown>};

/** Where a latch keeps the end of its cool-down across service-worker restarts (Task 9: storage.local). */
export interface LatchStore {
  load(): Promise<number>;
  save(until: number): Promise<void>;
}

/**
 * One per coordinator: the RPC, the broadcast route and the JSON reads share it. Requests go out
 * ONE AT A TIME, in call order: concurrent reads (a Promise.all) would otherwise all be on the wire
 * before the first 403 came back — a burst of 403s, which is exactly what CrowdSec bans. When a
 * queued request's turn comes after a 403, it is refused without being sent.
 */
export interface ForbiddenLatch {
  request(what: string, send: () => Promise<FetchResponse>): Promise<FetchResponse>;
}

export function createForbiddenLatch(opts: {now?: () => number; store?: LatchStore} = {}): ForbiddenLatch {
  const now = opts.now ?? Date.now;
  let until = 0;
  let loaded: Promise<void> | null = null;
  let tail: Promise<unknown> = Promise.resolve();
  const load = (): Promise<void> => {
    loaded ??= (opts.store?.load() ?? Promise.resolve(0)).then(
      v => {
        if (Number.isFinite(v)) until = Math.max(until, v);
      },
      () => undefined,
    );
    return loaded;
  };
  return {
    request(what, send) {
      const turn = async (): Promise<FetchResponse> => {
        await load();
        if (now() < until) throw new RpcForbidden(`${what} (cooling down after an earlier 403)`);
        const res = await send();
        if (res.status === 403) {
          until = now() + FORBIDDEN_COOLDOWN_MS;
          await opts.store?.save(until).catch(() => undefined);
          throw new RpcForbidden(what);
        }
        return res;
      };
      const result = tail.then(turn, turn);
      tail = result.catch(() => undefined);
      return result;
    },
  };
}

export interface Rpc {
  call<M extends RpcMethod>(method: M, params: readonly unknown[]): Promise<unknown>;
}

const isAllowed = (m: string): m is RpcMethod => (ALLOWED_RPC_METHODS as readonly string[]).includes(m);

export function createRpc(opts: {fetch: FetchLike; latch: ForbiddenLatch; endpoint?: string}): Rpc {
  const endpoint = opts.endpoint ?? RPC_ENDPOINT;
  let id = 0;
  return {
    async call(method, params) {
      // The type already refuses other strings; this refuses a cast or a computed name.
      if (!isAllowed(method)) throw new RpcMethodRefused(method);
      id += 1;
      const body = JSON.stringify({jsonrpc: '2.0', id, method, params});
      // Through the latch: one request at a time, and a 403 is terminal for every queued one.
      const res = await opts.latch.request(method, () =>
        opts.fetch(endpoint, {method: 'POST', headers: {'content-type': 'application/json'}, body, credentials: 'omit'}),
      );
      if (res.status !== 200) throw new RpcHttpError(method, res.status);
      const answer = await res.json();
      if (typeof answer !== 'object' || answer === null) throw new RpcMalformed(`${method}: not an object`);
      const {error} = answer as {error?: {code?: unknown; message?: unknown} | null};
      if (error !== undefined && error !== null) {
        throw new RpcResponseError(typeof error.code === 'number' ? error.code : 0, typeof error.message === 'string' ? error.message : 'unknown');
      }
      if (!('result' in answer)) throw new RpcMalformed(`${method}: no result`);
      return (answer as {result: unknown}).result;
    },
  };
}

export interface SignatureStatus {
  err: unknown;
  confirmationStatus: 'processed' | 'confirmed' | 'finalized' | null;
}
export interface TokenAccountEntry {
  pubkey: string;
  mint: string;
  owner: string;
  amount: bigint;
  decimals: number;
}
export interface SignatureInfo {
  signature: string;
  blockTime: number | null;
  err: unknown;
}
export interface SimulationOutcome {
  err: unknown;
  logs: string[];
  unitsConsumed: number | null;
}

/** Every chain read the extension makes, typed. The only way to reach the RPC above. */
export interface SolanaReader {
  getBalance(owner: string): Promise<bigint>;
  getAccountExists(address: string): Promise<boolean>;
  getMultipleLamports(addresses: readonly string[]): Promise<bigint[]>;
  getLatestBlockhash(): Promise<{blockhash: string; lastValidBlockHeight: number}>;
  getBlockHeight(): Promise<number>;
  getSignatureStatuses(signatures: readonly string[], searchTransactionHistory?: boolean): Promise<(SignatureStatus | null)[]>;
  getRecentPrioritizationFees(): Promise<{prioritizationFee: number}[]>;
  simulateTransaction(transactionBase64: string): Promise<SimulationOutcome>;
  getTokenAccountsByOwner(owner: string, filter: {mint: string} | {programId: string}): Promise<TokenAccountEntry[]>;
  getSignaturesForAddress(address: string, opts: {limit: number; before?: string}): Promise<SignatureInfo[]>;
  getTransaction(signature: string): Promise<unknown>;
}

const COMMITMENT = {commitment: 'confirmed'} as const;

type Json = Record<string, unknown>;
function obj(x: unknown, what: string): Json {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) throw new RpcMalformed(what);
  return x as Json;
}
function list(x: unknown, what: string): unknown[] {
  if (!Array.isArray(x)) throw new RpcMalformed(what);
  return x as unknown[];
}
/** A non-negative integer. Lamports above 2^53 lose precision in JSON itself; that is the RPC's format. */
function count(x: unknown, what: string): number {
  if (typeof x !== 'number' || !Number.isInteger(x) || x < 0) throw new RpcMalformed(what);
  return x;
}
function text(x: unknown, what: string): string {
  if (typeof x !== 'string' || x.length === 0) throw new RpcMalformed(what);
  return x;
}
function valueOf(result: unknown, what: string): unknown {
  const o = obj(result, what);
  if (!('value' in o)) throw new RpcMalformed(`${what}: no value`);
  return o.value;
}

function signatureStatus(x: unknown): SignatureStatus | null {
  if (x === null) return null;
  const s = obj(x, 'getSignatureStatuses entry');
  const c = s.confirmationStatus;
  return {err: s.err ?? null, confirmationStatus: c === 'processed' || c === 'confirmed' || c === 'finalized' ? c : null};
}

function tokenAccount(x: unknown): TokenAccountEntry {
  const e = obj(x, 'token account');
  const data = obj(obj(e.account, 'token account.account').data, 'token account data');
  const info = obj(obj(data.parsed, 'token account parsed').info, 'token account info');
  const tokenAmount = obj(info.tokenAmount, 'tokenAmount');
  const amount = text(tokenAmount.amount, 'tokenAmount.amount');
  if (!/^\d+$/.test(amount)) throw new RpcMalformed('tokenAmount.amount');
  return {
    pubkey: text(e.pubkey, 'pubkey'),
    mint: text(info.mint, 'mint'),
    owner: text(info.owner, 'owner'),
    amount: BigInt(amount),
    decimals: count(tokenAmount.decimals, 'decimals'),
  };
}

export function solanaReader(rpc: Rpc): SolanaReader {
  return {
    async getBalance(owner) {
      return BigInt(count(valueOf(await rpc.call('getBalance', [owner, COMMITMENT]), 'getBalance'), 'getBalance.value'));
    },
    async getAccountExists(address) {
      return valueOf(await rpc.call('getAccountInfo', [address, {encoding: 'base64', ...COMMITMENT}]), 'getAccountInfo') !== null;
    },
    async getMultipleLamports(addresses) {
      const params = [addresses, {encoding: 'base64', dataSlice: {offset: 0, length: 0}, ...COMMITMENT}];
      const v = list(valueOf(await rpc.call('getMultipleAccounts', params), 'getMultipleAccounts'), 'getMultipleAccounts.value');
      if (v.length !== addresses.length) throw new RpcMalformed('getMultipleAccounts: wrong length');
      return v.map(a => (a === null ? 0n : BigInt(count(obj(a, 'account').lamports, 'lamports'))));
    },
    async getLatestBlockhash() {
      const v = obj(valueOf(await rpc.call('getLatestBlockhash', [COMMITMENT]), 'getLatestBlockhash'), 'getLatestBlockhash.value');
      return {blockhash: text(v.blockhash, 'blockhash'), lastValidBlockHeight: count(v.lastValidBlockHeight, 'lastValidBlockHeight')};
    },
    async getBlockHeight() {
      return count(await rpc.call('getBlockHeight', [COMMITMENT]), 'getBlockHeight');
    },
    async getSignatureStatuses(signatures, searchTransactionHistory = false) {
      const result = await rpc.call('getSignatureStatuses', [signatures, {searchTransactionHistory}]);
      const v = list(valueOf(result, 'getSignatureStatuses'), 'getSignatureStatuses.value');
      if (v.length !== signatures.length) throw new RpcMalformed('getSignatureStatuses: wrong length');
      return v.map(signatureStatus);
    },
    async getRecentPrioritizationFees() {
      // A non-number becomes NaN, which estimatePriorityFee discards — the RPC is untrusted.
      return list(await rpc.call('getRecentPrioritizationFees', []), 'getRecentPrioritizationFees').map(f => {
        const fee = obj(f, 'prioritization fee').prioritizationFee;
        return {prioritizationFee: typeof fee === 'number' ? fee : Number.NaN};
      });
    },
    async simulateTransaction(transactionBase64) {
      const params = [transactionBase64, {encoding: 'base64', sigVerify: false, replaceRecentBlockhash: false, ...COMMITMENT}];
      const v = obj(valueOf(await rpc.call('simulateTransaction', params), 'simulateTransaction'), 'simulateTransaction.value');
      const logs = Array.isArray(v.logs) ? (v.logs as unknown[]).filter((l): l is string => typeof l === 'string') : [];
      return {err: v.err ?? null, logs, unitsConsumed: typeof v.unitsConsumed === 'number' ? v.unitsConsumed : null};
    },
    async getTokenAccountsByOwner(owner, filter) {
      const result = await rpc.call('getTokenAccountsByOwner', [owner, filter, {encoding: 'jsonParsed', ...COMMITMENT}]);
      return list(valueOf(result, 'getTokenAccountsByOwner'), 'getTokenAccountsByOwner.value').map(tokenAccount);
    },
    async getSignaturesForAddress(address, opts) {
      const config = opts.before === undefined ? {limit: opts.limit, ...COMMITMENT} : {limit: opts.limit, before: opts.before, ...COMMITMENT};
      return list(await rpc.call('getSignaturesForAddress', [address, config]), 'getSignaturesForAddress').map(x => {
        const s = obj(x, 'signature info');
        return {signature: text(s.signature, 'signature'), blockTime: typeof s.blockTime === 'number' ? s.blockTime : null, err: s.err ?? null};
      });
    },
    async getTransaction(signature) {
      return rpc.call('getTransaction', [signature, {encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, ...COMMITMENT}]);
    },
  };
}
