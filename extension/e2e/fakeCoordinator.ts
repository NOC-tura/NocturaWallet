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
 * A simulated coordinator: the read proxy for the methods the engine uses, the broadcast route
 * with the contract this plan defines (docs/superpowers/specs/2026-09-29-coordinator-broadcast-route.md),
 * prices and /stats. 10 SOL, no token accounts, quiet fees, simulation always passes. Every
 * getLatestBlockhash hands out a fresh blockhash valid for BLOCKHASH_LIFETIME blocks from the
 * current height, as a real node does.
 */
export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeCoordinator> {
  const fake: FakeCoordinator = {
    mode: 'confirm',
    blockHeight: FAKE_START_HEIGHT,
    hits: [],
    broadcasts: [],
    broadcastWires: [],
    historyChecks: [],
    unexpected: [],
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

  const rpcResult = (method: string, params: unknown[]): unknown => {
    switch (method) {
      case 'getBalance':
        return {context: context(), value: 10_000_000_000};
      case 'getLatestBlockhash':
        return {context: context(), value: {blockhash: base58.encode(randomBytes(32)), lastValidBlockHeight: fake.blockHeight + BLOCKHASH_LIFETIME}};
      case 'getRecentPrioritizationFees':
        return [];
      case 'simulateTransaction':
        return {context: context(), value: {err: null, logs: ['Program 11111111111111111111111111111111 success'], accounts: null, unitsConsumed: 450, returnData: null}};
      case 'getTokenAccountsByOwner':
        return {context: context(), value: []};
      case 'getMultipleAccounts':
        return {context: context(), value: (params[0] as unknown[]).map(() => null)};
      case 'getAccountInfo':
        return {context: context(), value: null};
      case 'getBlockHeight':
        return fake.blockHeight;
      case 'getSignatureStatuses': {
        const config = params[1] as {searchTransactionHistory?: boolean} | undefined;
        return signatureStatuses(params[0] as string[], config?.searchTransactionHistory === true);
      }
      case 'getSignaturesForAddress':
        return [];
      case 'getTransaction':
        return null;
      default:
        fake.unexpected.push(`rpc ${method}`);
        return null;
    }
  };

  const json = (route: Route, status: number, body: unknown) => route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)});

  await ctx.route('https://api.noc-tura.io/**', async route => {
    const req = route.request();
    const url = req.url();
    if (url === RPC && req.method() === 'POST') {
      const body = JSON.parse(req.postData() ?? '{}') as {jsonrpc?: string; id?: number; method?: string; params?: unknown[]};
      const method = body.method ?? '';
      fake.hits.push({url, rpcMethod: method});
      if (body.jsonrpc !== '2.0' || !Array.isArray(body.params)) fake.unexpected.push(`rpc ${method}: not a JSON-RPC 2.0 request`);
      return json(route, 200, {jsonrpc: '2.0', id: body.id ?? 0, result: rpcResult(method, body.params ?? [])});
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
