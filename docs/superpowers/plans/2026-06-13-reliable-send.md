# Reliable Transparent Send Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make transparent sends land reliably — a dynamic, floored priority fee + a tight compute-unit limit + blockhash-expiry resubmit on #21 — so a 0-fee tx is never dropped into an infinite "stuck" spinner again.

**Architecture:** A new `priorityFee.ts` estimates `max(network-percentile, floor)` micro-lamports/CU from `getRecentPrioritizationFees`. The instruction builders add `setComputeUnitLimit`. `submitTransparentTransfer` returns `lastValidBlockHeight`; #21's poll resubmits (≤3) when the blockhash expires before confirmation. Folds into the not-yet-merged #4 work.

**Tech Stack:** React Native 0.84, TypeScript strict, @solana/web3.js, Jest.

**Source:** Solana fee docs (formula `ceil(price × cu_limit / 1e6)` lamports). Spec: `docs/superpowers/specs/2026-06-13-reliable-send-design.md`. Branch: `feat/tx-status-broadcast`.

---

## File Structure
- `src/modules/solana/priorityFee.ts` — CREATE: `estimatePriorityFee(connection, level)`.
- `src/modules/solana/types.ts` — MODIFY: add `computeUnitLimit?: number` to `TransferParams` + `SPLTransferParams`.
- `src/modules/solana/transactionBuilder.ts` — MODIFY: prepend `setComputeUnitLimit` when `computeUnitLimit` is set.
- `src/modules/solana/sendTransaction.ts` — MODIFY: `submitTransparentTransfer` returns `{signature, lastValidBlockHeight}` + passes a per-type CU limit.
- `src/screens/transparent/TransactionStatusScreen.tsx` — MODIFY: estimate fee before submit; track `lastValidBlockHeight`; resubmit on expiry.

---

## Task 1: `priorityFee.ts` — dynamic floored estimate

**Files:**
- Create: `src/modules/solana/priorityFee.ts`
- Test: `src/modules/solana/__tests__/priorityFee.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import {estimatePriorityFee} from '../priorityFee';

function conn(fees: number[]) {
  return {
    getRecentPrioritizationFees: jest.fn(async () =>
      fees.map((f, i) => ({slot: i, prioritizationFee: f})),
    ),
  } as never;
}

describe('estimatePriorityFee', () => {
  it('returns the floor when recent fees are all zero', async () => {
    expect(await estimatePriorityFee(conn([0, 0, 0, 0]), 'normal')).toBe(10_000);
    expect(await estimatePriorityFee(conn([0, 0, 0, 0]), 'fast')).toBe(50_000);
    expect(await estimatePriorityFee(conn([0, 0, 0, 0]), 'urgent')).toBe(150_000);
  });

  it('returns the network percentile when it exceeds the floor', async () => {
    // 100 samples of 1_000_000 → every percentile is 1_000_000 > floor
    const fees = new Array(100).fill(1_000_000);
    expect(await estimatePriorityFee(conn(fees), 'normal')).toBe(1_000_000);
  });

  it('falls back to the floor on RPC error', async () => {
    const c = {getRecentPrioritizationFees: jest.fn(async () => { throw new Error('rpc'); })} as never;
    expect(await estimatePriorityFee(c, 'fast')).toBe(50_000);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx jest priorityFee.test`)

- [ ] **Step 3: Implement `src/modules/solana/priorityFee.ts`**

```typescript
import type {Connection} from '@solana/web3.js';

export type PriorityLevel = 'normal' | 'fast' | 'urgent';

/** Percentile of recent network fees per tier. */
const PERCENTILE: Record<PriorityLevel, number> = {normal: 50, fast: 75, urgent: 90};
/** Minimum micro-lamports/CU per tier — guarantees non-zero priority when the
 *  network is quiet (a 0-fee tx can still be dropped). */
const FLOOR: Record<PriorityLevel, number> = {
  normal: 10_000,
  fast: 50_000,
  urgent: 150_000,
};

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx];
}

/**
 * Compute-unit price (micro-lamports/CU) for a tier: the per-tier percentile of
 * recent prioritization fees, floored to a per-tier minimum. Never throws —
 * an RPC failure returns the floor so the send proceeds.
 */
export async function estimatePriorityFee(
  connection: Connection,
  level: PriorityLevel,
): Promise<number> {
  try {
    const recent = await connection.getRecentPrioritizationFees();
    const fees = recent
      .map(r => r.prioritizationFee)
      .sort((a, b) => a - b);
    return Math.max(percentile(fees, PERCENTILE[level]), FLOOR[level]);
  } catch {
    return FLOOR[level];
  }
}
```

- [ ] **Step 4: Run — expect PASS**; `npx tsc --noEmit` (0)

- [ ] **Step 5: Commit**

```bash
git add src/modules/solana/priorityFee.ts src/modules/solana/__tests__/priorityFee.test.ts
git commit -m "feat(solana): estimatePriorityFee — dynamic floored CU price

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: compute-unit limit in the instruction builders

**Files:**
- Modify: `src/modules/solana/types.ts`
- Modify: `src/modules/solana/transactionBuilder.ts`
- Test: `src/modules/solana/__tests__/transactionBuilder.test.ts`

- [ ] **Step 1: Add the param** — in `src/modules/solana/types.ts`, add `computeUnitLimit?: number;` to both `TransferParams` and `SPLTransferParams` (next to the existing `priorityFee?: number;`).

- [ ] **Step 2: Write the failing test** — append to `transactionBuilder.test.ts` `describe('instruction builders', ...)`:

```typescript
  it('prepends a setComputeUnitLimit when computeUnitLimit is given', () => {
    const ix = buildTransferInstructions({
      sender: A, recipient: B, lamports: 1_000n, priorityFee: 15_000, computeUnitLimit: 450,
    });
    // priority-price + compute-limit + recipient transfer + fee markup = 4
    expect(ix.length).toBe(4);
  });
```
(`A`/`B` already exist in that describe block.)

- [ ] **Step 3: Run — expect FAIL** (`npx jest transactionBuilder.test`)

- [ ] **Step 4: Implement** — in `buildTransferInstructions` AND `buildSPLTransferInstructions`, after creating the `instructions` array and BEFORE the `priorityFee` block, add:

```typescript
  if (params.computeUnitLimit !== undefined) {
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({units: params.computeUnitLimit}),
    );
  }
```
(Use `params.computeUnitLimit` — destructure it alongside the other fields. The limit instruction must come before the price instruction; both ComputeBudget instructions precede the transfers, which is the required ordering.)

- [ ] **Step 5: Run — expect PASS**; `npx tsc --noEmit` (0)

- [ ] **Step 6: Commit**

```bash
git add src/modules/solana/types.ts src/modules/solana/transactionBuilder.ts src/modules/solana/__tests__/transactionBuilder.test.ts
git commit -m "feat(solana): optional setComputeUnitLimit in transfer instruction builders

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `submitTransparentTransfer` returns `lastValidBlockHeight` + sets CU limit

**Files:**
- Modify: `src/modules/solana/sendTransaction.ts`
- Test: `src/modules/solana/__tests__/submitTransaction.test.ts`

- [ ] **Step 1: Update the test** — change the mock `getLatestBlockhash` to include `lastValidBlockHeight` and assert it is returned. Replace the existing assertion block:

```typescript
    expect(res.signature).toBe('SIG_ABC');
    expect(res.lastValidBlockHeight).toBe(1);
    expect(sendRawTransaction).toHaveBeenCalledTimes(1);
```
(The existing mock already returns `lastValidBlockHeight: 1` from `getLatestBlockhash`.)

- [ ] **Step 2: Run — expect FAIL** (`res.lastValidBlockHeight` undefined)

- [ ] **Step 3: Implement** — in `submitTransparentTransfer`:
  - change the return type to `Promise<{signature: string; lastValidBlockHeight: number}>`;
  - destructure `const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash();`
  - compute a per-type CU limit and pass it into the builder:
    ```typescript
    const computeUnitLimit =
      params.kind === 'sol' ? 450 : params.createAta ? 65_000 : 40_000;
    ```
    pass `computeUnitLimit` into `buildTransferInstructions`/`buildSPLTransferInstructions`;
  - `return {signature, lastValidBlockHeight};`

- [ ] **Step 4: Run — expect PASS**; `npx tsc --noEmit` (0)

- [ ] **Step 5: Commit**

```bash
git add src/modules/solana/sendTransaction.ts src/modules/solana/__tests__/submitTransaction.test.ts
git commit -m "feat(solana): submit returns lastValidBlockHeight + sets CU limit

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: #21 — estimate fee, track expiry, resubmit

**Files:**
- Modify: `src/screens/transparent/TransactionStatusScreen.tsx`
- Test: `src/screens/transparent/__tests__/TransactionStatusScreen.test.tsx`

Read the current file (the #4 submit→poll version). Changes:

- [ ] **Step 1: Lazy-require the estimator** — add `estimatePriorityFee` from `../../modules/solana/priorityFee` to the lazy-require try/catch block (same pattern as the others).

- [ ] **Step 2: Estimate the fee before submit** — in the `run()` mount effect, replace the static priority-fee line:
```typescript
      const priorityFee = Number(
        (PRIORITY_FEE_LAMPORTS[intent.priorityLevel] * 1_000_000n) / 200_000n,
      );
```
with a dynamic estimate (the connection is available via `getConnection()`):
```typescript
      const priorityFee = estimatePriorityFee
        ? await estimatePriorityFee(getConnection(), intent.priorityLevel)
        : 0;
      if (cancelled) return;
```

- [ ] **Step 3: Submit + track expiry** — store the submit result's `lastValidBlockHeight` and an attempt counter in refs. Replace the submit + poll wiring so that:
```
attempt = 1
const {signature, lastValidBlockHeight} = await submitTransparentTransfer(params)
setSignature(signature); setStage('broadcasting'); poll(signature, lastValidBlockHeight, attempt)
```
In `poll(sig, lastValidBlockHeight, attempt)` (500 ms loop, cancelled-guarded), each iteration:
- `const r = await getConnection().getSignatureStatus(sig)`
  - confirmed/finalized → `setSlot`; `setStage('success')`; return.
  - `value.err` → mapped message; `setStage('failed')`; return.
- Every ~10th iteration (≈5 s), also `const h = await getConnection().getBlockHeight()` (wrapped in its own try/catch). If `h > lastValidBlockHeight` and still unconfirmed → **expired**:
  - if `attempt < 3`: re-estimate fee + rebuild params + `submitTransparentTransfer` again → new `{signature, lastValidBlockHeight}`; `setSignature(newSig)`; recurse/continue the loop with the new values and `attempt + 1` (reset the 90 s stuck timer for the new attempt).
  - else: `setErrorMessage('Transaction expired — the network didn\'t include it in time. Tap Retry.')`; `setStage('failed')`; return.
- Else if `>= 90_000 ms` since this attempt started and not expired → `setStage('stuck')` (keep polling).

Implementation note: factor the "build params + submit" into a local `async function attemptSubmit(): Promise<{signature; lastValidBlockHeight}>` used by both the initial submit and the resubmit, so the fee re-estimation + param build are DRY.

- [ ] **Step 4: Fee-paid display** — the success "Fee paid" row should reflect the real cost. Change it to `formatTokenAmount(BASE_FEE_LAMPORTS + computeFeeLamports, SOL_DECIMALS)` where `computeFeeLamports = BigInt(Math.ceil((priorityFee * cuLimit) / 1_000_000))` (per the Solana formula), with `cuLimit` = the per-type limit used (450 for sol, 65_000/40_000 for spl). Keep a `priorityFeeRef`/state for the estimate used. If wiring the exact value is awkward, display `base + estimated priority` consistently; do NOT show the old static tier value.

- [ ] **Step 5: Tests** — update `TransactionStatusScreen.test.tsx`:
  - Mock `../../../modules/solana/priorityFee` → `estimatePriorityFee: jest.fn().mockResolvedValue(10_000)`.
  - The existing connection mock must add `getBlockHeight: jest.fn().mockResolvedValue(0)` (≤ lastValidBlockHeight, so no expiry) and `getLatestBlockhash`/submit mocks return `lastValidBlockHeight`. Keep the success + failed tests green.
  - Add an "expiry → resubmit" test: `getBlockHeight` resolves a value `> lastValidBlockHeight`, `getSignatureStatus` stays pending; assert `submitTransparentTransfer` is called a second time (use `waitFor`, allow the ~5 s gate by advancing timers or by making the poll check height on the first eligible iteration — if timer control is flaky, assert the resubmit path via a shorter elapsed gate guarded behind a test-only constant is NOT allowed; instead use `jest.useFakeTimers()` + `jest.advanceTimersByTime`).

- [ ] **Step 6: Verify** — `npx tsc --noEmit` (0); `npx jest TransactionStatusScreen priorityFee submitTransaction transactionBuilder` (PASS); `npx eslint src/screens/transparent/TransactionStatusScreen.tsx src/modules/solana` (0 errors).

- [ ] **Step 7: Commit**

```bash
git add src/screens/transparent/TransactionStatusScreen.tsx src/screens/transparent/__tests__/TransactionStatusScreen.test.tsx
git commit -m "feat(send): #21 dynamic priority fee + blockhash-expiry resubmit

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Full gate

- [ ] **Step 1:** `npx tsc --noEmit` → 0
- [ ] **Step 2:** `npx eslint src/screens/transparent src/modules/solana` → 0 errors
- [ ] **Step 3:** `npx jest` → all pass
- [ ] **Step 4:** commit fallout: `git commit -am "test: align suite with reliable-send"`

---

## Task 6: Build + on-device verification (manual)

Follow [[project_android_transparent_v1]]. **Tiny amounts.**

- [ ] **Step 1:** `.env` → mainnet (backup first); `cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`; copy APK → `/home/user/Downloads/`; restore `.env`.
- [ ] **Step 2:** Send a small SOL amount. Confirm: the tx now **lands** (the broadcasting screen flips to "Sent successfully" within a few seconds — a non-zero priority fee is attached even though the network shows 0 recent fees); the tx is **findable on Solscan**; if a confirmation genuinely can't happen, the screen shows "Transaction expired — tap Retry" (not an infinite stuck spinner).

---

## Self-Review Notes
- **Spec coverage:** priority estimation w/ floor (Task 1), CU limit (Task 2), submit returns lastValidBlockHeight + CU limit (Task 3), #21 estimate + expiry resubmit + fee display (Task 4), tests (each), on-device (Task 6). Out-of-scope (chip strip #3, simulate-derived CU, fiat) absent — correct.
- **Type consistency:** `estimatePriorityFee(connection, level): Promise<number>` (Task 1) consumed in Task 4; `computeUnitLimit?` added in Task 2 and passed in Task 3; `submitTransparentTransfer` return `{signature, lastValidBlockHeight}` (Task 3) consumed in Task 4. `PriorityLevel` = `'normal'|'fast'|'urgent'` matches `TransferIntent.priorityLevel`.
- **No false reliability:** the floor guarantees non-zero priority even at 0 network fees (the exact failure today); expiry resubmit (≤3) restores `signAndSend`'s lost robustness; a truly un-includable tx fails cleanly with Retry instead of an infinite spinner.
