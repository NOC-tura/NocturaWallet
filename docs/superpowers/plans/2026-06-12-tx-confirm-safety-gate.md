# #20 tx-confirm Safety Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the design's safety layer to `TxConfirmScreen` (#20): a high-value typed-confirm gate, an inline "Add to address book?" prompt on first-time recipients, and first-6/last-6 checksum highlighting of the recipient.

**Architecture:** A pure `transferRisk.ts` module computes high-value status + checksum parts (unit-tested). `TxConfirmScreen` consumes it: reads balances from the wallet store, highlights the address, shows the first-time inline prompt, and gates the `[Send]` button behind a typed `CONFIRM` when high-value. The broadcast path is untouched.

**Tech Stack:** React Native 0.84, TypeScript strict, NativeWind, Jest, Zustand wallet store.

**Source of truth:** `/home/user/Downloads/index.html` §20 + `screen.md` §20. Spec: `docs/superpowers/specs/2026-06-12-tx-confirm-safety-gate-design.md`.

**Threshold (approved):** high-value when `amount > 5% of the sent token's balance` OR (SOL AND `amount > 5 SOL`). SPL uses `tokenBalances[mint]`. Wallet store balances are **string-encoded** (`solBalance: string`, `tokenBalances: Record<string,string>`) — coerce to BigInt at the screen boundary.

---

## File Structure
- `src/modules/solana/transferRisk.ts` — CREATE: pure `isHighValueTransfer` + `formatChecksumParts` + `TYPED_CONFIRM_SENTINEL`.
- `src/screens/transparent/TxConfirmScreen.tsx` — MODIFY: consume the helper; checksum address; first-time inline Add/Skip; high-value typed-confirm gate.

---

## Task 1: `transferRisk.ts` — pure risk + checksum helpers

**Files:**
- Create: `src/modules/solana/transferRisk.ts`
- Test: `src/modules/solana/__tests__/transferRisk.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import {isHighValueTransfer, formatChecksumParts, TYPED_CONFIRM_SENTINEL} from '../transferRisk';
import type {TransferIntent} from '../../../types/transfer';

const base: TransferIntent = {
  mode: 'transparent', recipient: 'GabcDEF123456789xxxxxxxxxxxxxxxxxxxxxxQMr9',
  amount: '1', tokenMint: 'native', tokenSymbol: 'SOL', decimals: 9,
  priorityLevel: 'normal', createAta: false,
};

describe('isHighValueTransfer', () => {
  it('SOL over 5% of balance is high-value', () => {
    // 1 SOL out of 10 SOL = 10% > 5%
    const r = isHighValueTransfer(base, {solBalance: 10_000_000_000n, tokenBalances: {}});
    expect(r.highValue).toBe(true);
    expect(r.percentOfBalance).toBe(10);
  });

  it('SOL over 5 SOL absolute is high-value even at <5% of a huge balance', () => {
    const r = isHighValueTransfer({...base, amount: '6'}, {solBalance: 10_000_000_000_000n, tokenBalances: {}});
    expect(r.highValue).toBe(true); // 6 SOL > 5 SOL absolute (0.06% of balance)
  });

  it('SOL under both thresholds is not high-value', () => {
    // 0.1 SOL out of 100 SOL = 0.1%
    const r = isHighValueTransfer({...base, amount: '0.1'}, {solBalance: 100_000_000_000n, tokenBalances: {}});
    expect(r.highValue).toBe(false);
  });

  it('SPL over 5% of that token balance is high-value', () => {
    const noc: TransferIntent = {...base, tokenMint: 'NOCmint', tokenSymbol: 'NOC', amount: '60'};
    const r = isHighValueTransfer(noc, {solBalance: 0n, tokenBalances: {NOCmint: 1_000_000_000_000n /* 1000 NOC */}});
    expect(r.highValue).toBe(true); // 60 > 5% of 1000
  });

  it('zero balance: % clause cannot trigger, SOL absolute still can', () => {
    expect(isHighValueTransfer({...base, amount: '0.1'}, {solBalance: 0n, tokenBalances: {}}).highValue).toBe(false);
    expect(isHighValueTransfer({...base, amount: '6'}, {solBalance: 0n, tokenBalances: {}}).highValue).toBe(true);
  });
});

describe('formatChecksumParts', () => {
  it('returns first-6 and last-6 for a long address', () => {
    expect(formatChecksumParts('GabcDEF123456789ZZZZZZQMr9XXXXXX')).toEqual({head: 'GabcDE', tail: 'XXXXXX'});
  });
  it('passes short addresses through with empty tail', () => {
    expect(formatChecksumParts('short')).toEqual({head: 'short', tail: ''});
  });
});

describe('TYPED_CONFIRM_SENTINEL', () => {
  it('is the literal CONFIRM', () => expect(TYPED_CONFIRM_SENTINEL).toBe('CONFIRM'));
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx jest transferRisk.test` — module missing)

- [ ] **Step 3: Implement `src/modules/solana/transferRisk.ts`**

```typescript
import {parseTokenAmount} from '../../utils/parseTokenAmount';
import type {TransferIntent} from '../../types/transfer';

const SOL_HIGH_VALUE_LAMPORTS = 5_000_000_000n; // 5 SOL
const HIGH_VALUE_PERCENT = 5n; // > 5% of the sent token's balance

export const TYPED_CONFIRM_SENTINEL = 'CONFIRM';

export interface HighValueResult {
  highValue: boolean;
  percentOfBalance: number; // floored integer for display; 0 when balance is zero/unknown
}

/**
 * A transfer is high-value when it moves > 5% of the sent token's balance, or
 * (for SOL) more than 5 SOL outright. SPL balances are keyed by mint.
 */
export function isHighValueTransfer(
  intent: TransferIntent,
  balances: {solBalance: bigint; tokenBalances: Record<string, bigint>},
): HighValueResult {
  const amount = parseTokenAmount(intent.amount, intent.decimals);
  const isSol = intent.tokenMint === 'native';
  const balance = isSol
    ? balances.solBalance
    : balances.tokenBalances[intent.tokenMint] ?? 0n;
  const overPercent = balance > 0n && amount * 100n > balance * HIGH_VALUE_PERCENT;
  const overAbsolute = isSol && amount > SOL_HIGH_VALUE_LAMPORTS;
  const percentOfBalance = balance > 0n ? Number((amount * 100n) / balance) : 0;
  return {highValue: overPercent || overAbsolute, percentOfBalance};
}

/** First-6 / last-6 of a base58 address for accent (`.ck`) highlighting. */
export function formatChecksumParts(address: string): {head: string; tail: string} {
  if (address.length <= 12) return {head: address, tail: ''};
  return {head: address.slice(0, 6), tail: address.slice(-6)};
}
```

- [ ] **Step 4: Run — expect PASS**; then `npx tsc --noEmit` (exit 0)

- [ ] **Step 5: Commit**

```bash
git add src/modules/solana/transferRisk.ts src/modules/solana/__tests__/transferRisk.test.ts
git commit -m "feat(solana): transferRisk — high-value detection + checksum parts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: TxConfirmScreen — checksum, first-time inline prompt, high-value gate

**Files:**
- Modify: `src/screens/transparent/TxConfirmScreen.tsx`
- Test: `src/screens/transparent/__tests__/TxConfirmScreen.test.tsx`

Read `TxConfirmScreen.tsx` fully first. It already: reads `const {publicKey} = useWalletStore()`; computes `isFirstTimeRecipient` (try/catch around `addressBook.findByAddress`); renders a `DetailRow` for To and a first-time callout block; has a post-send "Add to contacts?" `Alert` (leave that as-is). NativeWind + StyleSheet are both used — match the file's existing styling approach.

- [ ] **Step 1: Read balances + compute high-value**

Change `const {publicKey} = useWalletStore();` to also pull balances and compute the flag:
```typescript
  const {publicKey, solBalance, tokenBalances} = useWalletStore();
  const {highValue, percentOfBalance} = isHighValueTransfer(intent, {
    solBalance: safeBigInt(solBalance),
    tokenBalances: Object.fromEntries(
      Object.entries(tokenBalances).map(([k, v]) => [k, safeBigInt(v)]),
    ),
  });
```
Add a local helper near the top of the file (module scope):
```typescript
function safeBigInt(v: string | undefined): bigint {
  try {
    return v ? BigInt(v) : 0n;
  } catch {
    return 0n;
  }
}
```
Import: `import {isHighValueTransfer, formatChecksumParts, TYPED_CONFIRM_SENTINEL} from '../../modules/solana/transferRisk';`

- [ ] **Step 2: Add gate + first-time state**

```typescript
  const [typedConfirm, setTypedConfirm] = useState('');
  const [firstTimeDismissed, setFirstTimeDismissed] = useState(false);
```
(`useState` is already imported.)

- [ ] **Step 3: Checksum address sub-component**

Add near the bottom of the file (with the other sub-components like `DetailRow`):
```typescript
function ChecksumAddress({address, style}: {address: string; style?: object}) {
  const {head, tail} = formatChecksumParts(address);
  if (!tail) return <Text style={style}>{head}</Text>;
  return (
    <Text style={style}>
      <Text style={confirmStyles.ckAccent}>{head}</Text>
      <Text>…</Text>
      <Text style={confirmStyles.ckAccent}>{tail}</Text>
    </Text>
  );
}
```
Add to the screen's StyleSheet: `ckAccent: {color: '#B084FC', fontWeight: '700'}` (the accent-transparent token; if the file already defines an accent color constant, reuse it). Use `<ChecksumAddress>` for the headline recipient and the To `DetailRow` value (you may pass a custom value node — if `DetailRow` only takes a string, render the To row inline instead of via `DetailRow`).

- [ ] **Step 4: First-time inline Add/Skip**

In the existing first-time block, gate it on `!firstTimeDismissed`, and below the banner copy add an inline row:
```tsx
{isFirstTimeRecipient && !firstTimeDismissed && (
  <View style={confirmStyles.firstTimeCard}>
    <Text style={confirmStyles.firstTimeText}>
      This address is not in your contacts. Double-check before sending.
    </Text>
    <View style={confirmStyles.inlineRow}>
      <Pressable
        testID="tx-confirm-add-contact"
        onPress={() => {
          try {
            addressBook.addContact({
              name: formatAddress(intent.recipient),
              address: intent.recipient,
              addressType: 'transparent',
              lastUsedAt: Date.now(),
            });
          } catch {
            // non-critical
          }
          setFirstTimeDismissed(true);
        }}>
        <Text style={confirmStyles.addLink}>Add</Text>
      </Pressable>
      <Pressable testID="tx-confirm-skip-contact" onPress={() => setFirstTimeDismissed(true)}>
        <Text style={confirmStyles.skipLink}>Skip</Text>
      </Pressable>
    </View>
  </View>
)}
```
(`Pressable` from react-native — add to imports if missing. `addressBook`/`formatAddress` are already imported.)

- [ ] **Step 5: High-value gate block**

Above the sticky CTA, when `highValue`, render:
```tsx
{highValue && (
  <View style={confirmStyles.highValueCard} testID="tx-confirm-highvalue">
    <Text style={confirmStyles.highValueHead}>High-value transfer</Text>
    <Text style={confirmStyles.highValueBody}>
      This sends {percentOfBalance}% of your balance. Type {TYPED_CONFIRM_SENTINEL} to proceed.
    </Text>
    <TextInput
      testID="tx-confirm-typed-input"
      value={typedConfirm}
      onChangeText={setTypedConfirm}
      autoCapitalize="characters"
      autoCorrect={false}
      placeholder={TYPED_CONFIRM_SENTINEL}
      placeholderTextColor="#6E727A"
      style={confirmStyles.typedInput}
    />
  </View>
)}
```
(`TextInput` from react-native — add to imports.)

- [ ] **Step 6: Gate the Send button**

Find the `[Send]` `Button`/`Pressable` and set its disabled prop to also require the typed confirm:
```typescript
  const sendDisabled = sending || (highValue && typedConfirm !== TYPED_CONFIRM_SENTINEL);
```
Use `disabled={sendDisabled}` on the Send control. (Keep the existing `lastTapRef` debounce + `sending` guard untouched.)

- [ ] **Step 7: Styles**

Add to the screen StyleSheet (`confirmStyles` or whatever it's named — match the file):
```typescript
  ckAccent: {color: '#B084FC', fontWeight: '700'},
  firstTimeCard: {borderRadius: 12, padding: 14, marginBottom: 12, backgroundColor: 'rgba(245,158,11,0.10)', borderLeftWidth: 2, borderLeftColor: '#F59E0B'},
  firstTimeText: {fontSize: 13, color: '#E7E9EE', lineHeight: 18},
  inlineRow: {flexDirection: 'row', gap: 20, marginTop: 10},
  addLink: {fontSize: 14, fontWeight: '700', color: '#B084FC'},
  skipLink: {fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.6)'},
  highValueCard: {borderRadius: 12, padding: 16, marginBottom: 12, backgroundColor: 'rgba(248,113,113,0.10)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.5)'},
  highValueHead: {fontSize: 13, fontWeight: '700', color: '#F87171'},
  highValueBody: {fontSize: 13, color: '#E7E9EE', lineHeight: 18, marginTop: 4},
  typedInput: {marginTop: 12, height: 48, borderRadius: 12, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.06)', color: '#FFFFFF', fontWeight: '700', letterSpacing: 2},
```
(If the existing first-time callout already has styling, reuse/adapt rather than duplicating. Remove the OLD plain first-time block if it's now superseded by the new inline-Add/Skip one — don't render two.)

- [ ] **Step 8: Tests** — extend `src/screens/transparent/__tests__/TxConfirmScreen.test.tsx`. Mock `useWalletStore` to return a `publicKey`, `solBalance`, and `tokenBalances` (mirror `SuccessScreen.test.tsx` store mocking). Add:
  - High-value intent (`amount` large vs the mocked `solBalance`): `getByTestId('tx-confirm-highvalue')` exists; `getByTestId('tx-confirm-send')` is disabled (`accessibilityState.disabled === true`); after `fireEvent.changeText(getByTestId('tx-confirm-typed-input'), 'CONFIRM')`, the send button is enabled.
  - Normal-value intent: `queryByTestId('tx-confirm-highvalue')` is null and send is enabled.
  - First-time recipient (mock `addressBook.findByAddress` → null): `getByTestId('tx-confirm-add-contact')` + `tx-confirm-skip-contact` exist; pressing Skip removes the prompt.

- [ ] **Step 9: Verify**
- `npx tsc --noEmit` → exit 0
- `npx jest TxConfirmScreen transferRisk` → all PASS
- `npx eslint src/screens/transparent/TxConfirmScreen.tsx src/modules/solana/transferRisk.ts` → 0 errors

- [ ] **Step 10: Commit**

```bash
git add src/screens/transparent/TxConfirmScreen.tsx src/screens/transparent/__tests__/TxConfirmScreen.test.tsx
git commit -m "feat(send): #20 high-value typed-confirm gate + first-time prompt + checksum

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Full gate

- [ ] **Step 1:** `npx tsc --noEmit` → exit 0
- [ ] **Step 2:** `npx eslint src/screens/transparent src/modules/solana` → 0 errors
- [ ] **Step 3:** `npx jest` → all pass
- [ ] **Step 4:** commit any fallout: `git commit -am "test: align suite with #20 safety gate"`

---

## Task 4: Build + on-device verification (manual)

Follow [[project_android_transparent_v1]]. **Tiny amounts.**

- [ ] **Step 1:** `.env` → mainnet (backup first); `cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`; copy APK → `/home/user/Downloads/`; restore `.env`.
- [ ] **Step 2:** Verify: a **small** SOL send shows no gate and confirms; a send of **>5% of balance (or >5 SOL)** shows the red "High-value transfer" card with the `% of your balance` + Type-CONFIRM input, the Send button stays disabled until `CONFIRM` is typed; the recipient shows first-6/last-6 in accent; a send to a brand-new address shows the inline **Add / Skip** prompt.

---

## Self-Review Notes
- **Spec coverage:** high-value threshold + gate (Task 1 + Task 2 steps 5–6), first-time inline Add/Skip (Task 2 step 4), checksum highlight (Task 2 step 3), broadcast untouched (no change to the send handler), tests (Tasks 1–2), on-device (Task 4). Out-of-scope items (fiat/chips/#21/shielded) are absent — correct.
- **Type consistency:** `isHighValueTransfer` / `formatChecksumParts` / `TYPED_CONFIRM_SENTINEL` signatures match between Task 1 (definition) and Task 2 (use). Balances coerced from the store's `string` to `bigint` at the screen boundary (Task 2 step 1).
- **No false PASS:** zero/unknown balance can't trigger the % clause, but the 5-SOL absolute clause still protects large SOL sends.
