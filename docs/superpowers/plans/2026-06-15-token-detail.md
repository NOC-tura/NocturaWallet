# #28 Token Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping a dashboard token row opens a per-token detail screen (#28) with a price chart, timeframe picker, holdings, and Send/Receive actions.

**Architecture:** Shared helpers (formatUsd, TokenLogo, holdings builder, resolved-prices hook) are extracted from `DashboardScreen` so TokenDetail reuses them. A `priceHistory` module + `usePriceHistory` hook fetch CoinGecko `market_chart` series; a `SparkChart` component renders them via `react-native-svg`. `TokenDetailScreen` composes these, built to the §28 design. A new `TokenDetailModal` root route is wired from the dashboard's existing (unused) `onTokenTap`. NOC (presale-only) shows holdings + presale price, no chart.

**Tech Stack:** TypeScript strict, React Native 0.84.1, react-native-svg 15.15.5, TanStack Query v5, React Navigation v7, Jest.

**Spec:** `docs/superpowers/specs/2026-06-15-token-detail-design.md`
**Branch:** `feat/token-detail` (created, stacked on `feat/dashboard-prices` / PR #18). Rebase `--onto origin/main` after #18 merges.

---

## File Structure

- `src/utils/formatUsd.ts` — NEW: `formatUsd` + `formatUsdString` (moved from DashboardScreen).
- `src/components/TokenLogo.tsx` — NEW: `TokenLogo` + its logo asset requires (moved from DashboardScreen).
- `src/modules/prices/holdings.ts` — NEW: `buildHoldings(...)` (extracted from DashboardScreen's memo).
- `src/hooks/useResolvedPrices.ts` — NEW: market prices + NOC presale price merged (extracted from DashboardScreen).
- `src/screens/dashboard/DashboardScreen.tsx` — MODIFY: import the four extractions; delete the now-moved local copies.
- `src/modules/prices/priceHistory.ts` — NEW: `fetchPriceHistory`, `TIMEFRAME_DAYS`, `Timeframe`, `coingeckoIdForMint`, `changeOverSeries`.
- `src/hooks/usePriceHistory.ts` — NEW hook.
- `src/components/SparkChart.tsx` — NEW: chart + `seriesToPath` helper + skeleton.
- `src/screens/transparent/SendScreen.tsx` — MODIFY: `initialMint` prop.
- `src/screens/transparent/TokenDetailScreen.tsx` — NEW screen.
- `src/types/navigation.d.ts` — MODIFY: `SendModal` param + `TokenDetailModal` route + `SendStackParamList.Send` param.
- `src/app/Navigator.tsx` — MODIFY: register `TokenDetailModal`; wire `onTokenTap`; thread `initialMint`.
- `src/constants/mmkvKeys.ts` — MODIFY: add a token-timeframe key prefix.

---

## Task 1: Extract shared helpers from DashboardScreen (DRY refactor)

**Files:**
- Create: `src/utils/formatUsd.ts`, `src/components/TokenLogo.tsx`, `src/modules/prices/holdings.ts`, `src/hooks/useResolvedPrices.ts`
- Modify: `src/screens/dashboard/DashboardScreen.tsx`
- Test: `src/modules/prices/__tests__/holdings.test.ts`, `src/utils/__tests__/formatUsd.test.ts`

This refactors code added in PR #18 — behavior-preserving; the existing dashboard tests must stay green.

- [ ] **Step 1: Write failing tests for the two pure extractions**

Create `src/utils/__tests__/formatUsd.test.ts`:
```ts
import {formatUsd, formatUsdString} from '../formatUsd';

describe('formatUsd', () => {
  it('splits whole + cents with grouping', () => {
    expect(formatUsd(14881.19)).toEqual({whole: '$14,881', cents: '.19'});
    expect(formatUsd(0)).toEqual({whole: '$0', cents: '.00'});
  });
  it('formatUsdString concatenates', () => {
    expect(formatUsdString(9872.4)).toBe('$9,872.40');
  });
});
```

Create `src/modules/prices/__tests__/holdings.test.ts`:
```ts
import {buildHoldings} from '../holdings';

const NOC = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';

describe('buildHoldings', () => {
  it('always includes SOL (native) and NOC, then other store tokens', () => {
    const h = buildHoldings({
      solBalance: '17027600000',
      nocBalance: '69119998000000000',
      tokenBalances: {[NOC]: '69119998000000000', USDCMINT: '13399619'},
      tokens: [
        {mint: NOC, symbol: 'NOC', name: 'Noctura', decimals: 9, trust: 'core'},
        {mint: 'USDCMINT', symbol: 'USDC', name: 'USD Coin', decimals: 6, trust: 'core'},
      ],
    });
    expect(h.find(x => x.mint === 'native')).toEqual({mint: 'native', amountRaw: '17027600000', decimals: 9});
    expect(h.find(x => x.mint === NOC)?.amountRaw).toBe('69119998000000000');
    expect(h.find(x => x.mint === 'USDCMINT')).toEqual({mint: 'USDCMINT', amountRaw: '13399619', decimals: 6});
    // NOC appears exactly once (not duplicated by the tokens loop)
    expect(h.filter(x => x.mint === NOC)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --testPathPattern="formatUsd|holdings"`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `src/utils/formatUsd.ts`**

```ts
import {groupInteger} from './parseTokenAmount';

/** Format a USD number into a grouped whole part ("$14,881") + cents (".19"). */
export function formatUsd(value: number): {whole: string; cents: string} {
  const safe = Number.isFinite(value) ? value : 0;
  const fixed = safe.toFixed(2);
  const [w, c] = fixed.split('.');
  return {whole: '$' + groupInteger(w), cents: `.${c ?? '00'}`};
}

/** Flat "$14,881.19" string. */
export function formatUsdString(value: number): string {
  const {whole, cents} = formatUsd(value);
  return whole + cents;
}
```

- [ ] **Step 4: Create `src/modules/prices/holdings.ts`**

```ts
import type {Holding} from './portfolio';
import {NOC_MINT} from '../../constants/programs';

const SOL_DECIMALS = 9;
const NOC_DECIMALS = 9;

interface TokenMeta {mint: string; decimals: number}

/**
 * Build the wallet's holdings list (SOL pinned as 'native', NOC pinned, then
 * the remaining store tokens). Shared by the dashboard total and the
 * per-token "% of portfolio". Mirrors the values the dashboard rows display.
 */
export function buildHoldings(args: {
  solBalance: string;
  nocBalance: string;
  tokenBalances: Record<string, string>;
  tokens: TokenMeta[];
}): Holding[] {
  const {solBalance, nocBalance, tokenBalances, tokens} = args;
  const list: Holding[] = [
    {mint: 'native', amountRaw: solBalance || '0', decimals: SOL_DECIMALS},
    {mint: NOC_MINT, amountRaw: (tokenBalances[NOC_MINT] ?? nocBalance) || '0', decimals: NOC_DECIMALS},
  ];
  for (const t of tokens) {
    if (t.mint === NOC_MINT) continue;
    list.push({mint: t.mint, amountRaw: tokenBalances[t.mint] ?? '0', decimals: t.decimals});
  }
  return list;
}
```

- [ ] **Step 5: Create `src/hooks/useResolvedPrices.ts`**

```ts
import {useMemo} from 'react';
import {usePrices} from './usePrices';
import {usePresaleStore} from '../store/zustand/presaleStore';
import {nocUsdPriceForStage} from '../constants/presale';
import {NOC_MINT} from '../constants/programs';
import type {TokenPrice} from '../modules/prices/priceModule';

/**
 * Market prices (SOL/USDC from CoinGecko) merged with NOC's presale price.
 * `havePrices` is false until the market fetch resolves (NOC alone never
 * counts as "have prices"). Shared by the dashboard and token-detail.
 */
export function useResolvedPrices(): {prices: Record<string, TokenPrice>; havePrices: boolean} {
  const {data: marketPrices} = usePrices();
  const currentStage = usePresaleStore(s => s.currentStage);
  const pricePerNoc = usePresaleStore(s => s.pricePerNoc);
  const nocUsd =
    pricePerNoc != null && Number(pricePerNoc) > 0
      ? Number(pricePerNoc)
      : nocUsdPriceForStage(currentStage);
  const prices = useMemo<Record<string, TokenPrice>>(
    () => ({...(marketPrices ?? {}), [NOC_MINT]: {usd: nocUsd, change24h: null}}),
    [marketPrices, nocUsd],
  );
  return {prices, havePrices: marketPrices != null};
}
```

- [ ] **Step 6: Create `src/components/TokenLogo.tsx`**

Move the `TokenLogo` function + the three logo `require`s (`SOLANA_LOGO`, `NOC_LOGO`, `USDC_LOGO`) out of `DashboardScreen.tsx` into this file. Export `TokenLogo`. Keep its exact current JSX/props (`{symbol: string; isNoc: boolean}`). Update the `require` paths to be relative to `src/components/` (`'../assets/tokens/...'`). Import `View`, `Image`, `Text` from react-native.

```tsx
import React from 'react';
import {View, Image} from 'react-native';
import {Text} from './ui';

const SOLANA_LOGO = require('../assets/tokens/solana-sol-logo.png');
const NOC_LOGO = require('../assets/tokens/noc-logo.png');
const USDC_LOGO = require('../assets/tokens/usdc-logo.png');

interface TokenLogoProps {symbol: string; isNoc: boolean}

export function TokenLogo({symbol, isNoc}: TokenLogoProps) {
  // ... move the EXACT body currently in DashboardScreen.tsx TokenLogo here ...
}
```
(Verify the `Text` import path: the dashboard imports `Text` from `'../../components/ui'`; from `src/components/TokenLogo.tsx` that is `'./ui'`. Adjust to whatever the real export is.)

- [ ] **Step 7: Refactor DashboardScreen to use the extractions**

In `src/screens/dashboard/DashboardScreen.tsx`:
- Delete the local `formatUsd` function; `import {formatUsd, formatUsdString} from '../../utils/formatUsd';`. Replace the per-row IIFE (`{(() => { const u = formatUsd(usdValue); return u.whole + u.cents; })()}`) with `{formatUsdString(usdValue)}`.
- Delete the local `TokenLogo` function + the three logo `require`s; `import {TokenLogo} from '../../components/TokenLogo';`.
- Replace the inline `holdings` useMemo body with `buildHoldings({solBalance, nocBalance, tokenBalances, tokens})`; `import {buildHoldings} from '../../modules/prices/holdings';`.
- Replace the `marketPrices`/`nocUsd`/`prices`/`havePrices` block with `const {prices, havePrices} = useResolvedPrices();`; `import {useResolvedPrices} from '../../hooks/useResolvedPrices';`. (Remove the now-unused `usePrices`, `usePresaleStore`, `nocUsdPriceForStage`, `TokenPrice` imports if nothing else uses them.)

- [ ] **Step 8: Run tests + tsc + lint**

Run: `npx jest --testPathPattern="formatUsd|holdings|dashboard|prices|parseTokenAmount" && npx tsc --noEmit && npx eslint src/screens/dashboard/DashboardScreen.tsx`
Expected: all pass; tsc 0; no new eslint errors. The dashboard must render identically (behavior-preserving).

- [ ] **Step 9: Commit**

```bash
git add src/utils/formatUsd.ts src/utils/__tests__/formatUsd.test.ts src/components/TokenLogo.tsx src/modules/prices/holdings.ts src/modules/prices/__tests__/holdings.test.ts src/hooks/useResolvedPrices.ts src/screens/dashboard/DashboardScreen.tsx
git commit -m "refactor(dashboard): extract formatUsd, TokenLogo, holdings, resolved-prices for reuse

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: priceHistory module

**Files:**
- Create: `src/modules/prices/priceHistory.ts`
- Test: `src/modules/prices/__tests__/priceHistory.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/prices/__tests__/priceHistory.test.ts`:
```ts
import {fetchPriceHistory, changeOverSeries, coingeckoIdForMint, TIMEFRAME_DAYS} from '../priceHistory';
import {USDC_MINT} from '../../tokens/coreTokens';
import {NOC_MINT} from '../../../constants/programs';

afterEach(() => {(global.fetch as jest.Mock | undefined)?.mockReset?.();});

describe('coingeckoIdForMint', () => {
  it('maps native→solana, USDC→usd-coin, NOC→null', () => {
    expect(coingeckoIdForMint('native')).toBe('solana');
    expect(coingeckoIdForMint(USDC_MINT)).toBe('usd-coin');
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
  it('extracts the price column from market_chart', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({prices: [[1000, 100], [2000, 110], [3000, 120]]}),
    })) as unknown as typeof fetch;
    const r = await fetchPriceHistory('solana', '7D');
    expect(r.prices).toEqual([100, 110, 120]);
  });
  it('throws on non-200', async () => {
    global.fetch = jest.fn(async () => ({ok: false, status: 429, json: async () => ({})})) as unknown as typeof fetch;
    await expect(fetchPriceHistory('solana', '24H')).rejects.toThrow();
  });
});

describe('TIMEFRAME_DAYS', () => {
  it('maps timeframes to day counts', () => {
    expect(TIMEFRAME_DAYS['24H']).toBe(1);
    expect(TIMEFRAME_DAYS.All).toBe('max');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest --testPathPattern=priceHistory`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/modules/prices/priceHistory.ts`:
```ts
import {USDC_MINT} from '../tokens/coreTokens';
import {NOC_MINT} from '../../constants/programs';

export type Timeframe = '24H' | '7D' | '30D' | '1Y' | 'All';

export const TIMEFRAME_DAYS: Record<Timeframe, number | 'max'> = {
  '24H': 1, '7D': 7, '30D': 30, '1Y': 365, All: 'max',
};

export interface PriceHistory {prices: number[]} // oldest → newest

/** CoinGecko id for a mint, or null when the token has no market (NOC). */
export function coingeckoIdForMint(mint: string): string | null {
  if (mint === 'native') return 'solana';
  if (mint === USDC_MINT) return 'usd-coin';
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

/**
 * Fetch a USD price series from CoinGecko market_chart. Plain fetch (public
 * data, cert not pinned), 8s timeout. Throws on timeout / non-200 / parse.
 */
export async function fetchPriceHistory(coingeckoId: string, tf: Timeframe): Promise<PriceHistory> {
  const days = TIMEFRAME_DAYS[tf];
  const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=usd&days=${days}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {signal: controller.signal});
    if (!res.ok) throw new Error(`CoinGecko market_chart HTTP ${res.status}`);
    const body = (await res.json()) as {prices?: [number, number][]};
    if (!Array.isArray(body.prices)) throw new Error('market_chart missing prices');
    return {prices: body.prices.map(p => p[1])};
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest --testPathPattern=priceHistory && npx tsc --noEmit`
Expected: PASS; tsc 0.

- [ ] **Step 5: Commit**

```bash
git add src/modules/prices/priceHistory.ts src/modules/prices/__tests__/priceHistory.test.ts
git commit -m "feat(prices): CoinGecko market_chart history + change-over-series

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: usePriceHistory hook

**Files:**
- Create: `src/hooks/usePriceHistory.ts`

No unit test (thin React Query wrapper). Verified by tsc.

- [ ] **Step 1: Implement**

```ts
import {useQuery} from '@tanstack/react-query';
import {fetchPriceHistory, type PriceHistory, type Timeframe} from '../modules/prices/priceHistory';

/**
 * CoinGecko price history for a token over a timeframe. Disabled when the token
 * has no market (coingeckoId null → NOC). History is slow-moving: 5min stale.
 */
export function usePriceHistory(coingeckoId: string | null, tf: Timeframe) {
  return useQuery<PriceHistory>({
    queryKey: ['priceHistory', coingeckoId, tf],
    queryFn: () => fetchPriceHistory(coingeckoId as string, tf),
    enabled: coingeckoId != null,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}
```

- [ ] **Step 2: tsc + commit**

Run: `npx tsc --noEmit` → exit 0.
```bash
git add src/hooks/usePriceHistory.ts
git commit -m "feat(prices): usePriceHistory hook

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: SparkChart component

**Files:**
- Create: `src/components/SparkChart.tsx`
- Test: `src/components/__tests__/sparkChart.test.ts`

- [ ] **Step 1: Write the failing test for the pure helper**

Create `src/components/__tests__/sparkChart.test.ts`:
```ts
import {seriesToPath} from '../SparkChart';

describe('seriesToPath', () => {
  it('maps a rising series to a path ending at the right edge', () => {
    const r = seriesToPath([1, 2, 3], 300, 100);
    expect(r.lastX).toBeCloseTo(300, 5);
    // rising series → last point near the top (small y) given padding
    expect(r.lastY).toBeLessThan(r.firstY);
    expect(r.line.startsWith('M')).toBe(true);
    expect(r.area.endsWith('Z')).toBe(true);
  });
  it('handles a flat series without NaN', () => {
    const r = seriesToPath([5, 5, 5], 300, 100);
    expect(r.line).not.toMatch(/NaN/);
    expect(r.area).not.toMatch(/NaN/);
  });
  it('returns empty paths for <2 points', () => {
    expect(seriesToPath([5], 300, 100).line).toBe('');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest --testPathPattern=sparkChart`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/components/SparkChart.tsx`:
```tsx
import React from 'react';
import {View} from 'react-native';
import Svg, {Path, Line, Circle} from 'react-native-svg';

export interface SparkPath {line: string; area: string; firstY: number; lastX: number; lastY: number}

/**
 * Map a price series to SVG path `d` strings, normalized to [pad, height-pad].
 * x is evenly spaced across width. Returns empty strings for <2 points.
 */
export function seriesToPath(prices: number[], width: number, height: number): SparkPath {
  if (prices.length < 2) return {line: '', area: '', firstY: 0, lastX: 0, lastY: 0};
  const pad = 8;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1; // flat series → avoid /0
  const innerH = height - pad * 2;
  const n = prices.length;
  const x = (i: number) => (i / (n - 1)) * width;
  const y = (p: number) => pad + (1 - (p - min) / span) * innerH;
  const pts = prices.map((p, i) => `${x(i).toFixed(2)},${y(p).toFixed(2)}`);
  const line = 'M' + pts.join(' L');
  const area = `M${x(0).toFixed(2)},${height} L` + pts.join(' L') + ` L${width.toFixed(2)},${height} Z`;
  return {line, area, firstY: y(prices[0]), lastX: x(n - 1), lastY: y(prices[n - 1])};
}

interface SparkChartProps {prices: number[]; width?: number; height?: number; up: boolean}

export function SparkChart({prices, width = 360, height = 120, up}: SparkChartProps) {
  const {line, area, lastX, lastY} = seriesToPath(prices, width, height);
  const color = up ? '#3FD68B' : '#F87171';
  if (!line) return <View style={{height}} />;
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <Path d={area} fill={color} fillOpacity={0.12} />
      <Path d={line} stroke={color} strokeWidth={2} fill="none" />
      <Circle cx={lastX} cy={lastY} r={4} fill={color} />
    </Svg>
  );
}

export function SparkChartSkeleton({height = 120}: {height?: number}) {
  return <View style={{height}} className="bg-bg-surface-2 rounded-lg" />;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest --testPathPattern=sparkChart && npx tsc --noEmit`
Expected: PASS; tsc 0. (If jest can't resolve `react-native-svg` in the test env, the `seriesToPath` test still runs since it imports only the pure helper — confirm the test imports `seriesToPath` and does NOT render the component.)

- [ ] **Step 5: Commit**

```bash
git add src/components/SparkChart.tsx src/components/__tests__/sparkChart.test.ts
git commit -m "feat(ui): SparkChart price chart + seriesToPath helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: SendScreen initialMint prefill + nav threading

**Files:**
- Modify: `src/screens/transparent/SendScreen.tsx`, `src/types/navigation.d.ts`, `src/app/Navigator.tsx`

- [ ] **Step 1: Add `initialMint` to SendScreen**

In `src/screens/transparent/SendScreen.tsx`:
- In `SendScreenProps` (the exported interface at line ~91) add: `initialMint?: string;`.
- Change the signature `export function SendScreen({onReview, onBack}: SendScreenProps)` → `export function SendScreen({onReview, onBack, initialMint}: SendScreenProps)`.
- Change `const [selectedMint, setSelectedMint] = useState(SOL_MINT);` → `const [selectedMint, setSelectedMint] = useState(initialMint ?? SOL_MINT);`.

- [ ] **Step 2: Thread the param through navigation types**

In `src/types/navigation.d.ts`:
- Change `SendModal: undefined;` → `SendModal: {initialMint?: string} | undefined;`.
- In `SendStackParamList`, change `Send: undefined;` → `Send: {initialMint?: string} | undefined;`.
- Add to `RootStackParamList`: `TokenDetailModal: {mint: string};`.

- [ ] **Step 3: Thread the param through the navigator**

In `src/app/Navigator.tsx`:
- `SendStack` must forward the root `SendModal` param into the `Send` screen. Change `function SendStack()` to read the route and set `initialParams`:
```tsx
function SendStack() {
  const route = useRoute<RouteProp<RootStackParamList, 'SendModal'>>();
  return (
    <SendNav.Navigator screenOptions={defaultScreenOptions}>
      <SendNav.Screen
        name="Send"
        component={SendScreenNav}
        initialParams={{initialMint: route.params?.initialMint}}
      />
      <SendNav.Screen name="TxSimulate" component={TxSimulateScreenNav} />
      <SendNav.Screen name="TxConfirm" component={TxConfirmScreenNav} />
      <SendNav.Screen name="TransactionStatus" component={TransactionStatusScreenNav} />
      <SendNav.Screen name="TransactionDetail" component={TransactionDetailScreenNav} />
    </SendNav.Navigator>
  );
}
```
(`useRoute` and `RouteProp` are already imported in this file — verify; if not, add them from `@react-navigation/native`.)
- `SendScreenNav` reads the `Send` route param and passes it down:
```tsx
function SendScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<SendStackParamList>>();
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<SendStackParamList, 'Send'>>();
  return (
    <SendScreenImpl
      onReview={intent => navigation.navigate('TxSimulate', {intent})}
      onBack={() => rootNav.goBack()}
      initialMint={route.params?.initialMint}
    />
  );
}
```

- [ ] **Step 4: tsc + existing send tests**

Run: `npx tsc --noEmit && npx jest --testPathPattern="SendScreen|transparent"`
Expected: tsc 0; existing tests pass (the new prop is optional, so existing call sites are unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/screens/transparent/SendScreen.tsx src/types/navigation.d.ts src/app/Navigator.tsx
git commit -m "feat(send): initialMint prefill via SendModal param

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: TokenDetailScreen (#28)

**Files:**
- Create: `src/screens/transparent/TokenDetailScreen.tsx`
- Modify: `src/constants/mmkvKeys.ts` (timeframe key prefix)
- Test: `src/screens/transparent/__tests__/TokenDetailScreen.test.tsx`

Build to the §28 design. This is integration — keep the screen-test light; the chart/price/format logic is unit-tested in Tasks 2 & 4.

- [ ] **Step 1: Add the MMKV timeframe key helper**

In `src/constants/mmkvKeys.ts`, add to the keys object a prefix entry, e.g. `TOKEN_TIMEFRAME_PREFIX: 'v1_token.timeframe.'` (used as `` `${MMKV_KEYS.TOKEN_TIMEFRAME_PREFIX}${mint}` ``). Match the file's existing structure/naming.

- [ ] **Step 2: Write a light failing test**

Create `src/screens/transparent/__tests__/TokenDetailScreen.test.tsx`:
```tsx
import React from 'react';
import {render} from '@testing-library/react-native';
import {TokenDetailScreen} from '../TokenDetailScreen';

jest.mock('../../../hooks/useResolvedPrices', () => ({
  useResolvedPrices: () => ({
    prices: {native: {usd: 150, change24h: 2}},
    havePrices: true,
  }),
}));
jest.mock('../../../hooks/usePriceHistory', () => ({
  usePriceHistory: () => ({data: {prices: [100, 120, 150]}, isLoading: false, isError: false}),
}));
jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: () => ({solBalance: '2000000000', nocBalance: '0', tokenBalances: {}, tokens: []}),
}));

describe('TokenDetailScreen', () => {
  it('renders the SOL price and a Send action', () => {
    const onSend = jest.fn();
    const {getByText} = render(
      <TokenDetailScreen mint="native" onBack={() => {}} onSend={onSend} onReceive={() => {}} />,
    );
    expect(getByText('Send')).toBeTruthy();
  });
});
```
(If the project's test setup needs providers/wrappers — check an existing screen test like `TransactionDetailScreen.test.tsx` and mirror its render setup / mocks.)

- [ ] **Step 3: Run to verify it fails**

Run: `npx jest --testPathPattern=TokenDetailScreen`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the screen**

Create `src/screens/transparent/TokenDetailScreen.tsx`. Build it to §28 (see the spec for exact DS class → variant mapping; mirror `TransactionDetailScreen`/dashboard styling conventions). Required structure & data wiring:

```tsx
import React, {useState} from 'react';
import {View, Pressable, ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, Send as SendIcon, ArrowDownToLine, Repeat, TrendingUp, TrendingDown} from 'lucide-react-native';
import {Text, Button} from '../../components/ui';
import {TokenLogo} from '../../components/TokenLogo';
import {SparkChart, SparkChartSkeleton} from '../../components/SparkChart';
import {useResolvedPrices} from '../../hooks/useResolvedPrices';
import {usePriceHistory} from '../../hooks/usePriceHistory';
import {buildHoldings} from '../../modules/prices/holdings';
import {computePortfolio} from '../../modules/prices/portfolio';
import {coingeckoIdForMint, changeOverSeries, type Timeframe} from '../../modules/prices/priceHistory';
import {formatUsd, formatUsdString} from '../../utils/formatUsd';
import {formatBalanceForDisplay} from '../../utils/parseTokenAmount';
import {useWalletStore} from '../../store/zustand/walletStore';
import {NOC_MINT} from '../../constants/programs';
import {CORE_TOKENS} from '../../modules/tokens/coreTokens';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';

const TIMEFRAMES: Timeframe[] = ['24H', '7D', '30D', '1Y', 'All'];

interface Props {
  mint: string;
  onBack: () => void;
  onSend: (mint: string) => void;
  onReceive: () => void;
}

export function TokenDetailScreen({mint, onBack, onSend, onReceive}: Props) {
  const {solBalance, nocBalance, tokenBalances, tokens} = useWalletStore();
  const {prices, havePrices} = useResolvedPrices();
  const isNoc = mint === NOC_MINT;
  const isSol = mint === 'native';

  // token meta (symbol/name/decimals)
  const meta =
    isSol
      ? {symbol: 'SOL', name: 'Solana', decimals: 9}
      : CORE_TOKENS.find(t => t.mint === mint) ?? tokens.find(t => t.mint === mint) ?? {symbol: '?', name: 'Token', decimals: 9};

  // balance + fiat
  const balanceRaw = isSol ? solBalance : (tokenBalances[mint] ?? (isNoc ? nocBalance : '0'));
  const price = prices[mint]?.usd ?? null;
  const uiAmount = Number(balanceRaw || '0') / 10 ** meta.decimals;
  const fiat = price != null ? uiAmount * price : null;

  // portfolio % (shared holdings)
  const holdings = buildHoldings({solBalance, nocBalance, tokenBalances, tokens});
  const portfolio = computePortfolio(holdings, prices);
  const pct = portfolio.totalUsd > 0 && portfolio.perToken[mint]
    ? (portfolio.perToken[mint].usd / portfolio.totalUsd) * 100
    : null;

  // timeframe (persisted)
  const tfKey = `${MMKV_KEYS.TOKEN_TIMEFRAME_PREFIX}${mint}`;
  const [tf, setTf] = useState<Timeframe>(
    (mmkvPublic.getString(tfKey) as Timeframe) || '24H',
  );
  const onPickTf = (next: Timeframe) => {
    setTf(next);
    mmkvPublic.set(tfKey, next);
  };

  // chart (no chart for NOC)
  const cgId = coingeckoIdForMint(mint);
  const history = usePriceHistory(cgId, tf);
  const series = history.data?.prices ?? [];
  const change = isNoc ? null : changeOverSeries(series);

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      {/* Top bar: back + symbol */}
      {/* Price hero: TokenLogo + name + ticker (NOC → "NOC · pre-TGE") + price (havePrices ? formatUsdString(price) : '—') + change line (hidden when change==null) */}
      {/* NOC: muted "Pre-TGE · no market chart yet" instead of chart + timeframe */}
      {/* else: SparkChart (history.isLoading ? skeleton : series→chart, isError → "Chart unavailable") + timeframe chips */}
      {/* Holdings card: YOUR HOLDINGS / {formatBalanceForDisplay(balanceRaw, meta.decimals)} {meta.symbol} / {fiat!=null ? formatUsdString(fiat) : '—'} / {pct!=null ? pct.toFixed(1)+'% of portfolio' : ''} */}
      {/* Quick actions: Send → onSend(mint), Receive → onReceive(), Swap (disabled "Soon"). Shield/Stake omitted. */}
    </SafeAreaView>
  );
}
```
Fill in the JSX to match §28 (top bar, price hero, chart/timeframe, holdings card, actions) using the project's `Text variant`s, NativeWind classes (`bg-bg-surface-1`, `rounded-2xl`, `text-fg-*`, `text-success`/`text-danger`, `text-accent-transparent`), and `≥44px` touch targets for the chips. The change line format: `` `${change.absUsd>=0?'+':'−'}${formatUsdString(Math.abs(change.absUsd))} · ${change.pct>=0?'+':''}${change.pct.toFixed(2)}% · ${tf}` `` with green/red + TrendingUp/Down. Use `Button` from `components/ui` or `Pressable` for the quick-action cells, matching the dashboard's action-row styling. Swap cell is a disabled `Pressable` with label "Swap" + sub "Soon".

- [ ] **Step 5: Run to verify it passes**

Run: `npx jest --testPathPattern=TokenDetailScreen && npx tsc --noEmit && npx eslint src/screens/transparent/TokenDetailScreen.tsx`
Expected: PASS; tsc 0; no eslint errors. If the light render test needs more mocks (navigation, safe-area), mirror an existing screen test's setup.

- [ ] **Step 6: Commit**

```bash
git add src/screens/transparent/TokenDetailScreen.tsx src/screens/transparent/__tests__/TokenDetailScreen.test.tsx src/constants/mmkvKeys.ts
git commit -m "feat(token-detail): #28 per-token screen — price, chart, holdings, actions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Navigation wiring (TokenDetailModal + onTokenTap)

**Files:**
- Modify: `src/app/Navigator.tsx`

(`TokenDetailModal` route type was added in Task 5 Step 2.)

- [ ] **Step 1: Add a `TokenDetailScreenNav` wrapper + register the modal**

In `src/app/Navigator.tsx`, add a wrapper component (near `ReceiveScreenNav`):
```tsx
function TokenDetailScreenNav() {
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TokenDetailModal'>>();
  return (
    <TokenDetailScreen
      mint={route.params.mint}
      onBack={() => rootNav.goBack()}
      onSend={mint => rootNav.navigate('SendModal', {initialMint: mint === 'native' ? SOL_MINT : mint})}
      onReceive={() => rootNav.navigate('ReceiveModal')}
    />
  );
}
```
Add the import at the top: `import {TokenDetailScreen} from '../screens/transparent/TokenDetailScreen';` and ensure `SOL_MINT` is imported (from `../constants/programs` — check the existing imports; add if missing).
Register it next to the `SendModal`/`ReceiveModal` screens (line ~666):
```tsx
      <RootNav.Screen name="TokenDetailModal" component={TokenDetailScreenNav} options={modalScreenOptions} />
```

- [ ] **Step 2: Wire `onTokenTap` from the dashboard**

In `DashboardScreenNav` (line ~286), add the prop to `<DashboardScreen ... />`:
```tsx
      onTokenTap={mint => rootNav.navigate('TokenDetailModal', {mint})}
```

- [ ] **Step 3: tsc + lint + tests**

Run: `npx tsc --noEmit && npx eslint src/app/Navigator.tsx && npx jest --testPathPattern="dashboard|TokenDetail"`
Expected: tsc 0; no eslint errors; tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/Navigator.tsx
git commit -m "feat(nav): TokenDetailModal route + wire dashboard onTokenTap

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Full verification + on-device

**Files:** none.

- [ ] **Step 1: Full suite + tsc + lint**

Run: `npx jest && npx tsc --noEmit && npx eslint .`
Expected: all tests pass; tsc 0; eslint no NEW errors (the pre-existing `e2e/helpers.ts` error and inline-style warnings are unrelated).

- [ ] **Step 2: Mainnet APK build (agent builds, user sideloads)**

Swap `.env` to mainnet with the user's Helius key, `cd android && ./gradlew assembleRelease`, revert `.env` to devnet, copy the APK to `/home/user/Downloads/` (the established flow).

- [ ] **Step 3: On-device verification**

- Tap **SOL** row → detail opens with logo, live price, a chart; switching 24H/7D/30D/1Y/All updates the chart + the change line; holdings show balance + fiat + "% of portfolio".
- Tap **USDC** → chart renders (≈ flat near $1).
- Tap **NOC** → "NOC · pre-TGE", NO chart, "Pre-TGE · no market chart yet", holdings + fiat at the presale price.
- **Send** from the detail opens Send with that token preselected; **Receive** opens Receive; **Swap** shows "Soon" (disabled).
- Back returns to the dashboard.

If anything misbehaves, STOP and use `superpowers:systematic-debugging`.

---

## Self-Review

**1. Spec coverage:**
- Navigation: TokenDetailModal + onTokenTap → Tasks 5 (type), 7. ✓
- Screen layout (top bar, price hero, chart, timeframe, holdings, actions) → Task 6. ✓
- SparkChart + seriesToPath → Task 4. ✓
- priceHistory (market_chart, TIMEFRAME_DAYS, coingeckoIdForMint, changeOverSeries) → Task 2. ✓
- usePriceHistory → Task 3. ✓
- NOC variant (no chart, pre-TGE, presale price) → Task 6 (data: `isNoc`, `coingeckoIdForMint`→null, change null). ✓
- Quick actions (Send prefill, Receive, Swap "Soon", Shield/Stake omitted) → Tasks 5 (prefill), 6. ✓
- Holdings "% of portfolio" via computePortfolio → Task 6. ✓
- Timeframe persistence (MMKV) → Task 6. ✓
- Shared extractions (formatUsd, TokenLogo, buildHoldings, useResolvedPrices) → Task 1. ✓
- Error states (chart unavailable, prices `—`, NOC) → Task 6. ✓
- Tests: priceHistory, seriesToPath, holdings, formatUsd, light screen → Tasks 1,2,4,6. ✓
- Out of scope (mode-split, tx list, real swap/stake/shield, more-menu) → not implemented (correct). ✓

**2. Placeholder scan:** Task 6 Step 4 gives the full data-wiring code + a JSX skeleton with explicit content per region and the change-line format string; the implementer fills JSX to the design (consistent with how prior screens #21/#27 were built). No TBD/TODO. Other tasks have complete code.

**3. Type consistency:** `Timeframe` (Task 2) used in Tasks 3, 4-not, 6. `PriceHistory.prices: number[]` consistent (Task 2 → 3 → 6). `seriesToPath(prices, width, height)` (Task 4) returns `{line, area, firstY, lastX, lastY}` used by SparkChart + test. `coingeckoIdForMint`/`changeOverSeries` (Task 2) used in Task 6. `buildHoldings(args)` (Task 1) → `Holding[]` used in Task 6 + dashboard. `formatUsd`/`formatUsdString` (Task 1) used in Task 6 + dashboard. `useResolvedPrices()` → `{prices, havePrices}` (Task 1) used in Task 6 + dashboard. `initialMint` (Task 5) param chain SendModal→SendStack→Send→SendScreen consistent. `TokenDetailModal: {mint: string}` (Task 5) used in Task 7. ✓
