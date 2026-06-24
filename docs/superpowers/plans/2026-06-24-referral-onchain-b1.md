# Referral on Buy — B1 (on-chain engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. This touches the money-critical presale buy path — review every task against the spec + the ICO program.

**Goal:** Make a presale purchase credit a referrer: register the buyer's referrer on-chain (one-time) and pass the real `referrer_allocation` so the 10% bonus applies, plus record the referrer off-chain for the tiered bonus. A temporary manual field captures the referrer (B2 adds the deep link).

**Architecture:** A persisted captured-referrer store; a `resolveReferrer` step that reads the buyer's on-chain allocation and decides whether to register + which `referrer_allocation` to pass; bundle `[register_referrer?, purchase]` into the existing single tx (both simulation + submit paths); record `referrerAddress` off-chain.

**Tech Stack:** RN (Hermes), TS strict, @solana/web3.js manual instructions, zustand+MMKV, Jest.

**Working dir:** `/home/user/Solana/Project/NocturaWallet`. Branch `feat/referral-onchain-b1` (spec committed).

---

## File Structure
- `src/store/zustand/referralCaptureStore.ts` (+ test) — **Create.** Persisted captured referrer.
- `src/modules/presale/referralInput.ts` (+ test) — **Create.** `parseReferralInput`.
- `src/modules/presale/presaleBuyModule.ts` (+ test) — **Modify.** `buildRegisterReferrerInstruction`, `fetchAllocationRef`, `resolveReferrer`; thread `referrerAllocation` param + bundle register into the 4 build/submit fns; `submit*` return `effectiveReferrerAddress`.
- `src/modules/presale/presaleModule.ts` — **Modify.** `referrerAddress?` on `PresalePurchaseRecord`.
- `src/screens/presale/PresaleBuyStatusScreen.tsx` — **Modify.** Pass `referrerAddress` to the record; clear store on success.
- `src/screens/PresaleScreen.tsx` — **Modify.** Manual "Have a referral?" field.

---

## Task 1: Captured-referrer store

**Files:** Create `src/store/zustand/referralCaptureStore.ts` + `__tests__/referralCaptureStore.test.ts`.

- [ ] **Step 1: Test** — set persists `capturedReferrer`; clear resets to null. (Mirror an existing MMKV-persisted store's test setup, e.g. `presaleStore` uses `mmkvSecureStorage`; this store uses the **public** MMKV adapter — find it via `grep -rn "createJSONStorage" src/store`.)
```ts
import {useReferralCaptureStore} from '../referralCaptureStore';
it('sets and clears the captured referrer', () => {
  useReferralCaptureStore.getState().setCapturedReferrer('Abc123');
  expect(useReferralCaptureStore.getState().capturedReferrer).toBe('Abc123');
  useReferralCaptureStore.getState().clearCapturedReferrer();
  expect(useReferralCaptureStore.getState().capturedReferrer).toBeNull();
});
```
- [ ] **Step 2:** Run `npx jest referralCaptureStore` → FAIL.
- [ ] **Step 3: Implement** — zustand `persist` store (name `noctura-referral-capture`, **public** MMKV adapter — match the adapter the public settings store uses): `{capturedReferrer: string|null = null, setCapturedReferrer(a){set({capturedReferrer:a})}, clearCapturedReferrer(){set({capturedReferrer:null})}}`.
- [ ] **Step 4:** `npx jest referralCaptureStore` → PASS; `tsc` clean.
- [ ] **Step 5:** Commit `feat(referral): captured-referrer store (persisted)`.

---

## Task 2: parseReferralInput helper

**Files:** Create `src/modules/presale/referralInput.ts` + test.

- [ ] **Step 1: Test:**
```ts
import {parseReferralInput} from '../referralInput';
const ADDR = '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd';
it('accepts a bare base58 address', () => expect(parseReferralInput(ADDR)).toBe(ADDR));
it('extracts ?ref= from a link', () =>
  expect(parseReferralInput(`https://noc-tura.io?ref=${ADDR}`)).toBe(ADDR));
it('trims whitespace', () => expect(parseReferralInput(`  ${ADDR}  `)).toBe(ADDR));
it('rejects junk', () => {
  expect(parseReferralInput('hello')).toBeNull();
  expect(parseReferralInput('')).toBeNull();
});
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** — trim; if it contains `ref=`, take the `ref` value (split on `ref=` then on `&`); validate the candidate with `new PublicKey(candidate)` in try/catch (a valid 32-byte key); return the base58 string or null.
- [ ] **Step 4:** PASS; `tsc` clean.
- [ ] **Step 5:** Commit `feat(referral): parseReferralInput (address or ?ref= link)`.

---

## Task 3: register instruction + allocation read + resolveReferrer

**Files:** Modify `src/modules/presale/presaleBuyModule.ts` + its test.

- [ ] **Step 1: Tests** (add to `presaleBuyModule.test.ts`):
  - `buildRegisterReferrerInstruction(USER, REF)` → `data` = the 8-byte disc `[122,229,215,169,100,145,198,120]` followed by `REF.toBytes()` (40 bytes total); 4 keys in order `[userAccount(w,!s), userAllocation(w,!s), user(w,s), SystemProgram(!w,!s)]` matching `derivePresalePdas`.
  - `fetchAllocationRef`: mock `connection.getAccountInfo` (via the `connectionMod` spy already used in this test file) returning a 117-byte buffer with `purchase_count`=1 @56 (u32 LE) and a referrer pubkey @84 → decodes both; all-zero referrer → `referrer:null`; null account → `{exists:false, referrer:null, purchaseCount:0}`.
  - `resolveReferrer` (spy/mck `fetchAllocationRef` — export it so it can be spied, or factor the decode so the test injects account data): 
    - no allocation + captured `REF` → `registerReferrer` is `REF`, `referrerAllocation` = PDA(["allocation", REF]), `effectiveReferrerAddress` = REF.
    - on-chain referrer `R2` set → `registerReferrer` null, `referrerAllocation` = PDA(R2), effective = R2.
    - purchase_count 1, captured REF, no on-chain → `registerReferrer` null, effective null, `referrerAllocation` = PDA(default).
    - captured == USER (self) → ignored (register null, effective null).
- [ ] **Step 2:** Run `npx jest presaleBuyModule` → FAIL.
- [ ] **Step 3: Implement** in `presaleBuyModule.ts`:
  - `REGISTER_REFERRER_DISCRIMINATOR = [122,229,215,169,100,145,198,120]`.
  - `buildRegisterReferrerInstruction(user, referrer)` — `data = Buffer.concat([Buffer.from(DISC), Buffer.from(referrer.toBytes())])`; keys `[{userAccount,w}, {userAllocation,w}, {user,s,w}, {SystemProgram}]` from `derivePresalePdas(user)`.
  - `ALLOC_PURCHASE_COUNT_OFFSET = 56`, `ALLOC_REFERRER_OFFSET = 84`. `fetchAllocationRef(user)`: `getConnection().getAccountInfo(derivePresalePdas(user).userAllocation)`; if null/short → `{exists:false, referrer:null, purchaseCount:0}`; else read u32 LE @56 and the 32 bytes @84 (→ `new PublicKey(slice).toBase58()`, or `null` if all bytes are 0).
  - `resolveReferrer(user, capturedReferrer)` per spec §B (validate captured with `new PublicKey` try/catch; reject `== user` and the default key). Returns `{referrerAllocation, registerReferrer, effectiveReferrerAddress}`.
  - Add `referrerAllocation: PublicKey` param to `buildSolPurchaseInstruction` / `buildStablecoinPurchaseInstruction` (used at key index 3 instead of the derived default).
- [ ] **Step 4:** `npx jest presaleBuyModule` → PASS; `tsc` clean.
- [ ] **Step 5:** Commit `feat(referral): register_referrer ix + allocation read + resolveReferrer`.

---

## Task 4: Bundle into the buy tx (sim + submit)

**Files:** Modify `src/modules/presale/presaleBuyModule.ts` (`buildSolPurchaseTx`, `buildStablecoinPurchaseTx`, `submitPresaleBuySol`, `submitPresaleBuyStablecoin`) + tests.

- [ ] **Step 1: Tests** — extend the existing tx-builder tests: stub `resolveReferrer` (or the store + `fetchAllocationRef`) so a first-time captured referrer yields `registerReferrer`; assert the built `VersionedTransaction` message has **2 instructions** with the register disc first and the purchase second, and the purchase's account #3 == PDA(captured). With no captured referrer: **1 instruction**, account #3 == default PDA (unchanged). (The existing single-instruction assertions must still pass for the no-referrer path.)
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** — in each of the 4 functions: read `useReferralCaptureStore.getState().capturedReferrer`; `const r = await resolveReferrer(user, captured)`; build `instructions = [...(r.registerReferrer ? [buildRegisterReferrerInstruction(user, r.registerReferrer)] : []), buildXPurchaseInstruction(user, …, r.referrerAllocation)]`; compile to the v0 message as before. `submitPresaleBuySol`/`submitPresaleBuyStablecoin` add `effectiveReferrerAddress: r.effectiveReferrerAddress` to their returned object. Keep all existing safety (debounce/seed handling) intact.
- [ ] **Step 4:** `npx jest presaleBuyModule` → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5:** Commit `feat(referral): bundle register_referrer + real referrer_allocation into the buy tx`.

---

## Task 5: Off-chain record + clear-on-success

**Files:** Modify `presaleModule.ts` (`PresalePurchaseRecord`), `PresaleBuyStatusScreen.tsx`.

- [ ] **Step 1:** Add `referrerAddress?: string` to `PresalePurchaseRecord` (the POST already serializes the whole record).
- [ ] **Step 2:** In `PresaleBuyStatusScreen`, capture `effectiveReferrerAddress` from the `submit*` result; include `referrerAddress: effectiveReferrerAddress ?? undefined` in the `recordPresalePurchase({...})` call. After a CONFIRMED purchase where `effectiveReferrerAddress` was set, call `useReferralCaptureStore.getState().clearCapturedReferrer()`.
- [ ] **Step 3:** `npx jest` (status-screen + presale suites) green; `tsc` clean. Update the status-screen test if it asserts the submit result shape.
- [ ] **Step 4:** Commit `feat(referral): record referrerAddress off-chain + clear capture on success`.

---

## Task 6: Manual referral field on #23

**Files:** Modify `src/screens/PresaleScreen.tsx`; `src/modules/presale/referralInput.ts` is reused.

- [ ] **Step 1:** In `PresaleActive`, read `capturedReferrer` + actions from `useReferralCaptureStore`. Above the sticky CTA, render:
  - If `capturedReferrer == null`: a collapsible "Have a referral?" row that reveals a `TextInput` (placeholder "Paste referral address or link") + an Apply button. On Apply: `const a = parseReferralInput(input)`; if `a == null` or `a === publicKey` → show an inline caption error ("Invalid referral address" / "You can't refer yourself"); else `setCapturedReferrer(a)`.
  - If set: a chip "Referral applied · `{a.slice(0,4)}…{a.slice(-4)}`" + a clear `×` → `clearCapturedReferrer()`.
  - Use the design-system (`Text`, NativeWind, `accent-transparent`); match the existing input/card styling on this screen. Don't disturb the buy gate / geo gate.
- [ ] **Step 2:** Test (extend PresaleActive test or a small new one): applying a valid address sets the store; self/junk shows the error and does not set it; a set referrer renders the chip + clears.
- [ ] **Step 3:** `npx jest PresaleActive referral`; `tsc`; `eslint src/screens/PresaleScreen.tsx` clean.
- [ ] **Step 4:** Commit `feat(referral): manual "Have a referral?" field on #23 (interim capture)`.

---

## Task 7: Full verification + on-device (fresh wallet)

- [ ] **Step 1:** `npx jest && npx tsc --noEmit` → all green/clean.
- [ ] **Step 2:** Build `app-release.apk` → `/home/user/Downloads/NocturaWallet-referral-b1.apk`.
- [ ] **Step 3: On-device (mainnet, FRESH wallet):** per spec §G — fresh wallet, paste the main address as referral, buy small → tx bundles register+purchase (one signature); main wallet's `totalBonusNoc` (Referral screen) gains the 10%; capture cleared; a second buy doesn't re-register.

---

## Self-Review
- **Spec coverage:** A store→T1; parseReferralInput→T2; register ix + read + resolve→T3; bundle sim+submit→T4; off-chain + clear→T5; manual field→T6; on-device→T7. ✓
- **Money-critical guards:** `referrer_allocation` always equals PDA of the buyer's on-chain referrer **after** the bundled register (else the program rejects) — enforced by `resolveReferrer` returning `referrerAllocation` from the same `effective` used for `registerReferrer`. No-referrer path is byte-identical to today (1 instruction, default PDA). ✓
- **Type consistency:** `resolveReferrer → {referrerAllocation, registerReferrer, effectiveReferrerAddress}` (T3) consumed in T4/T5; `submit*` return gains `effectiveReferrerAddress` (T4) used in T5; `PresalePurchaseRecord.referrerAddress?` (T5). ✓
- **Flagged:** captured referrer acted on only for first-time buyers (matches on-chain one-time bonus + website); deep link is B2; manual field is interim/fallback.
