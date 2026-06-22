# Presale Buy — SOL (Cycle B1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user buy NOC in the presale by paying SOL — build the on-chain `presale_purchase_with_sol` instruction by hand, sign+submit it through the wallet's existing pipeline, and wire the `#23` buy flow (amount → confirm → status).

**Architecture:** A new `presaleBuyModule` hand-assembles the Anchor instruction (8-byte discriminator + u64-LE lamports + ordered PDA/account metas) — the wallet has no Anchor runtime. `submitPresaleBuySol` clones `submitSwap` (seed→derive→sign→broadcast→zeroize). Three dedicated screens (`#23` active rebuild, `PresaleBuyConfirm`, `PresaleBuyStatus`) reuse the lower-level modules (`simulateTransaction`, the `UnlockSend` re-auth bridge, the status poll loop).

**Tech Stack:** React Native (Hermes), TypeScript strict, `@solana/web3.js` (manual instruction building — no Anchor/spl-token), Jest.

**Working dir:** `/home/user/Solana/Project/NocturaWallet`. Branch `feat/presale-buy-sol` (spec committed; stacked on Cycle A / PR #24).

> On-chain target: `PROGRAM_ID = 6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt`. SOL → `SOL_TREASURY`. Amount = SOL paid; the program computes NOC via Pyth. **B1 = SOL only; no geo-gate; no referral (referrer = `PublicKey.default`).**

---

## File Structure

- `src/constants/programs.ts` — **Modify.** Add `PYTH_SOL_USD_ACCOUNT`.
- `src/modules/presale/presaleBuyModule.ts` — **Create.** PDAs, instruction builder, sim-tx builder, `submitPresaleBuySol`, `estimateNocForSol`, `MIN_PURCHASE_USD`.
- `src/modules/presale/__tests__/presaleBuyModule.test.ts` — **Create.**
- `src/screens/PresaleScreen.tsx` — **Modify.** Rebuild `PresaleActive` to the `#23` buy UI.
- `src/screens/presale/PresaleBuyConfirmScreen.tsx` — **Create.**
- `src/screens/presale/PresaleBuyStatusScreen.tsx` — **Create.**
- `src/app/Navigator.tsx` — **Modify.** Register the two new screens + route params.

---

## Task 1: Buy instruction + PDAs + helpers

**Files:**
- Modify: `src/constants/programs.ts`
- Create: `src/modules/presale/presaleBuyModule.ts`
- Test: `src/modules/presale/__tests__/presaleBuyModule.test.ts`

- [ ] **Step 1: Add the Pyth constant**

In `src/constants/programs.ts`, after the `RPC_ENDPOINT`/`PROGRAM_ID` area, add:
```ts
// Pyth SOL/USD price account (read-only) required by presale_purchase_with_sol.
export const PYTH_SOL_USD_ACCOUNT = '7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE';
```

- [ ] **Step 2: Write the failing test**

Create `src/modules/presale/__tests__/presaleBuyModule.test.ts`:
```ts
import {PublicKey, SystemProgram} from '@solana/web3.js';
import {
  derivePresalePdas,
  buildSolPurchaseInstruction,
  estimateNocForSol,
  MIN_PURCHASE_USD,
} from '../presaleBuyModule';
import {PROGRAM_ID, ADMIN_ADDRESS, SOL_TREASURY, PYTH_SOL_USD_ACCOUNT} from '../../../constants/programs';

const USER = new PublicKey('KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr');
const PROGRAM = new PublicKey(PROGRAM_ID);

describe('derivePresalePdas', () => {
  it('derives config from ADMIN, user/allocation from the buyer, referrer from default', () => {
    const pdas = derivePresalePdas(USER);
    const [config] = PublicKey.findProgramAddressSync([Buffer.from('config'), new PublicKey(ADMIN_ADDRESS).toBytes()], PROGRAM);
    const [userAccount] = PublicKey.findProgramAddressSync([Buffer.from('user'), USER.toBytes()], PROGRAM);
    const [userAllocation] = PublicKey.findProgramAddressSync([Buffer.from('allocation'), USER.toBytes()], PROGRAM);
    const [referrer] = PublicKey.findProgramAddressSync([Buffer.from('allocation'), PublicKey.default.toBytes()], PROGRAM);
    expect(pdas.config.toBase58()).toBe(config.toBase58());
    expect(pdas.userAccount.toBase58()).toBe(userAccount.toBase58());
    expect(pdas.userAllocation.toBase58()).toBe(userAllocation.toBase58());
    expect(pdas.referrerAllocation.toBase58()).toBe(referrer.toBase58());
  });
});

describe('buildSolPurchaseInstruction', () => {
  it('encodes the discriminator + u64-LE lamports and orders the 8 accounts', () => {
    const lamports = 2_000_000_000n; // 2 SOL
    const ix = buildSolPurchaseInstruction(USER, lamports);
    // data: 8-byte discriminator + 8-byte u64 LE
    expect([...ix.data.subarray(0, 8)]).toEqual([161, 153, 65, 238, 160, 236, 43, 165]);
    // 2_000_000_000 = 0x7735_9400 → LE bytes
    expect([...ix.data.subarray(8, 16)]).toEqual([0x00, 0x94, 0x35, 0x77, 0x00, 0x00, 0x00, 0x00]);
    expect(ix.data.length).toBe(16);
    expect(ix.programId.toBase58()).toBe(PROGRAM_ID);
    const pdas = derivePresalePdas(USER);
    const expected = [
      [pdas.config.toBase58(), false, true],
      [pdas.userAccount.toBase58(), false, true],
      [pdas.userAllocation.toBase58(), false, true],
      [pdas.referrerAllocation.toBase58(), false, true],
      [PYTH_SOL_USD_ACCOUNT, false, false],
      [USER.toBase58(), true, true],
      [SOL_TREASURY, false, true],
      [SystemProgram.programId.toBase58(), false, false],
    ];
    expect(ix.keys.map(k => [k.pubkey.toBase58(), k.isSigner, k.isWritable])).toEqual(expected);
  });

  it('rejects a lamports value out of u64 range', () => {
    expect(() => buildSolPurchaseInstruction(USER, -1n)).toThrow();
    expect(() => buildSolPurchaseInstruction(USER, 2n ** 64n)).toThrow();
  });
});

describe('estimateNocForSol', () => {
  it('computes NOC = sol*usd/stagePrice', () => {
    expect(estimateNocForSol(2, 150, 0.1501)).toBeCloseTo(1998.667, 2);
    expect(estimateNocForSol(1, 150, 0)).toBe(0);
  });
  it('MIN_PURCHASE_USD is $25', () => {
    expect(MIN_PURCHASE_USD).toBe(25);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest presaleBuyModule`
Expected: FAIL — cannot find module `../presaleBuyModule`.

- [ ] **Step 4: Implement the module**

Create `src/modules/presale/presaleBuyModule.ts`:
```ts
import {PublicKey, SystemProgram, TransactionInstruction} from '@solana/web3.js';
import {PROGRAM_ID, ADMIN_ADDRESS, SOL_TREASURY, PYTH_SOL_USD_ACCOUNT} from '../../constants/programs';

const PROGRAM = new PublicKey(PROGRAM_ID);
const ADMIN = new PublicKey(ADMIN_ADDRESS);
const PYTH = new PublicKey(PYTH_SOL_USD_ACCOUNT);
const TREASURY = new PublicKey(SOL_TREASURY);

// Anchor 8-byte discriminator for `presale_purchase_with_sol`.
const PURCHASE_WITH_SOL_DISCRIMINATOR = [161, 153, 65, 238, 160, 236, 43, 165];

/** On-chain minimum purchase, in USD (the program rejects below $25). */
export const MIN_PURCHASE_USD = 25;

export interface PresalePdas {
  config: PublicKey;
  userAccount: PublicKey;
  userAllocation: PublicKey;
  referrerAllocation: PublicKey;
}

/** Derive the four PDAs the purchase instruction needs. */
export function derivePresalePdas(user: PublicKey): PresalePdas {
  const [config] = PublicKey.findProgramAddressSync([Buffer.from('config'), ADMIN.toBytes()], PROGRAM);
  const [userAccount] = PublicKey.findProgramAddressSync([Buffer.from('user'), user.toBytes()], PROGRAM);
  const [userAllocation] = PublicKey.findProgramAddressSync([Buffer.from('allocation'), user.toBytes()], PROGRAM);
  // No referrer in B1: the program skips the bonus when the referrer allocation
  // is the PDA of the default (all-zero) pubkey.
  const [referrerAllocation] = PublicKey.findProgramAddressSync(
    [Buffer.from('allocation'), PublicKey.default.toBytes()],
    PROGRAM,
  );
  return {config, userAccount, userAllocation, referrerAllocation};
}

/**
 * Encode a u64 as 8 little-endian bytes WITHOUT Buffer.writeBigUInt64LE — the
 * Hermes Buffer polyfill (buffer@5.7.1) lacks the BigInt accessors and throws
 * on-device. Mirrors buildTransferCheckedInstruction in transactionBuilder.ts.
 */
function encodeU64LE(value: bigint): Buffer {
  const MAX_U64 = 18_446_744_073_709_551_615n;
  if (value < 0n || value > MAX_U64) {
    throw new Error(`presale buy: lamports out of u64 range: ${value}`);
  }
  const buf = Buffer.alloc(8);
  let remaining = value;
  for (let i = 0; i < 8; i++) {
    buf.writeUInt8(Number(remaining & 0xffn), i);
    remaining >>= 8n;
  }
  return buf;
}

/**
 * Hand-build the `presale_purchase_with_sol(sol_amount)` instruction.
 * Account order is authoritative (matches the program's PresalePurchaseWithSol
 * struct / lib/idl.json): config, user_account, user_allocation,
 * referrer_allocation, pyth_sol_usd_price, user(signer), sol_treasury, system.
 */
export function buildSolPurchaseInstruction(user: PublicKey, solLamports: bigint): TransactionInstruction {
  const {config, userAccount, userAllocation, referrerAllocation} = derivePresalePdas(user);
  const data = Buffer.concat([Buffer.from(PURCHASE_WITH_SOL_DISCRIMINATOR), encodeU64LE(solLamports)]);
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      {pubkey: config, isSigner: false, isWritable: true},
      {pubkey: userAccount, isSigner: false, isWritable: true},
      {pubkey: userAllocation, isSigner: false, isWritable: true},
      {pubkey: referrerAllocation, isSigner: false, isWritable: true},
      {pubkey: PYTH, isSigner: false, isWritable: false},
      {pubkey: user, isSigner: true, isWritable: true},
      {pubkey: TREASURY, isSigner: false, isWritable: true},
      {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
    ],
    data,
  });
}

/** UI estimate only — actual NOC is computed on-chain from the Pyth SOL/USD price. */
export function estimateNocForSol(solAmount: number, solUsd: number, stagePriceUsd: number): number {
  if (stagePriceUsd <= 0) {
    return 0;
  }
  return (solAmount * solUsd) / stagePriceUsd;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest presaleBuyModule`
Expected: PASS — all tests. Run `npx tsc --noEmit` → no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/constants/programs.ts src/modules/presale/presaleBuyModule.ts src/modules/presale/__tests__/presaleBuyModule.test.ts
git commit -m "feat(presale): hand-built presale_purchase_with_sol instruction + PDAs + estimate"
```

---

## Task 2: Sim-tx builder + submit

**Files:**
- Modify: `src/modules/presale/presaleBuyModule.ts`
- Test: `src/modules/presale/__tests__/presaleBuyModule.test.ts` (extend)

- [ ] **Step 1: Write the failing test (sim-tx builder)**

Append to `src/modules/presale/__tests__/presaleBuyModule.test.ts`:
```ts
import {VersionedTransaction} from '@solana/web3.js';
import {buildSolPurchaseTx} from '../presaleBuyModule';
import * as connectionMod from '../../solana/connection';

describe('buildSolPurchaseTx', () => {
  it('builds a VersionedTransaction with the purchase instruction and the user as payer', async () => {
    jest.spyOn(connectionMod, 'getConnection').mockReturnValue({
      getLatestBlockhash: async () => ({blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 1}),
    } as never);
    const tx = await buildSolPurchaseTx(USER, 2_000_000_000n);
    expect(tx).toBeInstanceOf(VersionedTransaction);
    // payer is the first static account key
    expect(tx.message.staticAccountKeys[0].toBase58()).toBe(USER.toBase58());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest presaleBuyModule`
Expected: FAIL — `buildSolPurchaseTx` not exported.

- [ ] **Step 3: Add `buildSolPurchaseTx` + `submitPresaleBuySol`**

Append to `src/modules/presale/presaleBuyModule.ts`:
```ts
import {Keypair, TransactionMessage, VersionedTransaction, ComputeBudgetProgram} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {estimatePriorityFee} from '../solana/priorityFee';
import {KeychainManager} from '../keychain/keychainModule';
import {mnemonicToSeed} from '../keyDerivation/mnemonicUtils';
import {deriveTransparentKeypair, type TransparentScheme} from '../keyDerivation/transparent';
import {zeroize} from '../session/zeroize';

const keychainManager = new KeychainManager();
const COMPUTE_UNIT_LIMIT = 120_000;

function buildBuyInstructions(user: PublicKey, solLamports: bigint, priorityFeeMicroLamports: number) {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({units: COMPUTE_UNIT_LIMIT}),
    ComputeBudgetProgram.setComputeUnitPrice({microLamports: priorityFeeMicroLamports}),
    buildSolPurchaseInstruction(user, solLamports),
  ];
}

/** Build the (unsigned) purchase tx for pre-submit simulation. Payer = user. */
export async function buildSolPurchaseTx(user: PublicKey, solLamports: bigint): Promise<VersionedTransaction> {
  const connection = getConnection();
  const {blockhash} = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: user,
    recentBlockhash: blockhash,
    instructions: buildBuyInstructions(user, solLamports, 0),
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

/**
 * Sign + broadcast the SOL purchase with the transparent keypair. Mirrors
 * submitSwap: the 64-byte secret key is zeroized in finally. skipPreflight is
 * FALSE (Helius's skipPreflight=true path is ~60s slow for program txs);
 * resending the same signed tx is idempotent (network dedups by signature).
 */
export async function submitPresaleBuySol(
  solLamports: bigint,
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
      instructions: buildBuyInstructions(signer.publicKey, solLamports, priorityFee),
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
> Verify `estimatePriorityFee`'s signature/level values in `src/modules/solana/priorityFee.ts` (use the same `'fast'` level the send/swap paths use; if the levels differ, match them). Move the new `import` lines to the top of the file with the others.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest presaleBuyModule` → PASS. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/modules/presale/presaleBuyModule.ts src/modules/presale/__tests__/presaleBuyModule.test.ts
git commit -m "feat(presale): buildSolPurchaseTx (simulation) + submitPresaleBuySol (sign/broadcast)"
```

---

## Task 3: `#23` active screen — SOL amount → estimate → Buy

**Files:**
- Modify: `src/screens/PresaleScreen.tsx` (rebuild the `PresaleActive` sub-component)

> Read the `#23` `active` mockup in `/home/user/Downloads/index.html` (search `s-pre`) and `screen.md` §23. Match it: stage badge, "$X / NOC" price card, SOL amount input, NOC estimate, sticky [Buy NOC].

- [ ] **Step 1: Rebuild `PresaleActive`**

Replace the `PresaleActive` component in `src/screens/PresaleScreen.tsx` with a live buy form. Requirements (build to the `#23` design, NativeWind, using the existing `ui` `Text`/`Button`):
- Read `usePresaleStore()` → `currentStage` (display, `?? 1`), `pricePerNoc` (USD string, `?? String(PRESALE_STAGE_PRICES[0])`).
- Read SOL price + balance: `useResolvedPrices()` for `solUsd = prices['native']?.usd`; SOL balance from the wallet/balances source the dashboard uses (`useWalletStore`/balances — match how `SendScreen` reads `solBalance`).
- A controlled SOL amount `TextInput` (numeric, `keyboardType="decimal-pad"`), with a "Max" chip (sets amount = balance − a small fee headroom, e.g. `0.001` SOL).
- NOC estimate line: `≈ {formatted estimateNocForSol(Number(amount)||0, solUsd, Number(pricePerNoc))} NOC`.
- Compute `usdValue = (Number(amount)||0) * solUsd`. The [Buy NOC] button is **disabled** unless: `Number(amount) > 0` AND `usdValue >= MIN_PURCHASE_USD` AND `Number(amount) + 0.001 <= solBalance`. Below min → a hint `Minimum $25` under the button.
- On [Buy NOC]: convert to lamports `BigInt(Math.round(Number(amount) * 1e9))` and `navigation.navigate('PresaleBuyConfirm', {solLamports: lamports.toString()})` (string param). Get `navigation` from the dashboard nav (the `Presale` screen is in `DashboardStack`; thread a nav prop or `useNavigation`).
- Keep the `pre_tge` switch wiring in `PresaleScreen` (the `claimable`/`claimed` branches unchanged).

- [ ] **Step 2: Type-check + a light render test**

Create `src/screens/__tests__/PresaleActive.test.tsx` (if `PresaleActive` is exported; else export it for testability):
```tsx
import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {usePresaleStore} from '../../store/zustand/presaleStore';
// Render PresaleScreen in pre_tge and assert the price card + a disabled Buy button below min.
// (Mock useResolvedPrices to return a SOL price; mock the nav.)
```
Run: `npx jest PresaleActive` and `npx tsc --noEmit`. (If a full render test is impractical given the screen's deps, at minimum `tsc` must pass and the estimate/min logic should be a pure helper covered by Task 1's `estimateNocForSol` test — extract any non-trivial gating into a tiny pure function and unit-test that instead.)

- [ ] **Step 3: Commit**

```bash
git add src/screens/PresaleScreen.tsx src/screens/__tests__/PresaleActive.test.tsx
git commit -m "feat(presale): #23 active buy form — SOL amount, NOC estimate, $25 min gate"
```

---

## Task 4: `PresaleBuyConfirm` screen

**Files:**
- Create: `src/screens/presale/PresaleBuyConfirmScreen.tsx`

- [ ] **Step 1: Implement the screen**

`PresaleBuyConfirmScreen({solLamports, onAuthorized, onCancel})`:
- Parse `solLamports` (string→`BigInt`). On mount: get the active `user = new PublicKey(useWalletStore.getState().publicKey)`, `tx = await buildSolPurchaseTx(user, lamports)`, `sim = await simulateTransaction(getConnection(), tx)`. Spinner while pending.
- Review card (build to `#23`/`tx-confirm` style): "You pay {lamports/1e9} SOL (~${usd})", "You receive ≈ {estimateNocForSol} NOC", "Stage {N} · ${price}/NOC", and a labeled row "Noctura Presale program" (trusted — not an unknown-contract warning).
- If `sim.success === false` → error state with `sim.error` (mapped), no proceed.
- Sticky [Confirm & Buy] → `awaitUserAuth()` then `rootNav.navigate('UnlockSend', { ... })` (reuse the existing re-auth bridge exactly as `TxConfirmScreen` does — read `TxConfirmScreen.tsx` for the precise call). On the returned `approved` → `onAuthorized()` (the Navigator wrapper navigates to `PresaleBuyStatus` with the same `solLamports`).
- [Cancel]/back → `onCancel()`.

> Mirror `TxConfirmScreen.tsx` for the `awaitUserAuth()` + `UnlockSend` pattern and the sticky-CTA layout; mirror `TxSimulateScreen.tsx` for the simulate-on-mount + error handling.

- [ ] **Step 2: tsc + commit**

Run: `npx tsc --noEmit`.
```bash
git add src/screens/presale/PresaleBuyConfirmScreen.tsx
git commit -m "feat(presale): PresaleBuyConfirm — simulate + review + re-auth"
```

---

## Task 5: `PresaleBuyStatus` screen

**Files:**
- Create: `src/screens/presale/PresaleBuyStatusScreen.tsx`

- [ ] **Step 1: Implement the screen**

`PresaleBuyStatusScreen({solLamports, onDashboard, onViewDetails})` — clone the submit+poll loop from `TransactionStatusScreen.tsx`:
- On mount: `scheme = await loadTransparentScheme()`; `{signature, lastValidBlockHeight} = await submitPresaleBuySol(BigInt(solLamports), scheme)`.
- Poll `getConnection().getSignatureStatus(signature)` every 500ms; success on `confirmationStatus` confirmed/finalized; `stuck` after 90s; blockhash-expiry resubmit up to `MAX_ATTEMPTS = 3` (copy the exact loop + states from `TransactionStatusScreen`).
- On success (best-effort, ignore failures): record to the coordinator and refresh the allocation:
  - `import {recordPresalePurchase} from '../../modules/presale/presaleModule'` — add this function in Task 5 Step 2.
  - `void recordPresalePurchase({txHash: signature, buyerAddress: user, paymentToken: 'SOL', paymentAmount: lamports/1e9, nocAmount: estimate, usdValue, stage})`.
  - Invalidate the presale allocation query: `queryClient.invalidateQueries({queryKey: ['presaleAllocation']})` (via `useQueryClient`).
- States: `pending` ("Order pending"), `confirmed` (success hero), `failed` (retry/cancel) — per `#23` `pending`/`done` + the existing status screen.

- [ ] **Step 2: Add `recordPresalePurchase` to `presaleModule.ts`**

```ts
export interface PresalePurchaseRecord {
  txHash: string;
  buyerAddress: string;
  paymentToken: 'SOL' | 'USDC' | 'USDT';
  paymentAmount: number;
  nocAmount: number;
  usdValue: number;
  stage: number;
}

/** Best-effort archive of a completed purchase to the coordinator. Never throws. */
export async function recordPresalePurchase(rec: PresalePurchaseRecord): Promise<void> {
  try {
    await fetch(`${API_BASE}/solana/purchase`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(rec),
    });
  } catch {
    // non-critical (matches the website — the on-chain tx is the source of truth)
  }
}
```
(Plain `fetch` — best-effort, and the pinned path is unreliable on-device anyway; the on-chain tx already happened.)

- [ ] **Step 3: tsc + commit**

Run: `npx tsc --noEmit`.
```bash
git add src/screens/presale/PresaleBuyStatusScreen.tsx src/modules/presale/presaleModule.ts
git commit -m "feat(presale): PresaleBuyStatus — submit + poll + best-effort coordinator record"
```

---

## Task 6: Navigation wiring

**Files:**
- Modify: `src/app/Navigator.tsx` (+ `src/types/navigation.d.ts` if the param lists live there)

- [ ] **Step 1: Register the screens + params**

- Add to the `DashboardStackParamList` (where `Presale` lives): `PresaleBuyConfirm: {solLamports: string}` and `PresaleBuyStatus: {solLamports: string}`.
- Register `PresaleBuyConfirm` + `PresaleBuyStatus` in the `DashboardStack` navigator with wrapper components that read `route.params.solLamports` and pass the callbacks (mirror `TxConfirmScreenNav` / `TransactionStatusScreenNav`):
  - `PresaleBuyConfirmNav`: `onAuthorized={() => nav.navigate('PresaleBuyStatus', {solLamports})}`, `onCancel={() => nav.goBack()}`.
  - `PresaleBuyStatusNav`: `onDashboard={() => nav.navigate('Dashboard')}`, `onViewDetails={(sig) => nav.navigate('TransactionDetail', {signature: sig})}` (if reachable; else omit).
- Ensure the `#23` active screen's [Buy NOC] navigates to `PresaleBuyConfirm`.

- [ ] **Step 2: Verify the navigator loads + tsc**

Run: `npx tsc --noEmit` (no new errors). Run `npx jest` (full suite) — nothing regressed.

- [ ] **Step 3: Commit**

```bash
git add src/app/Navigator.tsx src/types/navigation.d.ts
git commit -m "feat(presale): wire PresaleBuyConfirm + PresaleBuyStatus into the dashboard stack"
```

---

## Task 7: Full verification + on-device

- [ ] **Step 1: Full suite + type-check**

Run: `npx jest && npx tsc --noEmit` → all pass, clean.

- [ ] **Step 2: Build the release APK (mainnet)**

Run: `cd android && ENVFILE=.env.production ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`. Copy the APK → `/home/user/Downloads/`.

- [ ] **Step 3: On-device verification (mainnet, REAL SOL — use a small amount ≥ $25)**

- Dashboard → Buy → `#23`: enter a SOL amount worth ≥ $25 → NOC estimate updates; below $25 → Buy disabled + "Minimum $25".
- [Buy NOC] → Confirm shows "pay X SOL → ≈ Y NOC", simulation OK → [Confirm & Buy] → biometric/PIN → Status → confirmed.
- Verify on a Solana explorer: the tx hits `PROGRAM_ID`, SOL went to `SOL_TREASURY`, and a new `["allocation", user]` PDA / updated `total_tokens` exists.
- After the buy, the dashboard presale allocation reflects the new NOC (allocation query refreshed).

---

## Self-Review

**1. Spec coverage:**
- A. PYTH constant → Task 1. ✓
- B. presaleBuyModule (PDAs, instruction, submit, estimate, min) → Tasks 1, 2. ✓
- C. buildSolPurchaseTx (simulation) → Task 2. ✓
- D-1. #23 active screen → Task 3. ✓
- D-2. PresaleBuyConfirm (simulate + review + re-auth) → Task 4. ✓
- D-3. PresaleBuyStatus (submit + poll + record) → Task 5. ✓
- D-4. Navigation → Task 6. ✓
- E. Fees (no markup; pre-TGE 0) → Task 2 (buyBuyInstructions adds only compute-budget, no fee transfer). ✓
- F. Error handling → Tasks 3 (min/balance gates), 4 (sim failure), 5 (retry/stuck). ✓
- G. Testing → Tasks 1, 2, 3. ✓

**2. Placeholder scan:** Tasks 1, 2 have complete exact code (the critical instruction/submit). Tasks 3-5 (UI screens) give complete requirements + the exact reuse points (`TxConfirmScreen`/`TxSimulateScreen`/`TransactionStatusScreen` to mirror) rather than 300 lines of cloned JSX — the implementer builds to the `#23` design + clones the named existing screens. `recordPresalePurchase` has full code. No `TODO`/`TBD`.

**3. Type consistency:** `derivePresalePdas`/`buildSolPurchaseInstruction`/`buildSolPurchaseTx`/`submitPresaleBuySol`/`estimateNocForSol`/`MIN_PURCHASE_USD` defined in Tasks 1-2, consumed in Tasks 3-5. Route param `solLamports: string` consistent across screens + Navigator (bigint isn't route-serializable). `TransparentScheme` from `keyDerivation/transparent` (same type the send/swap submit use). `recordPresalePurchase` shape matches the coordinator `/solana/purchase` body. No gaps.
