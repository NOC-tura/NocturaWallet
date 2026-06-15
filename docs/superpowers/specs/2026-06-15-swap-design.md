# Swap (Jupiter) — Design

**Status:** Approved (brainstorming), pending spec review.
**Date:** 2026-06-15
**Branch:** `feat/swap` (off `origin/main`).
**Design note:** The user's mockups have NO dedicated swap screen — `screen.md` §28/§12 say "Swap → send #12 in swap mode (placeholder until swap screen exists)". The user approved Claude proposing the swap UX, built in their existing design language (reuse the #12 Send / #21 Status DS classes + NativeWind tokens). Activity #26 references "via Jupiter" as the provider.

## Goal

Let the user swap one SPL/native token for another (e.g. SOL → USDC) via the Jupiter aggregator. Today the dashboard "Swap" action just opens Send (`onPress={onSend}`) and the #28 token-detail "Swap" is a disabled "Soon". Build a real swap: a `SwapScreen` with a live quote, slippage, and on-chain execution, wired from both entry points.

Scope = transparent v1. **No MiCA geo-gate now** (so the user, in the EU, can test); geo-gating is a pre-launch compliance step (out of scope, noted). **NOC is not swappable** (presale-only, not on any DEX) — excluded from the token lists; the token-detail Swap action is hidden for NOC.

## A. Jupiter integration — `src/modules/swap/jupiter.ts`

Free Jupiter Lite API (no key, rate-limited; production proxy is a follow-up like CoinGecko).

```ts
export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;   // raw base units (string)
  outAmount: string;  // raw base units (string)
  priceImpactPct: string; // e.g. "0.0012"
  slippageBps: number;
  raw: unknown;       // the full quote object — passed back to /swap verbatim
}

// GET https://lite-api.jup.ag/swap/v1/quote?inputMint=&outputMint=&amount=&slippageBps=&swapMode=ExactIn
export async function getSwapQuote(params: {
  inputMint: string; outputMint: string; amount: string; slippageBps: number;
}): Promise<SwapQuote>;

// POST https://lite-api.jup.ag/swap/v1/swap  body {quoteResponse, userPublicKey, wrapAndUnwrapSol:true, dynamicComputeUnitLimit:true}
// → {swapTransaction: base64, lastValidBlockHeight: number}
export async function getSwapTransaction(
  quoteRaw: unknown, userPublicKey: string,
): Promise<{swapTransaction: string; lastValidBlockHeight: number}>; // base64 VersionedTransaction + expiry
```
- Plain `fetch`, ~10s timeout, throws on non-200 / no-route (Jupiter returns an error / empty `routePlan` → treat as "no route"). Same privacy posture as CoinGecko (third-party, IP only).
- **SOL mint mapping:** Jupiter uses the wrapped-SOL mint `So11111111111111111111111111111111111111112` for native SOL. The app's `'native'` sentinel maps to that mint for Jupiter calls; `wrapAndUnwrapSol: true` handles wrap/unwrap so the user pays/receives native SOL. A helper `jupiterMint(appMint): string` does `'native' → wSOL`, else the mint as-is.

## B. Quote hook — `src/hooks/useSwapQuote.ts`

```ts
export function useSwapQuote(args: {
  inputMint: string; outputMint: string; amountRaw: string; slippageBps: number; enabled: boolean;
}): UseQueryResult<SwapQuote>;
```
- React Query keyed by all args; `enabled` false when amount is 0/empty or mints equal. `staleTime: 10_000`, `refetchInterval: 15_000` (quotes move). The SCREEN debounces the amount input (~400ms) before updating `amountRaw` so typing doesn't spam Jupiter.

## C. Execution — `src/modules/swap/submitSwap.ts`

```ts
export async function submitSwap(params: {
  quoteRaw: unknown; scheme: TransparentScheme;
}): Promise<{signature: string; lastValidBlockHeight: number}>;
```
- Mirrors `submitTransparentTransfer` (`sendTransaction.ts`): retrieve seed (biometric/passcode gated) → derive the transparent keypair → call `getSwapTransaction(quoteRaw, signer.publicKey)` → `VersionedTransaction.deserialize(base64ToBytes(swapTransaction))` → `tx.sign([signer])` → `connection.sendRawTransaction(tx.serialize(), {skipPreflight:true, maxRetries:0})` → return `{signature, lastValidBlockHeight}` (lastValidBlockHeight taken from Jupiter's `/swap` response). Zeroize the secret key in `finally`.
- Jupiter builds the tx (compute budget, route, ATAs) — we do NOT add our own instructions. (The Noctura fee-markup does NOT apply to swaps in v1.)

## D. `SwapScreen` — `src/screens/transparent/SwapScreen.tsx`

Props: `{initialFromMint?: string; onBack: () => void; onDone: () => void}`. Build to the design language of `SendScreen`/`TransactionStatusScreen` (DS: `bg-bg-surface-1`, `rounded-2xl`, `noc-numeral`, `text-accent-transparent`, the speed-chip pattern reused for slippage, the `Button` CTA).

State: `fromMint` (default `initialFromMint ?? 'native'`), `toMint` (default USDC; if `fromMint===USDC` default to SOL), `amount` (human string, debounced → `amountRaw` via `parseTokenAmount`), `slippageBps` (from MMKV `v1_advanced_slippage`, default 50 = 0.5%).

Layout:
1. **Top bar**: back + "Swap".
2. **From card**: token selector (ActionSheet over swappable held tokens) + amount `TextInput` + **MAX** + balance line (`formatBalanceForDisplay`).
3. **Flip button** (↕, between cards): swaps `fromMint`/`toMint` (clears amount).
4. **To card**: token selector (curated list) + read-only **"≈ {formatBalanceForDisplay(quote.outAmount, toDecimals)} {toSymbol}"** from the live quote (skeleton while `isLoading`).
5. **Quote details** (when quote present): rate `1 {from} ≈ {x} {to}`, **price impact** `{priceImpactPct%}` (amber/`text-warning` when > 1%, red when > 5%), "via Jupiter", est. network fee.
6. **Slippage chips** (`.chip` style, ≥44px): 0.1% / 0.5% / 1.0% / Custom → sets `slippageBps`, persists to `v1_advanced_slippage`.
7. **CTA** `Button`: label `Swap {amount} {from} → {outAmount} {to}`; disabled when no amount / `isLoading` / no route / `amountRaw > balance` / mints equal; 500ms debounce; on tap → execution flow (below).
8. **Execution + result (inline)**: tapping Swap calls `submitSwap`, then shows an **inline status state within SwapScreen** (broadcasting spinner → confirmed/failed), styled to match the #21 `TransactionStatusScreen` VISUAL (not navigating to it — #21 is coupled to the send `intent`/`submitTransparentTransfer`, so we reuse its look, not the screen). Poll confirmation with the existing `getSignatureStatus` HTTP pattern (the #21 poll). A failed swap shows "Swap failed" (+ "slippage exceeded" when the error indicates it); success shows the received amount + a "View on explorer" link. A "Done" button calls `onDone()`.

## E. Token lists

- A small swappable-token registry (reuse `CORE_TOKENS`: SOL/USDC/USDT; NOC EXCLUDED). `From` list = registry tokens the user holds with balance > 0 (plus SOL always). `To` list = the registry minus the selected `from`.
- A `isSwappable(mint): boolean` helper (`mint !== NOC_MINT && in registry`). #28 token-detail hides the Swap action when `!isSwappable(mint)`.

## F. Navigation

- New `SwapModal: {initialFromMint?: string}` root route (modal), registered like `SendModal`.
- **Dashboard** `onSwap` → `rootNav.navigate('SwapModal')` (replace the current `onPress={onSend}`). Add an `onSwap` prop to `DashboardScreen` + wire in `DashboardScreenNav`.
- **#28 token-detail** Swap cell → `rootNav.navigate('SwapModal', {initialFromMint: mint})` (remove the disabled "Soon"); hidden entirely when `!isSwappable(mint)`.

## G. Error handling / states

- Quote: loading (skeleton on the To amount + disabled CTA), no route (`"No route for this pair"` + disabled CTA), insufficient balance (`"Insufficient {from}"`), price-impact high (warning color, still allowed).
- Execution: broadcasting (spinner), confirmed (success), failed — map Jupiter/on-chain errors; "slippage exceeded" when the failure indicates it (reuse #21 error mapping where possible).
- Jupiter unreachable/timeout → "Couldn't reach Jupiter, try again".
- NOC or any non-swappable token never reaches the screen (filtered out of lists + token-detail hides the action).

## H. Testing

- `jupiter.test.ts`: `getSwapQuote` parses a mocked quote response → `{inAmount,outAmount,priceImpactPct,raw}`; non-200 / empty routePlan → throws/"no route". `getSwapTransaction` returns the `swapTransaction` base64; error → throws. `jupiterMint('native')` → wSOL mint; `jupiterMint(USDC)` → USDC.
- `submitSwap.test.ts`: mock the keychain + connection + getSwapTransaction → asserts it deserializes, signs, and sends; zeroizes the key (mirror `signAndSend`/`submitTransaction` test style).
- `useSwapQuote` debounce: covered via the screen or a light hook test (optional).
- `isSwappable`: NOC → false; USDC/SOL → true.
- On-device (mainnet): swap a small **SOL → USDC** and **USDC → SOL**; verify quote updates, slippage chips, execution lands, balances update; confirm NOC has no Swap action.

## I. Out of scope (stated, not silently dropped)

- **MiCA geo-gate** (#50) — added pre-launch as a compliance step (geoFence module already exists).
- **Backend / keyed proxy** for Jupiter (privacy + rate-limit) — production, like the CoinGecko proxy.
- NOC swap (until listed on a DEX post-TGE).
- Noctura fee-markup on swaps (v1 takes no markup on swaps).
- A separate high-value typed-confirm gate (#20-style) for swaps — v1 is quote + CTA + status; revisit later.
- Limit orders / DCA / cross-mode (shielded) swaps.
