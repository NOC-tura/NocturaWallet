# Referral on Buy — B1: on-chain engine — Design

**Status:** Approved (brainstorming). **Date:** 2026-06-24. **Repo:** NocturaWallet. **Branch:** `feat/referral-onchain-b1`.

## Context

Cycle #4 part B = applying a referrer in the presale buy flow. Decomposed into **B1 (this spec): the on-chain referral engine** + **B2 (later): App Links capture** (native + website). B1 makes the buy credit a referrer; B2 only feeds the referrer address in via a `noc-tura.io?ref=<addr>` deep link.

### On-chain mechanics (verified from the ICO program)
- Referrer = a wallet **address**, stored on the buyer's own `PresaleAllocation.referrer`.
- `register_referrer(referrer: Pubkey)` — disc `[122,229,215,169,100,145,198,120]`; accounts (in order) `user_account`(w), `user_allocation`(w), `user`(signer,w), `system_program`. Both PDAs are `init_if_needed` (payer = user), so it works on a fresh wallet. Rejects: `referrer == default`, `referrer == self`, or an already-set referrer.
- On a purchase, the program credits **10%** (one-time, gated on `purchase_count == 0`) to the **referrer's** allocation, and validates the passed `referrer_allocation` account against seeds `["allocation", user_allocation.referrer]`. **So the `referrer_allocation` the client passes MUST equal the PDA of the buyer's current on-chain referrer** (or the program rejects the tx).
- Off-chain: the coordinator records a tiered **10–30%** bonus (purchases ≥ $100) when `recordPresalePurchase` includes a `referrerAddress`.

### PresaleAllocation layout (offsets, 117 bytes)
`disc(8) · user@8(32) · total_tokens@40(8) · total_spent_cents@48(8) · purchase_count@56(u32) · first_purchase_at@60(8) · last_purchase_at@68(8) · referral_bonus_tokens@76(8) · referrer@84(32) · claimed@116(1)`.

### Buy-flow architecture (existing)
- `PresaleBuyConfirmScreen` (#20) builds the tx for **simulation** via `buildSolPurchaseTx`/`buildStablecoinPurchaseTx`.
- `PresaleBuyStatusScreen` (#21) **signs + broadcasts** via `submitPresaleBuySol`/`submitPresaleBuyStablecoin`, then calls `recordPresalePurchase`.
- Both build through `buildSolPurchaseInstruction(user, lamports)` / `buildStablecoinPurchaseInstruction(...)` → `derivePresalePdas` → `referrerAllocation` (currently the **default/zero** PDA → no bonus). Account order has `referrerAllocation` at **index 3**; only its value changes.

## A. Captured-referrer store — `src/store/zustand/referralCaptureStore.ts` (new)

Persisted (MMKV **public** — not sensitive) zustand store:
- `capturedReferrer: string | null` — a base58 address.
- `setCapturedReferrer(addr: string)`, `clearCapturedReferrer()`.
B1's manual field writes here; B2's deep link will write here; cleared after a successful referred purchase.

## B. Resolve logic + register instruction — `src/modules/presale/presaleBuyModule.ts`

- `buildRegisterReferrerInstruction(user: PublicKey, referrer: PublicKey): TransactionInstruction` — disc + `referrer.toBytes()` (32) ; accounts `[userAccount(w), userAllocation(w), user(signer,w), SystemProgram]` (PDAs from `derivePresalePdas`).
- `fetchAllocationRef(user): Promise<{exists: boolean; referrer: string | null; purchaseCount: number}>` — `getConnection().getAccountInfo(userAllocation)`; decode `purchase_count` (u32 LE @56) and `referrer` (32 bytes @84; `null` when all-zero/default). `exists:false` when no account.
- `resolveReferrer(user: PublicKey, capturedReferrer: string | null): Promise<{referrerAllocation: PublicKey; registerReferrer: PublicKey | null; effectiveReferrerAddress: string | null}>`:
  - Read `fetchAllocationRef`.
  - `onChainReferrer` = `exists && referrer != null` ? referrer : null.
  - `capturedValid` = `capturedReferrer` is a valid base58 pubkey **and** ≠ user **and** ≠ default.
  - `isFirstPurchase` = `!exists || purchaseCount === 0`.
  - `registerReferrer` = (`!onChainReferrer && capturedValid && isFirstPurchase`) ? `new PublicKey(captured)` : null.
  - `effective` = `registerReferrer ?? (onChainReferrer ? new PublicKey(onChainReferrer) : null)`. *(A captured referrer is acted on only for a first-time buyer — matches the on-chain one-time bonus and the website; returning buyers without a prior referrer get nothing, on- or off-chain.)*
  - `referrerAllocation` = PDA `["allocation", (effective ?? PublicKey.default)]`.
  - `effectiveReferrerAddress` = `effective?.toBase58() ?? null`.
- `buildSolPurchaseInstruction` / `buildStablecoinPurchaseInstruction` gain a `referrerAllocation: PublicKey` parameter (passed in at index 3) instead of deriving the default. (Keeps the function pure/sync; the async resolve happens in the tx builders.)

## C. Bundle into the tx — same module

`buildSolPurchaseTx`, `buildStablecoinPurchaseTx`, `submitPresaleBuySol`, `submitPresaleBuyStablecoin` all:
1. `const captured = useReferralCaptureStore.getState().capturedReferrer;`
2. `const {referrerAllocation, registerReferrer, effectiveReferrerAddress} = await resolveReferrer(user, captured);`
3. Instructions = `[...(registerReferrer ? [buildRegisterReferrerInstruction(user, registerReferrer)] : []), buildXPurchaseInstruction(user, …, referrerAllocation)]` — one tx, register (if any) first so the purchase reads the just-set referrer.
4. The two `submit*` functions **return** `effectiveReferrerAddress` (added to their result object) so the status screen can record it.

Simulation (confirm) and submit build the SAME instruction list (both resolve identically — the buyer hasn't registered between the two), so the simulated tx matches what's broadcast.

## D. Off-chain record — `src/modules/presale/presaleModule.ts` + `PresaleBuyStatusScreen`

- `PresalePurchaseRecord` gains `referrerAddress?: string`. `recordPresalePurchase` already POSTs the whole record — no change beyond the field.
- `PresaleBuyStatusScreen`: capture `effectiveReferrerAddress` from the `submit*` result and pass it as `referrerAddress` in the `recordPresalePurchase({...})` call. On a confirmed referred purchase, call `clearCapturedReferrer()`.

## E. Manual referral field (B1 interim + fallback) — `src/screens/PresaleScreen.tsx` (`PresaleActive`)

A small "Have a referral?" affordance on #23 (above the sticky CTA):
- Reads `capturedReferrer` from the store.
- If none: a collapsible input "Paste referral address or link" + Apply. Accepts a raw base58 address OR a `…?ref=<addr>` URL (extract the `ref` query value). Validate with `new PublicKey(...)` (try/catch) and reject self (== wallet `publicKey`); on success `setCapturedReferrer`, on failure a caption error.
- If set: show "Referral applied · `Abcd…wxyz`" + a clear (×) → `clearCapturedReferrer`.
- A pure helper `parseReferralInput(raw): string | null` (extract address from a link or bare address; return null if not a 32-byte base58 key) — unit-tested.
> B2's deep link will call `setCapturedReferrer` directly; this field stays as a manual fallback (or is removed in B2 — decided then).

## F. Testing

- `parseReferralInput`: bare address → address; `https://noc-tura.io?ref=<addr>` → addr; junk → null.
- `fetchAllocationRef`: crafted buffers → decodes purchase_count + referrer; default referrer → null; no account → exists:false.
- `resolveReferrer` (mock `fetchAllocationRef`): no allocation + captured → register=captured, allocation=PDA(captured); on-chain referrer set → no register, allocation=PDA(onchain); purchase_count>0 + captured, no onchain → register=null, effective=null, allocation=PDA(default); captured == self → ignored.
- `buildRegisterReferrerInstruction`: disc + 32-byte referrer arg + 4 accounts in order.
- Buy tx builders: with a captured first-time referrer the tx has **2 instructions** `[register, purchase]` and the purchase's account #3 == PDA(captured); without a referrer it has 1 instruction and account #3 == default PDA (unchanged behavior).

## G. On-device (mainnet) — needs a FRESH wallet

1. Import/create a **fresh** wallet (no presale purchases) with a little SOL.
2. On #23, paste the **main wallet** address (`KnZ5…`) into "Have a referral?" → Apply.
3. Buy a small amount → the tx bundles `register_referrer` + purchase (one signature). After confirm, the **main wallet's** referral allocation gains the 10% bonus — verify in the Referral screen (`EARNED`/`totalBonusNoc`) on the main wallet, or on-chain.
4. The fresh wallet's captured referrer is cleared after success; a second buy does NOT re-register.

## Out of scope (B2 / later)
- App Links / Universal Links native config + `assetlinks.json` / `apple-app-site-association` (needs the APK signing cert + website hosting by the ICO Claude).
- The 3-level referral-loop guard (not implemented on-chain either — comment only).
- Showing the referee a "you were referred by X" confirmation beyond the applied chip.
