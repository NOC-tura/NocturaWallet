# Transaction-Flow Screens (#19 tx-simulate → #20 tx-confirm → #21 tx-status) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the transparent send's combined `ConfirmationSheet` with the design's dedicated 3-screen chain — #19 tx-simulate (dry-run preview with derived risk checks + balance delta) → #20 tx-confirm (final review) → #21 tx-status (existing) — relocating the simulation and broadcast logic out of `SendScreen`.

**Architecture:** Screens are navigation-agnostic (intent + callbacks via props, wired in `Navigator.tsx`). A `TransferIntent` param carries the send across screens. #19 builds the real tx and simulates it; risk check-rows are derived from the known instruction set plus one `getAccountInfo` (recipient executable). #20 performs auth + `sendTransparentTransfer` (unchanged) → #21. Mode (`transparent`|`shielded`) is carried for accent theming; only the transparent broadcast is wired (shielded is gated and lacks a broadcast path — out of scope).

**Tech Stack:** React Native 0.84, TypeScript strict, @solana/web3.js, React Navigation v7 (native-stack), NativeWind, Jest. Source of truth for visuals: `/home/user/Downloads/index.html` (`.s-sim` mockups ~8846–9120) + `screen.md` §19–21.

**Scope note:** Shielded #18→#19 wiring + shielded broadcast are OUT OF SCOPE (gated behind `FEATURES.shielded`, no shielded broadcast exists yet). #19/#20 carry `mode` for theming only.

---

## File Structure

- `src/modules/solana/queries.ts` — MODIFY: add `getAccountInfo` (recipient executable lookup).
- `src/modules/solana/simulationChecks.ts` — CREATE: derive check-rows from instructions + recipient executable.
- `src/types/transfer.ts` — CREATE: `TransferIntent` type.
- `src/types/navigation.d.ts` — MODIFY: add `TxSimulate`/`TxConfirm` to `SendStackParamList`.
- `src/screens/transparent/TxSimulateScreen.tsx` — CREATE (#19).
- `src/screens/transparent/TxConfirmScreen.tsx` — CREATE (#20).
- `src/app/Navigator.tsx` — MODIFY: register screens, wire `SendScreen` → #19 → #20 → #21.
- `src/screens/transparent/SendScreen.tsx` — MODIFY: drop inline simulation/confirm; "Review" builds a `TransferIntent` and calls `onReview`.
- `src/components/ConfirmationSheet.tsx` — DELETE once unreferenced.

---

## Task 1: `getAccountInfo` query helper

**Files:**
- Modify: `src/modules/solana/queries.ts`
- Test: `src/modules/solana/__tests__/queries.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

```typescript
import {getAccountInfo} from '../queries';

describe('getAccountInfo', () => {
  it('returns executable=true when the account is a program', async () => {
    const connection = {
      getAccountInfo: jest.fn(async () => ({executable: true})),
    } as never;
    const res = await getAccountInfo(connection, {toBase58: () => 'P'} as never);
    expect(res).toEqual({exists: true, executable: true});
  });

  it('returns exists=false when the account is missing', async () => {
    const connection = {getAccountInfo: jest.fn(async () => null)} as never;
    const res = await getAccountInfo(connection, {toBase58: () => 'X'} as never);
    expect(res).toEqual({exists: false, executable: false});
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx jest queries.test`
Expected: FAIL (`getAccountInfo` is not exported)

- [ ] **Step 3: Implement** (append to `queries.ts`)

```typescript
export interface AccountInfoSummary {
  exists: boolean;
  executable: boolean;
}

/**
 * Minimal account lookup — whether an address exists on-chain and whether it is
 * an executable (program) account. Used by the simulation risk checks.
 */
export async function getAccountInfo(
  connection: Connection,
  publicKey: PublicKey,
): Promise<AccountInfoSummary> {
  return rpcLimiter.execute(`getAccountInfo:${publicKey.toBase58()}`, async () => {
    const info = await connection.getAccountInfo(publicKey);
    return {exists: info != null, executable: info?.executable === true};
  });
}
```

- [ ] **Step 4: Run — expect PASS**; then `npx tsc --noEmit` (exit 0)

- [ ] **Step 5: Commit**

```bash
git add src/modules/solana/queries.ts src/modules/solana/__tests__/queries.test.ts
git commit -m "feat(solana): getAccountInfo helper (exists + executable)"
```

---

## Task 2: `simulationChecks.ts` — derive risk check-rows

**Files:**
- Create: `src/modules/solana/simulationChecks.ts`
- Test: `src/modules/solana/__tests__/simulationChecks.test.ts`

Check-row model and rules (per spec, transparent self-built transfers):

- [ ] **Step 1: Write the failing test**

```typescript
import {deriveTransferChecks} from '../simulationChecks';
import * as queries from '../queries';
import {PublicKey} from '@solana/web3.js';

jest.mock('../connection', () => ({getConnection: () => ({}) as never}));

const RECIPIENT = new PublicKey('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');

describe('deriveTransferChecks', () => {
  it('all PASS for a regular-wallet recipient', async () => {
    jest.spyOn(queries, 'getAccountInfo').mockResolvedValue({exists: true, executable: false});
    const rows = await deriveTransferChecks(RECIPIENT);
    expect(rows.map(r => r.status)).toEqual(['ok', 'ok', 'ok']);
    expect(rows[2].title).toContain('regular wallet');
  });

  it('WARNs when the recipient is an executable (program) account', async () => {
    jest.spyOn(queries, 'getAccountInfo').mockResolvedValue({exists: true, executable: true});
    const rows = await deriveTransferChecks(RECIPIENT);
    expect(rows[2].status).toBe('warn');
  });

  it('WARNs "couldn\'t verify" when the lookup fails', async () => {
    jest.spyOn(queries, 'getAccountInfo').mockRejectedValue(new Error('rpc down'));
    const rows = await deriveTransferChecks(RECIPIENT);
    expect(rows[2].status).toBe('warn');
    expect(rows[2].title).toMatch(/couldn.t verify/i);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx jest simulationChecks.test`)

- [ ] **Step 3: Implement `simulationChecks.ts`**

```typescript
import {PublicKey} from '@solana/web3.js';
import {getConnection} from './connection';
import {getAccountInfo} from './queries';

export type CheckStatus = 'ok' | 'warn' | 'danger';

export interface TransferCheck {
  status: CheckStatus;
  title: string;
  meta: string;
}

/**
 * Risk rows for a self-built SOL/SPL transfer. The instruction set is known
 * (only SystemProgram / SPL-Token / ComputeBudget / ATA are ever built), so the
 * first two rows are static PASS. The third checks the recipient on-chain.
 */
export async function deriveTransferChecks(
  recipient: PublicKey,
): Promise<TransferCheck[]> {
  const rows: TransferCheck[] = [
    {
      status: 'ok',
      title: 'No interactions with unknown contracts',
      meta: 'SystemProgram / SPL-Token transfer only',
    },
    {
      status: 'ok',
      title: 'No token approvals granted',
      meta: 'Transfer only · zero allowances changed',
    },
  ];

  try {
    const info = await getAccountInfo(getConnection(), recipient);
    rows.push(
      info.executable
        ? {
            status: 'warn',
            title: 'Recipient is a program account',
            meta: `executable account at ${recipient.toBase58()}`,
          }
        : {
            status: 'ok',
            title: 'Recipient is a regular wallet',
            meta: `no executable account at ${recipient.toBase58()}`,
          },
    );
  } catch {
    rows.push({
      status: 'warn',
      title: "Couldn't verify the recipient",
      meta: 'account lookup failed — proceed with care',
    });
  }

  return rows;
}
```

- [ ] **Step 4: Run — expect PASS**; then `npx tsc --noEmit` (exit 0)

- [ ] **Step 5: Commit**

```bash
git add src/modules/solana/simulationChecks.ts src/modules/solana/__tests__/simulationChecks.test.ts
git commit -m "feat(solana): derive transfer risk check-rows"
```

---

## Task 3: `TransferIntent` type + navigation params

**Files:**
- Create: `src/types/transfer.ts`
- Modify: `src/types/navigation.d.ts`

- [ ] **Step 1: Create `src/types/transfer.ts`**

```typescript
/** A pending transfer carried across the #19→#20 confirm chain. */
export interface TransferIntent {
  mode: 'transparent' | 'shielded';
  recipient: string; // base58
  amount: string; // human string, e.g. "0.001"
  tokenMint: string; // 'native' for SOL, else mint base58
  tokenSymbol: string; // 'SOL' | 'NOC' | …
  decimals: number;
  priorityLevel: 'normal' | 'fast' | 'urgent';
  createAta: boolean;
}
```

- [ ] **Step 2: Extend `SendStackParamList`** in `src/types/navigation.d.ts`

Add an import at the top of the file:
```typescript
import type {TransferIntent} from './transfer';
```
Then inside `SendStackParamList`, after `Send: undefined;` add:
```typescript
  TxSimulate: {intent: TransferIntent};
  TxConfirm: {intent: TransferIntent};
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add src/types/transfer.ts src/types/navigation.d.ts
git commit -m "feat(types): TransferIntent + TxSimulate/TxConfirm nav params"
```

---

## Task 4: `TxSimulateScreen` (#19)

**Files:**
- Create: `src/screens/transparent/TxSimulateScreen.tsx`

Visual reference: `index.html` lines 8846–9120 (`.s-sim`). Use the project's NativeWind tokens (`bg-bg-surface-1/2`, `text-fg-primary/secondary/tertiary`, `text-success/warning/danger`, `rounded-md`, `Text`/`Button` from `../../components/ui`) — mirror `SelectAccountScreen.tsx` / `SendScreen.tsx` styling conventions.

Props contract:
```typescript
interface TxSimulateScreenProps {
  intent: import('../../types/transfer').TransferIntent;
  onContinue: (intent: import('../../types/transfer').TransferIntent) => void;
  onCancel: () => void;
}
```

Behaviour:
- `useReducer`/`useState` state: `'simulating' | {kind:'ready'; checks; delta} | {kind:'failed'; reason}`.
- On mount (and on Retry): read `publicKey` + `solBalance` from `useWalletStore`; build the tx (`buildTransferTx`/`buildSPLTransferTx`, sender = `new PublicKey(publicKey)`, priorityFee = `Number((PRIORITY_FEE_LAMPORTS[intent.priorityLevel] * 1_000_000n) / 200_000n)`); `simulateTransaction(getConnection(), tx)`; on success compute `deriveTransferChecks(new PublicKey(intent.recipient))` and the balance delta; on failure set `failed` with `result.error?.action ?? result.error?.message`.
- Modules are lazy-required in a try/catch (mirror `SendScreen.tsx` lines ~45–76) so test/stub envs don't crash; if unavailable, render `ready` with empty checks (no hard block).
- **simulating:** intent-card (eyebrow "Simulating on <network> RPC", `amount → recipient`, step-pill) + 2 skeleton cards + sticky `[Simulating…]` (disabled) + `[Cancel]`.
- **ready:** intent-card (eyebrow ✓ "Simulation passed", step-pill "Ready"); "What this transaction does" card mapping `checks` to rows (`ok`→success tint+check, `warn`→warning, `danger`→danger) with PASS/CHECK badge; "Balance delta" card (`Sending −amount`, `Network fee`, `Priority`, divider, `After`); footer note. Sticky `[Continue to confirm]` → `onContinue(intent)` + `[Cancel]`.
- **failed:** intent-card (warn eyebrow + real reason); sticky stacked `[Retry]` (re-run) / `[Continue anyway]` (warning-tinted → `onContinue(intent)`) / `[Cancel]` → `onCancel`.
- `data-mode` accent: `intent.mode === 'shielded'` uses shielded accent classes, else transparent (mirror existing mode handling; default transparent).

Fee/priority constants: copy `PRIORITY_FEE_LAMPORTS`, `BASE_FEE_LAMPORTS`, the `200_000n` CU divisor, and `SOL_DECIMALS` into this screen (or import from a shared `src/constants/fees.ts` if you extract them — optional, not required).

- [ ] **Step 1: Implement the screen** per the contract above. Reuse `parseTokenAmount`/`formatTokenAmount` from `../../utils/parseTokenAmount`, `formatAddress` from `../../utils/formatAddress`, `deriveTransferChecks` from `../../modules/solana/simulationChecks`, `useWalletStore` from `../../store/zustand/walletStore`. Add `testID`s: `tx-simulate-continue`, `tx-simulate-retry`, `tx-simulate-cancel`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Smoke test** `src/screens/transparent/__tests__/TxSimulateScreen.test.tsx`

```typescript
import React from 'react';
import {render} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {TxSimulateScreen} from '../TxSimulateScreen';

const intent = {
  mode: 'transparent' as const, recipient: 'Gabc', amount: '0.001',
  tokenMint: 'native', tokenSymbol: 'SOL', decimals: 9,
  priorityLevel: 'normal' as const, createAta: false,
};

it('renders the simulating state', () => {
  const {getByText} = render(
    <SafeAreaProvider>
      <TxSimulateScreen intent={intent} onContinue={jest.fn()} onCancel={jest.fn()} />
    </SafeAreaProvider>,
  );
  expect(getByText('Review transfer')).toBeTruthy();
});
```

- [ ] **Step 4: Run — expect PASS** (`npx jest TxSimulateScreen`)

- [ ] **Step 5: Commit**

```bash
git add src/screens/transparent/TxSimulateScreen.tsx src/screens/transparent/__tests__/TxSimulateScreen.test.tsx
git commit -m "feat(send): TxSimulateScreen (#19) dry-run preview"
```

---

## Task 5: `TxConfirmScreen` (#20)

**Files:**
- Create: `src/screens/transparent/TxConfirmScreen.tsx`

Props contract:
```typescript
interface TxConfirmScreenProps {
  intent: import('../../types/transfer').TransferIntent;
  onSent: (params: {signature: string; amount: string; recipient: string; token: string}) => void;
  onCancel: () => void;
}
```

Behaviour (broadcast logic relocated verbatim from the current `SendScreen.handleConfirm`):
- Detail rows: Network ("Solana mainnet"), Fee (base 5000 lamports formatted), Priority (`PRIORITY_FEE_LAMPORTS[intent.priorityLevel]` formatted), From (`publicKey`), To (`intent.recipient`).
- First-time-recipient callout when `addressBook.findByAddress(intent.recipient)` is null (warning-tinted).
- Headline "Send {intent.amount} {intent.tokenSymbol} to {formatAddress(intent.recipient)}".
- Sticky `[Send {amount} {symbol}]` (primary) + `[Cancel]`. The Send button is debounced 500 ms via a `lastTapRef` and disabled while `sending` (cardinal rule #6).
- On Send: `const approved = await awaitUserAuth(); rootNav.navigate('UnlockSend', {amount, ticker, recipient, networkFee})` (mirror current order — navigate then await), then if approved call `sendTransparentTransfer` with the scheme from `loadTransparentScheme()` (lazy-required) for `kind:'sol'` (when `intent.tokenMint === 'native'`) or `kind:'spl'` (mint = `new PublicKey(intent.tokenMint)`, `amount = parseTokenAmount(intent.amount, intent.decimals)`, `createAta = intent.createAta`). On success `onSent({signature, amount, recipient, token})`; on throw `Alert.alert('Send failed', message)` and re-enable.
- `useNavigation` for `rootNav` (RootStackParamList) to reach the `UnlockSend` modal; `onSent`/`onCancel` are props (wired in Navigator).
- Add the optional "Add to contacts?" prompt after `onSent`, copied from the current `SendScreen.handleConfirm`.

- [ ] **Step 1: Implement the screen** reusing `sendTransparentTransfer`/`loadTransparentScheme` (lazy-required like in SendScreen), `awaitUserAuth` from `../../modules/session/pendingAuth`, `addressBook`, `formatAddress`, `parseTokenAmount`/`formatTokenAmount`. `testID`s: `tx-confirm-send`, `tx-confirm-cancel`.

- [ ] **Step 2: Type-check** (`npx tsc --noEmit`, exit 0)

- [ ] **Step 3: Smoke test** `src/screens/transparent/__tests__/TxConfirmScreen.test.tsx` (render, assert the headline text "Send 0.001 SOL to …" is present, using the same `intent` + `SafeAreaProvider` wrapper as Task 4).

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/screens/transparent/TxConfirmScreen.tsx src/screens/transparent/__tests__/TxConfirmScreen.test.tsx
git commit -m "feat(send): TxConfirmScreen (#20) final review + broadcast"
```

---

## Task 6: Wire #19/#20 into the Send stack

**Files:**
- Modify: `src/app/Navigator.tsx`

- [ ] **Step 1: Imports** — add `import {TxSimulateScreen} from '../screens/transparent/TxSimulateScreen';` and `import {TxConfirmScreen} from '../screens/transparent/TxConfirmScreen';`.

- [ ] **Step 2: Nav wrappers** — add:

```typescript
function TxSimulateScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<SendStackParamList>>();
  const route = useRoute<RouteProp<SendStackParamList, 'TxSimulate'>>();
  return (
    <TxSimulateScreen
      intent={route.params.intent}
      onContinue={intent => navigation.navigate('TxConfirm', {intent})}
      onCancel={() => navigation.goBack()}
    />
  );
}

function TxConfirmScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<SendStackParamList>>();
  const route = useRoute<RouteProp<SendStackParamList, 'TxConfirm'>>();
  return (
    <TxConfirmScreen
      intent={route.params.intent}
      onSent={params => navigation.navigate('TransactionStatus', params)}
      onCancel={() => navigation.goBack()}
    />
  );
}
```
(Ensure `useRoute` and `RouteProp` are imported from `@react-navigation/native`.)

- [ ] **Step 3: Register screens** in `SendStack()` after the `Send` screen line:

```typescript
      <SendNav.Screen name="TxSimulate" component={TxSimulateScreenNav} />
      <SendNav.Screen name="TxConfirm" component={TxConfirmScreenNav} />
```

- [ ] **Step 4: Type-check** (`npx tsc --noEmit`, exit 0)

- [ ] **Step 5: Commit**

```bash
git add src/app/Navigator.tsx
git commit -m "feat(send): register TxSimulate/TxConfirm in send stack"
```

---

## Task 7: Refactor `SendScreen` to route into #19

**Files:**
- Modify: `src/screens/transparent/SendScreen.tsx`
- Modify: `src/app/Navigator.tsx` (`SendScreenNav` wrapper)

- [ ] **Step 1: Props** — change `SendScreenProps` to:

```typescript
export interface SendScreenProps {
  onReview: (intent: import('../../types/transfer').TransferIntent) => void;
  onBack?: () => void;
}
```

- [ ] **Step 2: Remove the confirm/simulation machinery** — delete: the `step==='confirm'` render branch + the `ConfirmationSheet` import/usage; `handleReview`, `handleConfirm`, `handleContinueAnyway`; the `simulationPassed`/`simError`/`reviewing`/`sending`/`needsAta` state; the lazy `simulateTransaction`/`buildTransferTx`/`buildSPLTransferTx`/`sendTransparentTransfer`/`loadTransparentScheme` requires; `networkFeeDisplay`/`accountCreationDisplay` if only used by the confirm sheet. Keep the input form, token/recipient/amount/priority state, validation (`canReview`), and the address-book suggestions.

- [ ] **Step 3: New review handler** — replace the primary CTA's `onPress` (currently `handleReview`) with:

```typescript
  const lastTapRef = useRef(0);
  const handleReview = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return;
    lastTapRef.current = now;
    if (!canReview) return;
    onReview({
      mode: 'transparent',
      recipient,
      amount,
      tokenMint: selectedMint,
      tokenSymbol: selectedToken.symbol,
      decimals: selectedToken.decimals,
      priorityLevel,
      createAta: selectedMint !== SOL_MINT,
    });
  }, [canReview, recipient, amount, selectedMint, selectedToken.symbol, selectedToken.decimals, priorityLevel, onReview]);
```
(`SOL_MINT` already exists in this file. The button label stays "Review".)

- [ ] **Step 4: Update `SendScreenNav`** in `Navigator.tsx`:

```typescript
function SendScreenNav() {
  const navigation = useNavigation<NativeStackNavigationProp<SendStackParamList>>();
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <SendScreenImpl
      onReview={intent => navigation.navigate('TxSimulate', {intent})}
      onBack={() => rootNav.goBack()}
    />
  );
}
```

- [ ] **Step 5: Type-check + update SendScreen test** — `npx tsc --noEmit` (exit 0). The existing `SendScreen.test.tsx` is mostly `.skip`; update any render that passed `onTransactionSent` to pass `onReview={jest.fn()}`.

- [ ] **Step 6: Run tests** — `npx jest SendScreen` (passes/skips, no type errors)

- [ ] **Step 7: Commit**

```bash
git add src/screens/transparent/SendScreen.tsx src/app/Navigator.tsx src/screens/transparent/__tests__/SendScreen.test.tsx
git commit -m "refactor(send): SendScreen routes to TxSimulate (#19) chain"
```

---

## Task 8: Retire `ConfirmationSheet`

**Files:**
- Delete: `src/components/ConfirmationSheet.tsx`

- [ ] **Step 1: Confirm no references**

Run: `grep -rn "ConfirmationSheet" src/`
Expected: no matches (after Task 7).

- [ ] **Step 2: Delete + commit**

```bash
git rm src/components/ConfirmationSheet.tsx
npx tsc --noEmit
git commit -m "chore(send): remove ConfirmationSheet (superseded by #19/#20)"
```

(If a `ConfirmationSheet` test file exists, remove it too.)

---

## Task 9: Full gate

- [ ] **Step 1:** `npx tsc --noEmit` → exit 0
- [ ] **Step 2:** `npx eslint src/screens/transparent src/modules/solana src/app/Navigator.tsx src/types` → 0 errors
- [ ] **Step 3:** `npx jest` → all pass (fix any arg-assertion fallout)
- [ ] **Step 4: Commit** any test updates: `git commit -am "test: align suite with #19/#20 transaction-flow screens"`

---

## Task 10: Build + on-device verification (manual)

Follow the runbook in [[project_android_transparent_v1]]. **Test on a tiny amount.**

- [ ] **Step 1:** `.env` → mainnet (backup first); `cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`; copy APK → `/home/user/Downloads/`; restore `.env`.
- [ ] **Step 2:** Send `0.001 SOL`: confirm the flow is now **#12 → #19 tx-simulate (check-rows + balance delta) → #20 tx-confirm → unlock → #21 status**, the transaction confirms on-chain, and the failed-simulation path still offers Retry / Continue-anyway / Cancel.

---

## Self-Review Notes

- **Spec coverage:** #19 (Task 4), #20 (Task 5), #21 reused (no task — unchanged), check-rows (Tasks 1–2), refactor (Task 7), ConfirmationSheet retired (Task 8), error handling (in 4/5), tests (each task + 9), on-device (10). Shielded #18→#19 intentionally deferred (spec "out of scope").
- **Type consistency:** `TransferIntent` (Task 3) fields are consumed identically in Tasks 4/5/7; `TransferCheck.status` (`ok|warn|danger`) used in Task 4; `AccountInfoSummary` (Task 1) consumed in Task 2.
- **Relocate-don't-rewrite:** `sendTransparentTransfer` + priority-fee conversion are moved verbatim (Tasks 4/5), preserving the on-device-verified behaviour.
- **No silent caps:** check-rows degrade to WARN on `getAccountInfo` failure (never a false PASS).
