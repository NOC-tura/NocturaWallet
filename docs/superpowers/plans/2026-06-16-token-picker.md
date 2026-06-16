# Token Picker Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native `Alert.alert` token pickers in Swap and Send with a reusable bottom-sheet list (logo + symbol + name + balance, tap to select).

**Architecture:** A `TokenPickerSheet` component built on React Native's `Modal` (the app's existing modal pattern). SwapScreen and SendScreen drive it with local `picker` state instead of `Alert.alert`.

**Tech Stack:** TypeScript strict, React Native 0.84.1, NativeWind, lucide-react-native, Jest.

**Spec:** `docs/superpowers/specs/2026-06-16-token-picker-design.md`
**Branch:** `feat/swap` (continues the swap branch — ships in the swap PR).

---

## File Structure

- `src/components/TokenPickerSheet.tsx` — NEW: the reusable bottom sheet.
- `src/screens/transparent/SwapScreen.tsx` — MODIFY: drop the two `Alert.alert` handlers; add `picker` state + the sheet.
- `src/screens/transparent/SendScreen.tsx` — MODIFY: drop the `Alert.alert` handler; add `pickerVisible` state + the sheet; add `name` to `availableTokens`.

---

## Task 1: TokenPickerSheet component

**Files:**
- Create: `src/components/TokenPickerSheet.tsx`
- Test: `src/components/__tests__/TokenPickerSheet.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/TokenPickerSheet.test.tsx`:
```tsx
import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {TokenPickerSheet} from '../TokenPickerSheet';

const tokens = [
  {mint: 'native', symbol: 'SOL', name: 'Solana', decimals: 9},
  {mint: 'USDCMINT', symbol: 'USDC', name: 'USD Coin', decimals: 6},
];

describe('TokenPickerSheet', () => {
  it('renders a row per token and calls onSelect with the tapped mint', () => {
    const onSelect = jest.fn();
    const {getByText} = render(
      <TokenPickerSheet
        visible
        title="Select token"
        tokens={tokens}
        selectedMint="native"
        balances={{native: '2000000000'}}
        onSelect={onSelect}
        onClose={() => {}}
      />,
    );
    expect(getByText('SOL')).toBeTruthy();
    expect(getByText('USD Coin')).toBeTruthy();
    fireEvent.press(getByText('USDC'));
    expect(onSelect).toHaveBeenCalledWith('USDCMINT');
  });
});
```
(If the project's render harness needs providers, mirror `src/components/__tests__/` or `src/screens/transparent/__tests__/TokenDetailScreen.test.tsx`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest --testPathPattern=TokenPickerSheet`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/components/TokenPickerSheet.tsx`:
```tsx
import React from 'react';
import {Modal, View, Pressable, ScrollView} from 'react-native';
import {Check} from 'lucide-react-native';
import {Text} from './ui';
import {TokenLogo} from './TokenLogo';
import {formatBalanceForDisplay} from '../utils/parseTokenAmount';
import {NOC_MINT} from '../constants/programs';

export interface PickerToken {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface TokenPickerSheetProps {
  visible: boolean;
  title: string;
  tokens: readonly PickerToken[];
  selectedMint: string;
  balances: Record<string, string>;
  onSelect: (mint: string) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet token picker (replaces the native Alert.alert pickers). A row
 * per token: logo + symbol + name + balance, with a check on the selected one.
 */
export function TokenPickerSheet({
  visible,
  title,
  tokens,
  selectedMint,
  balances,
  onSelect,
  onClose,
}: TokenPickerSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        className="flex-1 bg-black/60 justify-end"
        onPress={onClose}
        accessibilityLabel="Close token picker">
        {/* Inner press stops the backdrop tap from closing when tapping the sheet. */}
        <Pressable onPress={() => {}} className="bg-bg-surface-1 rounded-t-2xl pt-2 pb-8">
          <View className="items-center py-2">
            <View className="w-10 h-1 rounded-pill bg-fg-tertiary" />
          </View>
          <Text variant="overline" className="text-fg-secondary px-5 pt-1 pb-2">
            {title}
          </Text>
          <ScrollView style={{maxHeight: 384}}>
            {tokens.length === 0 ? (
              <Text variant="body-sm" className="text-fg-tertiary px-5 py-4">
                No tokens
              </Text>
            ) : (
              tokens.map(t => (
                <Pressable
                  key={t.mint}
                  onPress={() => onSelect(t.mint)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${t.symbol}`}
                  className="flex-row items-center px-5 py-3 active:bg-bg-surface-2"
                  style={{minHeight: 56}}>
                  <TokenLogo symbol={t.symbol} isNoc={t.mint === NOC_MINT} />
                  <View className="flex-1 ml-3">
                    <Text variant="body-lg" className="text-fg-primary">
                      {t.symbol}
                    </Text>
                    <Text variant="body-sm" className="text-fg-secondary">
                      {t.name}
                    </Text>
                  </View>
                  <Text variant="body-sm" numeral className="text-fg-secondary mr-2">
                    {formatBalanceForDisplay(balances[t.mint] ?? '0', t.decimals)}
                  </Text>
                  {t.mint === selectedMint ? <Check size={18} color="#B084FC" /> : null}
                </Pressable>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest --testPathPattern=TokenPickerSheet && npx tsc --noEmit && npx eslint src/components/TokenPickerSheet.tsx`
Expected: PASS; tsc 0; no eslint errors (inline-style warnings OK).

- [ ] **Step 5: Commit**

```bash
git add src/components/TokenPickerSheet.tsx src/components/__tests__/TokenPickerSheet.test.tsx
git commit -m "feat(ui): TokenPickerSheet — bottom-sheet token selector (#43)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Wire SwapScreen to the sheet

**Files:**
- Modify: `src/screens/transparent/SwapScreen.tsx`

- [ ] **Step 1: Replace the Alert pickers with sheet state**

Read `src/screens/transparent/SwapScreen.tsx`. Remove the two `Alert.alert`-based handlers (the `pickFromToken`/`pickToToken` functions that call `Alert.alert('Swap from'/'Swap to', ...)`) and the `Alert` import if it becomes unused. Add imports + state:
```tsx
import {TokenPickerSheet} from '../../components/TokenPickerSheet';
```
In the component body (near the other `useState`s):
```tsx
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
```

- [ ] **Step 2: Point the From/To selectors at the sheet**

The From-card and To-card token selectors currently call the Alert handlers on press. Change the From selector's `onPress` to `() => setPicker('from')` and the To selector's to `() => setPicker('to')`.

- [ ] **Step 3: Render the sheet**

Add, before the closing tag of the screen's root (so it overlays):
```tsx
      <TokenPickerSheet
        visible={picker !== null}
        title={picker === 'from' ? 'Swap from' : 'Swap to'}
        tokens={SWAP_TOKENS.filter(t =>
          picker === 'from' ? t.mint !== toMint : t.mint !== fromMint,
        )}
        selectedMint={picker === 'from' ? fromMint : toMint}
        balances={{native: solBalance, ...tokenBalances}}
        onSelect={mint => {
          if (picker === 'from') {
            setFromMint(mint);
          } else {
            setToMint(mint);
          }
          setAmount('');
          setDebouncedAmount('');
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
```
(`SWAP_TOKENS`, `fromMint`, `toMint`, `solBalance`, `tokenBalances`, `setFromMint`, `setToMint`, `setAmount`, `setDebouncedAmount` already exist in this screen. `SWAP_TOKENS` rows are `{mint, symbol, name, decimals}` — they satisfy `PickerToken`. The list filtering ensures from≠to.)

- [ ] **Step 4: Verify**

Run: `npx jest --testPathPattern=SwapScreen && npx tsc --noEmit && npx eslint src/screens/transparent/SwapScreen.tsx`
Expected: PASS; tsc 0; no eslint errors. Confirm `Alert` is no longer imported if unused.

- [ ] **Step 5: Commit**

```bash
git add src/screens/transparent/SwapScreen.tsx
git commit -m "feat(swap): use TokenPickerSheet instead of Alert for token selection

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Wire SendScreen to the sheet

**Files:**
- Modify: `src/screens/transparent/SendScreen.tsx`

- [ ] **Step 1: Add `name` to availableTokens**

`availableTokens` items are `{mint, symbol, decimals}` (type `TokenInfo`) — the picker needs `name`. Read the `availableTokens` useMemo and the `TokenInfo` interface + `SOL_TOKEN` const. Add a `name` field:
- Add `name: string;` to the `TokenInfo` interface.
- `SOL_TOKEN` → add `name: 'Solana'`.
- The NOC default entry → add `name: 'Noctura'`.
- The `storeTokens.map(...)` → add `name: t.name` (the store `TokenMetadata` has `name`).

- [ ] **Step 2: Replace the Alert picker with sheet state**

Remove the `handleOpenTokenPicker` function (the `Alert.alert('Select token', ...)`) and the `Alert` import if it becomes unused. Add:
```tsx
import {TokenPickerSheet} from '../../components/TokenPickerSheet';
```
In the component body:
```tsx
  const [pickerVisible, setPickerVisible] = useState(false);
```

- [ ] **Step 3: Point the token chip at the sheet + render it**

The token chip currently calls `handleOpenTokenPicker` on press — change its `onPress` to `() => setPickerVisible(true)`.
Render the sheet before the screen root's closing tag:
```tsx
      <TokenPickerSheet
        visible={pickerVisible}
        title="Select token"
        tokens={availableTokens}
        selectedMint={selectedMint}
        balances={{native: solBalance, [NOC_MINT]: nocBalance, ...tokenBalances}}
        onSelect={mint => {
          setSelectedMint(mint);
          setAmount('');
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
```
(`availableTokens`, `selectedMint`, `solBalance`, `nocBalance`, `tokenBalances`, `setSelectedMint`, `setAmount`, `NOC_MINT` already exist in this screen — verify and adjust names to the real ones. `SOL_MINT` here is `'native'`; the balances map uses `native: solBalance`.)

- [ ] **Step 4: Verify**

Run: `npx jest --testPathPattern="SendScreen|transparent" && npx tsc --noEmit && npx eslint src/screens/transparent/SendScreen.tsx`
Expected: PASS; tsc 0; no eslint errors. Confirm `Alert` is no longer imported if unused.

- [ ] **Step 5: Commit**

```bash
git add src/screens/transparent/SendScreen.tsx
git commit -m "feat(send): use TokenPickerSheet instead of Alert for token selection

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Full verification + on-device

**Files:** none.

- [ ] **Step 1: Full suite + tsc + lint**

Run: `npx jest && npx tsc --noEmit && npx eslint .`
Expected: all tests pass; tsc 0; no NEW eslint errors (the pre-existing `e2e/helpers.ts` error + inline-style warnings are unrelated).

- [ ] **Step 2: Mainnet APK build**

Swap `.env` to mainnet with the user's Helius + CoinGecko keys, `cd android && ./gradlew assembleRelease`, revert `.env`, copy the APK to `/home/user/Downloads/` (the established flow).

- [ ] **Step 3: On-device verification**

- **Swap**: tap the From token → a bottom sheet slides up with SOL / USDC / USDT, each with logo + name + balance, a ✓ on the current; tap one → it's selected, sheet closes. Same for the To token (the current From is absent from the list).
- **Send**: tap the token chip → the sheet lists SOL / NOC / any held SPL with balances; tap → selected. No more native gray alert.
- Backdrop tap / hardware back closes the sheet without changing the selection.

If anything misbehaves, STOP and use `superpowers:systematic-debugging`.

---

## Self-Review

**1. Spec coverage:**
- `TokenPickerSheet` component (Modal bottom sheet, rows = logo+symbol+name+balance+check) → Task 1. ✓
- Swap wiring (from/to, opposite-side filtered out, clears amount) → Task 2. ✓
- Send wiring (chip → sheet, name added to availableTokens) → Task 3. ✓
- Remove all 3 `Alert.alert` sites → Tasks 2, 3. ✓
- Empty/back/backdrop states → Task 1 (component). ✓
- Search / §43-as-screen / popular sections → out of scope (not implemented). ✓
- Tests: component render + onSelect → Task 1; screen tests stay green → Tasks 2, 3. ✓

**2. Placeholder scan:** Full component code in Task 1; precise edits with code in Tasks 2-3; commands have expected output. No TBD/TODO.

**3. Type consistency:** `PickerToken {mint, symbol, name, decimals}` (Task 1) — `SWAP_TOKENS` already matches (Task 2); `availableTokens` gets `name` added to match (Task 3). `TokenPickerSheetProps` (visible/title/tokens/selectedMint/balances/onSelect/onClose) consistent across all three render sites. `balances` is `Record<string,string>` keyed by mint with `native` for SOL in both screens. ✓
