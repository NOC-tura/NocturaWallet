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

## C. Banner — `src/components/PresaleBanner.tsx` (REWRITE the buy state)

**Discovery:** the existing `PresaleBanner` is an elaborate dark card (stage badge + progress bar + `1 NOC = X SOL` + `sold/cap` row) using inline `StyleSheet`, AND it is **not rendered anywhere** (dead component). The `index.html` dashboard `.presale` (≈ line 6371) is a **compact row**, so the buy state is rewritten to match it with NativeWind (consistent with the rest of the app):

```
[rocket icon]  NOC Presale · Stage {N}                    [chevron-right]
               ${pricePerNoc} · {pct}% to next stage
```
- **Title (`noc-body-lg`):** `NOC Presale · Stage {currentStage ?? 1}`.
- **Subtitle (`noc-body-sm noc-numeral`):** `${pricePerNoc} · {pct}% to next stage`, where `pricePerNoc` is the USD stage price (e.g. `$0.1501`) and `pct = soldInStage / stageCapacity × 100` rounded (BigInt: `Number((sold * 100n) / cap)`).
- Leading rocket icon + trailing chevron-right (lucide-react-native `Rocket` / `ChevronRight`, matching the design's `#i-rocket` / `#i-chevron-right`).
- Whole row is a `Pressable` → `onPress` (→ presale screen; the dashboard passes its `onPresale`).
- **Removed:** the SOL price line (incl. the `'0.0012'` fallback), the `sold/cap` row, the progress bar, and the `StyleSheet` block.
- The claim-state branch (`tgeStatus === 'claimable'`) is kept as-is (TGE is in the future; only the buy state renders now) — but its inline styles can stay until Cycle C.
- The implementer MUST read the `.presale` block in `/home/user/Downloads/index.html` (≈ line 6371) and match its structure/classes/copy faithfully.

## D. Dashboard wiring — `src/screens/dashboard/DashboardScreen.tsx` (modify)

- **Render the banner (it is currently NOT mounted anywhere):** insert `<PresaleBanner onPress={onPresale} />` in the dashboard content **after the TOKENS list and before the bottom nav / `DashboardFooter`**, matching the `index.html` placement (the `.presale` sits right after the `.tokens` block).
- Call `const {isPaused} = usePresaleSync();` in the dashboard component.
- Gate the banner: render it only when `!isPaused` (presale active). When paused, hide it (the design has no dedicated paused banner state; hiding is the safe default).
- The existing footer "Buy" button keeps its `onPresale` (the banner and the button both lead to the presale screen).
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
