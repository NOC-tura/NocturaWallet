# Reliable SPL Sending + Faster Landing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make transparent SPL token sends succeed when the recipient already holds the token (don't blindly create the ATA), and make all transparent sends land faster by raising the priority-fee floors.

**Architecture:** A new async helper `resolveCreateAta` in `transactionBuilder.ts` checks on-chain (via the existing `getAccountInfo`) whether the recipient's Associated Token Account exists, returning `true` only when it must be created. `TxSimulateScreen` (#19) — the single async gate before broadcast — resolves the real `createAta` for SPL before building the simulation tx and forwards the corrected `TransferIntent` to the confirm/broadcast screens. Separately, the priority-fee `FLOOR` values in `priorityFee.ts` are raised so quiet-network sends still pay a competitive per-CU price.

**Tech Stack:** TypeScript (strict), React Native 0.84.1, `@solana/web3.js`, Jest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-14-spl-send-design.md`

**Branch:** `feat/spl-send-reliable` (already created off `origin/main`; the design commit is already on it).

---

## File Structure

- `src/modules/solana/transactionBuilder.ts` — export the existing private `findAssociatedTokenAddress`; add async `resolveCreateAta(connection, recipient, mint)`; import `getAccountInfo` from `./queries` and the `Connection` type from `@solana/web3.js`.
- `src/modules/solana/__tests__/transactionBuilder.test.ts` — add a `resolveCreateAta` describe block (mocks `../queries`).
- `src/screens/transparent/TxSimulateScreen.tsx` — add `resolvedCreateAta` state; resolve `createAta` for SPL before building the sim tx; forward `{...intent, createAta: resolvedCreateAta}` at both `onContinue` sites.
- `src/modules/solana/priorityFee.ts` — raise the three `FLOOR` values.
- `src/modules/solana/__tests__/priorityFee.test.ts` — update the floor assertions.

---

## Task 1: `resolveCreateAta` helper + export `findAssociatedTokenAddress`

**Files:**
- Modify: `src/modules/solana/transactionBuilder.ts` (imports near top + `findAssociatedTokenAddress` at line ~31 + add new function after it)
- Test: `src/modules/solana/__tests__/transactionBuilder.test.ts`

- [ ] **Step 1: Write the failing test**

Add this block to the END of `src/modules/solana/__tests__/transactionBuilder.test.ts`. It mocks `../queries` so no real RPC happens. (The existing test file does not import `../queries`, so adding this mock is safe.)

```ts
// ── resolveCreateAta ──────────────────────────────────────────────────────────
import {resolveCreateAta, findAssociatedTokenAddress} from '../transactionBuilder';
import {getAccountInfo} from '../queries';

jest.mock('../queries', () => ({
  getAccountInfo: jest.fn(),
}));

const mockGetAccountInfo = getAccountInfo as jest.MockedFunction<typeof getAccountInfo>;

describe('resolveCreateAta', () => {
  const recipient = new PublicKey('So11111111111111111111111111111111111111112');
  const mint = new PublicKey('TokenAccountAddr111111111111111111111111111');
  const fakeConn = {} as never; // getAccountInfo is mocked, connection unused

  it('returns false when the recipient ATA already exists (no creation needed)', async () => {
    mockGetAccountInfo.mockResolvedValue({exists: true, executable: false});
    expect(await resolveCreateAta(fakeConn, recipient, mint)).toBe(false);
  });

  it('returns true when the recipient ATA does not exist (must be created)', async () => {
    mockGetAccountInfo.mockResolvedValue({exists: false, executable: false});
    expect(await resolveCreateAta(fakeConn, recipient, mint)).toBe(true);
  });

  it('checks the canonical ATA address for the recipient + mint', async () => {
    mockGetAccountInfo.mockResolvedValue({exists: true, executable: false});
    await resolveCreateAta(fakeConn, recipient, mint);
    const expectedAta = findAssociatedTokenAddress(recipient, mint);
    expect(mockGetAccountInfo).toHaveBeenCalledWith(fakeConn, expectedAta);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=transactionBuilder -t resolveCreateAta`
Expected: FAIL — `resolveCreateAta` is not exported (and `findAssociatedTokenAddress` is not exported yet) → import/undefined error.

- [ ] **Step 3: Export `findAssociatedTokenAddress` and add `resolveCreateAta`**

In `src/modules/solana/transactionBuilder.ts`:

(a) Add the `Connection` type to the existing `@solana/web3.js` import and import `getAccountInfo`. The current import block is:

```ts
import {
  PublicKey,
  SystemProgram,
  ComputeBudgetProgram,
  TransactionMessage,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import {getConnection} from './connection';
import {NOCTURA_FEE_TREASURY, TRANSPARENT_FEES} from '../../constants/programs';
import type {TransferParams, SPLTransferParams} from './types';
```

Change it to:

```ts
import {
  PublicKey,
  SystemProgram,
  ComputeBudgetProgram,
  TransactionMessage,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import type {Connection} from '@solana/web3.js';
import {getConnection} from './connection';
import {getAccountInfo} from './queries';
import {NOCTURA_FEE_TREASURY, TRANSPARENT_FEES} from '../../constants/programs';
import type {TransferParams, SPLTransferParams} from './types';
```

(b) Change the declaration of `findAssociatedTokenAddress` from `function findAssociatedTokenAddress(` to `export function findAssociatedTokenAddress(` (line ~31). Body unchanged.

(c) Immediately AFTER the `findAssociatedTokenAddress` function (after its closing `}`), add:

```ts
/**
 * Resolve whether a recipient needs their Associated Token Account created for
 * `mint`. Returns true ONLY when the ATA does not yet exist on-chain — sending
 * to a recipient who already holds the token must NOT prepend a create-ATA
 * instruction (it fails with "account already in use"). Falls through to the
 * caller's optimistic default only on RPC error (handled by the caller).
 */
export async function resolveCreateAta(
  connection: Connection,
  recipient: PublicKey,
  mint: PublicKey,
): Promise<boolean> {
  const ata = findAssociatedTokenAddress(recipient, mint);
  const info = await getAccountInfo(connection, ata);
  return !info.exists;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=transactionBuilder -t resolveCreateAta`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify no regression in the rest of the builder test + typecheck**

Run: `npx jest --testPathPattern=transactionBuilder && npx tsc --noEmit`
Expected: All `transactionBuilder` tests pass; `tsc` reports no errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/solana/transactionBuilder.ts src/modules/solana/__tests__/transactionBuilder.test.ts
git commit -m "feat(spl): resolveCreateAta — check recipient ATA existence before creating

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Wire `resolveCreateAta` into #19 TxSimulateScreen

**Files:**
- Modify: `src/screens/transparent/TxSimulateScreen.tsx` (module-load block ~line 28-46, the simulate effect ~line 140-152, the `onContinue` handlers ~line 270-285)

**No new automated test:** #19 has no screen-test scaffold for the async build path, and building one is out of scope per the spec. The ATA logic itself is covered by Task 1's unit tests; this task is wiring, verified by typecheck + lint + on-device (Task 4).

- [ ] **Step 1: Add a lazily-required reference to `resolveCreateAta`**

`TxSimulateScreen` lazy-requires its solana modules so the screen renders in test/stub environments. Find the existing block that declares `buildSPLTransferTx` (≈ line 28-46):

```ts
let buildSPLTransferTx:
  | typeof import('../../modules/solana/transactionBuilder').buildSPLTransferTx
  | null = null;
```

Add a parallel declaration right after it:

```ts
let resolveCreateAta:
  | typeof import('../../modules/solana/transactionBuilder').resolveCreateAta
  | null = null;
```

Then, in the same try-block where the modules are required (the block containing `buildSPLTransferTx = require('../../modules/solana/transactionBuilder').buildSPLTransferTx;`), add:

```ts
      resolveCreateAta = require('../../modules/solana/transactionBuilder').resolveCreateAta;
```

- [ ] **Step 2: Add `resolvedCreateAta` state**

Near the other `useState` declarations in the component (e.g. just after the `simState`/`retryCount` state), add:

```tsx
  const [resolvedCreateAta, setResolvedCreateAta] = React.useState(intent.createAta);
```

(If the file imports `useState` directly rather than via `React.`, match that style — use `useState(intent.createAta)`.)

- [ ] **Step 3: Resolve the real `createAta` before building the SPL sim tx**

In the simulate effect, locate the SPL build branch (≈ line 141-152):

```ts
          const isSpl = intent.tokenMint !== 'native';

          const tx = isSpl
            ? await _buildSPLTransferTx({
                sender,
                recipient: recipientPk,
                mint: new PublicKey(intent.tokenMint),
                amount: parseTokenAmount(intent.amount, intent.decimals),
                decimals: intent.decimals,
                createAta: intent.createAta,
                priorityFee,
              })
            : await _buildTransferTx({
```

Replace it with (compute `effectiveCreateAta` first, default to the optimistic `intent.createAta`, override from chain when the module is present, swallow RPC errors):

```ts
          const isSpl = intent.tokenMint !== 'native';

          let effectiveCreateAta = intent.createAta;
          if (isSpl && resolveCreateAta) {
            try {
              effectiveCreateAta = await resolveCreateAta(
                connection,
                recipientPk,
                new PublicKey(intent.tokenMint),
              );
            } catch {
              // RPC blip — keep the optimistic intent.createAta; the simulation
              // below will surface any resulting problem.
              effectiveCreateAta = intent.createAta;
            }
            if (cancelled) return;
            setResolvedCreateAta(effectiveCreateAta);
          }

          const tx = isSpl
            ? await _buildSPLTransferTx({
                sender,
                recipient: recipientPk,
                mint: new PublicKey(intent.tokenMint),
                amount: parseTokenAmount(intent.amount, intent.decimals),
                decimals: intent.decimals,
                createAta: effectiveCreateAta,
                priorityFee,
              })
            : await _buildTransferTx({
```

(The `else` branch and everything after it are unchanged.)

- [ ] **Step 4: Forward the corrected intent at both `onContinue` sites**

Find `handleContinue` (≈ line 270-276) and `handleContinueAnyway` (≈ line 278-283). Each ends with `onContinue(intent);`. Change BOTH occurrences to:

```ts
    onContinue({...intent, createAta: resolvedCreateAta});
```

After this step, `handleContinue` reads:

```ts
  const handleContinue = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    onContinue({...intent, createAta: resolvedCreateAta});
  };
```

and `handleContinueAnyway` reads:

```ts
  const handleContinueAnyway = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    onContinue({...intent, createAta: resolvedCreateAta});
  };
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/screens/transparent/TxSimulateScreen.tsx`
Expected: No type errors; no lint errors.

- [ ] **Step 6: Run the existing transparent screen tests to confirm no regression**

Run: `npx jest --testPathPattern=transparent`
Expected: PASS (or "No tests found" for TxSimulateScreen specifically — that's fine; other transparent-screen tests must still pass).

- [ ] **Step 7: Commit**

```bash
git add src/screens/transparent/TxSimulateScreen.tsx
git commit -m "fix(spl): resolve real createAta in #19 + forward corrected intent

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Raise priority-fee floors

**Files:**
- Modify: `src/modules/solana/priorityFee.ts` (the `FLOOR` map, ≈ line 9-13)
- Test: `src/modules/solana/__tests__/priorityFee.test.ts`

- [ ] **Step 1: Update the failing test to the new floors**

In `src/modules/solana/__tests__/priorityFee.test.ts`, update the two assertions that reference the floors. Change the "returns the floor when recent fees are all zero" test body to:

```ts
  it('returns the floor when recent fees are all zero', async () => {
    expect(await estimatePriorityFee(conn([0, 0, 0, 0]), 'normal')).toBe(50_000);
    expect(await estimatePriorityFee(conn([0, 0, 0, 0]), 'fast')).toBe(150_000);
    expect(await estimatePriorityFee(conn([0, 0, 0, 0]), 'urgent')).toBe(500_000);
  });
```

And change the "falls back to the floor on RPC error" assertion from `toBe(50_000)` to:

```ts
    expect(await estimatePriorityFee(c, 'fast')).toBe(150_000);
```

(Leave the "returns the network percentile when it exceeds the floor" test — `toBe(1_000_000)` — unchanged.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=priorityFee`
Expected: FAIL — the floor test now expects `50_000`/`150_000`/`500_000` but the implementation still returns `10_000`/`50_000`/`150_000`.

- [ ] **Step 3: Raise the `FLOOR` values**

In `src/modules/solana/priorityFee.ts`, the current map is:

```ts
const FLOOR: Record<PriorityLevel, number> = {
  normal: 10_000,
  fast: 50_000,
  urgent: 150_000,
};
```

Change it to:

```ts
const FLOOR: Record<PriorityLevel, number> = {
  normal: 50_000,
  fast: 150_000,
  urgent: 500_000,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=priorityFee`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Confirm no other test asserted the old floor**

Run: `npx jest --testPathPattern='priorityFee|TransactionStatusScreen'`
Expected: PASS. (`TransactionStatusScreen.test.tsx` mocks `estimatePriorityFee` to return a fixed `10_000` — a mock return, not a floor assertion — so it is unaffected. If it unexpectedly fails on a floor value, update that mock too; otherwise leave it.)

- [ ] **Step 6: Commit**

```bash
git add src/modules/solana/priorityFee.ts src/modules/solana/__tests__/priorityFee.test.ts
git commit -m "perf(fees): raise priority-fee floors for faster inclusion (50k/150k/500k)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Full suite + on-device verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npx jest`
Expected: All tests pass (no regressions introduced by Tasks 1-3).

- [ ] **Step 2: Lint + typecheck the whole project**

Run: `npx tsc --noEmit && npx eslint .`
Expected: No errors.

- [ ] **Step 3: Build the release APK for sideload**

Run: `cd android && ./gradlew assembleRelease`
Expected: BUILD SUCCESSFUL; APK at `android/app/build/outputs/apk/release/app-release.apk`. Hand the APK to the user to sideload (the user installs; the agent does not).

- [ ] **Step 4: On-device manual verification (user-driven, document results)**

Verify the two ATA paths and faster landing:
1. Send a small amount of **NOC** to a recipient that does **not** yet hold NOC (fresh address) → #19 simulation passes, tx lands, recipient ATA is created. (`createAta` resolved `true`.)
2. Send a small amount of **NOC** to a recipient that **already holds** NOC → #19 simulation passes (previously this would fail), tx lands, no duplicate-ATA error. (`createAta` resolved `false`.)
3. If the user holds **USDC**, repeat case 2 with USDC to confirm it is mint-agnostic.
4. Confirm sends feel faster to confirm than before (raised Normal floor). This is qualitative — note observed broadcast→confirm time.

Record outcomes (signatures + observed behaviour) before opening the PR. If any case fails, STOP and use `superpowers:systematic-debugging` (do not patch blindly).

---

## Self-Review

**1. Spec coverage:**
- ATA-existence helper (`resolveCreateAta` + export `findAssociatedTokenAddress`, reuse `getAccountInfo`) → Task 1. ✓
- Called in #19 before the SPL build, forwarded at both `onContinue` sites via `resolvedCreateAta` state, RPC-error fallback to optimistic value → Task 2. ✓
- Raised `FLOOR` (50k/150k/500k), `PERCENTILE`/`max` logic unchanged → Task 3. ✓
- Update the breaking `priorityFee.test.ts` floor assertions → Task 3 Step 1. ✓
- Display `PRIORITY_FEE_LAMPORTS` maps explicitly NOT touched (deferred) → not in any task, matching spec out-of-scope. ✓
- Testing: `resolveCreateAta` unit tests + floor test update + on-device NOC(new)/NOC(existing)/USDC → Tasks 1, 3, 4. ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows full code; commands have expected output. ✓

**3. Type consistency:** `resolveCreateAta(connection: Connection, recipient: PublicKey, mint: PublicKey): Promise<boolean>` is defined identically in Task 1 and called with `(connection, recipientPk, new PublicKey(intent.tokenMint))` in Task 2. `findAssociatedTokenAddress(recipient, mint)` signature matches its existing definition. `resolvedCreateAta` state (Task 2 Step 2) is the same name used in Steps 3-4. `getAccountInfo` returns `{exists, executable}` (matches the mock in Task 1). ✓
