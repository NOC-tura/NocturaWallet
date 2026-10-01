import type {JsonGetter} from '../../../core/ports';
import type {Ext} from '../ext';
import {API_BASE, RequestUnreachable, RpcHttpError, createForbiddenLatch, createRpc, solanaReader, type FetchLike, type ForbiddenLatch, type LatchStore, type SolanaReader} from '../../../core/solana/rpc';
import {PRESALE_STAGE_PRICES} from '../../../core/presale/stagePrices';
import {broadcastSigned} from '../../../core/solana/broadcast';
import {fetchUsdPrices} from '../../../core/portfolio/prices';
import type {Prices} from '../../../core/portfolio/value';

/**
 * Everything the wallet engine needs from outside: chain reads, the broadcast route, prices, time
 * and randomness. browserDeps() is the real one; tests pass a fake, so no unit test reaches the
 * network.
 */
export interface WalletDeps {
  reader: SolanaReader;
  /** Sends signed wire bytes through the coordinator's broadcast route; resolves to the verified signature. */
  broadcast(wire: Uint8Array): Promise<string>;
  /** USD prices for SOL, USDC and USDT. */
  prices(): Promise<Prices>;
  /** USD per NOC at the current presale stage (owner decision B), or null when /stats does not say it validly. */
  stagePrice(): Promise<number | null>;
  now(): number;
  randomBytes(n: number): Uint8Array;
  sleep(ms: number): Promise<void>;
}

/** Prices are shown to two decimals; a minute is plenty, and the proxy's budget is shared. */
export const PRICE_TTL_MS = 60_000;

/** GET a bare path under API_BASE. A 403 trips the shared latch, like the RPC and the broadcast route. */
export function createJsonGetter(fetch: FetchLike, latch: ForbiddenLatch): JsonGetter {
  return {
    async get<T>(path: string): Promise<T> {
      // Through the shared latch: serialised with the RPC and the broadcast route; a 403 is terminal.
      const res = await latch.request(path, () => fetch(`${API_BASE}${path}`, {method: 'GET', credentials: 'omit'}));
      if (res.status !== 200) throw new RpcHttpError(path, res.status);
      return (await res.json()) as T;
    },
  };
}

/**
 * NOC's USD price for the dollar re-auth rule, read strictly from a /stats body. NOT web's
 * fetchPresaleStats: that maps a missing currentStage to stage 1 — the lowest price — which is right
 * for a display but would under-value NOC here and skip a re-authentication (fail open). Here a
 * missing, non-integer or unknown stage, or a price that is not a positive finite number, is null,
 * and null counts as above the threshold. web's own display is unchanged.
 */
export function stagePriceFrom(body: unknown): number | null {
  if (typeof body !== 'object' || body === null) return null;
  const {success, data} = body as {success?: unknown; data?: unknown};
  if (success !== true || typeof data !== 'object' || data === null) return null;
  const stage = (data as {currentStage?: unknown}).currentStage;
  if (typeof stage !== 'number' || !Number.isSafeInteger(stage) || stage < 0 || stage >= PRESALE_STAGE_PRICES.length) return null;
  const price = PRESALE_STAGE_PRICES[stage];
  return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : null;
}

/**
 * How long one coordinator request may take. The latch serialises every request, so one that never
 * answers — CrowdSec answers some users (CGNAT, VPN, Tor) with silence, not an error — would
 * otherwise freeze balances, history, prepare, broadcast and the confirmation poller behind it.
 */
export const REQUEST_TIMEOUT_MS = 20_000;
/** The broadcast route forwards to the network before answering: a little longer. */
export const BROADCAST_TIMEOUT_MS = 30_000;

export {RequestUnreachable};

/** A coordinator request got no answer in time. Not a 403: it never trips the cool-down. Unreachable, like a rejected fetch. */
export class RequestTimedOut extends RequestUnreachable {
  constructor(url: string, ms: number) {
    super(url, `no answer within ${ms} ms; aborted`);
    this.name = 'RequestTimedOut';
  }
}

/**
 * globalThis.fetch with a deadline covering the response AND its body: the request is aborted and
 * the promise rejected when the deadline passes — even if the fetch ignored the abort — so the
 * latch moves on to the next request. The timer is cleared as soon as the body is read (or the
 * fetch fails), so a finished request leaves nothing behind. A fetch that rejects (DNS, offline, a
 * reset connection) becomes RequestUnreachable, as a deadline does: "no answer", never "failed".
 */
export function timedFetch(ms: number): FetchLike {
  return async (url, init) => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new RequestTimedOut(url, ms));
      }, ms);
    });
    const done = () => clearTimeout(timer);
    try {
      const res = await Promise.race([globalThis.fetch(url, {...init, signal: controller.signal}), deadline]);
      return {
        status: res.status,
        json: async () => {
          try {
            return (await Promise.race([res.json(), deadline])) as unknown;
          } finally {
            done();
          }
        },
      };
    } catch (e) {
      done();
      if (e instanceof RequestUnreachable) throw e;
      throw new RequestUnreachable(url, `the request failed (${e instanceof Error ? e.message : String(e)})`);
    }
  };
}

/** storage.local, background-owned: the end of a 403 cool-down, so a restarted worker keeps it (review M3). */
export const FORBIDDEN_UNTIL_KEY = 'v1_forbidden_until';

export function latchStore(ext: Ext): LatchStore {
  return {
    load: async () => {
      const v = await ext.local.get(FORBIDDEN_UNTIL_KEY);
      return typeof v === 'number' && Number.isFinite(v) ? v : 0;
    },
    save: until => ext.local.set(FORBIDDEN_UNTIL_KEY, until),
  };
}

/**
 * The background's real deps: ONE latch for every coordinator route (the RPC, the broadcast route
 * and the JSON reads), so one 403 silences them all; its cool-down is persisted, so a restarted
 * service worker keeps it. Build this once per background instance.
 */
export function browserDeps(ext: Ext): WalletDeps {
  const fetch = timedFetch(REQUEST_TIMEOUT_MS);
  const broadcastFetch = timedFetch(BROADCAST_TIMEOUT_MS);
  const latch = createForbiddenLatch({store: latchStore(ext)});
  const get = createJsonGetter(fetch, latch);
  let cache: {at: number; prices: Prices} | null = null;
  let stage: {at: number; price: number} | null = null;
  return {
    reader: solanaReader(createRpc({fetch, latch})),
    broadcast: wire => broadcastSigned({fetch: broadcastFetch, latch}, wire),
    async prices() {
      const now = Date.now();
      if (cache !== null && now - cache.at < PRICE_TTL_MS) return cache.prices;
      const prices = await fetchUsdPrices(get);
      cache = {at: now, prices};
      return prices;
    },
    // Owner decision B: NOC at the current presale stage price, read as web/ reads it (/stats).
    async stagePrice() {
      const now = Date.now();
      if (stage !== null && now - stage.at < PRICE_TTL_MS) return stage.price;
      const price = stagePriceFrom(await get.get<unknown>('/stats'));
      if (price !== null) stage = {at: now, price};
      return price;
    },
    now: () => Date.now(),
    // A CSPRNG: ids for prepared sends, pending records and re-auth challenges.
    randomBytes: n => globalThis.crypto.getRandomValues(new Uint8Array(n)),
    sleep: ms => new Promise<void>(resolve => setTimeout(resolve, ms)),
  };
}
