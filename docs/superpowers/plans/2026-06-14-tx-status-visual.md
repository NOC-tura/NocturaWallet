# #21 tx-status Visual Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `TransactionStatusScreen` (#21) render + styling to match `index.html` §21 (`.s-stat`) using the app's NativeWind design system, keeping all logic (submit→poll, expiry resubmit, fee math) unchanged.

**Architecture:** Replace the hand-rolled `StyleSheet` (hardcoded hex) with NativeWind classes + `components/ui` primitives, mirroring SendScreen/TxSimulate/TxConfirm. A `StatusRing` sub-component renders the per-stage hero ring; a restyled `MetaRow` renders the meta grid with a copy button. The `useEffect` submit/poll/expiry block and helpers are preserved verbatim.

**Tech Stack:** React Native 0.84, NativeWind v4, TypeScript strict, lucide-react-native, @react-native-clipboard/clipboard, Jest.

**Source:** `/home/user/Downloads/index.html` §21 (`.s-stat`, CSS ~line 2266) + `screen.md` §21. Spec: `docs/superpowers/specs/2026-06-14-tx-status-visual-design.md`. Branch: `feat/tx-status-broadcast`.

**DS tokens (from `tailwind.config.js`):** `bg-bg-base`, `bg-bg-surface-1/2/3`, `text-fg-primary/secondary/tertiary`, `text-accent-transparent` (#B084FC), `text-success`, `text-warning`, `text-danger`, `rounded-2xl` (24px), `rounded-lg`. Class form is `bg-bg-surface-1` etc. (the `bg-` prefix + token name).

---

## File Structure
- `src/screens/transparent/TransactionStatusScreen.tsx` — REWRITE render + remove `StyleSheet`. Keep the effect/logic/state/helpers.
- `src/screens/transparent/__tests__/TransactionStatusScreen.test.tsx` — keep; adjust only if a literal string changes.

---

## Task 1: Rewrite the #21 render to the design system

**Files:**
- Modify: `src/screens/transparent/TransactionStatusScreen.tsx`

**Preserve verbatim** (do NOT touch): the `useEffect` that runs `attemptSubmit`/poll/expiry, the `mapErr` helper, the state declarations (`stage`, `signature`, `slot`, `errorMessage`, `priorityFeeUsed`, `retryCount`), the lazy-require block, `CU_LIMIT`/`computeFeeLamports`/`feePaid` computation, and the `err`-before-`confirmationStatus` poll ordering. ONLY the returned JSX + the styling approach change.

- [ ] **Step 1: Read the references** — open `src/screens/transparent/TxConfirmScreen.tsx` and `src/screens/onboarding/SuccessScreen.tsx` for the NativeWind + `SafeAreaView` + `Text`/`Button` (`components/ui`) + clipboard-copy conventions; open `index.html` around line 2266 (`.s-stat`) for the visual.

- [ ] **Step 2: New imports** — replace the RN `StyleSheet`/`TouchableOpacity`/`ActivityIndicator` imports as needed with: `SafeAreaView` from `react-native-safe-area-context`; `Text`, `Button` from `../../components/ui`; `cn` from `../../utils/cn`; `Check`, `X`, `AlertTriangle`, `ArrowRight`, `Copy` from `lucide-react-native`; `Clipboard` from `@react-native-clipboard/clipboard`. Keep `View`, `Pressable`, `ActivityIndicator`, `Linking`, `ScrollView` from react-native as needed.

- [ ] **Step 3: `StatusRing` sub-component** — add near the bottom of the file:
```tsx
function StatusRing({stage}: {stage: Stage}) {
  // 132dp ring; success/failed have a translucent halo; broadcasting spins.
  if (stage === 'success') {
    return (
      <View className="w-32 h-32 rounded-full items-center justify-center border-2 border-success bg-[rgba(63,214,139,0.12)]">
        <Check size={56} color="#3FD68B" strokeWidth={2} />
      </View>
    );
  }
  if (stage === 'failed') {
    return (
      <View className="w-32 h-32 rounded-full items-center justify-center border-2 border-danger bg-[rgba(248,113,113,0.10)]">
        <X size={56} color="#F87171" strokeWidth={2} />
      </View>
    );
  }
  if (stage === 'stuck') {
    return (
      <View
        className="w-32 h-32 rounded-full items-center justify-center bg-[rgba(242,181,59,0.08)]"
        style={{borderWidth: 1.5, borderColor: '#F2B53B', borderStyle: 'dashed'}}>
        <AlertTriangle size={52} color="#F2B53B" strokeWidth={1.75} />
      </View>
    );
  }
  // submitting / broadcasting
  return (
    <View className="w-32 h-32 rounded-full items-center justify-center border border-[rgba(176,132,252,0.35)]">
      <ActivityIndicator size="large" color="#B084FC" />
    </View>
  );
}
```
(Colors are the DS hex for the lucide `color` prop, which needs a literal: success `#3FD68B`, danger `#F87171`, warning `#F2B53B`, accent `#B084FC` — these match the tailwind tokens.)

- [ ] **Step 4: Stage copy** — derive per-stage label + sub:
```tsx
const COPY: Record<Stage, {label: string; sub: string; warn?: boolean}> = {
  submitting:   {label: 'Broadcasting transaction…', sub: 'Submitted to Solana mainnet · waiting for first confirmation'},
  broadcasting: {label: 'Broadcasting transaction…', sub: 'Submitted to Solana mainnet · waiting for first confirmation'},
  success:      {label: 'Sent successfully', sub: 'Confirmed on Solana mainnet'},
  failed:       {label: 'Transaction failed', sub: errorMessage ?? 'The transaction did not go through.'},
  stuck:        {label: 'Taking longer than usual', sub: 'Network is congested · the tx is in the mempool but hasn’t been included yet', warn: true},
};
const copy = COPY[stage];
```
Keep the EXACT strings `'Broadcasting transaction…'`, `'Sent successfully'`, `'Transaction failed'` (the tests assert these).

- [ ] **Step 5: Copy-to-clipboard helper** — add a `handleCopySig` that copies `signature` with a 30 s auto-clear (mirror SuccessScreen's pattern: `Clipboard.setString(signature); setTimeout(() => Clipboard.setString(''), 30_000)`), wrapped in try/catch.

- [ ] **Step 6: The single returned JSX** — one `SafeAreaView className="flex-1 bg-bg-base"` containing:
  1. **Top bar** (`flex-row items-center px-4 py-3`): a back placeholder (no back button during submitting/broadcasting/stuck) + a flexible spacer + a **status pill** rendered only for `success` (`CONFIRMED`, success-tinted: `px-2 py-0.5 rounded-pill bg-[rgba(63,214,139,0.16)]`, `Text variant="overline" className="text-success"`) or `stuck` (`SLOW`, warning-tinted).
  2. A `ScrollView contentContainerClassName="flex-grow items-center px-5 pb-8"`:
     - **Hero** (`items-center justify-center py-8 gap-5 flex-1`): `<StatusRing stage={stage} />` + `<Text variant="h1" className="text-center">{copy.label}</Text>` + `<Text variant="body-sm" className={cn('text-center max-w-[300px]', copy.warn ? 'text-warning' : 'text-fg-secondary')}>{copy.sub}</Text>`.
     - **Amount card** (`w-full bg-bg-surface-1 rounded-2xl p-5 items-center gap-3 mt-2`): `Text variant="overline" className="text-fg-tertiary"` = "AMOUNT"; a row (`flex-row items-baseline gap-2`) with `Text` amount (large, e.g. `className="text-fg-primary font-geist-semibold text-[28px]"` + `numeral`) + `Text variant="body" className="text-fg-secondary"` ticker; a `Text variant="caption" className="text-fg-tertiary"` = `To {formatAddress(intent.recipient)}`.
     - **Meta grid** (`w-full bg-bg-surface-1 rounded-lg px-5 mt-3`) — rendered when `signature` exists: `MetaRow` for **TX HASH** (mono, `truncatedSig`, with a copy `Pressable` calling `handleCopySig`), **SLOT** (`slot != null ? String(slot) : '—'`, mono), **FEE PAID** (`feePaid`).
     - A flexible spacer `<View className="flex-1" />`.
  3. **Sticky CTA area** (`px-6 pb-2 pt-2 gap-2`):
     - submitting/broadcasting: a single disabled `Button label="Broadcasting…" variant="primary" disabled` + a caption `Text variant="caption" className="text-fg-tertiary text-center"` = "Don’t close the app · this usually takes 8–12 s".
     - success: a `flex-row gap-2` with `Button label="View details" variant="secondary" testID="tx-status-details"` (onPress = `onViewDetails?.(signature!) ?? Linking.openURL(getExplorerUrl(signature!))`) and `Button label="Done" variant="primary" testID="tx-status-done"` (onPress=`onDashboard`).
     - failed: `Button label="Retry" variant="primary" testID="tx-status-retry"` (onPress=`() => setRetryCount(c => c + 1)`) + `Button label="Done" variant="secondary" testID="tx-status-done"` (onPress=`onDashboard`).
     - stuck: a "View on Solscan" `Pressable` (opens explorer) + `Button label="Done" variant="primary" testID="tx-status-done"`.

- [ ] **Step 7: Restyle `MetaRow`** to the grid layout:
```tsx
function MetaRow({label, value, mono, onCopy}: {label: string; value: string; mono?: boolean; onCopy?: () => void}) {
  return (
    <View className="flex-row items-center gap-3 py-3 border-t border-bg-surface-3">
      <Text variant="overline" className="text-fg-tertiary w-[76px]">{label}</Text>
      <Text variant="body-sm" className={cn('flex-1 text-fg-primary', mono && 'font-geist-mono text-fg-secondary')} numberOfLines={1}>{value}</Text>
      {onCopy ? (
        <Pressable onPress={onCopy} className="w-8 h-8 rounded-sm items-center justify-center bg-bg-surface-2" accessibilityLabel={`Copy ${label}`}>
          <Copy size={14} color="#A8ACB5" strokeWidth={1.75} />
        </Pressable>
      ) : null}
    </View>
  );
}
```
(The first row's top border is acceptable visually within the card; if the design's "first row no border" matters, conditionally drop `border-t` on the first row.)

- [ ] **Step 8: Remove the old `StyleSheet.create` block** and any now-unused style refs / the old per-state `if` render blocks. Verify nothing references the deleted `styles.*`.

- [ ] **Step 9: Verify**
  - `npx tsc --noEmit` → 0
  - `npx jest TransactionStatusScreen` → all PASS (the existing success/failed/landed-but-failed/expiry tests rely on the preserved strings + testIDs)
  - `npx eslint src/screens/transparent/TransactionStatusScreen.tsx` → 0 errors

- [ ] **Step 10: Commit**
```bash
git add src/screens/transparent/TransactionStatusScreen.tsx src/screens/transparent/__tests__/TransactionStatusScreen.test.tsx
git commit -m "feat(send): #21 tx-status visual rework to index.html §21 + design system

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Full gate

- [ ] **Step 1:** `npx tsc --noEmit` → 0
- [ ] **Step 2:** `npx eslint src/screens/transparent` → 0 errors
- [ ] **Step 3:** `npx jest` → all pass
- [ ] **Step 4:** commit any fallout: `git commit -am "test: align suite with #21 visual rework"`

---

## Task 3: Build + on-device verification (manual)

Follow [[project_android_transparent_v1]]. **Tiny amounts.**

- [ ] **Step 1:** `.env` → mainnet (backup first); build arm64 release; copy APK → `/home/user/Downloads/`; restore `.env`.
- [ ] **Step 2:** Send a small SOL amount. Confirm the #21 screen now matches the design: a **132dp hero ring** (spinner while broadcasting → green ring + halo on success), a **CONFIRMED** pill, the **AMOUNT** card, the **TX HASH · SLOT · FEE PAID** meta grid with a copy button on the hash, and a **[View details] · [Done]** button row — visually consistent with the other DS screens, not the old hardcoded look.

---

## Self-Review Notes
- **Spec coverage:** DS migration (Task 1 step 2/8), ring states (step 3), stage label/sub (step 4), status pill (step 6.1), amount card (6.2), meta grid + copy (6.2/7), CTAs (6.3), logic preserved (Task 1 preamble), tests preserved (step 9). Out-of-scope (fiat, shielded, Dynamic Island, Slot/Fee copy) absent — correct.
- **Type consistency:** `Stage` (existing) keys match `COPY`; `StatusRing`/`MetaRow` props match call sites; testIDs `tx-status-done/details/retry` preserved.
- **No logic regression:** the submit/poll/expiry effect, `mapErr`, fee math, and the `err`-first ordering are explicitly preserved (only JSX/styles change).
