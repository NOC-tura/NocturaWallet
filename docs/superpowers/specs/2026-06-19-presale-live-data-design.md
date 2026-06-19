# Presale Live Data (Cycle A) — Design

**Status:** Approved (brainstorming), pending spec review.
**Date:** 2026-06-19
**Repo:** NocturaWallet.
**Branch:** `feat/presale-live-data`.

## Context

The wallet's presale UI is stubbed: `presaleStore.setStageInfo` is never called, so the dashboard `PresaleBanner` falls back to a hard-coded **`'0.0012'` SOL** price and "Stage 1", and stage progress is fake. (NOC's USD value happens to be correct because `useResolvedPrices` → `nocUsdPriceForStage(currentStage)` defaults a `null` stage to stage 1 = $0.1501.)

This is **Cycle A** of the presale work: wire LIVE presale data (read-only) into the store + dashboard banner, and remove the stubs. **Cycle B** (the buy flow + full PresaleScreen #23) and **Cycle C** (post-TGE claim) come later.

The presale is a direct on-chain Anchor program; the wallet reads global state + the user's allocation from the **coordinator** (`api.noc-tura.io`), consistent with the wallet's backend-first architecture (Cycle 2). No signing in this cycle.

**Decisions (from brainstorming):**
- User allocation source = **backend `/user/:address`** (sum of recorded purchases) — simple, backend-first; may slightly under-count if a purchase wasn't recorded (acceptable for a read-only display; on-chain accuracy is reserved for Cycle C).
- Banner price shown in **USD** per the `index.html` design (NOT SOL).

## A. Data module — `src/modules/presale/presaleModule.ts` (new)

Both calls use `pinnedFetch` against `${API_BASE}` (= `https://api.noc-tura.io/api/v1`), backend-first like the other Cycle-2 modules. Throw on non-200 / `success:false`.

```ts
export interface PresaleStats {
  displayStage: number;       // 1-indexed (coordinator currentStage is 0-indexed)
  pricePerNocUsd: number;     // PRESALE_STAGE_PRICES[coordinator currentStage]
  soldInStageBase: string;    // NOC into the current stage, 9-dec base units (string)
  stageCapacityBase: string;  // 10,240,000 NOC in base units (string)
  isPaused: boolean;
}

export async function fetchPresaleStats(): Promise<PresaleStats>;
```
- `GET ${API_BASE}/stats` → body `{success, data:{currentStage, totalNocSold, isPaused, ...}}`.
- `currentStage` is **0-indexed** (0 = stage 1). `displayStage = currentStage + 1`.
- `pricePerNocUsd = PRESALE_STAGE_PRICES[clamp(currentStage, 0, 9)]` (from `src/constants/presale.ts`).
- `tokensIntoStage = max(0, totalNocSold − currentStage × 10_240_000)` (NOC, float). `soldInStageBase = parseTokenAmount(String(tokensIntoStage), 9)` → base-unit string. `stageCapacityBase = (10_240_000n × 1_000_000_000n).toString()`.
- `isPaused` from `data.isPaused`.

```ts
export interface UserAllocation {
  tokensPurchasedBase: string;  // Σ noc_amount over recorded purchases, 9-dec base units
  referralBonusBase: string;    // Σ referral_bonus, 9-dec base units
}

export async function fetchUserAllocation(address: string): Promise<UserAllocation>;
```
- `GET ${API_BASE}/user/{address}` → body `{success, data:{purchases:[{noc_amount, referral_bonus, ...}]}}`.
- Sum each `noc_amount` (display NOC string, ≤9 dp) via `parseTokenAmount(s, 9)` → BigInt base units; same for `referral_bonus`. Return the BigInt sums as strings. Empty/no purchases → `'0'`/`'0'`.
- Use `parseTokenAmount` (exact decimal→base-unit, no float drift) — NOT `Number(x)*1e9`.

(Constants: `TOKENS_PER_STAGE = 10_240_000`, `NOC_DECIMALS = 9`. Reuse `PRESALE_STAGE_PRICES` from `constants/presale.ts`.)

## B. Sync hook — `src/hooks/usePresaleSync.ts` (new)

Mirrors `usePrices`: TanStack Query, writes results into `presaleStore`. Mounted by the dashboard.

- Reads the active address: `useWalletStore(s => s.publicKey)`.
- `statsQ = useQuery({queryKey:['presaleStats'], queryFn: fetchPresaleStats, staleTime: 30_000, refetchInterval: 60_000, retry: 1})`.
- `allocQ = useQuery({queryKey:['presaleAllocation', address], queryFn: () => fetchUserAllocation(address!), enabled: address != null, staleTime: 60_000, retry: 1})`.
- On `statsQ.data` change → `presaleStore.setStageInfo({currentStage: displayStage, pricePerNoc: String(pricePerNocUsd), soldInStage: soldInStageBase, stageCapacity: stageCapacityBase})` (via `useEffect`).
- On `allocQ.data` change → `presaleStore.setAllocation({tokensPurchased: tokensPurchasedBase, claimedTokens: '0', referralBonusTokens: referralBonusBase, isZeroFeeEligible: false})`.
- Returns `{isPaused: statsQ.data?.isPaused ?? false}` for the dashboard to gate the banner.
- A fetch failure keeps the last persisted store values (presaleStore is MMKV-persisted) — no crash, banner shows last-known.

## C. Banner — `src/components/PresaleBanner.tsx` (modify)

Align the pre-TGE buy banner to the `index.html` dashboard `.presale` design (≈ line 6371): a compact promo, price in USD, progress as "% to next stage".

- **Title:** `NOC Presale · Stage {currentStage ?? 1}`.
- **Subtitle:** `${pricePerNoc} · {pct}% to next stage` where `pricePerNoc` is the USD stage price (e.g. `$0.1501`) and `pct = round(soldInStage / stageCapacity × 100)`.
- **Remove:** the `1 NOC = {price} SOL` line and the `{sold} / {cap} NOC` row (the SOL fallback `'0.0012'` goes away entirely).
- Keep the "Buy NOC →" CTA and the `onPress` (→ PresaleScreen, wired in Cycle B).
- The claim-state branch (`tgeStatus === 'claimable'`) stays unchanged (TGE is in the future; the buy banner is what renders now).
- The implementer must read the `.presale` block in `/home/user/Downloads/index.html` and match it faithfully (classes/structure/copy), not approximate.

## D. Dashboard wiring — `src/screens/dashboard/DashboardScreen.tsx` (modify)

- Call `const {isPaused} = usePresaleSync();` near the existing `useResolvedPrices()` usage (line ~123).
- Gate the banner: render `PresaleBanner` only when `!isPaused` (presale active). When paused, hide it (the design has no dedicated paused banner state; hiding is the safe default).
- NOC USD price already flows through `useResolvedPrices` → `nocUsdPriceForStage(currentStage)`; once `setStageInfo` runs with the live stage, NOC's USD value is correct for the ACTUAL stage (not just the stage-1 default).

## E. Error handling / states

- `/stats` or `/user` non-200 / timeout / parse error → the query errors; the store keeps its last (persisted) values; the banner shows last-known data (or, on a cold first run with no data, `currentStage ?? 1` = "Stage 1" + the stage-1 price — a safe default, never the `0.0012` stub since that line is removed).
- No active address → `allocQ` disabled; allocation stays `'0'` (banner pre-TGE doesn't show allocation anyway).
- `isPaused` → banner hidden.

## F. Testing

- `presaleModule.test.ts` (mock `pinnedFetch`):
  - `fetchPresaleStats`: coordinator `currentStage:0` → `displayStage:1`, `pricePerNocUsd:0.1501`; `totalNocSold:839030` → `soldInStageBase` = `parseTokenAmount('839030', 9)`, `stageCapacityBase` = 10.24M×1e9; `isPaused` passthrough; mid-presale e.g. `currentStage:2, totalNocSold:21,000,000` → stage 3, price 0.1945, into-stage = 21,000,000 − 20,480,000 = 520,000. Non-200 → throws.
  - `fetchUserAllocation`: purchases `[{noc_amount:'176.282478348', referral_bonus:'0'}, {noc_amount:'100', referral_bonus:'10'}]` → `tokensPurchasedBase` = base(276.282478348), `referralBonusBase` = base(10); empty purchases → `'0'/'0'`; non-200 → throws.
- `PresaleBanner.test.tsx`: store with `currentStage:1, pricePerNoc:'0.1501', soldInStage`, `stageCapacity` → renders `NOC Presale · Stage 1` + `$0.1501 · 8% to next stage`; no `0.0012`, no SOL text.
- (No on-device-only logic; verify on-device that the dashboard banner shows the live stage/price/% and NOC USD value is correct for the current stage.)

## Out of scope (Cycle A)

- Buy flow + full PresaleScreen #23 (Cycle B).
- On-chain allocation read + claim (Cycle C).
- A dedicated `isPaused` banner design (hidden for now).
- Touching the standalone `PresaleScreen.tsx` (Cycle B rebuilds it to the #23 design).
