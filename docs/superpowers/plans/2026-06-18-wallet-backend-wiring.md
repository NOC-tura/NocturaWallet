# Wallet → Backend Proxy Wiring (Cycle 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route the wallet's prices, chart, and token-metadata (incl. logos) through the live `api.noc-tura.io` backend proxy (SSL-pinned), with automatic fallback to the existing direct CoinGecko/Helius calls, and add USDT pricing/charting.

**Architecture:** Each data module gains a `…FromBackend()` function (via `pinnedFetch`) and keeps its current direct call renamed `…Direct()`; a thin `fetchX()` wrapper tries backend-first and falls back to direct on any error. Real SPKI SSL pinning is enabled in `pinnedFetch` first (foundational). Hooks/callers are unchanged.

**Tech Stack:** React Native 0.84 (Hermes), TypeScript strict, `react-native-ssl-pinning@1.6.0` (public-key pinning via `pkPinning`), TanStack Query, Jest.

**Working directory:** `/home/user/Solana/Project/NocturaWallet`. Branch `feat/backend-wiring` (already created; spec committed).

> **Backend is LIVE + verified** at `https://api.noc-tura.io/api/v1/wallet/{prices,chart,tokens/metadata,img}` (Cycle 1).

---

## File Structure

- `src/modules/sslPinning/pinnedFetch.ts` — **Modify.** Enable `pkPinning: true`; real `sha256/…` pins.
- `src/modules/sslPinning/__tests__/pinnedFetch.test.ts` — **Modify.** Assert `pkPinning: true`.
- `src/modules/tokens/coreTokens.ts` — **Modify.** Export `USDT_MINT`.
- `src/constants/programs.ts` — **Modify.** Export guarded `API_ORIGIN`.
- `.env.production`, `.env.development`, `.env.example` — **Modify.** `API_BASE` → `…/api/v1`.
- `src/modules/prices/priceModule.ts` — **Modify.** Backend-first + USDT.
- `src/modules/prices/priceHistory.ts` — **Modify.** Backend-first + USDT chart case.
- `src/modules/tokens/tokenMetadata.ts` — **Modify.** Backend-first + proxy image URL.
- Tests: `priceModule.test.ts`, `priceHistory.test.ts`, `tokenMetadata.test.ts` — **Modify** (rewrite for the 3 paths).

---

## Task 1: Enable real SPKI SSL pinning in `pinnedFetch`

**Files:**
- Modify: `src/modules/sslPinning/pinnedFetch.ts`
- Test: `src/modules/sslPinning/__tests__/pinnedFetch.test.ts`

- [ ] **Step 1: Update the failing test first — assert `pkPinning: true`**

In `src/modules/sslPinning/__tests__/pinnedFetch.test.ts`, replace the `'makes a GET request through SSL pinning'` test body with:
```ts
  it('makes a GET request through SSL pinning with public-key pinning enabled', async () => {
    await pinnedFetch('https://api.noc-tura.io/api/v1/health');
    expect(SSLPinning.fetch).toHaveBeenCalledWith(
      'https://api.noc-tura.io/api/v1/health',
      expect.objectContaining({
        method: 'GET',
        pkPinning: true,
        sslPinning: expect.objectContaining({
          certs: expect.any(Array),
        }),
      }),
    );
  });

  it('all SSL_PINS use the sha256/ public-key format', () => {
    SSL_PINS.forEach(pin => expect(pin.startsWith('sha256/')).toBe(true));
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest pinnedFetch`
Expected: FAIL — `pkPinning` not passed / pins lack `sha256/` prefix.

- [ ] **Step 3: Enable `pkPinning` and set real-format pins**

In `src/modules/sslPinning/pinnedFetch.ts`, replace the `SSL_PINS` declaration:
```ts
/**
 * SPKI public-key pins for api.noc-tura.io (SHA-256 of the SubjectPublicKeyInfo,
 * `sha256/<base64>` — OkHttp/AFNetworking format). The lib matches ANY cert in
 * the served chain, so we pin the leaf AND the Let's Encrypt intermediate:
 * a leaf renewal (even with a new key) still validates against the intermediate,
 * so certbot rotation can't brick the app. Server should also renew with
 * `--reuse-key` to keep the leaf pin stable.
 *
 * Extract real values (see docs/superpowers/specs/2026-06-18-wallet-backend-wiring-design.md §A)
 * and replace the placeholders below before the on-device build. Until then,
 * backend calls fail the pin check and the app falls back to the direct path.
 */
// Verified from the VPS 2026-06-18 (both MATCH the live cert). Server renews
// with reuse_key=True so the LEAF pin survives ~90-day Let's Encrypt renewals;
// the INTERMEDIATE is the backup. A systemd noc-pin-check.timer monitors these
// daily. RULE on rotation: update BOTH this array AND the server's
// scripts/check-ssl-pins.sh, and ship the new app version BEFORE the new cert.
export const SSL_PINS: string[] = [
  'sha256/r6OlpjBVoTMRSS9o9JFTgtzC8KyrVYI6OAmKQGhf9Y8=', // LEAF (primary)
  'sha256/iFvwVyJSxnQdyaUvUERIf+8qk7gRze3612JMwoO3zdU=', // INTERMEDIATE Let's Encrypt (backup)
];
```
And in the `SSLPinning.fetch(...)` options object, add `pkPinning: true` directly above the `sslPinning:` key:
```ts
      pkPinning: true,
      sslPinning: {
        certs: SSL_PINS,
      },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest pinnedFetch`
Expected: PASS — all pinnedFetch tests (incl. the two updated/added).

- [ ] **Step 5: Commit**

```bash
git add src/modules/sslPinning/pinnedFetch.ts src/modules/sslPinning/__tests__/pinnedFetch.test.ts
git commit -m "feat(security): enable SPKI public-key pinning (pkPinning) in pinnedFetch"
```

> **NOTE:** the pins above are the REAL verified values — no placeholder swap needed later.

---

## Task 2: `USDT_MINT` constant + guarded `API_ORIGIN`

**Files:**
- Modify: `src/modules/tokens/coreTokens.ts`
- Modify: `src/constants/programs.ts`

- [ ] **Step 1: Add `USDT_MINT` to coreTokens**

In `src/modules/tokens/coreTokens.ts`, directly after the `export const USDC_MINT = '…';` line, add:
```ts
export const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
```

- [ ] **Step 2: Add guarded `API_ORIGIN` to programs.ts**

In `src/constants/programs.ts`, directly after the `export const API_BASE = Config.API_BASE;` line, add:
```ts
// Origin of API_BASE (e.g. https://api.noc-tura.io) — used to absolutize the
// backend's relative image-proxy paths. Guarded so a missing/blank API_BASE
// can't throw at import time (new URL is available via react-native-url-polyfill).
export const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE).origin;
  } catch {
    return '';
  }
})();
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from these two files.

- [ ] **Step 4: Commit**

```bash
git add src/modules/tokens/coreTokens.ts src/constants/programs.ts
git commit -m "feat: add USDT_MINT + guarded API_ORIGIN constants"
```

---

## Task 3: Point `API_BASE` at `/api/v1`

**Files:**
- Modify: `.env.production`, `.env.development`, `.env.example`

- [ ] **Step 1: Update the three env files**

- `.env.production` line 4: `API_BASE=https://api.noc-tura.io/api/v1`
- `.env.development` line 4: `API_BASE=http://localhost:3001/api/v1`
- `.env.example` line 7: `API_BASE=http://localhost:3001/api/v1`

(Only the `API_BASE` value changes in each; leave all other vars untouched.)

- [ ] **Step 2: Verify the values**

Run: `grep -n '^API_BASE=' .env.production .env.development .env.example`
Expected: all three end in `/api/v1`.

- [ ] **Step 3: Commit**

```bash
git add .env.production .env.development .env.example
git commit -m "chore: point API_BASE at coordinator /api/v1"
```

---

## Task 4: Prices — backend-first + USDT (`priceModule.ts`)

**Files:**
- Modify: `src/modules/prices/priceModule.ts`
- Test: `src/modules/prices/__tests__/priceModule.test.ts`

- [ ] **Step 1: Rewrite the test for the three paths**

Replace the entire contents of `src/modules/prices/__tests__/priceModule.test.ts` with:
```ts
import {fetchPrices} from '../priceModule';
import {USDC_MINT, USDT_MINT} from '../../tokens/coreTokens';
import {pinnedFetch} from '../../sslPinning/pinnedFetch';

jest.mock('../../sslPinning/pinnedFetch');
const mockPinned = pinnedFetch as jest.Mock;

const backendBody = {
  success: true,
  data: {
    solana: {usd: 178.42, usd_24h_change: 2.34},
    'usd-coin': {usd: 0.999, usd_24h_change: 0.01},
    tether: {usd: 1.0, usd_24h_change: -0.02},
  },
};
const cgBody = {
  solana: {usd: 150, usd_24h_change: 1.1},
  'usd-coin': {usd: 1.0, usd_24h_change: 0.0},
  tether: {usd: 0.999, usd_24h_change: 0.05},
};

afterEach(() => {
  mockPinned.mockReset();
  (global.fetch as jest.Mock | undefined)?.mockReset?.();
});

describe('fetchPrices', () => {
  it('uses the backend and maps SOL/USDC/USDT (no direct call)', async () => {
    mockPinned.mockResolvedValue({status: 200, json: async () => backendBody});
    global.fetch = jest.fn() as unknown as typeof fetch;

    const prices = await fetchPrices();
    expect(prices.native).toEqual({usd: 178.42, change24h: 2.34});
    expect(prices[USDC_MINT]).toEqual({usd: 0.999, change24h: 0.01});
    expect(prices[USDT_MINT]).toEqual({usd: 1.0, change24h: -0.02});
    expect(mockPinned).toHaveBeenCalledWith(
      expect.stringContaining('/wallet/prices?ids=solana,usd-coin,tether'),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls back to direct CoinGecko when the backend fails', async () => {
    mockPinned.mockRejectedValue(new Error('pin fail'));
    global.fetch = jest.fn(async () => ({ok: true, status: 200, json: async () => cgBody})) as unknown as typeof fetch;

    const prices = await fetchPrices();
    expect(prices.native).toEqual({usd: 150, change24h: 1.1});
    expect(prices[USDT_MINT]).toEqual({usd: 0.999, change24h: 0.05});
    expect(global.fetch).toHaveBeenCalled();
  });

  it('throws when both backend and direct fail', async () => {
    mockPinned.mockRejectedValue(new Error('pin fail'));
    global.fetch = jest.fn(async () => ({ok: false, status: 503, json: async () => ({})})) as unknown as typeof fetch;
    await expect(fetchPrices()).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest priceModule`
Expected: FAIL — `fetchPrices` still calls CoinGecko directly / USDT missing / `pinnedFetch` not used.

- [ ] **Step 3: Rewrite `priceModule.ts`**

Replace the entire contents of `src/modules/prices/priceModule.ts` with:
```ts
import {USDC_MINT, USDT_MINT} from '../tokens/coreTokens';
import {API_BASE, COINGECKO_API_KEY} from '../../constants/programs';
import {pinnedFetch} from '../sslPinning/pinnedFetch';

export interface TokenPrice {
  usd: number;
  change24h: number | null; // percent; null when unknown
}

/**
 * Auth header for CoinGecko when a Demo API key is configured (lifts the
 * ~2/min public-tier limit to ~30/min). Empty → public tier (no header).
 */
export function coingeckoHeaders(): Record<string, string> | undefined {
  return COINGECKO_API_KEY ? {'x-cg-demo-api-key': COINGECKO_API_KEY} : undefined;
}

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=solana,usd-coin,tether&vs_currencies=usd&include_24hr_change=true';

interface CoinGeckoEntry {
  usd?: number;
  usd_24h_change?: number;
}

function mapEntries(d: Record<string, CoinGeckoEntry>): Record<string, TokenPrice> {
  const sol = d.solana;
  const usdc = d['usd-coin'];
  const usdt = d.tether;
  if (sol?.usd == null || usdc?.usd == null || usdt?.usd == null) {
    throw new Error('price response missing SOL/USDC/USDT');
  }
  return {
    native: {usd: sol.usd, change24h: sol.usd_24h_change ?? null},
    [USDC_MINT]: {usd: usdc.usd, change24h: usdc.usd_24h_change ?? null},
    [USDT_MINT]: {usd: usdt.usd, change24h: usdt.usd_24h_change ?? null},
  };
}

/** Backend proxy (privacy + shared rate limit), SSL-pinned. Throws on failure. */
export async function fetchPricesFromBackend(): Promise<Record<string, TokenPrice>> {
  const res = await pinnedFetch(`${API_BASE}/wallet/prices?ids=solana,usd-coin,tether`);
  if (res.status !== 200) {
    throw new Error(`backend prices HTTP ${res.status}`);
  }
  const body = (await res.json()) as {success?: boolean; data?: Record<string, CoinGeckoEntry>};
  if (!body.success || !body.data) {
    throw new Error('backend prices unsuccessful');
  }
  return mapEntries(body.data);
}

/**
 * Direct CoinGecko fallback. Public market data on a third-party host (cert not
 * pinned) → plain fetch with a 6s timeout. Throws on timeout / non-200 / parse.
 */
export async function fetchPricesDirect(): Promise<Record<string, TokenPrice>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(COINGECKO_URL, {signal: controller.signal, headers: coingeckoHeaders()});
    if (!res.ok) {
      throw new Error(`CoinGecko HTTP ${res.status}`);
    }
    return mapEntries((await res.json()) as Record<string, CoinGeckoEntry>);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * SOL + USDC + USDT USD prices and 24h change. Backend-first (privacy); on any
 * backend failure, falls back to direct CoinGecko. Keyed by mint ('native' for
 * SOL). NOC is NOT included (presale-only; the consumer injects it). Throws only
 * when both paths fail; the hook then keeps its last cache.
 */
export async function fetchPrices(): Promise<Record<string, TokenPrice>> {
  try {
    return await fetchPricesFromBackend();
  } catch {
    return fetchPricesDirect();
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest priceModule`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/modules/prices/priceModule.ts src/modules/prices/__tests__/priceModule.test.ts
git commit -m "feat(prices): backend-first via pinnedFetch + USDT, direct CoinGecko fallback"
```

---

## Task 5: Chart — backend-first + USDT case (`priceHistory.ts`)

**Files:**
- Modify: `src/modules/prices/priceHistory.ts`
- Test: `src/modules/prices/__tests__/priceHistory.test.ts`

- [ ] **Step 1: Rewrite the test for the three paths + USDT id**

Replace the entire contents of `src/modules/prices/__tests__/priceHistory.test.ts` with:
```ts
import {fetchPriceHistory, changeOverSeries, coingeckoIdForMint, TIMEFRAME_DAYS} from '../priceHistory';
import {USDC_MINT, USDT_MINT} from '../../tokens/coreTokens';
import {NOC_MINT} from '../../../constants/programs';
import {pinnedFetch} from '../../sslPinning/pinnedFetch';

jest.mock('../../sslPinning/pinnedFetch');
const mockPinned = pinnedFetch as jest.Mock;

afterEach(() => {
  mockPinned.mockReset();
  (global.fetch as jest.Mock | undefined)?.mockReset?.();
});

describe('coingeckoIdForMint', () => {
  it('maps native→solana, USDC→usd-coin, USDT→tether, NOC→null', () => {
    expect(coingeckoIdForMint('native')).toBe('solana');
    expect(coingeckoIdForMint(USDC_MINT)).toBe('usd-coin');
    expect(coingeckoIdForMint(USDT_MINT)).toBe('tether');
    expect(coingeckoIdForMint(NOC_MINT)).toBeNull();
  });
});

describe('changeOverSeries', () => {
  it('returns abs + pct from first→last', () => {
    expect(changeOverSeries([100, 110])).toEqual({absUsd: 10, pct: 10});
  });
  it('returns null for <2 points or first 0', () => {
    expect(changeOverSeries([100])).toBeNull();
    expect(changeOverSeries([0, 5])).toBeNull();
  });
});

describe('fetchPriceHistory', () => {
  it('uses the backend and extracts the price column (no direct call)', async () => {
    mockPinned.mockResolvedValue({
      status: 200,
      json: async () => ({success: true, data: {prices: [[1000, 100], [2000, 110], [3000, 120]]}}),
    });
    global.fetch = jest.fn() as unknown as typeof fetch;

    const r = await fetchPriceHistory('solana', '7D');
    expect(r.prices).toEqual([100, 110, 120]);
    expect(mockPinned).toHaveBeenCalledWith(expect.stringContaining('/wallet/chart?id=solana&days=7'));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls back to direct CoinGecko when the backend fails', async () => {
    mockPinned.mockRejectedValue(new Error('pin fail'));
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({prices: [[1000, 5], [2000, 6]]}),
    })) as unknown as typeof fetch;

    const r = await fetchPriceHistory('tether', '24H');
    expect(r.prices).toEqual([5, 6]);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('throws when both backend and direct fail', async () => {
    mockPinned.mockRejectedValue(new Error('pin fail'));
    global.fetch = jest.fn(async () => ({ok: false, status: 429, json: async () => ({})})) as unknown as typeof fetch;
    await expect(fetchPriceHistory('solana', '24H')).rejects.toThrow();
  });
});

describe('TIMEFRAME_DAYS', () => {
  it('maps timeframes to day counts; 1Y is the longest (free-tier 365d cap)', () => {
    expect(TIMEFRAME_DAYS['24H']).toBe(1);
    expect(TIMEFRAME_DAYS['1Y']).toBe(365);
    expect(Math.max(...Object.values(TIMEFRAME_DAYS))).toBe(365);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest priceHistory`
Expected: FAIL — USDT id unmapped / backend not used.

- [ ] **Step 3: Rewrite `priceHistory.ts`**

Replace the entire contents of `src/modules/prices/priceHistory.ts` with:
```ts
import {USDC_MINT, USDT_MINT} from '../tokens/coreTokens';
import {NOC_MINT, API_BASE} from '../../constants/programs';
import {coingeckoHeaders} from './priceModule';
import {pinnedFetch} from '../sslPinning/pinnedFetch';

export type Timeframe = '24H' | '7D' | '30D' | '1Y';

// CoinGecko's free/public API caps historical data at 365 days (days>365 →
// HTTP 401, error 10012), so '1Y' is the longest range offered.
export const TIMEFRAME_DAYS: Record<Timeframe, number> = {
  '24H': 1,
  '7D': 7,
  '30D': 30,
  '1Y': 365,
};

export interface PriceHistory {
  prices: number[]; // oldest → newest
}

/** CoinGecko id for a mint, or null when the token has no market (NOC). */
export function coingeckoIdForMint(mint: string): string | null {
  if (mint === 'native') return 'solana';
  if (mint === USDC_MINT) return 'usd-coin';
  if (mint === USDT_MINT) return 'tether';
  if (mint === NOC_MINT) return null;
  return null;
}

/** First→last absolute + percent change of a price series; null if undefined. */
export function changeOverSeries(prices: number[]): {absUsd: number; pct: number} | null {
  if (prices.length < 2) return null;
  const first = prices[0];
  const last = prices[prices.length - 1];
  if (first === 0) return null;
  return {absUsd: last - first, pct: ((last - first) / first) * 100};
}

/** Backend proxy (SSL-pinned). Throws on failure. */
export async function fetchPriceHistoryFromBackend(coingeckoId: string, tf: Timeframe): Promise<PriceHistory> {
  const days = TIMEFRAME_DAYS[tf];
  const res = await pinnedFetch(`${API_BASE}/wallet/chart?id=${coingeckoId}&days=${days}`);
  if (res.status !== 200) {
    throw new Error(`backend chart HTTP ${res.status}`);
  }
  const body = (await res.json()) as {success?: boolean; data?: {prices?: [number, number][]}};
  if (!body.success || !Array.isArray(body.data?.prices)) {
    throw new Error('backend chart unsuccessful');
  }
  return {prices: body.data.prices.map(p => p[1])};
}

/**
 * Direct CoinGecko market_chart fallback. Plain fetch (public data, cert not
 * pinned), 8s timeout. Throws on timeout / non-200 / parse.
 */
export async function fetchPriceHistoryDirect(coingeckoId: string, tf: Timeframe): Promise<PriceHistory> {
  const days = TIMEFRAME_DAYS[tf];
  const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=usd&days=${days}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {signal: controller.signal, headers: coingeckoHeaders()});
    if (!res.ok) throw new Error(`CoinGecko market_chart HTTP ${res.status}`);
    const body = (await res.json()) as {prices?: [number, number][]};
    if (!Array.isArray(body.prices)) throw new Error('market_chart missing prices');
    return {prices: body.prices.map(p => p[1])};
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * USD price series for a coin over a timeframe. Backend-first (privacy); on any
 * backend failure, falls back to direct CoinGecko. Throws only when both fail.
 */
export async function fetchPriceHistory(coingeckoId: string, tf: Timeframe): Promise<PriceHistory> {
  try {
    return await fetchPriceHistoryFromBackend(coingeckoId, tf);
  } catch {
    return fetchPriceHistoryDirect(coingeckoId, tf);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest priceHistory`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/prices/priceHistory.ts src/modules/prices/__tests__/priceHistory.test.ts
git commit -m "feat(chart): backend-first via pinnedFetch + USDT, direct CoinGecko fallback"
```

---

## Task 6: Token metadata — backend-first + proxy image URL (`tokenMetadata.ts`)

**Files:**
- Modify: `src/modules/tokens/tokenMetadata.ts`
- Test: `src/modules/tokens/__tests__/tokenMetadata.test.ts`

- [ ] **Step 1: Rewrite the test for the three paths + proxy image**

Replace the entire contents of `src/modules/tokens/__tests__/tokenMetadata.test.ts` with:
```ts
import {fetchTokenMetadata} from '../tokenMetadata';
import {pinnedFetch} from '../../sslPinning/pinnedFetch';
import {API_ORIGIN} from '../../../constants/programs';

jest.mock('../../sslPinning/pinnedFetch');
const mockPinned = pinnedFetch as jest.Mock;

afterEach(() => {
  mockPinned.mockReset();
  (global.fetch as jest.Mock | undefined)?.mockReset?.();
});

const dasResponse = (assets: unknown[]) => ({
  ok: true,
  status: 200,
  json: async () => ({jsonrpc: '2.0', id: 'meta', result: assets}),
});

describe('fetchTokenMetadata (backend path)', () => {
  it('maps backend data and absolutizes the proxy image url', async () => {
    mockPinned.mockResolvedValue({
      status: 200,
      json: async () => ({
        success: true,
        data: {
          MINT_A: {name: 'Bonk', symbol: 'BONK', image: '/api/v1/wallet/img?url=https%3A%2F%2Fx%2Fy.png'},
          MINT_B: {name: 'Foo', symbol: 'FOO'},
        },
      }),
    });
    global.fetch = jest.fn() as unknown as typeof fetch;

    const r = await fetchTokenMetadata(['MINT_A', 'MINT_B']);
    expect(r.MINT_A).toEqual({
      name: 'Bonk',
      symbol: 'BONK',
      logoUri: `${API_ORIGIN}/api/v1/wallet/img?url=https%3A%2F%2Fx%2Fy.png`,
    });
    expect(r.MINT_B).toEqual({name: 'Foo', symbol: 'FOO', logoUri: undefined});
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns {} for an empty mint list without any network call', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    expect(await fetchTokenMetadata([])).toEqual({});
    expect(mockPinned).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('fetchTokenMetadata (direct fallback)', () => {
  it('falls back to Helius DAS (cdn_uri only) when the backend fails', async () => {
    mockPinned.mockRejectedValue(new Error('pin fail'));
    global.fetch = jest.fn(async () =>
      dasResponse([
        {
          id: 'MINT_A',
          content: {
            metadata: {name: 'Bonk', symbol: 'BONK'},
            files: [{uri: 'https://x/y.png', cdn_uri: 'https://cdn.helius-rpc.com/img'}],
          },
        },
      ]),
    ) as unknown as typeof fetch;

    const r = await fetchTokenMetadata(['MINT_A']);
    expect(r.MINT_A).toEqual({name: 'Bonk', symbol: 'BONK', logoUri: 'https://cdn.helius-rpc.com/img'});
    expect(global.fetch).toHaveBeenCalled();
  });

  it('throws when both backend and direct fail', async () => {
    mockPinned.mockRejectedValue(new Error('pin fail'));
    global.fetch = jest.fn(async () => ({ok: false, status: 500, json: async () => ({})})) as unknown as typeof fetch;
    await expect(fetchTokenMetadata(['MINT_A'])).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tokenMetadata`
Expected: FAIL — backend path not implemented.

- [ ] **Step 3: Rewrite `tokenMetadata.ts`**

Replace the entire contents of `src/modules/tokens/tokenMetadata.ts` with:
```ts
import {RPC_ENDPOINT, API_BASE, API_ORIGIN} from '../../constants/programs';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {pinnedFetch} from '../sslPinning/pinnedFetch';

export interface TokenMeta {
  name: string;
  symbol: string;
  logoUri?: string; // absolute URL (backend img proxy) or Helius cdn_uri; undefined when unknown
}

interface DasAsset {
  id: string;
  content?: {
    metadata?: {name?: string; symbol?: string};
    files?: Array<{uri?: string; cdn_uri?: string}>;
  };
}

interface BackendMeta {
  name?: string;
  symbol?: string;
  image?: string; // relative proxy path: /api/v1/wallet/img?url=...
}

/**
 * Backend proxy (SSL-pinned): Helius DAS with the key server-side, and image
 * URLs rewritten through the SSRF-safe img proxy (so logos work for ANY token,
 * not just Helius-CDN ones). `logoUri` is the ABSOLUTE proxy URL. Throws on failure.
 */
export async function fetchTokenMetadataFromBackend(mints: string[]): Promise<Record<string, TokenMeta>> {
  const res = await pinnedFetch(`${API_BASE}/wallet/tokens/metadata`, {
    method: 'POST',
    body: JSON.stringify({mints}),
  });
  if (res.status !== 200) {
    throw new Error(`backend metadata HTTP ${res.status}`);
  }
  const body = (await res.json()) as {success?: boolean; data?: Record<string, BackendMeta>};
  if (!body.success || !body.data) {
    throw new Error('backend metadata unsuccessful');
  }
  const out: Record<string, TokenMeta> = {};
  for (const [mint, m] of Object.entries(body.data)) {
    out[mint] = {
      name: m.name ?? '',
      symbol: m.symbol ?? '',
      logoUri: m.image ? `${API_ORIGIN}${m.image}` : undefined,
    };
  }
  return out;
}

/**
 * Direct Helius DAS fallback (getAssetBatch on the RPC the app already uses for
 * balances — no new party). `logoUri` is ONLY the Helius cdn_uri; we never fall
 * back to the raw image host. Throws on transport/HTTP error.
 */
export async function fetchTokenMetadataDirect(mints: string[]): Promise<Record<string, TokenMeta>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(RPC_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({jsonrpc: '2.0', id: 'meta', method: 'getAssetBatch', params: {ids: mints}}),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`DAS getAssetBatch HTTP ${res.status}`);
    const body = (await res.json()) as {result?: Array<DasAsset | null>};
    const out: Record<string, TokenMeta> = {};
    for (const a of body.result ?? []) {
      if (!a) continue;
      out[a.id] = {
        name: a.content?.metadata?.name ?? '',
        symbol: a.content?.metadata?.symbol ?? '',
        logoUri: a.content?.files?.[0]?.cdn_uri,
      };
    }
    return out;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve token name/symbol/logo for the given mints. Backend-first (logos for
 * any token via the SSRF proxy); on any backend failure, falls back to direct
 * Helius DAS. Throws only when both fail; the caller keeps its cache.
 */
export async function fetchTokenMetadata(mints: string[]): Promise<Record<string, TokenMeta>> {
  if (mints.length === 0) return {};
  try {
    return await fetchTokenMetadataFromBackend(mints);
  } catch {
    return fetchTokenMetadataDirect(mints);
  }
}

/** Warm-start cache of resolved metadata (public MMKV — non-sensitive). */
export function loadCachedMetadata(): Record<string, TokenMeta> {
  try {
    const s = mmkvPublic.getString(MMKV_KEYS.TOKEN_METADATA_CACHE);
    return s ? (JSON.parse(s) as Record<string, TokenMeta>) : {};
  } catch {
    return {};
  }
}

export function saveCachedMetadata(map: Record<string, TokenMeta>): void {
  try {
    mmkvPublic.set(MMKV_KEYS.TOKEN_METADATA_CACHE, JSON.stringify(map));
  } catch {
    // cache write is best-effort
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tokenMetadata`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/tokens/tokenMetadata.ts src/modules/tokens/__tests__/tokenMetadata.test.ts
git commit -m "feat(tokens): backend-first metadata via pinnedFetch (proxy logos), direct DAS fallback"
```

---

## Task 7: Full verification + real pins + on-device

**Files:** (no new code; integration + the user's real SSL pins)

- [ ] **Step 1: Full test suite + type-check**

Run: `npx jest && npx tsc --noEmit`
Expected: all suites PASS; no type errors. (If `eslint` is part of CI: `npx eslint src/modules/prices src/modules/tokens src/modules/sslPinning src/constants` — fix any new lint in changed files.)

- [ ] **Step 2: Confirm real pins are set**

The real verified pins are already in `SSL_PINS` (set in Task 1) — confirm no `REPLACE_WITH` placeholder remains: `grep -c REPLACE_WITH src/modules/sslPinning/pinnedFetch.ts` → expected `0`.

- [ ] **Step 3: Build the release APK**

Run: `cd android && ./gradlew assembleRelease` (per the project's existing release flow).
Expected: APK builds without error.

- [ ] **Step 4: On-device verification (mainnet)**

Install the APK and verify:
- Dashboard: SOL / USDC / **USDT** show USD value + 24h % (served via the backend; confirm with a network capture or by temporarily logging which path served).
- Token detail: chart loads across 24H/7D/30D/1Y for SOL and USDT.
- A held non-core token shows its real logo (through the img proxy).
- Airplane mode: cached prices/logos still render; uncached logos show the letter avatar; no crash.
- (Optional) temporarily corrupt one pin → confirm the app still shows data via the direct fallback (proves the fallback path).

- [ ] **Step 5: Done** — proceed to finishing-a-development-branch (PR).

---

## Self-Review

**1. Spec coverage:**
- A. SSL pinning (pkPinning + sha256 format + leaf/intermediate pins) → Task 1 (+ real pins Task 7). ✓
- B. API base + origin + USDT_MINT → Tasks 2, 3. ✓
- C. Prices backend-first + USDT → Task 4. ✓
- D. Chart backend-first + USDT case → Task 5. ✓
- E. Token metadata backend-first + absolute proxy image → Task 6. ✓
- F. TokenLogo: no change required (renders logoUri) — confirmed, no task needed. ✓
- G. Error handling / fallback → wrappers in Tasks 4/5/6 (try backend → catch → direct). ✓
- H. Testing → tests in Tasks 1, 4, 5, 6. ✓
- I. On-device → Task 7. ✓

**2. Placeholder scan:** The only intentional placeholders are the two `sha256/REPLACE_WITH_…` pins — these are user-supplied secrets, explicitly swapped in Task 7 Step 2, and the app gracefully falls back to direct until then (documented). No code-logic placeholders.

**3. Type consistency:** `TokenPrice {usd, change24h}`, `TokenMeta {name, symbol, logoUri?}`, `PriceHistory {prices}` unchanged across backend/direct/wrapper. `fetchPrices`/`fetchPriceHistory`/`fetchTokenMetadata` keep their existing signatures (hooks/callers untouched). `pinnedFetch` returns `{status, json()}` — consumed consistently (`res.status !== 200` then `await res.json()`). `API_ORIGIN`/`USDT_MINT` defined in Task 2, used in Tasks 4/5/6. `coingeckoHeaders` still exported from `priceModule` and imported by `priceHistory`. No gaps.
