# #28 Token Detail — Design

**Status:** Approved (brainstorming), pending spec review.
**Date:** 2026-06-15
**Branch:** `feat/token-detail` — STACKS on `feat/dashboard-prices` (PR #18, unmerged): needs `usePrices`, `computePortfolio`, `priceModule`, `formatUsd`/`groupInteger`, `TokenLogo`. Rebase `--onto origin/main` after #18 merges.
**Design source of truth:** `/home/user/Downloads/index.html` §28 (`#s28`, lines 12410-12734) + `screen.md` §28 (lines 329-337).

## Goal

Make a token row on the dashboard open a per-token detail screen (#28) — the universal wallet pattern. Today the `>` chevron is a no-op (`onTokenTap` is defined but never passed by the navigator, and the screen doesn't exist). Build the #28 screen to the design: price hero + chart + timeframe picker + holdings + quick actions.

Scope is **transparent v1**: shielded features are gated (`FEATURES.shielded === false`), so the mode-split holdings and the Shield action are omitted for now. Swap and Stake screens don't exist, so Swap is a disabled "Soon" and Stake is omitted.

## A. Navigation

- Add a root-stack route `TokenDetailModal: {mint: string}` to `RootStackParamList` (`src/types/navigation.d.ts`) and register the screen in the root navigator (`src/app/Navigator.tsx`), alongside `SendModal`/`ReceiveModal`.
- In `DashboardScreenNav` (Navigator.tsx ~line 286), pass `onTokenTap={(mint) => rootNav.navigate('TokenDetailModal', {mint})}` to `DashboardScreen`. (The `onTokenTap` prop and the row `onPress` already exist; they're just unwired.)

## B. `TokenDetailScreen` — `src/screens/transparent/TokenDetailScreen.tsx`

Props: `{mint: string; onBack: () => void; onSend: (mint: string) => void; onReceive: () => void}` (the navigator wires `onSend`→SendModal w/ initialMint, `onReceive`→ReceiveModal, `onBack`→goBack).

Resolve the token from the wallet store + `CORE_TOKENS`: symbol, name, decimals, balance (`solBalance` for `'native'`, `nocBalance`/`tokenBalances[mint]` otherwise), and whether it's NOC (`mint === NOC_MINT`) or native SOL (`'native'`). Determine the CoinGecko id: SOL→`solana`, USDC→`usd-coin`, else none (no chart).

Layout (build to §28 DS classes — `noc-h3`, `noc-balance-lg`, `noc-numeral`, `noc-body-lg/sm`, `noc-overline`, etc., mapped to the project's NativeWind `Text variant`s as the dashboard does):

1. **Top bar**: back button (ArrowLeft) + token symbol (h2/`noc-h3`) + a "more" (3-dot) button that is rendered but inert (no menu — out of scope; OR omit it — implementer's choice, keep it visually balanced).
2. **Price hero**: `TokenLogo` (reuse from dashboard) + token name (`body-lg`) + ticker (`body-sm`, for NOC show `"NOC · pre-TGE"`). Current **USD price** (`usePrices()` → `prices[mint].usd`; NOC → presale stage price via `nocUsdPriceForStage`) rendered large (`noc-balance-lg`). **Change line**: for the selected timeframe — `{+|−}${absUsd} · {+|−}X.XX% · {label}` with TrendingUp(green)/TrendingDown(red); computed from the chart series (first vs last). When no series (NOC, or fetch failed) the change line is hidden.
3. **SparkChart** (component B-2) from the selected timeframe's series, 120px tall. Skeleton while loading; "Chart unavailable" text on error; omitted entirely for NOC.
4. **Timeframe picker** (`.chip-row`): `24H | 7D | 30D | 1Y | All`, active chip highlighted, ≥44×44 touch targets. Selecting one refetches the series and recomputes the hero change. Persist the selection per-token in MMKV key `v1_token.<mint>.timeframe` (default `24H`). Hidden for NOC (no chart).
5. **Holdings card**: `YOUR HOLDINGS` overline; balance (`formatBalanceForDisplay`, `noc-balance-md`) + `{symbol}`; fiat sub (`formatUsd(balance × price)`); right side `"{pct}% of portfolio"` where `pct = perToken[mint].usd / totalUsd × 100` from `computePortfolio` over the dashboard holdings (compute the same holdings list here, or extract a shared helper). Mode-split (Transparent/Shielded) is OMITTED (shielded gated).
6. **Quick actions** (`.actions`, 4-col grid, `.qa` cards): **Send** (Send icon → `onSend(mint)`), **Receive** (→ `onReceive()`), **Swap** (Swap icon, disabled, label "Soon", muted), and a 4th cell that is **empty/hidden** (Shield gated off; Stake has no screen). Keep the grid visually balanced (e.g. 3 active cells + the disabled Swap, or 3 cells if cleaner — implementer matches the design's spacing).

### B-2. `SparkChart` component — `src/components/SparkChart.tsx`

- Props: `{prices: number[]; width?: number; height?: number; up: boolean}` (color green when up, red when down).
- Pure helper `seriesToPath(prices: number[], width: number, height: number): {line: string; area: string; lastX: number; lastY: number}` — maps the series to SVG path `d` strings (min/max normalized to height with a small top/bottom padding; x evenly spaced). Exported for unit testing.
- Renders `react-native-svg` `Svg` with a baseline `Line`, an `area` `Path` (filled, low-opacity gradient or flat tint), a `line` `Path` (stroke), and a `Circle` dot at the last point. `preserveAspectRatio="none"`, viewBox `0 0 {width} {height}`.
- A `SparkChartSkeleton` (or a `loading` prop) renders a 120px shimmer placeholder.

## C. NOC variant

NOC has no market. The screen for NOC: price hero shows the **presale stage price** (`nocUsdPriceForStage(currentStage)` / `pricePerNoc`), ticker `"NOC · pre-TGE"`, NO chart, NO timeframe picker, NO change line; instead a single muted line **"Pre-TGE · no market chart yet"**. Holdings card + Send/Receive actions render normally. (Stake omitted — no screen.)

## D. Data modules

### `src/modules/prices/priceHistory.ts`
```ts
export interface PriceHistory { prices: number[]; } // close prices, oldest→newest
export type Timeframe = '24H' | '7D' | '30D' | '1Y' | 'All';
export const TIMEFRAME_DAYS: Record<Timeframe, number | 'max'> = {
  '24H': 1, '7D': 7, '30D': 30, '1Y': 365, All: 'max',
};
// coingeckoId: 'solana' | 'usd-coin'. Plain fetch, 8s timeout. Throws on failure.
export async function fetchPriceHistory(coingeckoId: string, tf: Timeframe): Promise<PriceHistory>;
```
- CoinGecko: `https://api.coingecko.com/api/v3/coins/{id}/market_chart?vs_currency=usd&days={n}` → `{prices: [[ts, price], …]}` → map to `number[]` (the price column). Same plain-fetch + timeout + privacy posture as `priceModule`.
- `coingeckoIdForMint(mint): string | null` helper (SOL `'native'`→`solana`, `USDC_MINT`→`usd-coin`, else null). Put it next to `fetchPriceHistory` (or in `priceModule`).

### `src/hooks/usePriceHistory.ts`
```ts
export function usePriceHistory(coingeckoId: string | null, tf: Timeframe): UseQueryResult<PriceHistory>;
```
- React Query: `queryKey: ['priceHistory', coingeckoId, tf]`, `enabled: coingeckoId != null`, `staleTime: 5 * 60_000`, `gcTime: 30 * 60_000`. No refetchInterval (history is slow-moving).

### Change-over-timeframe (pure)
`changeOverSeries(prices: number[]): {absUsd: number; pct: number} | null` — `last - first` and `(last-first)/first*100`; null when `< 2` points or first is 0. Put in `priceHistory.ts`. Used by the hero change line.

## E. SendScreen prefill

- Change `SendModal` route type from `undefined` to `{initialMint?: string} | undefined` in `navigation.d.ts`.
- `SendScreen` accepts an optional `initialMint` prop; `selectedMint` initializes to `initialMint ?? SOL_MINT` (`useState(initialMint ?? SOL_MINT)`). The navigator passes `route.params?.initialMint`.
- TokenDetail's Send action navigates `SendModal` with `{initialMint: mint}` (for `'native'` pass `SOL_MINT`).

## E-bis. Shared helpers (DRY — avoid duplicating dashboard logic)

`formatUsd` and the holdings-list assembly currently live module-private inside `DashboardScreen.tsx`. To reuse them in TokenDetail without duplication:
- Extract `formatUsd(value): {whole: string; cents: string}` to `src/utils/formatUsd.ts` (uses `groupInteger`); import it in both `DashboardScreen` and `TokenDetailScreen`. Also export a flat `formatUsdString(value): string` (= `whole + cents`) to replace the per-row IIFE.
- Extract the holdings-list builder to `src/modules/prices/holdings.ts`: `buildHoldings({solBalance, nocBalance, tokenBalances, tokens}): Holding[]` (the exact logic now inlined in the dashboard `useMemo`). Both the dashboard and TokenDetail's "% of portfolio" use it → identical totals.
- These extractions are refactors of just-added code (PR #18), so keep them mechanical and behavior-preserving; the dashboard's existing tests must stay green.

## F. Error handling / states

- **Loading**: price-hero skeleton (logo + lines) + chart skeleton (per §28a).
- **Chart fetch error**: hide the chart + change line, show a muted "Chart unavailable" line; the price hero (current price from `usePrices`), timeframe picker, holdings, and actions still render.
- **Prices unavailable**: price hero shows `—` for price (like the dashboard); holdings fiat hides; balances still show.
- **NOC**: per section C (no chart path at all).
- Hidden-balance MMKV flag (`v1_balance_hidden`): balances/fiat blur to `····` consistent with the dashboard (reuse the same gate). Chart + price stay visible (public data).

## G. Testing

- `priceHistory.test.ts`: `fetchPriceHistory` parses a mocked `market_chart` (`{prices:[[t,p],…]}`) → `number[]`; non-200/abort → throws. `changeOverSeries` → abs+pct for a known series; null for <2 points / first 0. `coingeckoIdForMint` mapping (native→solana, USDC→usd-coin, NOC→null).
- `SparkChart.test.tsx` / `seriesToPath` test: a known series → expected normalized path endpoints (assert `lastX`/`lastY` and that line/area strings are non-empty and start/end correctly); flat series (all equal) → no NaN.
- `TokenDetailScreen.test.tsx` (light): mock store + hooks → SOL renders price/holdings/actions; NOC renders the pre-TGE line and NO chart; Send action calls `onSend`.
- On-device (mainnet): tap SOL → detail with live chart + timeframe switching + holdings + working Send (prefilled SOL) / Receive; tap USDC → chart; tap NOC → pre-TGE, no chart, holdings + Send/Receive.

## H. Out of scope (stated, not silently dropped)

- Mode-split holdings (Transparent/Shielded breakdown) — shielded gated (`FEATURES.shielded === false`).
- Per-token Activity/transaction list — the design defers it to v0.3.
- Real Swap, Stake, Shield destination screens — Swap is a disabled "Soon"; Shield/Stake omitted.
- The top-bar "more" (3-dot) menu actions.
- Backend price proxy (privacy) — same as the dashboard-prices cycle.
