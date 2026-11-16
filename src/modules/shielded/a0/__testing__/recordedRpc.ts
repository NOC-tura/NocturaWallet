/**
 * TEST-ONLY: a recorded-RPC devnet for the A0 tree sync (never imported by app code).
 *
 * The REAL `Connection` of @solana/web3.js (the suite's `realWeb3` mock line makes the import
 * below the real library) with a custom `fetch` that answers JSON-RPC from a recorded chain — so
 * the code under test goes through web3.js's own request building and its own response parsing
 * (superstruct + `versionedMessageFromResponse`), exactly as on the phone. Only the HTTP hop is
 * replaced.
 *
 * The fake implements just what the recorder (`scripts/a0-fixtures/record-devnet-tree.mjs`)
 * recorded, and refuses anything else as a JSON-RPC error, so a sync that asks for another
 * method, another encoding or another config fails its test instead of being answered:
 *   - getSignaturesForAddress(<addr>, {limit, before?, until?, commitment}) — `before` / `until`
 *     exclusive, newest first, like the RPC; an unknown `before` / `until` is an error (the real
 *     RPC's answer there is not something a test should lean on); another address → [];
 *   - getTransaction(<sig>, {commitment, maxSupportedTransactionVersion: 0}) — JSON encoding
 *     only (the recording's), `null` for an unknown signature;
 *   - getAccountInfo(<addr>, {encoding: 'base64', commitment}) — the recorded tree, else null.
 * Every request is appended to `requests` (method + params), for the I-3 assertions of Task 3.
 */
import {Connection} from '@solana/web3.js';

export interface RecordedSignature {
  signature: string;
  slot: number;
  err: unknown;
  memo: string | null;
  blockTime: number | null;
  confirmationStatus: string;
}

/** A recorded transaction as the RPC answered it (JSON encoding) — fields the tests edit are typed. */
export interface RecordedTx {
  slot: number;
  blockTime: number | null;
  meta: {
    err: unknown;
    logMessages: string[];
    preBalances: number[];
    [k: string]: unknown;
  };
  transaction: {
    signatures: string[];
    message: {
      accountKeys: string[];
      instructions: {programIdIndex: number; accounts: number[]; data: string}[];
      [k: string]: unknown;
    };
  };
  [k: string]: unknown;
}

export interface RecordedChain {
  tree: string;
  /** newest first, as getSignaturesForAddress lists them */
  signatures: RecordedSignature[];
  transactions: Record<string, RecordedTx>;
  account: {context: {slot: number; [k: string]: unknown}; value: {data: [string, string]; owner: string; [k: string]: unknown} | null};
}

export interface RecordedFixture {
  tree: string;
  signatures: RecordedSignature[];
  transactions: Record<string, RecordedTx>;
  account: RecordedChain['account'];
}

/** A deep copy the test may edit. */
export function chainFrom(fixture: RecordedFixture): RecordedChain {
  return JSON.parse(
    JSON.stringify({
      tree: fixture.tree,
      signatures: fixture.signatures,
      transactions: fixture.transactions,
      account: fixture.account,
    }),
  ) as RecordedChain;
}

export interface RpcRequest {
  method: string;
  params: unknown[];
}

class RpcRefusal extends Error {}

function answer(chain: RecordedChain, method: string, params: unknown[]): unknown {
  const cfg = (params[1] ?? {}) as Record<string, unknown>;
  const commitmentOk = cfg.commitment === 'confirmed' || cfg.commitment === 'finalized';
  if (method === 'getSignaturesForAddress') {
    const extra = Object.keys(cfg).filter(k => !['limit', 'before', 'until', 'commitment'].includes(k));
    if (!commitmentOk || extra.length || typeof cfg.limit !== 'number') {
      throw new RpcRefusal(`getSignaturesForAddress config ${JSON.stringify(cfg)}`);
    }
    if (params[0] !== chain.tree) {
      return [];
    }
    const list = chain.signatures;
    const pos = (sig: unknown): number => {
      const i = list.findIndex(s => s.signature === sig);
      if (i < 0) {
        throw new RpcRefusal(`unknown signature ${String(sig)}`);
      }
      return i;
    };
    const start = cfg.before === undefined ? 0 : pos(cfg.before) + 1;
    const end = cfg.until === undefined ? list.length : pos(cfg.until);
    return list.slice(start, Math.max(start, end)).slice(0, cfg.limit);
  }
  if (method === 'getTransaction') {
    const keys = Object.keys(cfg).sort().join(',');
    if (!commitmentOk || keys !== 'commitment,maxSupportedTransactionVersion' || cfg.maxSupportedTransactionVersion !== 0) {
      throw new RpcRefusal(`getTransaction config ${JSON.stringify(cfg)} (the recording is JSON, v0-capable)`);
    }
    return chain.transactions[String(params[0])] ?? null;
  }
  if (method === 'getAccountInfo') {
    if (!commitmentOk || cfg.encoding !== 'base64') {
      throw new RpcRefusal(`getAccountInfo config ${JSON.stringify(cfg)}`);
    }
    return {
      context: chain.account.context,
      value: params[0] === chain.tree ? chain.account.value : null,
    };
  }
  throw new RpcRefusal(`method ${method} is not recorded`);
}

/** The real Connection over a recorded chain, and the log of every request it made. */
export function recordedConnection(chain: RecordedChain): {
  connection: Connection;
  requests: RpcRequest[];
} {
  const requests: RpcRequest[] = [];
  const fakeFetch = async (_url: unknown, init?: {body?: unknown}) => {
    const body = JSON.parse(String(init?.body)) as {id: unknown; method: string; params?: unknown[]};
    const params = body.params ?? [];
    requests.push({method: body.method, params: JSON.parse(JSON.stringify(params)) as unknown[]});
    let payload: unknown;
    try {
      payload = {jsonrpc: '2.0', id: body.id, result: answer(chain, body.method, params)};
    } catch (e) {
      if (!(e instanceof RpcRefusal)) {
        throw e;
      }
      payload = {jsonrpc: '2.0', id: body.id, error: {code: -32602, message: `recordedRpc: ${e.message}`}};
    }
    const text = JSON.stringify(payload);
    return {ok: true, status: 200, statusText: 'OK', text: async () => text, json: async () => payload};
  };
  const connection = new Connection('https://recorded.invalid', {
    commitment: 'confirmed',
    fetch: fakeFetch as unknown as typeof fetch,
    disableRetryOnRateLimit: true,
  });
  return {connection, requests};
}
