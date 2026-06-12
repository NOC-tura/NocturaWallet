# Transaction-Flow Screens (#19 tx-simulate → #20 tx-confirm → #21 tx-status) — Design

**Status:** Approved (brainstorming), pending spec review.
**Date:** 2026-06-12
**Branch:** `feat/tx-flow-screens`

## Goal

Build the design's dedicated 3-screen transaction-confirm chain — **#19 tx-simulate → #20 tx-confirm → #21 tx-status** — and refactor the transparent send to route through it, replacing the combined `ConfirmationSheet`. Both the transparent send (#12) and the shielded send (#18 zk-proof) feed this chain. Visual source of truth: `/home/user/Downloads/index.html` (`.s-sim` mockups, lines ~8846–9120) and `/home/user/Downloads/screen.md` (§18–21).

## Background / current state

The transparent send currently works end-to-end (verified on mainnet, PR #12) but uses a **combined** flow:
`SendScreen` (#12) → `handleReview` runs `simulateTransaction` inline → `ConfirmationSheet` (simulation result + confirm in one modal) → `UnlockSend` (auth) → `sendTransparentTransfer` → `TransactionStatusScreen` (#21).

The design instead wants the simulation and confirmation as **separate full screens** (#19, #20), shared by both modes. `#21 TransactionStatusScreen` already exists (states `pending`/`success`/`failed`/`timeout`, `signature` prop) and is **reused as-is**.

## Flow (both modes)

```
#12 send (input)  ─┐
                   ├─→ #19 tx-simulate → #20 tx-confirm → #10 unlock-send → broadcast → #21 tx-status
#18 zk-proof ready ┘     (dry-run)         (final review)    (PIN/biometric)  (sendTransparentTransfer)
```

`data-mode` (`transparent` | `shielded`) drives the accent color on #19/#20. Shielded is gated behind `FEATURES.shielded` — the #18→#19 wiring is implemented but unreachable until the flag flips; the transparent #12→#19 path is the on-device-testable one.

## Components & files

### New
- `src/screens/transparent/TxSimulateScreen.tsx` (#19) — simulation preview.
- `src/screens/transparent/TxConfirmScreen.tsx` (#20) — final review.
- `src/modules/solana/simulationChecks.ts` — derive the "What this transaction does" check-rows from the built instructions + one `getAccountInfo` (recipient executable check).
- `src/types` — a shared `TransferIntent` type (navigation param).

### Modified
- `src/screens/transparent/SendScreen.tsx` — remove inline simulation (`handleReview`) and `ConfirmationSheet`; the "Review" CTA navigates to #19 with a `TransferIntent`. Move broadcast (`handleConfirm` body) to #20.
- `src/app/Navigator.tsx` + `src/types/navigation.d.ts` — register `TxSimulate` and `TxConfirm` in the Send stack; wire params.
- `src/screens/transparent/TransactionStatusScreen.tsx` (#21) — reused; minor only if a field is missing.

### Retired
- `src/components/ConfirmationSheet.tsx` — no longer used by the transparent send. Delete once no references remain (confirm with grep).

## Data flow & types

```ts
// shared navigation param
export interface TransferIntent {
  mode: 'transparent' | 'shielded';
  recipient: string;          // base58
  amount: string;             // human string, e.g. "0.001"
  tokenMint: string;          // 'native' for SOL, else mint base58
  tokenSymbol: string;        // 'SOL' | 'NOC' | …
  decimals: number;
  priorityLevel: 'normal' | 'fast' | 'urgent';
  createAta: boolean;         // SPL recipient ATA creation
}
```

1. **#12 / #18 → #19**: navigate with a `TransferIntent`.
2. **#19** builds the tx (`buildTransferTx` / `buildSPLTransferTx`, sender = wallet `publicKey`), runs `simulateTransaction`, computes:
   - **check-rows** via `simulationChecks.ts` (derived from the known instruction set + recipient `getAccountInfo`),
   - **balance delta**: `Sending (−amount)`, `Network fee`, `Priority`, `After = solBalance − amount(SOL) − fees`.
3. **#19 [Continue to confirm] → #20**: forward the same `TransferIntent`.
4. **#20 [Send] → unlock** (`awaitUserAuth` + root `UnlockSend` modal) **→ `sendTransparentTransfer`** (the persisted-scheme signer path, unchanged) **→ #21** with the real signature.

The simulation priority-fee conversion (tier lamports → per-CU microLamports, `× 1e6 / 200_000`) is preserved from the current `SendScreen` implementation.

## Screen specs

### #19 TxSimulateScreen
- **Top bar:** back · "Review transfer" · step "3 of 4".
- **Intent card:** eyebrow (cpu glyph "Simulating on <network> RPC" / check "Simulation passed" / warn "Couldn't reach RPC"), `amount → recipient`, `step-pill` (Building call · Nms / Ready · Nms / failed).
- **States:** `simulating` (skeleton shimmer cards) / `ready` / `failed`.
- **Ready:** "What this transaction does" check-card (rows `ok|warn|danger` with PASS/badge) + "Balance delta" card + footer-meta ("Simulated against slot … · valid ~2 s"). Sticky `[Continue to confirm]` + `[Cancel]`.
- **Failed:** real reason + `[Retry]` (re-simulate) / `[Continue anyway]` (→ #20, marks sim skipped) / `[Cancel]` (→ #12). Reuses the recovery pattern already built for `ConfirmationSheet`.
- **Derived check-rows (transparent SOL/SPL):**
  - "No interactions with unknown contracts" — PASS when instructions are only SystemProgram/SPL-Token/ComputeBudget/ATA (always true for our self-built transfers).
  - "No token approvals granted" — PASS (no Approve instruction is ever built).
  - "Recipient is a regular wallet" — PASS when `getAccountInfo(recipient).executable === false`; WARN if executable (sending to a program account).

### #20 TxConfirmScreen
- Headline "Send <amount> <symbol> to <Gabc…xyz9>".
- Detail rows: Network, Fee, Priority, From, To.
- First-time-recipient callout (warning bg) when the address is not in the address book.
- Sticky bottom bar (column): `[Send <amount> <symbol>]` (primary, debounced 500 ms, disabled-on-tap) + `[Cancel]`.
- `[Send]` → auth → broadcast → #21.

### #21 TransactionStatusScreen — reused
Existing `pending`/`success`/`failed`/`timeout` states + `signature` prop. No change unless a needed field is missing.

## Error handling
- **#19 failed** (RPC drop, sim error, `getAccountInfo` failure): surface the real message; `[Retry]` / `[Continue anyway]` / `[Cancel]`. `getAccountInfo` failure degrades the recipient check to "couldn't verify" (WARN), not a hard block.
- **#20 broadcast failure:** `Alert('Send failed', message)`, stay on #20 (cardinal rule #6 debounce preserved).
- **No double-submit:** #20 `[Send]` debounced 500 ms + disabled while broadcasting.

## Testing
- `simulationChecks.ts` — unit tests: derive rows from sample instruction arrays (SOL transfer, SPL transfer, +ComputeBudget); recipient executable PASS/WARN via mocked `getAccountInfo`; `getAccountInfo` failure → WARN "couldn't verify".
- `TxSimulateScreen` / `TxConfirmScreen` — render smoke tests for each state (mirror the existing screen-test style; heavy async paths may be `.skip` like the current `SendScreen` test).
- `sendTransaction.ts` tests — unchanged.
- Update the `SendScreen` test for the new navigation (it now routes to `TxSimulate` instead of showing `ConfirmationSheet`).

## Risk
This refactors working, on-device-verified code (PR #12). Mitigation: **relocate, don't rewrite** — `sendTransparentTransfer` and the simulation/priority-fee logic move verbatim into the new screens. Full suite + tsc + eslint gate, then on-device re-verify a real 0.001 SOL send through the new #19→#20→#21 chain before opening the PR.

## Out of scope (YAGNI)
- dApp/WalletConnect-originated tx parsing (full simulation log analysis) — checks are derived from our own known tx shape; revisit when WalletConnect lands.
- Shielded-specific simulation content beyond accent/mode theming.
- `tx-detail` (#27), `stuck-tx` (#54) — separate screens.
