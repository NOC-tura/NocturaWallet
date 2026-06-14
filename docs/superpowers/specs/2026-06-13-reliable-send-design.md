# Reliable Transparent Send (priority-fee estimation + CU limit + expiry retry) — Design

**Status:** Approved (brainstorming), pending spec review.
**Date:** 2026-06-13
**Branch:** `feat/tx-status-broadcast` (folds into the not-yet-merged #4 work)

## Goal

Make transparent sends land reliably. Root cause of the on-device failure (2026-06-13, confirmed: Solscan could not locate `65JzUDC3…Dca8Txnt`): a **0-priority-fee** tx (Normal tier) was dropped (blockhash expired before inclusion), and the #4 `submit→poll` path lost the blockhash-expiry retry that `signAndSend` had, so the app polled forever (stuck) instead of resubmitting. Fix per Solana's fee docs (https://solana.com/docs/core/fees): give every tx a non-zero, congestion-aware priority fee with a tight compute-unit limit, and resubmit on blockhash expiry.

## Solana fee facts (from the docs)
- Prioritization fee = `ceil(compute_unit_price_µLamports × compute_unit_limit / 1_000_000)` lamports.
- Base fee = 5,000 lamports/signature. Priority fees "increase the likelihood that the current leader schedules your transaction ahead of competing ones."
- Default CU = 200,000/instruction; max 1,400,000/tx.

## Approach (approved)

### 1. Priority-fee estimation — dynamic with a floor (`priorityFee.ts`, new)
```
estimatePriorityFee(level): Promise<number>   // returns microLamports per CU
```
- Query `connection.getRecentPrioritizationFees([])` (recent ~150 slots, global).
- Compute the per-tier percentile of the returned fees: Normal = 50th, Fast = 75th, Instant = 90th.
- Return `max(percentileValue, FLOOR[level])` where `FLOOR = {normal: 10_000, fast: 50_000, instant: 150_000}` µLam/CU. The floor guarantees a non-zero priority even when the network is quiet (today all recent fees were 0, yet the tx still dropped — a floor prevents that). Tiers stay distinct when quiet.
- On RPC failure → return `FLOOR[level]` (never block the send).

### 2. Compute-unit limit (predictable, cheap fee)
- Add `setComputeUnitLimit` to the instruction lists (as the first instruction, before `setComputeUnitPrice`). Conservative per-type limits: SOL transfer = **450** CU; SPL transfer = **40_000** CU, **+25_000** when `createAta`. With FLOOR price these yield a few lamports of priority (e.g. SOL: `ceil(10_000 × 450 / 1e6) = 5` lamports) — negligible cost, real priority.
- The builders gain a `computeUnitLimit?: number` param; the screens pass the per-type value.

### 3. Blockhash-expiry resubmit (restore #4's lost robustness)
- `submitTransparentTransfer` returns `{signature, lastValidBlockHeight}` (from the same `getLatestBlockhash` used to build the tx).
- #21 poll: every 500 ms `getSignatureStatus`; every ~5 s also `getBlockHeight`. Resolution:
  - `confirmationStatus` ∈ {confirmed, finalized} → **success**.
  - `value.err` → **failed** (mapped reason).
  - `blockHeight > lastValidBlockHeight` while unconfirmed → **expired**: auto-resubmit (re-run submit with a fresh blockhash + fresh fee estimate), up to **3 total attempts**. After 3 expiries → **failed** with "Transaction expired — tap Retry" (Retry = full re-run via `retryCount`).
  - else `>= 90 s` elapsed and not expired → **stuck** (informational; keep polling — a slow-but-alive tx still flips to success).

## Components & files
- `src/modules/solana/priorityFee.ts` — CREATE: `estimatePriorityFee(level)` + tier `FLOOR`/percentile constants. Pure-ish (takes a `Connection`); tested with a mocked `getRecentPrioritizationFees`.
- `src/modules/solana/transactionBuilder.ts` — MODIFY: `buildTransferInstructions`/`buildSPLTransferInstructions` accept `computeUnitLimit?: number` and prepend `ComputeBudgetProgram.setComputeUnitLimit({units})` when provided.
- `src/modules/solana/sendTransaction.ts` — MODIFY: `submitTransparentTransfer` returns `{signature: string; lastValidBlockHeight: number}`; pass `computeUnitLimit` into the builders (450 for sol, 40_000 / 65_000 for spl by `createAta`).
- `src/screens/transparent/TransactionStatusScreen.tsx` — MODIFY: before submit, `await estimatePriorityFee(intent.priorityLevel)` (replaces the static tier→fee conversion); track `lastValidBlockHeight` + attempt count; resubmit on expiry (≤3); surface "expired · Retry" on exhaustion. Keep the broadcasting/success/failed/stuck states from #4.

## Data flow
`intent.priorityLevel` → `estimatePriorityFee` (RPC) → microLamports/CU → `submitTransparentTransfer` (builds with CU limit + price, signs, sends) → `{signature, lastValidBlockHeight}` → #21 poll (status + block height) → success / failed / expired-resubmit / stuck. The displayed "Fee paid" in #21 success becomes `base + ceil(price × cuLimit / 1e6)` lamports (real priority cost), not the old static tier lamports.

## Error handling
- `estimatePriorityFee` RPC failure → floor (send proceeds).
- Submit (sign/send) throws → failed.
- Poll `err` → failed (mapped). Expiry (3×) → failed "Transaction expired — tap Retry".
- `getBlockHeight` hiccup → skip the expiry check that iteration (don't fail).

## Testing
- `priorityFee.test.ts`: all-zero recent fees → returns `FLOOR[level]`; non-zero fees → returns `max(percentile, floor)` with the right percentile per tier; RPC throws → returns floor.
- `transactionBuilder.test.ts`: with `computeUnitLimit`, the instruction list includes a `setComputeUnitLimit` (count increases by 1).
- `submitTransaction.test.ts`: `submitTransparentTransfer` returns `{signature, lastValidBlockHeight}`.
- `TransactionStatusScreen.test.tsx`: existing success/failed tests still pass; add an "expired → resubmit" test (mock `getBlockHeight > lastValidBlockHeight` → `submitTransparentTransfer` called twice) — keep light if timer-flaky.

## Out of scope (deferred — not silently dropped, per [[feedback_build_to_index_html_design]])
- Priority chip strip on #20 (gap #3 — this fix makes the DEFAULT reliable; the in-confirm picker is separate).
- Simulate-to-get-exact-CU (we use conservative per-type constants; simulation-derived limits are a later refinement).
- Fiat values (gap #2), separate #54/#44 screens, shielded variants.
