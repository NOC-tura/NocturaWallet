# Presale Buy — USDC + USDT (Cycle B2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add USDC + USDT payment to the presale buy — two hand-built stablecoin instructions, a 3-chip payment selector on `#23`, and a generalized confirm/status flow — reusing everything from B1.

**Architecture:** Extend `presaleBuyModule` with `buildStablecoinPurchaseInstruction`/`buildStablecoinPurchaseTx`/`submitPresaleBuyStablecoin` (SPL transfer to the admin's ATA, 1:1 USD, no Pyth). Make `#23`'s gate token-aware (3-chip selector) and generalize the buy route from `{solLamports}` to `{paymentToken, amountBaseUnits}`, branching SOL vs stablecoin in Confirm/Status.

**Tech Stack:** React Native (Hermes), TypeScript strict, `@solana/web3.js` (manual instruction building), Jest.

**Working dir:** `/home/user/Solana/Project/NocturaWallet`. Branch `feat/presale-buy-stablecoins` (spec committed; stacked on B1 / PR #25 → Cycle A / PR #24).

> Stablecoin payment goes to **`findAssociatedTokenAddress(ADMIN_ADDRESS, mint)`** (admin ATA), NOT the SOL treasury. Amount = stablecoin base units (6 decimals), 1:1 USD.

---

## File Structure

- `src/modules/presale/presaleBuyModule.ts` — **Modify.** Add stablecoin instruction + sim-tx + submit + `estimateNocForUsd`.
- `src/modules/presale/__tests__/presaleBuyModule.test.ts` — **Modify.** Add USDC/USDT tests.
- `src/screens/PresaleScreen.tsx` — **Modify.** 3-chip selector; token-aware `canBuy`; per-token input/estimate/navigate.
- `src/screens/__tests__/PresaleActive.test.tsx` — **Modify.** Token-aware gate tests.
- `src/screens/presale/PresaleBuyConfirmScreen.tsx` — **Modify.** Branch sim-tx + display by token.
- `src/screens/presale/PresaleBuyStatusScreen.tsx` — **Modify.** Branch submit by token.
- `src/app/Navigator.tsx` + `src/types/navigation.d.ts` — **Modify.** Route params `{paymentToken, amountBaseUnits}`.

---

## Task 1: Stablecoin instruction + estimate

**Files:**
- Modify: `src/modules/presale/presaleBuyModule.ts`
- Test: `src/modules/presale/__tests__/presaleBuyModule.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/modules/presale/__tests__/presaleBuyModule.test.ts`:
```ts
import {buildStablecoinPurchaseInstruction, estimateNocForUsd} from '../presaleBuyModule';
import {USDC_MINT, USDT_MINT} from '../../tokens/coreTokens';
import {findAssociatedTokenAddress} from '../../solana/transactionBuilder';

const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ADMIN = new PublicKey(ADMIN_ADDRESS);

describe('buildStablecoinPurchaseInstruction', () => {
  it.each([
    ['USDC', USDC_MINT, [150, 34, 181, 239, 229, 123, 187, 128]],
    ['USDT', USDT_MINT, [209, 3, 170, 172, 219, 182, 149, 89]],
  ] as const)('builds the %s instruction with the right disc, amount, and 10 accounts', (token, mint, disc) => {
    const amount = 25_000_000n; // 25 USDC/USDT (6 dp)
    const ix = buildStablecoinPurchaseInstruction(USER, token, amount);
    expect([...ix.data.subarray(0, 8)]).toEqual(disc);
    // 25_000_000 = 0x017D7840 → LE
    expect([...ix.data.subarray(8, 16)]).toEqual([0x40, 0x78, 0x7d, 0x01, 0x00, 0x00, 0x00, 0x00]);
    expect(ix.data.length).toBe(16);
    expect(ix.programId.toBase58()).toBe(PROGRAM_ID);
    const pdas = derivePresalePdas(USER);
    const userAta = findAssociatedTokenAddress(USER, new PublicKey(mint)).toBase58();
    const adminAta = findAssociatedTokenAddress(ADMIN, new PublicKey(mint)).toBase58();
    const expected = [
      [pdas.config.toBase58(), false, true],
      [pdas.userAccount.toBase58(), false, true],
      [pdas.userAllocation.toBase58(), false, true],
      [pdas.referrerAllocation.toBase58(), false, true],
      [userAta, false, true],
      [adminAta, false, true],
      [mint, false, false],
      [USER.toBase58(), true, true],
      [TOKEN_PROGRAM, false, false],
      [SystemProgram.programId.toBase58(), false, false],
    ];
    expect(ix.keys.map(k => [k.pubkey.toBase58(), k.isSigner, k.isWritable])).toEqual(expected);
  });
});

describe('estimateNocForUsd', () => {
  it('computes NOC = usd/stagePrice (stablecoin is 1:1 USD)', () => {
    expect(estimateNocForUsd(40, 0.1501)).toBeCloseTo(266.489, 2);
    expect(estimateNocForUsd(10, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest presaleBuyModule`
Expected: FAIL — `buildStablecoinPurchaseInstruction` / `estimateNocForUsd` not exported.

- [ ] **Step 3: Implement**

In `src/modules/presale/presaleBuyModule.ts`:
- Add the import for the ATA helper + mints at the top:
```ts
import {findAssociatedTokenAddress} from '../solana/transactionBuilder';
import {USDC_MINT, USDT_MINT} from '../tokens/coreTokens';
```
- Add constants near the SOL discriminator:
```ts
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const PURCHASE_WITH_USDC_DISCRIMINATOR = [150, 34, 181, 239, 229, 123, 187, 128];
const PURCHASE_WITH_USDT_DISCRIMINATOR = [209, 3, 170, 172, 219, 182, 149, 89];

export type StablecoinToken = 'USDC' | 'USDT';

const STABLECOIN: Record<StablecoinToken, {mint: PublicKey; disc: number[]}> = {
  USDC: {mint: new PublicKey(USDC_MINT), disc: PURCHASE_WITH_USDC_DISCRIMINATOR},
  USDT: {mint: new PublicKey(USDT_MINT), disc: PURCHASE_WITH_USDT_DISCRIMINATOR},
};
```
- Add the builder + estimate (reuse `derivePresalePdas`, `encodeU64LE`):
```ts
/**
 * Hand-build presale_purchase_with_usdc / _usdt. Payment is an SPL transfer
 * from the buyer's ATA to the ADMIN's ATA (1:1 USD, no Pyth). Account order
 * matches the program's PresalePurchaseWithStablecoin struct.
 */
export function buildStablecoinPurchaseInstruction(
  user: PublicKey,
  token: StablecoinToken,
  amountBaseUnits: bigint,
): TransactionInstruction {
  const {mint, disc} = STABLECOIN[token];
  const {config, userAccount, userAllocation, referrerAllocation} = derivePresalePdas(user);
  const userAta = findAssociatedTokenAddress(user, mint);
  const adminAta = findAssociatedTokenAddress(ADMIN, mint);
  const data = Buffer.concat([Buffer.from(disc), encodeU64LE(amountBaseUnits)]);
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      {pubkey: config, isSigner: false, isWritable: true},
      {pubkey: userAccount, isSigner: false, isWritable: true},
      {pubkey: userAllocation, isSigner: false, isWritable: true},
      {pubkey: referrerAllocation, isSigner: false, isWritable: true},
      {pubkey: userAta, isSigner: false, isWritable: true},
      {pubkey: adminAta, isSigner: false, isWritable: true},
      {pubkey: mint, isSigner: false, isWritable: false},
      {pubkey: user, isSigner: true, isWritable: true},
      {pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
      {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
    ],
    data,
  });
}

/** UI estimate for a stablecoin (1:1 USD) payment. */
export function estimateNocForUsd(usd: number, stagePriceUsd: number): number {
  if (stagePriceUsd <= 0) {
    return 0;
  }
  return usd / stagePriceUsd;
}
```
> `ADMIN` and `PROGRAM` `PublicKey`s already exist at the top of the module (from B1). Confirm `findAssociatedTokenAddress` is exported from `transactionBuilder.ts` (it is).

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest presaleBuyModule` → PASS. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/modules/presale/presaleBuyModule.ts src/modules/presale/__tests__/presaleBuyModule.test.ts
git commit -m "feat(presale): hand-built USDC/USDT purchase instruction + estimateNocForUsd"
```

---

## Task 2: Stablecoin sim-tx + submit

**Files:**
- Modify: `src/modules/presale/presaleBuyModule.ts`
- Test: `src/modules/presale/__tests__/presaleBuyModule.test.ts`

- [ ] **Step 1: Write the failing test**

Append:
```ts
import {buildStablecoinPurchaseTx} from '../presaleBuyModule';

describe('buildStablecoinPurchaseTx', () => {
  it('builds a VersionedTransaction with the user as payer', async () => {
    jest.spyOn(connectionMod, 'getConnection').mockReturnValue({
      getLatestBlockhash: async () => ({blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 1}),
    } as never);
    const tx = await buildStablecoinPurchaseTx(USER, 'USDC', 25_000_000n);
    expect(tx.message.staticAccountKeys[0].toBase58()).toBe(USER.toBase58());
  });
});
```
(`connectionMod` is already imported in this test file from Task 2 of B1.)

- [ ] **Step 2: Run to verify it fails** → `buildStablecoinPurchaseTx` not exported.

- [ ] **Step 3: Implement** (append to `presaleBuyModule.ts`)

```ts
function buildStablecoinInstructions(
  user: PublicKey,
  token: StablecoinToken,
  amountBaseUnits: bigint,
  priorityFeeMicroLamports: number,
) {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({units: COMPUTE_UNIT_LIMIT}),
    ComputeBudgetProgram.setComputeUnitPrice({microLamports: priorityFeeMicroLamports}),
    buildStablecoinPurchaseInstruction(user, token, amountBaseUnits),
  ];
}

/** Unsigned stablecoin purchase tx for pre-submit simulation. Payer = user. */
export async function buildStablecoinPurchaseTx(
  user: PublicKey,
  token: StablecoinToken,
  amountBaseUnits: bigint,
): Promise<VersionedTransaction> {
  const connection = getConnection();
  const {blockhash} = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: user,
    recentBlockhash: blockhash,
    instructions: buildStablecoinInstructions(user, token, amountBaseUnits, 0),
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

/** Sign + broadcast a USDC/USDT purchase. Same safety as submitPresaleBuySol. */
export async function submitPresaleBuyStablecoin(
  token: StablecoinToken,
  amountBaseUnits: bigint,
  scheme: TransparentScheme,
): Promise<{signature: string; lastValidBlockHeight: number}> {
  const mnemonic = await keychainManager.retrieveSeed();
  const seed = await mnemonicToSeed(mnemonic);
  const {secretKey} = deriveTransparentKeypair(seed, scheme);
  zeroize(seed);
  try {
    const signer = Keypair.fromSecretKey(secretKey);
    const connection = getConnection();
    const priorityFee = await estimatePriorityFee(connection, 'fast');
    const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: signer.publicKey,
      recentBlockhash: blockhash,
      instructions: buildStablecoinInstructions(signer.publicKey, token, amountBaseUnits, priorityFee),
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([signer]);
    const raw = tx.serialize();
    let signature: string | null = null;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        signature = await connection.sendRawTransaction(raw, {skipPreflight: false, maxRetries: 2});
        break;
      } catch (e) {
        lastErr = e;
        await new Promise(r => setTimeout(r, 800));
      }
    }
    if (signature === null) {
      throw lastErr instanceof Error ? lastErr : new Error('Failed to broadcast presale buy');
    }
    return {signature, lastValidBlockHeight};
  } finally {
    zeroize(secretKey);
  }
}
```

- [ ] **Step 4: Run to verify it passes** → `npx jest presaleBuyModule` PASS; `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/modules/presale/presaleBuyModule.ts src/modules/presale/__tests__/presaleBuyModule.test.ts
git commit -m "feat(presale): buildStablecoinPurchaseTx + submitPresaleBuyStablecoin"
```

---

## Task 3: `#23` screen — 3-chip selector + token-aware gate

**Files:**
- Modify: `src/screens/PresaleScreen.tsx`
- Test: `src/screens/__tests__/PresaleActive.test.tsx`

- [ ] **Step 1: Rewrite the gate test (token-aware)**

Replace `src/screens/__tests__/PresaleActive.test.tsx` with:
```tsx
import {canBuy, FEE_HEADROOM_SOL} from '../PresaleScreen';
import {MIN_PURCHASE_USD, MAX_PURCHASE_USD} from '../../modules/presale/presaleBuyModule';

const SOL_USD = 200;
const base = {solUsd: SOL_USD, solBalance: 10, tokenBalance: 1000};

describe('canBuy (token-aware)', () => {
  it('SOL: zero/min/max/balance', () => {
    expect(canBuy({...base, paymentToken: 'SOL', amount: '0'}).enabled).toBe(false);
    expect(canBuy({...base, paymentToken: 'SOL', amount: '0.04'}).reason).toBe('Minimum $10'); // $8
    expect(canBuy({...base, paymentToken: 'SOL', amount: '300', solBalance: 1000}).reason).toBe('Maximum $50,000 per transaction');
    expect(canBuy({...base, paymentToken: 'SOL', amount: '1', solBalance: 1}).reason).toBe('Insufficient SOL balance');
    expect(canBuy({...base, paymentToken: 'SOL', amount: '0.2'}).enabled).toBe(true);
  });
  it('USDC/USDT: 1:1 USD min/max + token balance + SOL fee headroom', () => {
    expect(canBuy({...base, paymentToken: 'USDC', amount: '8'}).reason).toBe('Minimum $10');
    expect(canBuy({...base, paymentToken: 'USDC', amount: '60000', tokenBalance: 100000}).reason).toBe('Maximum $50,000 per transaction');
    expect(canBuy({...base, paymentToken: 'USDC', amount: '50', tokenBalance: 20}).reason).toBe('Insufficient USDC balance');
    expect(canBuy({...base, paymentToken: 'USDT', amount: '50', solBalance: 0}).reason).toBe('Need a little SOL for the network fee');
    expect(canBuy({...base, paymentToken: 'USDC', amount: '50'}).enabled).toBe(true);
    expect(canBuy({...base, paymentToken: 'USDC', amount: '10'}).enabled).toBe(true); // inclusive $10
  });
  it('exposes MIN $10 / MAX $50,000 + fee headroom', () => {
    expect(MIN_PURCHASE_USD).toBe(10);
    expect(MAX_PURCHASE_USD).toBe(50_000);
    expect(FEE_HEADROOM_SOL).toBe(0.001);
  });
});
```

- [ ] **Step 2: Run to verify it fails** → current `canBuy` has no `paymentToken`/`tokenBalance`.

- [ ] **Step 3: Make `canBuy` token-aware**

Replace the `canBuy` export in `src/screens/PresaleScreen.tsx` with:
```ts
export function canBuy({
  paymentToken,
  amount,
  solUsd,
  solBalance,
  tokenBalance,
}: {
  paymentToken: 'SOL' | 'USDC' | 'USDT';
  amount: string;
  solUsd: number;
  solBalance: number;
  tokenBalance: number; // display units of the selected stablecoin (ignored for SOL)
}): {enabled: boolean; reason: string | null} {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return {enabled: false, reason: null};
  }
  // Stablecoins are 1:1 USD; SOL converts via the live price.
  const usdValue = paymentToken === 'SOL' ? amt * solUsd : amt;
  if (usdValue < MIN_PURCHASE_USD) {
    return {enabled: false, reason: `Minimum $${MIN_PURCHASE_USD}`};
  }
  if (usdValue > MAX_PURCHASE_USD) {
    return {enabled: false, reason: `Maximum $${MAX_PURCHASE_USD.toLocaleString('en-US')} per transaction`};
  }
  if (paymentToken === 'SOL') {
    if (amt + FEE_HEADROOM_SOL > solBalance) {
      return {enabled: false, reason: 'Insufficient SOL balance'};
    }
  } else {
    if (amt > tokenBalance) {
      return {enabled: false, reason: `Insufficient ${paymentToken} balance`};
    }
    if (solBalance < FEE_HEADROOM_SOL) {
      return {enabled: false, reason: 'Need a little SOL for the network fee'};
    }
  }
  return {enabled: true, reason: null};
}
```

- [ ] **Step 4: Wire the selector + per-token logic into `PresaleActive`**

In `PresaleActive` (`PresaleScreen.tsx`):
- Add `const [paymentToken, setPaymentToken] = useState<'SOL' | 'USDC' | 'USDT'>('SOL');`. Reset `amount` to `''` when the token changes.
- Token balances + decimals:
  ```ts
  import {USDC_MINT, USDT_MINT} from '../modules/tokens/coreTokens';
  const tokenBalances = useWalletStore(s => s.tokenBalances); // Record<mint, baseUnitString>
  const stableMint = paymentToken === 'USDC' ? USDC_MINT : paymentToken === 'USDT' ? USDT_MINT : null;
  const tokenBalance = stableMint ? Number(tokenBalances[stableMint] ?? '0') / 1e6 : 0; // USDC/USDT = 6 dp
  ```
  (Verify the `tokenBalances` unit is base units by how `TokenListRow`/the dashboard renders it with `decimals`; if it's already display units, drop the `/1e6`.)
- `usdValue`/`nocEstimate` branch by token:
  ```ts
  const amountNum = Number(amount) || 0;
  const usdValue = paymentToken === 'SOL' ? amountNum * solUsd : amountNum;
  const nocEstimate = paymentToken === 'SOL'
    ? estimateNocForSol(amountNum, solUsd, stagePriceUsd)
    : estimateNocForUsd(amountNum, stagePriceUsd);
  ```
- `gate = useMemo(() => canBuy({paymentToken, amount, solUsd, solBalance, tokenBalance}), [paymentToken, amount, solUsd, solBalance, tokenBalance])`.
- The "Available" line + ticker show `paymentToken` and its balance (`solBalance` for SOL, `tokenBalance` for stablecoin). `onMax` for stablecoin sets `amount = String(tokenBalance)` (no fee headroom needed — fee is paid in SOL).
- The 3-chip selector: a row of 3 `Pressable` chips above the YOU PAY card (`SOL` | `USDC` | `USDT`), selected one highlighted (`bg-accent-transparent-tint` / accent text), `testID={`pay-chip-${t}`}`. Match the app's chip styling (e.g. the timeframe chips on TokenDetail).
- `onBuy`: branch the base-unit conversion + navigate with the generalized param:
  ```ts
  const amountBaseUnits = paymentToken === 'SOL'
    ? BigInt(Math.round(amountNum * 1e9))
    : BigInt(Math.round(amountNum * 1e6));
  navigation.navigate('PresaleBuyConfirm', {paymentToken, amountBaseUnits: amountBaseUnits.toString()});
  ```

- [ ] **Step 5: Run tests + tsc**

Run: `npx jest PresaleActive` (gate tests pass) + `npx tsc --noEmit` (clean — note this will FAIL until Task 4 updates the route param type; if so, proceed to Task 4 then re-run, OR temporarily the navigate call may show a type error that Task 4 resolves — acceptable mid-stack, but prefer doing Task 4's `navigation.d.ts` param change FIRST if tsc blocks the commit).

- [ ] **Step 6: Commit**

```bash
git add src/screens/PresaleScreen.tsx src/screens/__tests__/PresaleActive.test.tsx
git commit -m "feat(presale): #23 3-chip payment selector (SOL/USDC/USDT) + token-aware buy gate"
```

---

## Task 4: Generalize Confirm + Status + Navigator to `{paymentToken, amountBaseUnits}`

**Files:**
- Modify: `src/types/navigation.d.ts`, `src/app/Navigator.tsx`
- Modify: `src/screens/presale/PresaleBuyConfirmScreen.tsx`, `src/screens/presale/PresaleBuyStatusScreen.tsx`

- [ ] **Step 1: Update the route param types**

In `src/types/navigation.d.ts`, change the two `DashboardStackParamList` entries:
```ts
PresaleBuyConfirm: {paymentToken: 'SOL' | 'USDC' | 'USDT'; amountBaseUnits: string};
PresaleBuyStatus: {paymentToken: 'SOL' | 'USDC' | 'USDT'; amountBaseUnits: string};
```

- [ ] **Step 2: Update the Navigator wrappers**

In `src/app/Navigator.tsx`, `PresaleBuyConfirmNav` reads `{paymentToken, amountBaseUnits}` and `onAuthorized={() => navigation.navigate('PresaleBuyStatus', {paymentToken, amountBaseUnits})}`. `PresaleBuyStatusNav` reads both params and passes them through. (Mirror the existing wrappers; just widen the params.)

- [ ] **Step 3: Branch `PresaleBuyConfirmScreen` by token**

Change the props to `{paymentToken, amountBaseUnits, onAuthorized, onCancel}`. In the simulate-on-mount:
```ts
const lamportsOrUnits = safeBigInt(amountBaseUnits);
const tx = paymentToken === 'SOL'
  ? await buildSolPurchaseTx(user, lamportsOrUnits)
  : await buildStablecoinPurchaseTx(user, paymentToken, lamportsOrUnits);
```
Display "You pay": SOL → `{Number(amountBaseUnits)/1e9} SOL (~$usd)`; stablecoin → `{Number(amountBaseUnits)/1e6} {paymentToken}`. "You receive ≈": SOL → `estimateNocForSol(...)`, stablecoin → `estimateNocForUsd(Number(amountBaseUnits)/1e6, stagePriceUsd)`. Re-auth + everything else unchanged.

- [ ] **Step 4: Branch `PresaleBuyStatusScreen` by token**

Change the props to `{paymentToken, amountBaseUnits, onDashboard, onViewDetails}`. The submit branches:
```ts
const units = safeBigInt(amountBaseUnits);
const result = paymentToken === 'SOL'
  ? await submitPresaleBuySol(units, scheme)
  : await submitPresaleBuyStablecoin(paymentToken, units, scheme);
```
On success, `recordPresalePurchase`: `paymentToken`, `paymentAmount` = SOL → `Number(amountBaseUnits)/1e9`, stablecoin → `Number(amountBaseUnits)/1e6`; `nocAmount`/`usdValue` via the matching estimate (stablecoin `usdValue = paymentAmount`). Poll/retry/stuck unchanged.

- [ ] **Step 5: Run tests + tsc + full suite**

Run: `npx tsc --noEmit` (clean) + `npx jest` (full suite — no regressions).

- [ ] **Step 6: Commit**

```bash
git add src/types/navigation.d.ts src/app/Navigator.tsx src/screens/presale/PresaleBuyConfirmScreen.tsx src/screens/presale/PresaleBuyStatusScreen.tsx
git commit -m "feat(presale): generalize buy flow to {paymentToken, amountBaseUnits} (SOL/USDC/USDT)"
```

---

## Task 5: Full verification + on-device

- [ ] **Step 1:** `npx jest && npx tsc --noEmit` → all pass, clean.
- [ ] **Step 2:** Build the APK: `cd android && ENVFILE=.env.production ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`; copy to `/home/user/Downloads/`.
- [ ] **Step 3: On-device (mainnet, small amounts ≥ $10):**
  - `#23` → tap **USDC** chip → "Available {USDC}" shows; enter ≥ 10 → estimate updates → Buy.
  - Confirm ("pay X USDC → ≈ Y NOC", simulation OK) → biometric → Status → confirmed.
  - Repeat with **USDT**.
  - Verify on an explorer: the stablecoin went to the **admin ATA** (`ADMIN_ADDRESS`'s USDC/USDT ATA) and the allocation increased; the buy shows on noc-tura.io.
  - Edge: with 0 USDC balance → USDC Buy disabled; with ~0 SOL → "Need a little SOL for the network fee".

---

## Self-Review

**1. Spec coverage:**
- A. Constants/discriminators/token program → Task 1. ✓
- B. `buildStablecoinPurchaseInstruction` (10 accounts, both ATAs) → Task 1. ✓
- C. sim-tx + submit (stablecoin) → Task 2. ✓
- D. `estimateNocForUsd` → Task 1. ✓
- E. `#23` 3-chip selector + per-token input/gate → Task 3. ✓
- F. generalize Confirm/Status/Navigator to `{paymentToken, amountBaseUnits}` → Task 4. ✓
- G. ATA handling (derive both; no create) → Task 1 (builder derives both). ✓
- H. error handling (token-aware gate + sim) → Tasks 3, 4. ✓
- I. testing → Tasks 1, 3. ✓

**2. Placeholder scan:** Tasks 1-2 are exact code (money-critical instruction + submit). Tasks 3-4 give the exact `canBuy` + the precise per-token branches + navigate change; the chip styling references the existing timeframe chips. The `tokenBalances` unit has a verify-note (base units vs display). No `TODO`/`TBD`.

**3. Type consistency:** `StablecoinToken='USDC'|'USDT'`; `buildStablecoinPurchaseInstruction`/`buildStablecoinPurchaseTx`/`submitPresaleBuyStablecoin`/`estimateNocForUsd` defined in Tasks 1-2, used in 3-4. Route param `{paymentToken: 'SOL'|'USDC'|'USDT', amountBaseUnits: string}` consistent across `navigation.d.ts`, Navigator, both screens, and the `#23` navigate. `canBuy`'s new signature is updated in both the screen and its test (Task 3). `recordPresalePurchase` already accepts `paymentToken: 'SOL'|'USDC'|'USDT'`. amount units: SOL ×1e9, stablecoin ×1e6 — consistent in `#23` (encode), Confirm/Status (decode/display). No gaps.
