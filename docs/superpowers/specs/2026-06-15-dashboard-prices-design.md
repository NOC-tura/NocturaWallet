# Dashboard — live USD prices, fiat values, formatting & USDC logo — Design

**Status:** Approved (brainstorming), pending spec review.
**Date:** 2026-06-15
**Branch:** `feat/dashboard-prices` (off `origin/main`)
**Design source of truth:** `/home/user/Downloads/index.html` §11 (`#s11`) + `screen.md` lines 141-150.

## Goal

Make the dashboard (#11) show REAL values instead of placeholders, and finish the design elements that are currently missing. Today: TOTAL BALANCE shows `$0.00` (store `totalUsdValue` is never updated), the `+2.34% · 24h` line is a hardcoded literal, token rows have no fiat/% column (the design specifies one), NOC amounts render without thousand separators, and USDC shows a "U" letter-avatar instead of a logo.

Five outcomes:
1. TOTAL BALANCE = real USD sum of holdings (`$14,881.19` format).
2. `+X.XX% · 24h` = real, USD-weighted 24h portfolio change (green up / red down), hidden when no price data.
3. Each token row shows its USD value + 24h % (per design §11) — currently missing.
4. Token amounts use thousand separators (`69,119,998 NOC`, SOL `17.0276`).
5. USDC shows a real logo.

## Price source — CoinGecko (direct)

New module `src/modules/prices/priceModule.ts`:

```ts
export interface TokenPrice {
  usd: number;
  change24h: number | null; // percent; null when unknown (no market)
}
// keyed by the app's mint key: 'native' (SOL), NOC_MINT, USDC mint
export async function fetchPrices(): Promise<Record<string, TokenPrice>>;
```

- Calls CoinGecko: `https://api.coingecko.com/api/v3/simple/price?ids=solana,usd-coin&vs_currencies=usd&include_24hr_change=true`.
- Uses **plain `fetch`** (NOT `pinnedFetch`): this is public market data on a third-party host whose cert we don't pin. A 6 s `AbortController` timeout. No API key.
- Maps the response → `{'native': {usd: solana.usd, change24h: solana.usd_24h_change}, [USDC_MINT]: {usd: usd-coin.usd, change24h: usd-coin.usd_24h_change}}`.
- **NOC** is not on CoinGecko (presale). NOC price is the current presale stage price — see below. `change24h: null`.
- On any failure (offline, timeout, non-200, parse) → throws; the React Query hook keeps the last cached value (or none).

**Privacy note:** this is a direct third-party call (the user's IP reaches CoinGecko). It leaks only "a wallet asked for SOL/USDC prices" — identical for every user, never balances or addresses. A backend price proxy (full privacy) is out of scope (no backend price endpoint exists yet).

### NOC price (presale stage)

NOC's USD price = the current presale stage price, which changes per stage. Source of truth, in order:
1. `usePresaleStore().pricePerNoc` (string) when populated — authoritative, set by the presale sync.
2. Fallback constant table `PRESALE_STAGE_PRICES` indexed by `currentStage` (default stage 1).

Add to `src/constants/programs.ts` (or a new `src/constants/presale.ts`):
```ts
// USD price per NOC by presale stage (1-indexed display; array is 0-indexed).
export const PRESALE_STAGE_PRICES: readonly number[] = [
  0.1501, 0.1723, 0.1945, 0.2167, 0.2389,
  0.2611, 0.2833, 0.3055, 0.3277, 0.3499,
];
```
NOC price resolution helper:
```ts
nocUsdPrice = Number(presale.pricePerNoc) > 0
  ? Number(presale.pricePerNoc)
  : (PRESALE_STAGE_PRICES[(presale.currentStage ?? 1) - 1] ?? PRESALE_STAGE_PRICES[0]);
```
(The presale CARD's hardcoded "Stage 1 / $0.1501" text is NOT rewired here — out of scope; only the NOC token price for balance/fiat uses the table.)

### Hook

`src/hooks/usePrices.ts`:
```ts
export function usePrices(): UseQueryResult<Record<string, TokenPrice>>;
```
- React Query: `queryKey: ['prices']`, `queryFn: fetchPrices`, `staleTime: 60_000`, `gcTime: 5 * 60_000`, `refetchInterval: 60_000`. NOC entry is merged in by the consumer (it comes from the presale store, not the fetch).

## Portfolio computation (pure, testable)

`src/modules/prices/portfolio.ts`:
```ts
export interface Holding { mint: string; amountRaw: string; decimals: number; }
export interface PortfolioValue {
  totalUsd: number;
  change24hPct: number | null;       // USD-weighted; null if no priced holding has a change
  perToken: Record<string, {usd: number; change24h: number | null}>; // mint → fiat value
}
export function computePortfolio(
  holdings: Holding[],
  prices: Record<string, TokenPrice>,
): PortfolioValue;
```
- Per holding: `uiAmount = Number(amountRaw) / 10**decimals`; `usd = uiAmount * price.usd`.
- `totalUsd = Σ usd`.
- `change24hPct = Σ(usd_i * change_i) / Σ(usd_i)` over holdings whose `change24h != null` (SOL); `null` if that set is empty or total is 0.
- All money math stays in `number` for DISPLAY only (prices are inherently float USD); token base amounts remain integer/bigint upstream. (Cardinal rule "integer for money" governs on-chain token amounts, which are untouched here; USD display values are derived floats.)

## UI — `DashboardScreen.tsx` (build to §11)

- **Holdings** assembled from existing data: SOL (`'native'`, solBalance, 9), NOC (`NOC_MINT`, nocBalance, 9), and each store token via `tokenBalances` (decimals from the token metadata). USDC mint + 6 decimals come from `CORE_TOKENS`.
- **Prices** = `usePrices()` data, with the NOC entry injected from the presale store (`{usd: nocUsdPrice, change24h: null}`).
- **TOTAL BALANCE**: `computePortfolio(...).totalUsd` → `formatUsd` (existing) → `$14,881.19` split into whole + `.cents` (existing markup). Hidden-balance mode shows `····` (existing).
- **24h line**: `change24hPct` → `+2.34% · 24h` (green `TrendingUp`) or `−1.1% · 24h` (red, down arrow). **Hidden entirely when `change24hPct == null`** (no fake value). Replace the hardcoded literal at line ~508.
- **Per-token row** (§11 `.price` column, currently absent): right-aligned `$value` (`.noc-body-lg .noc-numeral`) over the 24h `%` (`.up` green / `.down` red, or `—` when `change24h == null`, e.g. USDC/NOC). Add to `TokenListRow`.
- **Secondary balance line** (`17.0276 SOL · 69,119,998 NOC`): use the grouped formatter (below).

### Formatting helper (thousand separators)

`src/utils/parseTokenAmount.ts` — add (or extend) a display formatter:
```ts
// Group the integer part with locale commas; keep up to `maxDecimals` (trim trailing zeros).
export function formatTokenDisplay(raw: string | bigint, decimals: number, maxDecimals = 4): string;
```
- `formatTokenDisplay('69119998000000000', 9)` → `'69,119,998'`.
- `formatTokenDisplay(solRaw, 9)` → `'17.0276'`.
- USDC `maxDecimals` 2 (design shows `740.21 USDC`). Caller passes `maxDecimals` per token (stablecoins 2, others 4).
- Keep the existing `formatTokenAmount` (used elsewhere); the new function is display-grouping only. Replace the balance renders in `TokenListRow` + the secondary line + amount-card with `formatTokenDisplay`.

### USDC logo

- Add `src/assets/tokens/usdc-logo.png` (official Circle USDC mark).
- `TokenLogo` already image-renders SOL & NOC by symbol; add the USDC case (match by mint `EPjFWdd5…` or symbol `USDC`) → `require('../../assets/tokens/usdc-logo.png')`. Other unknown tokens keep the letter-avatar fallback.

## Error handling

- Prices unavailable (offline/timeout/fail) and no cache → TOTAL BALANCE shows `$0.00`? **No** — show `—` (or keep the last cached total); the 24h line and per-token fiat hide. Never present a stale fake. (React Query `gcTime` keeps the last good prices for 5 min; beyond that, fiat columns render `—`.)
- NOC always has a price (presale table), so NOC fiat always shows; its 24h is always `—`.
- USDC change may be ~0 → still render the number (e.g. `+0.0%`) unless null.

## Testing

- `priceModule.test.ts`: mock `fetch` → parses CoinGecko shape into the mint-keyed map (SOL change from `usd_24h_change`); non-200 / abort / bad JSON → throws.
- `portfolio.test.ts`: holdings + prices → correct `totalUsd`; USD-weighted `change24hPct` (only SOL contributes; USDC change 0, NOC null excluded); empty-priced set → `null`; zero balances → 0/null.
- `parseTokenAmount.test.ts`: `formatTokenDisplay` grouping — `69,119,998`, `17.0276`, `740.21` (maxDecimals 2), trailing-zero trim, sub-1 values.
- On-device (mainnet): TOTAL BALANCE = real sum; SOL 24h % green/red live; USDC logo shows; NOC/SOL amounts comma-grouped.

## Out of scope (stated, not silently dropped)

- Backend price proxy for full IP privacy (no endpoint yet).
- Per-token sparkline charts.
- Rewiring the presale CARD's stage/price text (still literal "Stage 1 / $0.1501").
- A real NOC market price (NOC is presale-only; uses stage price).
- Shielded-mode dashboard variant (anonymity-set line) — gated behind `FEATURES.shielded`.
