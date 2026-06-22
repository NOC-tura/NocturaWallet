# Presale Buy — SOL (Cycle B1) — Design

**Status:** Approved (brainstorming), pending spec review.
**Date:** 2026-06-19
**Repo:** NocturaWallet.
**Branch:** `feat/presale-buy-sol` (stacked on `feat/presale-live-data` / PR #24 until merged).

## Context

Cycle A made the dashboard presale data live (stage/price/progress/allocation). This is **Cycle B1**: the actual **SOL** presale purchase — building the on-chain `presale_purchase_with_sol` instruction, signing + submitting it through the wallet's existing tx pipeline, and the `#23` presale-buy UI. **B2** adds USDC + USDT (full parity, the user's goal). **C** is the post-TGE claim.

The presale is a direct on-chain Anchor program (`PROGRAM_ID = 6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt`). The wallet has **no Anchor runtime** — instructions are hand-assembled as `TransactionInstruction` (8-byte Anchor discriminator + Borsh args + ordered account metas/PDAs), the same way the wallet already hand-builds SPL transfers. Amount is specified as **SOL paid**; the program computes NOC = USD ÷ stage-price using a Pyth SOL/USD oracle account (the wallet passes the account; it does not read it).

**Decisions (from brainstorming):**
- B1 = **SOL only** (matches the `#23` design). USDC/USDT = B2.
- **No geo-gate** in B1 (deferred).
- **Dedicated buy screens** (do NOT generalize the send `TransferIntent` screens, which are transfer-specific) — reuse the lower-level modules: `simulateTransaction`, the `UnlockSend` re-auth bridge, the status poll loop, the `submitSwap`-style sign/submit pattern.

## A. On-chain constants — `src/constants/programs.ts` (add)

```ts
// Pyth SOL/USD price account (read-only) required by presale_purchase_with_sol.
export const PYTH_SOL_USD_ACCOUNT = '7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE';
```
Already present and reused: `PROGRAM_ID`, `ADMIN_ADDRESS` (`KnZ5bR…39qr`, the config-PDA seed), `SOL_TREASURY` (`6Zia7b…o6Vd`, the SOL recipient + on-chain constraint), `NOC_MINT`, `NOC_DECIMALS = 9`.

## B. Buy module — `src/modules/presale/presaleBuyModule.ts` (new)

### B-1. PDAs (all via `PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)`)
- `config` = `["config", ADMIN_ADDRESS.toBytes()]` (seeded with the ADMIN pubkey, NOT the buyer).
- `userAccount` = `["user", user.toBytes()]`.
- `userAllocation` = `["allocation", user.toBytes()]`.
- `referrerAllocation` = `["allocation", PublicKey.default.toBytes()]` (no referrer in B1 — the program skips the bonus when the referrer is the default allocation PDA).

### B-2. Instruction builder
```ts
export function buildSolPurchaseInstruction(user: PublicKey, solLamports: bigint): TransactionInstruction;
```
- `data` = `presale_purchase_with_sol` discriminator `[161,153,65,238,160,236,43,165]` (8 bytes) ++ `solLamports` as **u64 little-endian** (8 bytes, hand-encoded — Hermes' Buffer lacks `writeBigUInt64LE`, see the existing `buildTransferCheckedInstruction` pattern).
- `keys` (EXACT order, from the program's `PresalePurchaseWithSol` struct / `lib/idl.json`):
  1. `config` — `{isSigner:false, isWritable:true}`
  2. `userAccount` — `{false, true}`
  3. `userAllocation` — `{false, true}`
  4. `referrerAllocation` — `{false, true}`
  5. `PYTH_SOL_USD_ACCOUNT` — `{false, false}`
  6. `user` — `{isSigner:true, isWritable:true}`
  7. `SOL_TREASURY` — `{false, true}`
  8. `SystemProgram.programId` — `{false, false}`
- `programId` = `PROGRAM_ID`.

### B-3. Submit
```ts
export async function submitPresaleBuySol(solLamports: bigint, scheme: TransparentScheme):
  Promise<{signature: string; lastValidBlockHeight: number}>;
```
Modeled on `submitSwap`/`submitTransparentTransfer` (`sendTransaction.ts`): `keychainManager.retrieveSeed()` (biometric/PIN-gated) → `mnemonicToSeed` → `deriveTransparentKeypair(seed, scheme)` → `zeroize(seed)` → `Keypair.fromSecretKey` → build ix (compute-budget limit + priority-fee ix via `estimatePriorityFee` + `buildSolPurchaseInstruction`) → `getLatestBlockhash` → compile V0 → `tx.sign([signer])` → `connection.sendRawTransaction(tx.serialize(), {skipPreflight:false, maxRetries:0})` → `zeroize(secretKey)` in `finally`. Returns `{signature, lastValidBlockHeight}`.
(Note `skipPreflight:false` — Helius' `skipPreflight:true` sendTransaction path is ~60s-slow for program txs, the same issue fixed in the swap flow; the transparent-send path uses `skipPreflight:true` but a program/buy tx should preflight.)

### B-4. Estimate + validation helpers
```ts
export function estimateNocForSol(solAmount: number, solUsd: number, stagePriceUsd: number): number; // = solAmount*solUsd/stagePriceUsd
export const MIN_PURCHASE_USD = 25; // on-chain min ($25)
```

## C. Build-tx-for-simulation helper

Add to `presaleBuyModule`:
```ts
export async function buildSolPurchaseTx(user: PublicKey, solLamports: bigint): Promise<VersionedTransaction>;
```
Builds the same ix list with `payerKey = user`, recent blockhash, compiled V0 — for `simulateTransaction` on the Confirm screen (mirrors `buildTransferTx`). No signing.

## D. UI

### D-1. `#23` active screen — `src/screens/PresaleScreen.tsx` (`PresaleActive`, replace placeholder)
Build to `index.html #23` `active`:
- Stage badge "Stage {N} of 10" + price card **"$X / NOC"** (live from `usePresaleStore`).
- **SOL amount input** (numeric), "Balance: {solBalance} SOL" + Max chip.
- **NOC estimate** ("≈ {estimateNoc} NOC") using `estimateNocForSol(sol, solUsd, stagePriceUsd)` — `solUsd` from `useResolvedPrices()` (SOL price), `stagePriceUsd` from the store.
- Sticky **[Buy NOC]** — disabled until: amount > 0, `amount*solUsd ≥ MIN_PURCHASE_USD`, amount + est. fee ≤ solBalance. Below-min → hint "Minimum $25".
- "Not available in your region?" link is OUT (geo-gate deferred) — omit the link in B1 (no dead link).
- Tap [Buy NOC] → navigate to **PresaleBuyConfirm** with `{solLamports}`.

### D-2. `PresaleBuyConfirm` screen — `src/screens/presale/PresaleBuyConfirmScreen.tsx` (new)
- On mount: `buildSolPurchaseTx(user, solLamports)` → `simulateTransaction`. Show a spinner, then a review card: **"You pay {sol} SOL (~${usd})"**, **"You receive ≈ {noc} NOC"**, "Stage {N} · $X/NOC", "Noctura Presale program" (labeled, trusted — NOT a scary unknown-contract warning). Simulation failure → error state, no proceed.
- Sticky **[Confirm & Buy]** → `awaitUserAuth()` + `rootNav.navigate('UnlockSend', {...})` (reuse the existing re-auth bridge); on `approved` → navigate to **PresaleBuyStatus** with `{solLamports}`.

### D-3. `PresaleBuyStatus` screen — `src/screens/presale/PresaleBuyStatusScreen.tsx` (new)
- Clone the submit+poll loop from `TransactionStatusScreen`: `submitPresaleBuySol(solLamports, scheme)` → poll `getSignatureStatus` every 500ms, blockhash-expiry resubmit (`MAX_ATTEMPTS=3`), `stuck` after 90s, success/failed states.
- On success: best-effort `POST ${API_BASE}/solana/purchase` (record: txHash, buyerAddress, paymentToken:'SOL', paymentAmount, nocAmount(est), usdValue, stage) via the presale module — ignore failures (non-critical, like the website). Then trigger an allocation refresh (invalidate the `['presaleAllocation', addr]` query). Show "Order pending/confirmed" per the `#23` `pending` state.
- Navigation: success → back to dashboard / presale; failed → retry/cancel.

### D-4. Navigation — `src/app/Navigator.tsx`
- Add `PresaleBuyConfirm` + `PresaleBuyStatus` to the `DashboardStack` (where `Presale` lives), params `{solLamports: string}` (string — bigint isn't serializable in route params; parse back with `BigInt`).
- The presale screen's [Buy NOC] uses the dashboard nav (`Presale` is already in `DashboardStack`).

## E. Fees

Pre-TGE → `feeEngine.getEffectiveFee` returns `0n`; the buy ix list does **NOT** append the transparent transfer markup (the program takes the SOL payment directly). Only the network base fee + the compute-budget/priority-fee instructions apply.

## F. Error handling / states

- Below `MIN_PURCHASE_USD` → [Buy NOC] disabled + hint.
- Insufficient SOL (amount + fee headroom) → disabled + hint.
- Simulation failure (e.g. presale paused, min not met on-chain, stage sold out) → Confirm shows the mapped error (`mapSimulationError`), no proceed.
- Submit/confirm failure or blockhash expiry → the Status screen's existing retry path (up to 3 attempts), then `failed`/`stuck`.
- Coordinator record failure → ignored (best-effort).
- Re-auth cancelled → return to Confirm.

## G. Testing

- `presaleBuyModule.test.ts`:
  - PDA derivations match expected (config seeded with ADMIN, user/allocation with the buyer, referrer with `PublicKey.default`) — assert the derived base58 addresses for a fixed test user.
  - `buildSolPurchaseInstruction`: `data` first 8 bytes = the discriminator, next 8 = the u64 LE of a sample lamports value; `keys` length 8, correct pubkeys + `isSigner`/`isWritable` flags in order; `programId === PROGRAM_ID`.
  - `estimateNocForSol(2, 150, 0.1501)` ≈ `1998.67` NOC; `MIN_PURCHASE_USD === 25`.
- `PresaleBuyConfirmScreen` / status: re-auth bridge invoked before submit; submit called once on the status screen; (status transitions can be covered like the existing `TransactionStatusScreen` tests if present, else module-level).
- On-device (mainnet): a small SOL purchase (≥ $25) → simulate → confirm (biometric) → submit → confirmed; the bought NOC appears in the allocation after refresh; verify the tx on-chain hits `PROGRAM_ID` and SOL went to `SOL_TREASURY`.

## Out of scope (B1)

- USDC + USDT payment (B2 — token picker + 2 stablecoin instructions + ATA handling).
- Geo/MiCA gate.
- Referral (referrer is always `PublicKey.default`).
- Post-TGE claim (Cycle C).
- Auto-stake (`*_and_vest_stake`) variants.
