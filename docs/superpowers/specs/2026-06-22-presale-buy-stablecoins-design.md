# Presale Buy — USDC + USDT (Cycle B2) — Design

**Status:** Approved (brainstorming), pending spec review.
**Date:** 2026-06-22
**Repo:** NocturaWallet.
**Branch:** `feat/presale-buy-stablecoins` (stacked on `feat/presale-buy-sol` / PR #25, which stacks on Cycle A / PR #24).

## Context

Cycle B1 shipped the **SOL** presale buy (verified on mainnet). B2 adds **USDC + USDT** payment for full parity with the website. It reuses the entire B1 flow (the `#23` screen, `PresaleBuyConfirm`, `PresaleBuyStatus`) and adds two stablecoin instruction builders + a payment-token selector.

The stablecoin purchase is a different on-chain instruction (`presale_purchase_with_usdc` / `presale_purchase_with_usdt`): amount = stablecoin **base units (6 decimals), 1:1 USD** (no Pyth oracle); payment is an SPL transfer from the buyer's stablecoin ATA to the **admin's** stablecoin ATA (`ADMIN_ADDRESS`), NOT the SOL treasury.

**Decisions (from brainstorming):**
- Payment selector = a **3-chip row** (SOL · USDC · USDT) above "YOU PAY" on `#23` — a flagged extension of the design (the `#23` mockup shows SOL only).
- Stablecoin input is entered **in the token amount** (= USD, since 1:1); estimate `NOC = amount / stagePrice`.
- No create-ATA for the buyer (they can only pay if they already hold the token). Admin ATA is derived (it exists — the live presale receives stablecoins there); a missing admin ATA surfaces as a simulation error before the user pays.

## A. Constants — `src/modules/presale/presaleBuyModule.ts`

Add the two Anchor discriminators + the SPL token program id (the existing `SPL_TOKEN_PROGRAM_ID` in `transactionBuilder.ts` is module-private):
```ts
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const PURCHASE_WITH_USDC_DISCRIMINATOR = [150, 34, 181, 239, 229, 123, 187, 128];
const PURCHASE_WITH_USDT_DISCRIMINATOR = [209, 3, 170, 172, 219, 182, 149, 89];
```
Reuse `USDC_MINT`/`USDT_MINT` (constants), `ADMIN_ADDRESS`, and `findAssociatedTokenAddress` (exported from `transactionBuilder.ts`).

## B. Stablecoin instruction builder

```ts
export type StablecoinToken = 'USDC' | 'USDT';

export function buildStablecoinPurchaseInstruction(
  user: PublicKey,
  token: StablecoinToken,
  amountBaseUnits: bigint, // 6-dec stablecoin units
): TransactionInstruction;
```
- `mint` = `USDC_MINT` / `USDT_MINT`; `disc` = the matching discriminator.
- `data` = `disc` (8 bytes) ++ `encodeU64LE(amountBaseUnits)` (reuse the B1 `encodeU64LE`).
- `userAta = findAssociatedTokenAddress(user, mint)`, `adminAta = findAssociatedTokenAddress(ADMIN, mint)`.
- PDAs via `derivePresalePdas(user)` (reused from B1).
- `keys` (EXACT order, from `PresalePurchaseWithStablecoin`):
  1. `config` `{false,true}`
  2. `userAccount` `{false,true}`
  3. `userAllocation` `{false,true}`
  4. `referrerAllocation` `{false,true}`
  5. `userAta` `{false,true}`
  6. `adminAta` `{false,true}`
  7. `mint` `{false,false}`
  8. `user` `{true,true}`
  9. `TOKEN_PROGRAM_ID` `{false,false}`
  10. `SystemProgram.programId` `{false,false}`
- `programId = PROGRAM`.

## C. Submit + sim-tx (stablecoin)

```ts
export async function buildStablecoinPurchaseTx(user: PublicKey, token: StablecoinToken, amountBaseUnits: bigint): Promise<VersionedTransaction>;
export async function submitPresaleBuyStablecoin(token: StablecoinToken, amountBaseUnits: bigint, scheme: TransparentScheme): Promise<{signature: string; lastValidBlockHeight: number}>;
```
Identical structure to `buildSolPurchaseTx` / `submitPresaleBuySol` (compute-budget + the stablecoin instruction; biometric `retrieveSeed` → derive → sign → broadcast `skipPreflight:false` → zeroize in `finally`). No Pyth.

## D. Estimate

```ts
export function estimateNocForUsd(usd: number, stagePriceUsd: number): number; // = usd/stagePrice (stablecoin is 1:1 USD)
```
(B1's `estimateNocForSol(sol, solUsd, stagePrice)` stays for the SOL path.)

## E. `#23` screen — payment selector + per-token logic (`PresaleScreen.tsx`)

- Add a **3-chip selector** (`SOL` · `USDC` · `USDT`) above the "YOU PAY" card; selected chip highlighted. Local state `paymentToken: 'SOL' | 'USDC' | 'USDT'`.
- The "YOU PAY" ticker + "Available …" reflect the selected token:
  - **SOL** → balance = `solBalance` (B1 logic, estimate via `estimateNocForSol`).
  - **USDC/USDT** → balance from the wallet's token balances (the same source the dashboard/token-detail uses for the mint); estimate via `estimateNocForUsd(amountNum, stagePriceUsd)` (amount IS the USD value).
- Generalize the gate: `canBuy` becomes token-aware:
  - `usdValue` = SOL → `amount*solUsd`; stablecoin → `amount` (1:1).
  - min `$10` / max `$50,000` on `usdValue` (both tokens).
  - balance check: SOL → `amount + FEE_HEADROOM_SOL <= solBalance`; stablecoin → `amount <= tokenBalance` AND `solBalance >= FEE_HEADROOM_SOL` (need a little SOL for the network fee), with reason "Need a little SOL for the network fee" if SOL is too low.
- On [Buy]: compute `amountBaseUnits` (SOL → `BigInt(round(amount*1e9))`; stablecoin → `BigInt(round(amount*1e6))`) and `navigation.navigate('PresaleBuyConfirm', {paymentToken, amountBaseUnits: amountBaseUnits.toString()})`.

## F. Generalize Confirm + Status to the payment token

- **Route params** change from `{solLamports: string}` to `{paymentToken: 'SOL'|'USDC'|'USDT', amountBaseUnits: string}` for both `PresaleBuyConfirm` and `PresaleBuyStatus` (update `navigation.d.ts` + the Navigator wrappers).
- **PresaleBuyConfirm:** branch the sim-tx + the "You pay" display by `paymentToken`:
  - SOL → `buildSolPurchaseTx(user, BigInt(amountBaseUnits))`, "pay {x} SOL (~$usd)".
  - USDC/USDT → `buildStablecoinPurchaseTx(user, token, BigInt(amountBaseUnits))`, "pay {x} {token}".
  - "You receive ≈ {noc}" via the matching estimate. Re-auth unchanged.
- **PresaleBuyStatus:** branch the submit by `paymentToken` (`submitPresaleBuySol` vs `submitPresaleBuyStablecoin`). `recordPresalePurchase` already accepts `paymentToken: 'SOL'|'USDC'|'USDT'` — pass the real token + `paymentAmount` (display units) + `usdValue`.

## G. ATA handling

- Buyer ATA: derived; no create-ATA — a buyer with no token balance is blocked at the `#23` gate (can't pay anyway).
- Admin ATA: derived from `ADMIN_ADDRESS` + mint; assumed to exist (the live presale receives stablecoins there). If absent, `simulateTransaction` on the Confirm screen fails with a mapped error → no proceed (the user never pays).

## H. Error handling / states

- Insufficient token balance / below `$10` / above `$50k` / not enough SOL for fee → [Buy] disabled + the matching hint.
- Simulation failure (paused, sold out, missing admin ATA, etc.) → Confirm error, no proceed.
- Submit/poll/retry/stuck → reused from B1.

## I. Testing

- `presaleBuyModule.test.ts` (extend): for USDC AND USDT — discriminator bytes, `amountBaseUnits` u64-LE, the 10-account order/flags incl. `userAta`/`adminAta` (assert against independently-derived `findAssociatedTokenAddress`), `mint`, `TOKEN_PROGRAM_ID`, `user` signer. `estimateNocForUsd(40, 0.1501) ≈ 266.5`.
- `PresaleActive` gate: token-aware `canBuy` — USDC below $10, USDC over balance, USDC with too-little SOL for fee, USDC happy path; SOL paths unchanged.
- On-device (mainnet, small amounts ≥ $10): buy with USDC and with USDT → simulate → confirm → submit → confirmed; verify on-chain the stablecoin went to the admin ATA and the allocation increased.

## Out of scope (B2)

- Post-TGE claim (Cycle C), geo-gate, referral, auto-stake (`*_and_vest_stake`).
