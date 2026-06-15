# Dashboard Live Prices & Formatting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard show real USD values (total + per-token), a real 24h % change, comma-grouped token amounts, and a real USDC logo.

**Architecture:** A pure price module fetches SOL/USDC prices + 24h change from CoinGecko; NOC price comes from the presale stage table. A pure `computePortfolio` turns holdings + prices into total USD + USD-weighted 24h % + per-token fiat. `DashboardScreen` consumes a `usePrices` React Query hook and renders the values. Thousand-separator grouping is done manually (Hermes `toLocaleString('en-US')` does NOT group on-device — same Node-vs-Hermes trap as the Buffer bug).

**Tech Stack:** TypeScript (strict), React Native 0.84.1, TanStack Query v5, Jest. No new deps.

**Spec:** `docs/superpowers/specs/2026-06-15-dashboard-prices-design.md`
**Branch:** `feat/dashboard-prices` (created; design committed).

---

## File Structure

- `src/utils/parseTokenAmount.ts` — add `groupInteger`; replace the `.toLocaleString('en-US')` grouping inside `formatBalanceForDisplay` with it.
- `src/screens/dashboard/DashboardScreen.tsx` — replace `formatUsd`'s `.toLocaleString`; assemble holdings; consume `usePrices`; render real total, 24h line (hide when null), per-token fiat column; USDC logo.
- `src/constants/presale.ts` — NEW: `PRESALE_STAGE_PRICES`.
- `src/modules/prices/priceModule.ts` — NEW: `fetchPrices` (CoinGecko) + `TokenPrice`.
- `src/modules/prices/portfolio.ts` — NEW: `computePortfolio` + types.
- `src/hooks/usePrices.ts` — NEW: React Query hook.
- `src/modules/tokens/coreTokens.ts` — add exported `USDC_MINT`.
- `src/assets/tokens/usdc-logo.png` — NEW asset.

---

## Task 1: Manual thousand-separator grouping (fixes NOC/SOL/USD commas)

**Files:**
- Modify: `src/utils/parseTokenAmount.ts`
- Test: `src/utils/__tests__/parseTokenAmount.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/utils/__tests__/parseTokenAmount.test.ts` (add `groupInteger` to the existing import from `../parseTokenAmount`):

```ts
import {groupInteger} from '../parseTokenAmount';

describe('groupInteger', () => {
  it('groups thousands with commas', () => {
    expect(groupInteger('69119998')).toBe('69,119,998');
    expect(groupInteger('1234567')).toBe('1,234,567');
    expect(groupInteger('1000')).toBe('1,000');
  });
  it('leaves short numbers unchanged', () => {
    expect(groupInteger('17')).toBe('17');
    expect(groupInteger('0')).toBe('0');
    expect(groupInteger('999')).toBe('999');
  });
});

describe('formatBalanceForDisplay grouping (on-device safe)', () => {
  it('comma-groups a large 9-decimal balance', () => {
    // 69,119,998 NOC in base units
    expect(formatBalanceForDisplay('69119998000000000', 9)).toBe('69,119,998');
  });
  it('keeps decimals for SOL', () => {
    expect(formatBalanceForDisplay('17027600000', 9)).toBe('17.0276');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=parseTokenAmount -t groupInteger`
Expected: FAIL — `groupInteger` is not exported.

- [ ] **Step 3: Implement `groupInteger` and use it in `formatBalanceForDisplay`**

In `src/utils/parseTokenAmount.ts`, add near the top (after the imports / before `formatBalanceForDisplay`):

```ts
/**
 * Insert thousands separators into a non-negative integer string.
 * Implemented manually because Hermes `Number.toLocaleString('en-US')` does
 * NOT group digits on-device (it works in Node/jest, which hides the bug).
 */
export function groupInteger(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
```

Then inside `formatBalanceForDisplay`, replace EVERY `.toLocaleString('en-US')` call. There are four occurrences, each of the form `X.toLocaleString('en-US')` where `X` is a bigint (`whole`, `whole + 1n`). Replace each with `groupInteger(X.toString())`. Concretely:
- `return (whole + 1n).toLocaleString('en-US');` → `return groupInteger((whole + 1n).toString());`
- `return whole.toLocaleString('en-US');` → `return groupInteger(whole.toString());`
- `return (whole + 1n).toLocaleString('en-US');` (the carry case) → `return groupInteger((whole + 1n).toString());`
- `return \`${whole.toLocaleString('en-US')}.${fracStr}\`;` → `return \`${groupInteger(whole.toString())}.${fracStr}\`;`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest --testPathPattern=parseTokenAmount`
Expected: PASS (existing tests + the new `groupInteger` and grouping tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/parseTokenAmount.ts src/utils/__tests__/parseTokenAmount.test.ts
git commit -m "fix(format): manual thousand-separator grouping (Hermes toLocaleString doesn't group)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Presale stage price table

**Files:**
- Create: `src/constants/presale.ts`
- Test: `src/constants/__tests__/presale.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/constants/__tests__/presale.test.ts`:

```ts
import {PRESALE_STAGE_PRICES, nocUsdPriceForStage} from '../presale';

describe('PRESALE_STAGE_PRICES', () => {
  it('has 10 stages starting at 0.1501', () => {
    expect(PRESALE_STAGE_PRICES).toHaveLength(10);
    expect(PRESALE_STAGE_PRICES[0]).toBe(0.1501);
    expect(PRESALE_STAGE_PRICES[9]).toBe(0.3499);
  });
});

describe('nocUsdPriceForStage', () => {
  it('returns the price for the given 1-indexed stage', () => {
    expect(nocUsdPriceForStage(1)).toBe(0.1501);
    expect(nocUsdPriceForStage(2)).toBe(0.1723);
  });
  it('defaults to stage 1 for null/out-of-range', () => {
    expect(nocUsdPriceForStage(null)).toBe(0.1501);
    expect(nocUsdPriceForStage(0)).toBe(0.1501);
    expect(nocUsdPriceForStage(99)).toBe(0.1501);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=presale`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/constants/presale.ts`:

```ts
/**
 * USD price per NOC by presale stage. Display stages are 1-indexed; the array
 * is 0-indexed. Each stage sells 10,240,000 NOC. NOC is presale-only (not on a
 * market), so the wallet uses these prices for NOC's USD value until the
 * presale store is wired to live on-chain stage data.
 */
export const PRESALE_STAGE_PRICES: readonly number[] = [
  0.1501, 0.1723, 0.1945, 0.2167, 0.2389,
  0.2611, 0.2833, 0.3055, 0.3277, 0.3499,
];

/** Resolve the NOC USD price for a 1-indexed stage, defaulting to stage 1. */
export function nocUsdPriceForStage(stage: number | null): number {
  if (stage == null || stage < 1 || stage > PRESALE_STAGE_PRICES.length) {
    return PRESALE_STAGE_PRICES[0];
  }
  return PRESALE_STAGE_PRICES[stage - 1];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=presale`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/constants/presale.ts src/constants/__tests__/presale.test.ts
git commit -m "feat(presale): NOC stage price table + resolver

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Price module (CoinGecko)

**Files:**
- Create: `src/modules/prices/priceModule.ts`
- Modify: `src/modules/tokens/coreTokens.ts` (add `USDC_MINT`)
- Test: `src/modules/prices/__tests__/priceModule.test.ts`

- [ ] **Step 1: Add the `USDC_MINT` export**

In `src/modules/tokens/coreTokens.ts`, add after the `CORE_TOKENS` array:

```ts
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
```

- [ ] **Step 2: Write the failing test**

Create `src/modules/prices/__tests__/priceModule.test.ts`:

```ts
import {fetchPrices} from '../priceModule';
import {USDC_MINT} from '../../tokens/coreTokens';

const okResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

afterEach(() => {
  (global.fetch as jest.Mock | undefined)?.mockReset?.();
});

describe('fetchPrices', () => {
  it('maps CoinGecko prices to mint keys', async () => {
    global.fetch = jest.fn(async () =>
      okResponse({
        solana: {usd: 178.42, usd_24h_change: 2.34},
        'usd-coin': {usd: 0.999, usd_24h_change: 0.01},
      }),
    ) as unknown as typeof fetch;

    const prices = await fetchPrices();
    expect(prices['native']).toEqual({usd: 178.42, change24h: 2.34});
    expect(prices[USDC_MINT]).toEqual({usd: 0.999, change24h: 0.01});
  });

  it('throws on a non-200 response', async () => {
    global.fetch = jest.fn(async () => ({ok: false, status: 503, json: async () => ({})})) as unknown as typeof fetch;
    await expect(fetchPrices()).rejects.toThrow();
  });

  it('throws when fetch rejects (offline/timeout)', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    await expect(fetchPrices()).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest --testPathPattern=priceModule`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `src/modules/prices/priceModule.ts`:

```ts
import {USDC_MINT} from '../tokens/coreTokens';

export interface TokenPrice {
  usd: number;
  change24h: number | null; // percent; null when unknown
}

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=solana,usd-coin&vs_currencies=usd&include_24hr_change=true';

interface CoinGeckoEntry {
  usd?: number;
  usd_24h_change?: number;
}

/**
 * Fetch SOL + USDC USD prices and 24h change from CoinGecko. Public market data
 * on a third-party host (cert not pinned) → plain fetch with a 6s timeout.
 * Returns a map keyed by the app's mint key ('native' for SOL, USDC mint).
 * NOC is NOT included (it is presale-only; the consumer injects it).
 * Throws on timeout / non-200 / parse failure; the hook keeps the last cache.
 */
export async function fetchPrices(): Promise<Record<string, TokenPrice>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(COINGECKO_URL, {signal: controller.signal});
    if (!res.ok) {
      throw new Error(`CoinGecko HTTP ${res.status}`);
    }
    const body = (await res.json()) as Record<string, CoinGeckoEntry>;
    const sol = body.solana;
    const usdc = body['usd-coin'];
    if (sol?.usd == null || usdc?.usd == null) {
      throw new Error('CoinGecko response missing prices');
    }
    return {
      native: {usd: sol.usd, change24h: sol.usd_24h_change ?? null},
      [USDC_MINT]: {usd: usdc.usd, change24h: usdc.usd_24h_change ?? null},
    };
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest --testPathPattern=priceModule`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/modules/prices/priceModule.ts src/modules/prices/__tests__/priceModule.test.ts src/modules/tokens/coreTokens.ts
git commit -m "feat(prices): CoinGecko price fetch (SOL + USDC) with timeout

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Portfolio computation (pure)

**Files:**
- Create: `src/modules/prices/portfolio.ts`
- Test: `src/modules/prices/__tests__/portfolio.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/prices/__tests__/portfolio.test.ts`:

```ts
import {computePortfolio} from '../portfolio';
import type {TokenPrice} from '../priceModule';

const prices: Record<string, TokenPrice> = {
  native: {usd: 100, change24h: 2}, // SOL $100, +2%
  NOC: {usd: 0.1501, change24h: null},
  USDC: {usd: 1, change24h: 0},
};

describe('computePortfolio', () => {
  it('sums USD value across holdings', () => {
    const r = computePortfolio(
      [
        {mint: 'native', amountRaw: '2000000000', decimals: 9}, // 2 SOL → $200
        {mint: 'NOC', amountRaw: '1000000000000', decimals: 9}, // 1000 NOC → $150.10
        {mint: 'USDC', amountRaw: '50000000', decimals: 6}, // 50 USDC → $50
      ],
      prices,
    );
    expect(r.totalUsd).toBeCloseTo(400.1, 2);
    expect(r.perToken.native.usd).toBeCloseTo(200, 2);
  });

  it('computes the USD-weighted 24h change over priced holdings with a change', () => {
    // Only SOL ($200, +2%) has a change; NOC null + USDC 0% → weighted by USD.
    const r = computePortfolio(
      [
        {mint: 'native', amountRaw: '2000000000', decimals: 9}, // $200, +2%
        {mint: 'USDC', amountRaw: '200000000', decimals: 6}, // $200, 0%
      ],
      prices,
    );
    // (200*2 + 200*0) / (200+200) = 1.0
    expect(r.change24hPct).toBeCloseTo(1.0, 4);
  });

  it('returns null change when no holding has a known change', () => {
    const r = computePortfolio([{mint: 'NOC', amountRaw: '1000000000000', decimals: 9}], prices);
    expect(r.change24hPct).toBeNull();
  });

  it('handles missing price / zero balances', () => {
    const r = computePortfolio([{mint: 'UNKNOWN', amountRaw: '5', decimals: 0}], prices);
    expect(r.totalUsd).toBe(0);
    expect(r.change24hPct).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=portfolio`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/modules/prices/portfolio.ts`:

```ts
import type {TokenPrice} from './priceModule';

export interface Holding {
  mint: string; // 'native' | mint base58
  amountRaw: string; // integer base units
  decimals: number;
}

export interface PortfolioValue {
  totalUsd: number;
  change24hPct: number | null; // USD-weighted; null if no priced holding has a change
  perToken: Record<string, {usd: number; change24h: number | null}>;
}

/**
 * Turn holdings + prices into total USD, a USD-weighted 24h % change, and a
 * per-token fiat value. USD figures are DISPLAY floats; on-chain token amounts
 * (amountRaw) stay integer. Holdings with no matching price contribute 0.
 */
export function computePortfolio(
  holdings: Holding[],
  prices: Record<string, TokenPrice>,
): PortfolioValue {
  let totalUsd = 0;
  let weightedChangeNumer = 0;
  let changeWeight = 0;
  const perToken: PortfolioValue['perToken'] = {};

  for (const h of holdings) {
    const price = prices[h.mint];
    if (price == null) {
      perToken[h.mint] = {usd: 0, change24h: null};
      continue;
    }
    const uiAmount = Number(h.amountRaw) / Math.pow(10, h.decimals);
    const usd = uiAmount * price.usd;
    totalUsd += usd;
    perToken[h.mint] = {usd, change24h: price.change24h};
    if (price.change24h != null) {
      weightedChangeNumer += usd * price.change24h;
      changeWeight += usd;
    }
  }

  const change24hPct = changeWeight > 0 ? weightedChangeNumer / changeWeight : null;
  return {totalUsd, change24hPct, perToken};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=portfolio`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/prices/portfolio.ts src/modules/prices/__tests__/portfolio.test.ts
git commit -m "feat(prices): pure portfolio USD + weighted 24h computation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `usePrices` hook

**Files:**
- Create: `src/hooks/usePrices.ts`

No new unit test (thin React Query wrapper over the tested `fetchPrices`; mirrors the existing hooks in `useSolanaQueries.ts`). Verified by typecheck + on-device.

- [ ] **Step 1: Implement**

Create `src/hooks/usePrices.ts`:

```ts
import {useQuery} from '@tanstack/react-query';
import {fetchPrices, type TokenPrice} from '../modules/prices/priceModule';

/**
 * Live SOL + USDC USD prices (and 24h change) from CoinGecko. 60s refresh; the
 * last good value is kept (gcTime) so a transient failure doesn't blank fiat.
 * NOC is not included here — the dashboard injects its presale-stage price.
 */
export function usePrices() {
  return useQuery<Record<string, TokenPrice>>({
    queryKey: ['prices'],
    queryFn: fetchPrices,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePrices.ts
git commit -m "feat(prices): usePrices React Query hook

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: USDC logo asset + TokenLogo case

**Files:**
- Create: `src/assets/tokens/usdc-logo.png`
- Modify: `src/screens/dashboard/DashboardScreen.tsx` (asset require + `TokenLogo`)

- [ ] **Step 1: Fetch the official USDC (Solana) logo asset**

Run:
```bash
curl -fsSL -o src/assets/tokens/usdc-logo.png \
  "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png"
file src/assets/tokens/usdc-logo.png
```
Expected: a PNG image (`file` reports "PNG image data"). If the URL fails, fall back to `https://assets.coingecko.com/coins/images/6319/small/usdc.png` and report which source was used.

- [ ] **Step 2: Add the asset require**

In `src/screens/dashboard/DashboardScreen.tsx`, next to the existing logo requires (`SOLANA_LOGO`, `NOC_LOGO` ≈ line 45-46), add:

```ts
const USDC_LOGO = require('../../assets/tokens/usdc-logo.png');
```

- [ ] **Step 3: Render the USDC logo in `TokenLogo`**

`TokenLogo` currently renders SOL and NOC images and falls back to a letter for everything else. Add a USDC case before the fallback `return`. Insert after the `if (isNoc) { ... }` block:

```tsx
  if (symbol === 'USDC') {
    return (
      <View className="w-10 h-10 rounded-pill items-center justify-center bg-bg-surface-2 overflow-hidden">
        <Image
          source={USDC_LOGO}
          style={{width: 26, height: 26}}
          resizeMode="contain"
          accessibilityLabel="USD Coin logo"
        />
      </View>
    );
  }
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/screens/dashboard/DashboardScreen.tsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/assets/tokens/usdc-logo.png src/screens/dashboard/DashboardScreen.tsx
git commit -m "feat(dashboard): real USDC logo

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire live prices into the dashboard (total, 24h, per-token fiat)

**Files:**
- Modify: `src/screens/dashboard/DashboardScreen.tsx`

This is integration (no screen-test scaffold). The logic it uses is unit-tested in Tasks 1-4. Verify with typecheck + lint + on-device.

- [ ] **Step 1: Replace `formatUsd`'s grouping with `groupInteger`**

At the top of `DashboardScreen.tsx`, import `groupInteger`:

```ts
import {formatBalanceForDisplay, groupInteger} from '../../utils/parseTokenAmount';
```
(Merge with the existing `parseTokenAmount` import if one already exists; otherwise add it.)

In `formatUsd` change:
```ts
  const whole = '$' + Number(w).toLocaleString('en-US');
```
to:
```ts
  const whole = '$' + groupInteger(w);
```
(`w` is already the integer string from `fixed.split('.')`.)

- [ ] **Step 2: Add imports for prices + presale price**

Add near the other imports:

```ts
import {usePrices} from '../../hooks/usePrices';
import {computePortfolio, type Holding} from '../../modules/prices/portfolio';
import type {TokenPrice} from '../../modules/prices/priceModule';
import {nocUsdPriceForStage} from '../../constants/presale';
import {USDC_MINT} from '../../modules/tokens/coreTokens';
import {usePresaleStore} from '../../store/zustand/presaleStore';
```
(If any are already imported, don't duplicate.)

- [ ] **Step 2b: Build holdings + prices + portfolio in the component**

In the `DashboardScreen` component body, after the existing store reads (`const {publicKey, solBalance, nocBalance, totalUsdValue, tokens, tokenBalances} = useWalletStore();`), add:

```tsx
  const {data: marketPrices} = usePrices();
  const currentStage = usePresaleStore(s => s.currentStage);
  const pricePerNoc = usePresaleStore(s => s.pricePerNoc);

  // NOC price = live presale price if set, else the stage table.
  const nocUsd =
    pricePerNoc != null && Number(pricePerNoc) > 0
      ? Number(pricePerNoc)
      : nocUsdPriceForStage(currentStage);

  // Merge market prices (SOL/USDC) with NOC's presale price.
  const prices: Record<string, TokenPrice> = useMemo(
    () => ({
      ...(marketPrices ?? {}),
      [NOC_MINT]: {usd: nocUsd, change24h: null},
    }),
    [marketPrices, nocUsd],
  );

  // Holdings from current balances. decimals come from token metadata; SOL/NOC
  // are 9, USDC 6 (from CORE_TOKENS via the token list).
  const holdings: Holding[] = useMemo(() => {
    const list: Holding[] = [
      {mint: 'native', amountRaw: solBalance || '0', decimals: SOL_DECIMALS},
      {mint: NOC_MINT, amountRaw: (tokenBalances[NOC_MINT] ?? nocBalance) || '0', decimals: NOC_DECIMALS},
    ];
    for (const t of tokens) {
      if (t.mint === NOC_MINT) continue; // already added
      list.push({mint: t.mint, amountRaw: (tokenBalances[t.mint] ?? '0'), decimals: t.decimals});
    }
    return list;
  }, [solBalance, nocBalance, tokenBalances, tokens]);

  const portfolio = useMemo(() => computePortfolio(holdings, prices), [holdings, prices]);
  const havePrices = marketPrices != null;
```

NOTE: confirm `'native'` is the correct SOL key here. The store's `solBalance` holds SOL; the price map keys SOL under `'native'`. The `holdings` SOL entry uses `mint: 'native'`, matching `prices['native']` from `fetchPrices`. Keep them identical.

- [ ] **Step 3: Feed the real total + 24h % into the header**

Find where `usd` is computed (`const usd = formatUsd(totalUsdValue);` ≈ line 253). Replace with the live total, and pass the 24h % to the header:

```tsx
  const usd = formatUsd(portfolio.totalUsd);
  const change24h = portfolio.change24hPct; // number | null
```

In the `<DashboardHeader ... />` JSX, add two props: `change24hPct={change24h}` and `havePrices={havePrices}`.

In `DashboardHeaderProps` (the interface, ≈ line 341) add:
```ts
  change24hPct: number | null;
  havePrices: boolean;
```
and accept them in the `DashboardHeader({ ... })` destructure.

- [ ] **Step 4: Render the real 24h line (hide when null)**

In `DashboardHeader`, replace the hardcoded transparent-mode change block:

```tsx
            <View className="flex-row items-center gap-2 mb-3">
              <TrendingUp size={14} color="#3FD68B" strokeWidth={2} />
              <Text variant="body-sm" numeral className="text-success">
                +2.34% · 24h
              </Text>
            </View>
```

with (uses the `change24hPct` prop; hides entirely when null; red/down when negative — import `TrendingDown` from lucide alongside `TrendingUp`):

```tsx
            change24hPct == null ? null : (
              <View className="flex-row items-center gap-2 mb-3">
                {change24hPct >= 0 ? (
                  <TrendingUp size={14} color="#3FD68B" strokeWidth={2} />
                ) : (
                  <TrendingDown size={14} color="#F87171" strokeWidth={2} />
                )}
                <Text
                  variant="body-sm"
                  numeral
                  className={change24hPct >= 0 ? 'text-success' : 'text-danger'}>
                  {`${change24hPct >= 0 ? '+' : ''}${change24hPct.toFixed(2)}% · 24h`}
                </Text>
              </View>
            )
```

(The surrounding conditional is `hidden ? (...) : isShielded ? (...) : (THIS)`. Keep that structure — replace only the final transparent branch expression.)

Add `TrendingDown` to the existing lucide import line that has `TrendingUp`.

- [ ] **Step 5: When prices are unavailable, don't show a fake `$0.00`**

In `DashboardHeader`, where the amount renders `usd.whole` + `usd.cents`, wrap so that when `!havePrices && portfolio total is 0` it shows `—`. Simplest: pass a precomputed display. In the parent, change:
```tsx
  const usd = formatUsd(portfolio.totalUsd);
```
to also compute a flag, and in the header render:
```tsx
{havePrices ? (
  <>
    <Text ...>{usd.whole}</Text>
    <Text ...>{usd.cents}</Text>
  </>
) : (
  <Text variant="h1" className="text-fg-primary">—</Text>
)}
```
Apply only to the non-hidden branch (hidden mode keeps its `····`). Match the existing markup/classes for `usd.whole`/`usd.cents`.

- [ ] **Step 6: Add the per-token fiat + 24h % column to `TokenListRow`**

Pass fiat data into each row. In the FlatList `renderItem` (≈ line 296-316), compute the per-token fiat from `portfolio.perToken[token.mint]` and pass new props:

```tsx
          const fiat = portfolio.perToken[token.mint];
          return (
            <TokenListRow
              symbol={token.symbol}
              name={token.name}
              balance={balance}
              decimals={token.decimals}
              hidden={hideBalances}
              mode={mode}
              isNoc={isNoc}
              usdValue={fiat?.usd ?? null}
              change24h={fiat?.change24h ?? null}
              onPress={onTokenTap ? () => onTokenTap(token.mint) : undefined}
            />
          );
```

In `TokenListRowProps` add:
```ts
  usdValue: number | null;
  change24h: number | null;
```

In `TokenListRow`, replace the trailing `<ChevronRight .../>` with a right-side price column followed by the chevron. Use `formatUsd` (already in this file) for the value and `groupInteger` is not needed here. Insert before `<ChevronRight ...>`:

```tsx
      {!hidden && usdValue != null ? (
        <View className="items-end mr-2">
          <Text variant="body-lg" numeral className="text-fg-primary">
            {(() => {
              const u = formatUsd(usdValue);
              return u.whole + u.cents;
            })()}
          </Text>
          {change24h == null ? (
            <Text variant="body-sm" className="text-fg-tertiary">
              —
            </Text>
          ) : (
            <Text
              variant="body-sm"
              numeral
              className={change24h >= 0 ? 'text-success' : 'text-danger'}>
              {`${change24h >= 0 ? '+' : ''}${change24h.toFixed(1)}%`}
            </Text>
          )}
        </View>
      ) : null}
```

(Keep `<ChevronRight ... />` after this block. `formatUsd` is module-scoped in this file, so `TokenListRow` can call it.)

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/screens/dashboard/DashboardScreen.tsx`
Expected: no errors. (TypeScript strict — no `any`. Resolve any unused-import or type issues.)

- [ ] **Step 8: Run the dashboard + store tests**

Run: `npx jest --testPathPattern="dashboard|walletStore|prices|presale|parseTokenAmount"`
Expected: PASS (existing dashboard tests still green; new module tests green).

- [ ] **Step 9: Commit**

```bash
git add src/screens/dashboard/DashboardScreen.tsx
git commit -m "feat(dashboard): live total USD, real 24h %, per-token fiat column

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Full verification + on-device

**Files:** none.

- [ ] **Step 1: Full suite + typecheck + lint**

Run: `npx jest && npx tsc --noEmit && npx eslint .`
Expected: all tests pass; tsc clean; eslint no new errors (pre-existing warnings ok).

- [ ] **Step 2: Mainnet APK build (agent builds, user sideloads)**

Swap `.env` to mainnet with the user's Helius key, `cd android && ./gradlew assembleRelease`, then revert `.env` to devnet (per the established APK flow). Copy to `/home/user/Downloads/`.

- [ ] **Step 3: On-device verification**

- TOTAL BALANCE shows a real USD sum (SOL + NOC@stage-price + USDC).
- The 24h line shows a real green/red value (matches SOL's move), and is hidden if CoinGecko is unreachable (no fake $0.00 / no fake +2.34%).
- Token amounts are comma-grouped (`69,119,998 NOC`).
- Each token row shows its USD value; SOL shows a live %, USDC/NOC show `—`.
- USD Coin shows its real logo.

If anything is wrong, STOP and use `superpowers:systematic-debugging`.

---

## Self-Review

**1. Spec coverage:**
- CoinGecko price source (SOL/USDC, plain fetch, timeout) → Task 3. ✓
- NOC price from presale stage (table + store) → Tasks 2, 7. ✓
- `usePrices` hook (60s) → Task 5. ✓
- Portfolio total + USD-weighted 24h + per-token → Task 4. ✓
- TOTAL BALANCE real value + hidden `—` when no prices → Task 7 (steps 3, 5). ✓
- Real 24h line, hide when null, green/red → Task 7 step 4. ✓
- Per-token fiat + % rows (design §11) → Task 7 step 6. ✓
- Thousand separators (Hermes-safe) → Task 1. ✓
- USDC logo → Task 6. ✓
- Error handling (no fake $0.00; keep cache) → Task 7 step 5 + `usePrices` gcTime. ✓
- Tests: priceModule, portfolio, groupInteger/format, presale → Tasks 1-4. ✓

**2. Placeholder scan:** No TBD/TODO; every code step has full code; commands have expected output. The only non-pasted artifact is the USDC PNG (binary), fetched via a pinned `curl` URL in Task 6 with a fallback — acceptable.

**3. Type consistency:** `TokenPrice {usd, change24h}` defined in Task 3, used in Tasks 4/5/7. `Holding {mint, amountRaw, decimals}` defined in Task 4, built in Task 7. `computePortfolio(holdings, prices) → {totalUsd, change24hPct, perToken}` consistent across Task 4 and Task 7 consumers. `groupInteger(string)` from Task 1 used in Tasks 1 & 7. `nocUsdPriceForStage(number|null)` from Task 2 used in Task 7. `USDC_MINT` from Task 3 used in Tasks 3 & 7. SOL key `'native'` consistent between `fetchPrices` (Task 3) and `holdings` (Task 7). ✓
