# Reliable SPL sending (ATA-existence fix) + faster landing (priority floors) — Design

**Status:** Approved (brainstorming), pending spec review.
**Date:** 2026-06-14
**Branch:** `feat/spl-send-reliable` (off `origin/main`; rebase after PR #16 / `feat/tx-detail` merges if it touches shared files — it does not touch `transactionBuilder.ts`/`priorityFee.ts`/`TxSimulateScreen.tsx`, so no conflict expected)

## Goal

Make transparent **SPL token** sends reliable, and make all transparent sends land faster.

1. **ATA-existence fix.** Today the recipient Associated Token Account (ATA) is **always** created on every SPL send (`createAta: selectedMint !== SOL_MINT` in `SendScreen.tsx:333` → always `true` for SPL). If the recipient already holds the token, the `createAssociatedTokenAccount` instruction fails (`account already in use`) and the whole transfer fails — at #19 the simulation fails, blocking the user. Fix: resolve `createAta` from on-chain reality (ATA exists → `false`, does not exist → `true`).
2. **Faster landing.** Raise the priority-fee floors so even when the network looks quiet we pay a competitive per-CU price.

## Why

On-device the SPL path is now reachable (token picker shows held SPL + NOC; #12→#19→#20→#21→#27 all branch SPL). Sending NOC/USDC to a recipient who already holds that token would fail with the current always-create-ATA logic. Separately, the user observed slow "broadcasting" — the tx lands but takes a while; a higher Normal floor improves time-to-inclusion.

## Part 1 — ATA-existence check

### New helper (`src/modules/solana/transactionBuilder.ts`)

`findAssociatedTokenAddress` is currently a private function in this module. Export it, and add:

```ts
/**
 * Resolve whether a recipient needs their Associated Token Account created for
 * `mint`. Returns true ONLY when the ATA does not yet exist on-chain — sending
 * to a recipient who already holds the token must NOT prepend a create-ATA
 * instruction (it would fail with "account already in use").
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

- Reuses the existing `getAccountInfo(connection, pubkey): Promise<{exists, executable}>` in `queries.ts` (built for #20). Import it into `transactionBuilder.ts`.
- `findAssociatedTokenAddress` already computes the canonical ATA (same derivation the builder uses to attach the create-ATA instruction), so the address checked is exactly the one that would be created.

### Where it is called — #19 `TxSimulateScreen.tsx`

The send chain is always #12 SendScreen → #19 TxSimulateScreen → #20 TxConfirmScreen → #21 broadcast. #19 is already async (it builds + simulates the tx). It is the single gate before broadcast, so resolving `createAta` there fixes both the simulation and the broadcast.

**Field names (actual `TransferIntent`):** the recipient is `intent.recipient` (base58), the mint is `intent.tokenMint` with the sentinel `'native'` for SOL. The SPL discriminator already exists in the effect as `const isSpl = intent.tokenMint !== 'native'`. The SPL builder is `buildSPLTransferTx({sender, recipient, mint, amount, decimals, createAta, priorityFee})` (line ~144); today it is called with `createAta: intent.createAta`.

Mechanics:

1. Add component state: `const [resolvedCreateAta, setResolvedCreateAta] = useState(intent.createAta)` (initial = the optimistic value SendScreen set).
2. In the simulate effect, inside the `isSpl` branch, **before** calling `buildSPLTransferTx`: call `resolveCreateAta(connection, recipientPk, new PublicKey(intent.tokenMint))` (the effect already has `connection` and `recipientPk = new PublicKey(intent.recipient)`). Use the result as the `createAta` passed to `buildSPLTransferTx`, and `setResolvedCreateAta(result)`. For SOL (`!isSpl`) leave `resolvedCreateAta` as-is (unused).
3. **Forward the corrected intent.** Both `onContinue` call sites — `handleContinue` (line ~275) and `handleContinueAnyway` (line ~282) — change from `onContinue(intent)` to `onContinue({...intent, createAta: resolvedCreateAta})`, so #20 → #21 broadcast uses the on-chain-correct value.

`SendScreen.tsx:333` keeps `createAta: selectedMint !== SOL_MINT` as the initial optimistic value (no RPC in the synchronous review handler) — #19 corrects it before anything is built or sent. No change to `SendScreen.tsx` is required for correctness; the value it sets is overwritten in #19.

### Failure handling

- If `resolveCreateAta`'s RPC call throws (network blip), fall back to the optimistic `intent.createAta` (do not block the flow on the existence check) and let the simulation surface any problem. Wrap the call in try/catch inside the effect; on error keep `intent.createAta` (and leave `resolvedCreateAta` at its current value).
- `getAccountInfo` already returns `{exists:false}` for a missing account (does not throw on "account not found").

## Part 2 — Raise priority-fee floors (`src/modules/solana/priorityFee.ts`)

Current `FLOOR` (µLam/CU): `normal: 10_000, fast: 50_000, urgent: 150_000`.
New `FLOOR`: `normal: 50_000, fast: 150_000, urgent: 500_000`.

- `PERCENTILE` (50/75/90) and the `max(percentile, FLOOR[level])` logic are unchanged — the floor is only the minimum when the network looks quiet.
- With the CU limits in `sendTransaction.ts` (SOL 1_000, SPL 40_000, SPL+ATA 65_000), the worst-case absolute priority fee at the new Normal floor is `50_000 × 65_000 / 1e6 ≈ 3_250` lamports (~0.0000033 SOL) — negligible, while making inclusion materially faster.
- **Existing test will break:** `src/modules/solana/__tests__/priorityFee.test.ts` asserts the floor case returns `10_000`/`50_000`/`150_000` and the RPC-error fast case returns `50_000`. These assertions MUST be updated to the new floors (`50_000`/`150_000`/`500_000`; fast error → `150_000`). The percentile-exceeds-floor case (1_000_000) is unaffected.

**Display fee maps are NOT touched (deferred).** Three screens (`SendScreen`, `TxConfirmScreen`, `TxSimulateScreen`) have a separate static `PRIORITY_FEE_LAMPORTS` map (`normal:0n, fast:15_000n, urgent:50_000n`, absolute lamports) used only to *display* an indicative priority-fee line and compute the "After" balance estimate in #19. These are decoupled by design from `estimatePriorityFee` (the per-µLam/CU value actually sent) and were never derived from `FLOOR`. Raising `FLOOR` does not require changing them; the displayed estimate stays indicative. (See out-of-scope.)

## Files

- `src/modules/solana/transactionBuilder.ts` — export `findAssociatedTokenAddress`; add `resolveCreateAta`; import `getAccountInfo`.
- `src/screens/transparent/TxSimulateScreen.tsx` — add `resolvedCreateAta` state; resolve `createAta` for SPL before building the sim tx; forward corrected intent at both `onContinue` sites.
- `src/modules/solana/priorityFee.ts` — raise `FLOOR` values.
- `src/modules/solana/__tests__/priorityFee.test.ts` — update floor assertions.

## Testing

- `transactionBuilder.test.ts` (existing builder test file): add `resolveCreateAta` cases → mock `getAccountInfo` returning `{exists:true}` ⇒ resolves `false`; `{exists:false}` ⇒ resolves `true`; verify the address passed to `getAccountInfo` equals `findAssociatedTokenAddress(recipient, mint)`.
- `priorityFee.test.ts`: UPDATE the existing floor assertions — `estimatePriorityFee(conn([0,0,0,0]), 'normal')` → `50_000`; `'fast'` → `150_000`; `'urgent'` → `500_000`; RPC-error `'fast'` fallback → `150_000`. Leave the percentile-exceeds-floor case (`1_000_000`) unchanged.
- `TransactionStatusScreen.test.tsx`: its `estimatePriorityFee` jest mock returns a fixed `10_000` — this is a mock return value, not a floor assertion, so it does NOT need to change (verify the test still passes after the floor change; update only if it incidentally asserts the floor).
- #19 has no existing screen-test scaffold for the build path; cover the ATA logic via the `resolveCreateAta` unit test + manual on-device verification rather than building a new screen-test harness here.
- **On-device:** NOC to a NEW recipient (ATA created, succeeds) and NOC to a recipient that already holds NOC (no ATA creation, succeeds). Then USDC if held.

## Out of scope (deferred — not silently dropped)

- SPL "To" displaying the owner vs. the ATA (display limitation) — separate.
- A full priority-fee chip picker / per-tx level override UI (#3 chips) — only the floor values change here.
- Reworking the indicative static `PRIORITY_FEE_LAMPORTS` display maps (and the #19 "After"-balance estimate that uses `normal:0n`) to reflect the real dynamic fee — pre-existing indicative-only behaviour, a separate cosmetic pass.
- Shielded send path — separate (gated behind `FEATURES.shielded`).
- Re-checking ATA existence inside `submitTransparentTransfer` as belt-and-suspenders — #19 always precedes #21, so one check there is sufficient; revisit only if a path that skips #19 is added.
