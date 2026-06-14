# #21 tx-status Visual Rework (to index.html §21 + design system) — Design

**Status:** Approved (brainstorming), pending spec review.
**Date:** 2026-06-14
**Branch:** `feat/tx-status-broadcast` (folds into the not-yet-merged #21 work)

## Goal

Rewrite `TransactionStatusScreen` (#21) to match the user's design (`/home/user/Downloads/index.html` §21 `.s-stat`, `screen.md` §21) using the app's design system (NativeWind tokens + `components/ui`), replacing the old hand-rolled `StyleSheet` with hardcoded hex colors that made the screen look "old" and inconsistent with the rest of the app. **Logic is unchanged** — submit→poll, blockhash-expiry resubmit, fee math, CU limit all stay.

## Why

On-device the success screen looked like the original scaffolded screen, not §21. Root cause: #21 is the only transaction-flow screen never migrated to the DS — SendScreen/TxSimulate/TxConfirm use NativeWind (`bg-bg-base`, `text-fg-*`, `Text`/`Button` from `components/ui`); #21 uses `StyleSheet.create` with `#0C0C14`/`#6C47FF`/`#4ADE80`. Prior work bolted state logic onto the old visual. Per [[feedback_build_to_index_html_design]] / CLAUDE.md "Design — Source of Truth", build it to the design.

## §21 visual spec (from index.html `.s-stat`)

- **Hero ring (132 dp)** centered, glyph ~56 dp:
  - `broadcasting` — accent ring with a **rotating halo** (two concentric arc rings spinning; the project has Reanimated v3 — use `useSharedValue` + `withRepeat(withTiming(360))`). Reduced-motion → static arc.
  - `success` — `--success` 2 dp ring + a translucent **halo** (design uses `box-shadow: 0 0 0 8px success/12%`; in RN render a larger translucent circle behind the bordered ring). Check glyph.
  - `failed` — `--danger` ring + ✗ glyph.
  - `stuck` — `--warning` **dashed** ring + warning glyph.
- **Stage label** (display, ~22/28, `text-fg-primary`) + **stage sub** (13/18, `text-fg-secondary`, `is-warn` → `text-warning`):
  - broadcasting: "Broadcasting transaction…" / "Submitted to Solana mainnet · waiting for first confirmation".
  - success: "Sent successfully" / "Confirmed · finalized" (we don't track block count — use "Confirmed on Solana mainnet"; do NOT invent "in 2 blocks").
  - failed: "Transaction failed" / the mapped error reason.
  - stuck: "Taking longer than usual" / "Network is congested · the tx is in the mempool but hasn't been included yet" (`is-warn`).
- **Top-bar status pill** (`.noc-overline`): `CONFIRMED` (success, success-tinted) / `SLOW` (stuck, warning-tinted). None during broadcasting/failed.
- **Amount card** (`bg-bg-surface-1`, rounded-2xl, centered): eyebrow overline "Amount" + amount-line (`{amount}` ~28 dp display + `{tokenSymbol}` ticker) + a "To {formatAddress(recipient)}" line.
- **Meta grid** (`bg-bg-surface-1`, rounded-lg): rows `[label 76dp | value 1fr | copy 32dp]` — **Tx hash** (mono, truncated, copy), **Slot** (mono numeral), **Fee paid** (`base + ceil(price×cuLimit/1e6)` SOL). Copy uses the existing clipboard pattern (`@react-native-clipboard/clipboard` + 30 s auto-clear, mirror SuccessScreen's copy).
- **Sticky CTAs**:
  - broadcasting/submitting: a single disabled primary "Don't close — broadcasting…" (no back affordance).
  - success: row `[View details]` (secondary → `onViewDetails(signature)` / explorer) + `[Done]` (primary → `onDashboard`). testIDs unchanged: `tx-status-details`, `tx-status-done`.
  - failed: `[Retry]` (`tx-status-retry`, bumps retryCount) + `[Done]`.
  - stuck: `[View on Solscan]` link + `[Done]`.

## Components & files
- `src/screens/transparent/TransactionStatusScreen.tsx` — REWRITE the render + styles only (keep the `useEffect` submit/poll/expiry logic and the helper functions verbatim). Use NativeWind classes + `Text`/`Button` from `components/ui`; remove the `StyleSheet.create` block. Extract the ring into a small in-file `StatusRing({stage})` sub-component (the rotating-halo Reanimated lives there, isolated). Keep `MetaRow` but restyle to the grid layout with a copy button.
- Reuse: `formatAddress`, `formatTokenAmount`, `getExplorerUrl`, `lucide-react-native` icons (Check, X, AlertTriangle, ArrowRight, Copy), `@react-native-clipboard/clipboard`, `react-native-reanimated`.

## Data flow / error handling
Unchanged. The render reads `stage`, `signature`, `slot`, `errorMessage`, `priorityFeeUsed` from the existing state. Copy-to-clipboard is best-effort (try/catch). No new RPC.

## Testing
- The existing `TransactionStatusScreen.test.tsx` behavioural tests (success/failed/landed-but-failed/expiry-resubmit) MUST still pass — they assert text ("Sent successfully", "Transaction failed") and testIDs (`tx-status-done`, `tx-status-retry`), which the rewrite preserves. Update only if a literal string changes (e.g. keep "Sent successfully" / "Transaction failed" / "Broadcasting transaction…" exactly so tests don't churn).
- Add a render assertion that the success state shows the amount card text (`{amount} {symbol}`) and the Tx hash / Slot / Fee paid labels.

## Out of scope (deferred — not silently dropped)
- Fiat `≈ $USD` lines (gap #2).
- Shielded `#21` variant (ring mint + SHIELDED ribbon + vault balance) — gated behind `FEATURES.shielded`.
- iOS Dynamic Island / Live Activity (design §G).
- Per-meta-row copy on Slot/Fee (only Tx hash gets a copy button; Slot/Fee are display-only).
