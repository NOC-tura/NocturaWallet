# #21 tx-status Broadcast Relocation + Richer States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the transparent broadcast + confirmation wait from the #20 Confirm screen onto #21 tx-status, using a fast submit-then-poll path, and build #21's richer states (broadcasting / success / failed / stuck) per the design.

**Architecture:** A new `submitTransparentTransfer` sends the tx and returns the signature immediately (no WS confirm wait). #20 [Send] authenticates then navigates to #21 with the `TransferIntent`. #21 submits, then polls `getSignatureStatus` (HTTP) to drive broadcasting → success / failed / stuck. The slow WS `confirmTransaction` path is no longer on the critical path.

**Tech Stack:** React Native 0.84, TypeScript strict, @solana/web3.js, React Navigation v7, NativeWind/StyleSheet, Jest.

**Source of truth:** `/home/user/Downloads/index.html` §21 + `screen.md` §21. Spec: `docs/superpowers/specs/2026-06-13-tx-status-broadcast-design.md`. Builds on [[project_tx_flow_screens]]; `sendTransparentTransfer` is currently called ONLY by `TxConfirmScreen` (+ its test).

---

## File Structure
- `src/modules/solana/sendTransaction.ts` — MODIFY: add `submitTransparentTransfer` (send-only); remove `sendTransparentTransfer` once unreferenced (Task 3).
- `src/types/navigation.d.ts` — MODIFY: `TransactionStatus` param → `{intent: TransferIntent}`.
- `src/screens/transparent/TransactionStatusScreen.tsx` — REWRITE: submit + poll + rich states.
- `src/screens/transparent/TxConfirmScreen.tsx` — MODIFY: `[Send]` → auth → navigate to #21 with intent; drop broadcast + post-send Alert.
- `src/app/Navigator.tsx` — MODIFY: `TxConfirmScreenNav` + `TransactionStatusScreenNav`.

---

## Task 1: `submitTransparentTransfer` (send-only)

**Files:**
- Modify: `src/modules/solana/sendTransaction.ts`
- Test: `src/modules/solana/__tests__/submitTransaction.test.ts`

- [ ] **Step 1: Write the failing test** `src/modules/solana/__tests__/submitTransaction.test.ts`

```typescript
import {PublicKey} from '@solana/web3.js';
import {submitTransparentTransfer} from '../sendTransaction';
import {KeychainManager} from '../../keychain/keychainModule';

const ABANDON =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const sendRawTransaction = jest.fn(async () => 'SIG_ABC');
jest.mock('../connection', () => ({
  getConnection: () => ({
    getLatestBlockhash: jest.fn(async () => ({blockhash: 'bh', lastValidBlockHeight: 1})),
    sendRawTransaction,
    confirmTransaction: jest.fn(),
  }),
}));

describe('submitTransparentTransfer', () => {
  afterEach(() => jest.restoreAllMocks());

  it('signs + sends and returns the signature without confirming', async () => {
    jest.spyOn(KeychainManager.prototype, 'retrieveSeed').mockResolvedValue(ABANDON);
    const res = await submitTransparentTransfer({
      kind: 'sol',
      recipient: new PublicKey('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'),
      lamports: 1_000n,
      priorityFee: 0,
      scheme: {kind: 'cli'},
    });
    expect(res.signature).toBe('SIG_ABC');
    expect(sendRawTransaction).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx jest submitTransaction.test` — function missing)

- [ ] **Step 3: Implement** — add to `src/modules/solana/sendTransaction.ts` (reuse the existing imports; add `TransactionMessage`, `VersionedTransaction` from `@solana/web3.js` if not present):

```typescript
export async function submitTransparentTransfer(
  params: SendTransparentParams,
): Promise<{signature: string}> {
  const mnemonic = await keychainManager.retrieveSeed();
  const seed = await mnemonicToSeed(mnemonic);
  const {secretKey} = deriveTransparentKeypair(seed, params.scheme);
  zeroize(seed);
  try {
    const signer = Keypair.fromSecretKey(secretKey);
    const sender = signer.publicKey;
    const priorityFee = params.priorityFee > 0 ? params.priorityFee : undefined;
    const instructions =
      params.kind === 'sol'
        ? buildTransferInstructions({
            sender,
            recipient: params.recipient,
            lamports: params.lamports,
            priorityFee,
          })
        : buildSPLTransferInstructions({
            sender,
            recipient: params.recipient,
            mint: params.mint,
            amount: params.amount,
            decimals: params.decimals,
            createAta: params.createAta,
            priorityFee,
          });

    const connection = getConnection();
    const {blockhash} = await connection.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: sender,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([signer]);
    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
      maxRetries: 0,
    });
    return {signature};
  } finally {
    zeroize(secretKey);
  }
}
```

- [ ] **Step 4: Run — expect PASS**; `npx tsc --noEmit` (exit 0)

- [ ] **Step 5: Commit**

```bash
git add src/modules/solana/sendTransaction.ts src/modules/solana/__tests__/submitTransaction.test.ts
git commit -m "feat(solana): submitTransparentTransfer — send-only (no confirm wait)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Rewire #20 → #21 with the broadcast on #21

This is one cohesive change (the `TransactionStatus` nav param type ripples through `navigation.d.ts`, `Navigator`, `#21`, `#20`). Do all parts so the project compiles.

**Files:**
- Modify: `src/types/navigation.d.ts`
- Rewrite: `src/screens/transparent/TransactionStatusScreen.tsx`
- Modify: `src/screens/transparent/TxConfirmScreen.tsx`
- Modify: `src/app/Navigator.tsx`
- Test: `src/screens/transparent/__tests__/TransactionStatusScreen.test.tsx` (create) + update `TxConfirmScreen.test.tsx`

- [ ] **Step 1: nav param** — in `src/types/navigation.d.ts`, change the `TransactionStatus` entry of `SendStackParamList` from `{signature; amount; recipient; token}` to:
```typescript
  TransactionStatus: {intent: TransferIntent};
```
(`TransferIntent` is already imported in this file.)

- [ ] **Step 2: rewrite `TransactionStatusScreen.tsx`** to the contract below. Reuse the existing `styles`/icon circles/`getExplorerUrl`/`formatAddress`/`ERROR_CODES` from the current file; KEEP the visual primitives, add the new states + meta rows.

Props:
```typescript
import type {TransferIntent} from '../../types/transfer';
export interface TransactionStatusScreenProps {
  intent: TransferIntent;
  onDashboard: () => void;
  onViewDetails?: (signature: string) => void;
}
```
Lazy-require (mirror the SendScreen pattern, try/catch): `submitTransparentTransfer` from `../../modules/solana/sendTransaction`, `loadTransparentScheme` from `../../modules/keyDerivation/derivationScheme`, `getConnection` from `../../modules/solana/connection`.

Constants in-file: `const BASE_FEE_LAMPORTS = 5_000n; const PRIORITY_FEE_LAMPORTS = {normal:0n, fast:15_000n, urgent:50_000n}; const SOL_DECIMALS = 9;`

State: `type Stage = 'submitting' | 'broadcasting' | 'success' | 'failed' | 'stuck'`. `signature: string | null`, `slot: number | null`, `errorMessage: string | null`.

On mount (effect, guarded by `cancelled`):
```
1. setStage('submitting')
2. scheme = loadTransparentScheme()
3. build SendTransparentParams from intent:
     kind: intent.tokenMint === 'native' ? 'sol' : 'spl'
     sol → {recipient: new PublicKey(intent.recipient), lamports: parseTokenAmount(intent.amount, SOL_DECIMALS)}
     spl → {recipient, mint: new PublicKey(intent.tokenMint), amount: parseTokenAmount(intent.amount, intent.decimals), decimals: intent.decimals, createAta: intent.createAta}
     priorityFee: Number((PRIORITY_FEE_LAMPORTS[intent.priorityLevel] * 1_000_000n) / 200_000n), scheme
4. try { const {signature} = await submitTransparentTransfer(params); setSignature; setStage('broadcasting'); startPoll(signature) }
   catch (e) { setErrorMessage(e.message); setStage('failed') }
```
`startPoll(signature)`: loop every 500 ms (reuse the existing poll structure). On `getSignatureStatus(signature)`:
- `value.confirmationStatus` in {confirmed, finalized} → set `slot = value.slot ?? null`, `setStage('success')`, stop.
- `value.err` → map via `ERROR_CODES` (reuse the existing InsufficientFunds/AccountNotFound/else mapping) → `setStage('failed')`, stop.
- else keep polling. Track elapsed; at **90 s** without resolution → `setStage('stuck')` but KEEP polling (a later confirmed/finalized still flips to success).

Modules-unavailable (lazy requires null, e.g. test stub without mocks) → leave `submitting`/no crash (tests mock the modules).

Render states (extend the current file's render):
- **submitting / broadcasting:** spinner ring + title "Broadcasting transaction…" + sub "Submitted to Solana mainnet · waiting for first confirmation" + amount card (`{intent.amount} {intent.tokenSymbol}` + To `formatAddress(intent.recipient)`) + tx-hash row (truncated `signature`, only when present) + "View on Solscan" + footer "Don't close the app · this usually takes 8–12 s". No back button (the screen renders none).
- **success:** green tick + "Sent successfully" + amount card + meta rows: Tx hash (truncated), Slot (`slot ?? '—'`), Fee paid (`formatTokenAmount(BASE_FEE_LAMPORTS + PRIORITY_FEE_LAMPORTS[intent.priorityLevel], SOL_DECIMALS)} SOL`) + [View details] (`onViewDetails?.(signature)` else open explorer) + [Done] (`onDashboard`). testIDs: `tx-status-done`, `tx-status-details`.
- **failed:** ✗ + "Transaction failed" + `errorMessage` + [Retry] (re-run the mount effect — bump a `retryCount` state used as effect dep) + [Done]. testID `tx-status-retry`.
- **stuck:** warning ring + "Taking longer than usual" + "Network is congested · the tx is in the mempool but hasn't been included yet" + tx-hash + "View on Solscan" + [Done].

- [ ] **Step 3: `TxConfirmScreen.tsx`** — change the `onSent` prop to `onBroadcast: (intent: TransferIntent) => void`. In `handleSend`, keep the debounce + `awaitUserAuth()` + `rootNav.navigate('UnlockSend', {...})`; on `approved`, call `onBroadcast(intent)` and return — REMOVE: the lazy `sendTransparentTransfer`/`loadTransparentScheme` requires + their try/catch, the SOL/SPL `sendTransparentTransfer` call, the success `Alert`/"Add to contacts?" prompt, and the now-unused imports. Keep `sending` only as the in-flight guard during auth (set true on tap, false if not approved). The high-value gate + checksum + first-time from #1 stay.

- [ ] **Step 4: `Navigator.tsx`** — update:
```typescript
function TxConfirmScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<SendStackParamList>>();
  const route = useRoute<RouteProp<SendStackParamList, 'TxConfirm'>>();
  return (
    <TxConfirmScreen
      intent={route.params.intent}
      onBroadcast={intent => navigation.navigate('TransactionStatus', {intent})}
      onCancel={() => navigation.goBack()}
    />
  );
}

function TransactionStatusScreenNav() {
  const route = useRoute<RouteProp<SendStackParamList, 'TransactionStatus'>>();
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const sendNav = useNavigation<NativeStackNavigationProp<SendStackParamList>>();
  return (
    <TransactionStatusScreen
      intent={route.params.intent}
      onDashboard={() => rootNav.navigate('MainTabs')}
      onViewDetails={signature => sendNav.navigate('TransactionDetail', {signature})}
    />
  );
}
```
(Verify the existing `TransactionStatusScreenNav` shape and `MainTabs`/`TransactionDetail` route names; adapt to what's there. Keep the existing `onDashboard` target the screen used before.)

- [ ] **Step 5: tests**
  - Create `src/screens/transparent/__tests__/TransactionStatusScreen.test.tsx`: mock `submitTransparentTransfer` (resolves `{signature:'S'}`), `loadTransparentScheme`, and `getConnection().getSignatureStatus`. Assert: after mount, "Broadcasting" UI renders; when status → `confirmed`, "Sent successfully" + `tx-status-done` render; when `submitTransparentTransfer` rejects, "Transaction failed" + `tx-status-retry` render. Wrap in `SafeAreaProvider`; use `waitFor`. Mirror `SuccessScreen.test.tsx` mock conventions.
  - Update `TxConfirmScreen.test.tsx`: the mock for `../../modules/solana/sendTransaction` no longer needs `sendTransparentTransfer`; the screen render now needs `onBroadcast={jest.fn()}` instead of `onSent`.

- [ ] **Step 6: Verify** — `npx tsc --noEmit` (0); `npx jest TransactionStatusScreen TxConfirmScreen submitTransaction` (PASS); `npx eslint src/screens/transparent src/app/Navigator.tsx` (0 errors).

- [ ] **Step 7: Commit**

```bash
git add src/types/navigation.d.ts src/screens/transparent/TransactionStatusScreen.tsx src/screens/transparent/TxConfirmScreen.tsx src/app/Navigator.tsx src/screens/transparent/__tests__/TransactionStatusScreen.test.tsx src/screens/transparent/__tests__/TxConfirmScreen.test.tsx
git commit -m "feat(send): #21 owns broadcast (submit→poll) + broadcasting/success/failed/stuck states

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Remove the now-unused `sendTransparentTransfer`

**Files:**
- Modify: `src/modules/solana/sendTransaction.ts`
- Delete: `src/modules/solana/__tests__/sendTransaction.test.ts` (the send+confirm test)

- [ ] **Step 1: Confirm unreferenced**

Run: `grep -rn "sendTransparentTransfer" src/`
Expected: no matches outside `sendTransaction.ts` / its test (after Task 2). If TxConfirm still references it, STOP — Task 2 is incomplete.

- [ ] **Step 2: Remove** the `sendTransparentTransfer` function (keep `submitTransparentTransfer`, `SendTransparentParams`, and any still-imported helpers) and delete its old test file. If `signAndSend`/`SignAndSendResult` imports become unused, remove them too.

- [ ] **Step 3: Verify + commit** — `npx tsc --noEmit` (0); `npx jest submitTransaction` (PASS).
```bash
git add src/modules/solana/sendTransaction.ts
git rm src/modules/solana/__tests__/sendTransaction.test.ts
git commit -m "chore(solana): drop sendTransparentTransfer (superseded by submit→poll on #21)"
```

---

## Task 4: Full gate

- [ ] **Step 1:** `npx tsc --noEmit` → 0
- [ ] **Step 2:** `npx eslint src/screens/transparent src/modules/solana src/app/Navigator.tsx src/types` → 0 errors
- [ ] **Step 3:** `npx jest` → all pass (fix any fallout from the removed `sendTransparentTransfer` mock / the `signAndSend` test which still exists and stays)
- [ ] **Step 4:** commit fallout: `git commit -am "test: align suite with #21 broadcast relocation"`

---

## Task 5: Build + on-device verification (manual)

Follow [[project_android_transparent_v1]]. **Tiny amounts.**

- [ ] **Step 1:** `.env` → mainnet (backup first); `cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`; copy APK → `/home/user/Downloads/`; restore `.env`.
- [ ] **Step 2:** Send a small SOL amount. Confirm: pressing **Send on #20 immediately advances to #21** showing "Broadcasting… don't close" (NOT a spinner stuck on #20); the tx hash + "View on Solscan" appear; on confirmation it flips to "Sent successfully" with Tx hash · Slot · Fee paid; a slow/congested confirmation shows the "Taking longer · network congested" stuck state after ~90 s instead of an opaque wait.

---

## Self-Review Notes
- **Spec coverage:** submit→poll (Task 1 + Task 2 step 2), #20→#21 relocation (Task 2 steps 3–4), nav param (Task 2 step 1), broadcasting/success/failed/stuck states (Task 2 step 2), dead-code removal (Task 3), tests (each), on-device (Task 5). Deferred items (#54/#44, Dynamic Island, shielded, blockhash-resubmit, fiat, chips) are absent — correct per spec.
- **Type consistency:** `submitTransparentTransfer(params: SendTransparentParams): Promise<{signature}>` (Task 1) is consumed by #21 (Task 2). `TransactionStatus` param `{intent: TransferIntent}` defined in Task 2 step 1 and consumed in steps 2/4. `onBroadcast(intent)` (Task 2 step 3) wired in step 4.
- **No regression:** the broadcast logic (derive scheme signer + build instructions) is reused verbatim inside `submitTransparentTransfer`; only the confirm mechanism changes (WS confirmTransaction → HTTP getSignatureStatus polling), which is the intended robustness improvement.
