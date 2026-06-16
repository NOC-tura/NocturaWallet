# Token Picker Sheet — Design

**Status:** Approved (brainstorming), pending spec review.
**Date:** 2026-06-16
**Branch:** `feat/swap` (continues the swap branch — this UX fix ships in the swap PR, before it is opened).
**Design source:** `/home/user/Downloads/index.html` §43 (`#s43`) + `screen.md` §43 "token-selector — modal-style picker for source/destination token (Send, Swap, Shield)".

## Goal

Replace the ugly native `Alert.alert` token pickers (3 sites: SwapScreen "Swap from"/"Swap to", SendScreen "Select token") with a proper bottom-sheet list — a row per token (logo + symbol + name + balance, selected one checked) that the user taps to pick. Realizes the §43 design.

## Component — `src/components/TokenPickerSheet.tsx`

A reusable bottom sheet built on React Native's `Modal` (the app's existing pattern — see `AppUpdateModal.tsx`: `<Modal transparent animationType="slide" />`). NOT a navigator screen (avoids React Navigation return-value plumbing; same UX).

```ts
export interface PickerToken {mint: string; symbol: string; name: string; decimals: number}

interface TokenPickerSheetProps {
  visible: boolean;
  title: string;                       // "Swap from" | "Swap to" | "Select token"
  tokens: readonly PickerToken[];      // the list to choose from (already filtered by caller)
  selectedMint: string;                // currently selected — gets the ✓
  balances: Record<string, string>;    // mint → raw balance string (for the right-side amount)
  onSelect: (mint: string) => void;    // tapping a row: select + the caller closes
  onClose: () => void;                 // backdrop tap / hardware back
}
export function TokenPickerSheet(props: TokenPickerSheetProps): JSX.Element;
```

Layout (build to §43 + the app's DS):
- `<Modal transparent visible animationType="slide" onRequestClose={onClose}>`.
- A full-screen `Pressable` backdrop (`bg-black/60`) → `onClose`; the sheet itself is a bottom-anchored `View` (`bg-bg-surface-1 rounded-t-2xl`, `pb` for the safe-area inset) that stops propagation.
- A small centered drag-handle bar at the top; the `title` (`Text variant h3/overline`) below it.
- A (non-scrolling for ≤8 items, else `ScrollView`) list of rows. Each row is a `Pressable` (≥56px, `active:bg-bg-surface-2`):
  - left: `TokenLogo` (reuse `src/components/TokenLogo.tsx`; `isNoc={mint === NOC_MINT}`),
  - middle: symbol (`body-lg`/`text-fg-primary`) over name (`body-sm`/`text-fg-secondary`),
  - right: balance `formatBalanceForDisplay(balances[mint] ?? '0', decimals)` (`noc-numeral`), and a `Check` (lucide, `text-accent-transparent`) when `mint === selectedMint`.
  - `onPress={() => onSelect(token.mint)}`.

## Wiring

### SwapScreen (`src/screens/transparent/SwapScreen.tsx`)
- Remove `pickFromToken`/`pickToToken` (the two `Alert.alert` handlers).
- Add state `picker: 'from' | 'to' | null` (default null). The From-card token selector sets `picker='from'`; the To-card sets `picker='to'`.
- Render one `<TokenPickerSheet visible={picker !== null} ... />`:
  - `title` = `picker === 'from' ? 'Swap from' : 'Swap to'`.
  - `tokens` = `SWAP_TOKENS` with the OPPOSITE side's mint filtered out (from-list excludes `toMint`, to-list excludes `fromMint`) — so the pair can't collide.
  - `selectedMint` = `picker === 'from' ? fromMint : toMint`.
  - `balances` = `{native: solBalance, ...tokenBalances}` (a map covering the swap tokens).
  - `onSelect(mint)`: set the relevant side (`setFromMint`/`setToMint`) and clear the amount + debounced amount, then `setPicker(null)`. (No collision handling needed — the list already excludes the opposite side, so `from` and `to` can never become equal.)
  - `onClose`: `setPicker(null)`.

### SendScreen (`src/screens/transparent/SendScreen.tsx`)
- Remove the `Alert.alert('Select token', …)` handler.
- Add state `pickerVisible: boolean`. The token chip's `onPress` sets it true.
- Render `<TokenPickerSheet visible={pickerVisible} title="Select token" tokens={availableTokens} selectedMint={selectedMint} balances={...} onSelect={mint => { setSelectedMint(mint); setPickerVisible(false); }} onClose={() => setPickerVisible(false)} />`.
- `availableTokens` already has `{mint, symbol, decimals}` — add `name` (from the store token metadata / `CORE_TOKENS`, fallback to symbol) so the rows show a name. `balances` = `{native: solBalance, [NOC_MINT]: nocBalance, ...tokenBalances}`.

## Error handling / states

- Empty `tokens` → render the sheet with a muted "No tokens" line (shouldn't happen — SOL is always present).
- Hardware back / backdrop tap → `onClose` (no selection).
- Missing balance for a mint → shows `0`.

## Testing

- `TokenPickerSheet.test.tsx` (light): given `visible` + 3 tokens, renders each symbol; tapping a row calls `onSelect` with that mint; the `selectedMint` row shows the check (query by the symbol). Mirror the existing screen-test harness.
- On-device: in Swap, tap From/To → sheet slides up with SOL/USDC/USDT + balances + ✓ on the current; tap a token → it's selected, sheet closes. Same in Send (SOL/NOC/held SPL). No more native alert.

## Out of scope (stated, not silently dropped)

- **Search input** (§43 has a contract-address search) — the current lists are small (3 swap / ~4 send); deferred until a full Jupiter token list exists.
- §43 as a standalone navigator screen — built as a component (same UX, no nav-return plumbing).
- "Popular vs full" sections — a single small list.
- Token search/import of arbitrary mints.
