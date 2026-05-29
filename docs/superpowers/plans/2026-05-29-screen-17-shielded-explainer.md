# Screen #17 Shielded Explainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic `PrivacyExplainerScreen` with the spec-compliant `ShieldedExplainerScreen` (§s17): first-Shielded-toggle on Dashboard opens the explainer, Continue persists the MMKV flag and navigates to ShieldUnshieldModal with `direction='private'`.

**Architecture:** New standalone screen at `src/screens/shielded/ShieldedExplainerScreen.tsx` with inline `VaultHero` (composite: `View` ring + `react-native-svg` diagonal-stripe pattern + lucide `Vault` icon) and inline `ExplainerStep`. MMKV gating via `mmkvPublic`. Old screen + old MMKV key + old nav route deleted in a final atomic task once nothing references them.

**Tech Stack:** RN 0.84.1 (Fabric), NativeWind v4, react-native-svg (present via lucide-react-native), react-native-mmkv (in-memory mock in jest), React Navigation v7 native-stack, Zustand. Tests with Jest + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-05-29-screen-17-shielded-explainer-design.md`

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/screens/shielded/ShieldedExplainerScreen.tsx` | Screen UI + handlers + inline `VaultHero` + inline `ExplainerStep` |
| Create | `src/screens/shielded/__tests__/ShieldedExplainerScreen.test.tsx` | 9 unit tests per spec §6 |
| Modify | `src/constants/mmkvKeys.ts` | Replace `PRIVACY_EXPLAINER_SHOWN` with `SHIELDED_EXPLAINED` |
| Modify | `src/types/navigation.d.ts` | Rename route `PrivacyExplainer` → `ShieldedExplainer` |
| Modify | `src/app/Navigator.tsx` | Swap import, route registration, screen wrapper signature, dashboard nav call |
| Modify | `src/screens/dashboard/DashboardScreen.tsx` | Switch MMKV key constant in `handleModeToggle` |
| Delete | `src/screens/PrivacyExplainerScreen.tsx` | Old generic screen |

---

## Task 1: Add new MMKV key constant + nav route type (additive)

Purely additive — old and new coexist briefly so the project stays compilable while we build.

**Files:**
- Modify: `src/constants/mmkvKeys.ts` (around line 78)
- Modify: `src/types/navigation.d.ts` (around line 23)

- [ ] **Step 1.1: Add `SHIELDED_EXPLAINED` constant**

In `src/constants/mmkvKeys.ts`, locate `PRIVACY_EXPLAINER_SHOWN: 'v1_privacy.explainerShown',` and ADD a new line directly below it (keep the old line for now):

```ts
  PRIVACY_EXPLAINER_SHOWN: 'v1_privacy.explainerShown',
  SHIELDED_EXPLAINED: 'v1_shielded_explained',
```

- [ ] **Step 1.2: Add `ShieldedExplainer` route type**

In `src/types/navigation.d.ts`, locate `PrivacyExplainer: undefined;` and ADD a new line directly below it (keep the old line for now):

```ts
  PrivacyExplainer: undefined;
  ShieldedExplainer: undefined;
```

- [ ] **Step 1.3: Type-check**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: no errors (both old and new types coexist; no consumer yet for the new ones).

- [ ] **Step 1.4: Commit**

```bash
git add src/constants/mmkvKeys.ts src/types/navigation.d.ts
git commit -m "feat(#17): add SHIELDED_EXPLAINED MMKV key + ShieldedExplainer route type"
```

---

## Task 2: Write all 9 failing tests (RED)

Tests come first per TDD. All 9 will fail with "Cannot find module '../ShieldedExplainerScreen'" — that's the correct RED state.

**Files:**
- Create: `src/screens/shielded/__tests__/ShieldedExplainerScreen.test.tsx`

- [ ] **Step 2.1: Write the test file**

Create `src/screens/shielded/__tests__/ShieldedExplainerScreen.test.tsx`:

```tsx
import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {Linking} from 'react-native';
import {ShieldedExplainerScreen} from '../ShieldedExplainerScreen';
import {mmkvPublic} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';
import {useShieldedStore} from '../../../store/zustand/shieldedStore';

const mockReplace = jest.fn();
const mockGoBack = jest.fn();
const navigation = {replace: mockReplace, goBack: mockGoBack} as any;

beforeEach(() => {
  mockReplace.mockClear();
  mockGoBack.mockClear();
  mmkvPublic.delete(MMKV_KEYS.SHIELDED_EXPLAINED);
  useShieldedStore.getState().setMode('transparent');
  jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve());
});

describe('ShieldedExplainerScreen', () => {
  it('renders H1, all 3 step titles, and footer note', () => {
    const {getByText} = render(<ShieldedExplainerScreen navigation={navigation} />);
    expect(getByText('Private SOL, three steps.')).toBeTruthy();
    expect(getByText('Move into the vault')).toBeTruthy();
    expect(getByText('Generate a ZK proof')).toBeTruthy();
    expect(getByText('Send privately')).toBeTruthy();
    expect(getByText('Screenshots disabled across this flow.')).toBeTruthy();
  });

  it('renders Continue and Learn more CTAs', () => {
    const {getByText} = render(<ShieldedExplainerScreen navigation={navigation} />);
    expect(getByText('Continue')).toBeTruthy();
    expect(getByText('Learn more')).toBeTruthy();
  });

  it('renders close × button with accessibility label', () => {
    const {getByLabelText} = render(<ShieldedExplainerScreen navigation={navigation} />);
    expect(getByLabelText('Close')).toBeTruthy();
  });

  it('tap Continue persists SHIELDED_EXPLAINED flag in MMKV', () => {
    const {getByTestId} = render(<ShieldedExplainerScreen navigation={navigation} />);
    fireEvent.press(getByTestId('continue-button'));
    expect(mmkvPublic.getBoolean(MMKV_KEYS.SHIELDED_EXPLAINED)).toBe(true);
  });

  it('tap Continue sets shielded mode in store', () => {
    const {getByTestId} = render(<ShieldedExplainerScreen navigation={navigation} />);
    fireEvent.press(getByTestId('continue-button'));
    expect(useShieldedStore.getState().mode).toBe('shielded');
  });

  it('tap Continue navigates (replace) to ShieldUnshieldModal with direction private', () => {
    const {getByTestId} = render(<ShieldedExplainerScreen navigation={navigation} />);
    fireEvent.press(getByTestId('continue-button'));
    expect(mockReplace).toHaveBeenCalledWith('ShieldUnshieldModal', {direction: 'private'});
  });

  it('tap close × does NOT persist the MMKV flag', () => {
    const {getByLabelText} = render(<ShieldedExplainerScreen navigation={navigation} />);
    fireEvent.press(getByLabelText('Close'));
    expect(mmkvPublic.getBoolean(MMKV_KEYS.SHIELDED_EXPLAINED)).toBeUndefined();
  });

  it('tap close × calls navigation.goBack', () => {
    const {getByLabelText} = render(<ShieldedExplainerScreen navigation={navigation} />);
    fireEvent.press(getByLabelText('Close'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('tap Learn more opens external privacy URL', () => {
    const {getByTestId} = render(<ShieldedExplainerScreen navigation={navigation} />);
    fireEvent.press(getByTestId('learn-more-button'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://noc-tura.io/privacy');
  });
});
```

- [ ] **Step 2.2: Verify RED**

Run: `npx jest src/screens/shielded/__tests__/ShieldedExplainerScreen.test.tsx 2>&1 | tail -10`
Expected: failure with `Cannot find module '../ShieldedExplainerScreen'`. This is the correct RED state.

- [ ] **Step 2.3: Commit RED**

```bash
git add src/screens/shielded/__tests__/ShieldedExplainerScreen.test.tsx
git commit -m "test(#17): add failing tests for ShieldedExplainerScreen (RED)"
```

---

## Task 3: Implement ShieldedExplainerScreen (GREEN)

Build the screen so all 9 tests pass. Single create-file step because the tests need the full surface (copy, handlers, accessibility, testIDs) before any can pass.

**Files:**
- Create: `src/screens/shielded/ShieldedExplainerScreen.tsx`

- [ ] **Step 3.1: Create the screen file**

Create `src/screens/shielded/ShieldedExplainerScreen.tsx`:

```tsx
import React from 'react';
import {View, Pressable, Linking, ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Svg, {Defs, Pattern, Rect, ClipPath, Circle, Line} from 'react-native-svg';
import {X, ShieldCheck, Vault} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Text, Button} from '../../components/ui';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {useShieldedStore} from '../../store/zustand/shieldedStore';
import type {RootStackParamList} from '../../types/navigation';

const PRIVACY_URL = 'https://noc-tura.io/privacy';
const ACCENT = '#5BE3C2';

type Props = NativeStackScreenProps<RootStackParamList, 'ShieldedExplainer'>;

export function ShieldedExplainerScreen({navigation}: Props) {
  function handleContinue() {
    mmkvPublic.set(MMKV_KEYS.SHIELDED_EXPLAINED, true);
    useShieldedStore.getState().setMode('shielded');
    navigation.replace('ShieldUnshieldModal', {direction: 'private'});
  }

  function handleClose() {
    navigation.goBack();
  }

  function handleLearnMore() {
    void Linking.openURL(PRIVACY_URL);
  }

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} className="flex-1 bg-bg-base">
      {/* Top bar: close × · SHIELDED overline · 1/1 */}
      <View className="flex-row items-center justify-between px-5 h-12">
        <Pressable
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          className="w-12 h-12 items-center justify-center -ml-3">
          <X size={22} color="#A8ACB5" strokeWidth={1.75} />
        </Pressable>
        <View className="flex-row items-center gap-2">
          <ShieldCheck size={12} color={ACCENT} strokeWidth={2} />
          <Text variant="overline" className="text-accent-shielded">SHIELDED</Text>
        </View>
        <Text variant="overline" className="text-fg-tertiary">1 / 1</Text>
      </View>

      <ScrollView contentContainerStyle={{paddingHorizontal: 20, paddingBottom: 24}}>
        <VaultHero />
        <Text variant="h1" className="mb-3 mt-6">
          Private SOL, three steps.
        </Text>
        <Text variant="body" className="text-fg-secondary mb-8 max-w-sm">
          Shielded mode moves SOL into a ZK pool. Senders, recipients, and amounts of future shielded transfers are unlinkable from your public address.
        </Text>

        <ExplainerStep
          n={1}
          title="Move into the vault"
          body="Deposit SOL from your public address. The deposit itself is visible on-chain (it has to be — it's how you fund the vault), but everything from this point onward is private."
        />
        <ExplainerStep
          n={2}
          title="Generate a ZK proof"
          body="For every shielded action, your phone produces a Plonk-style zero-knowledge proof locally. The proof shows you own the funds without revealing which note you're spending."
        />
        <ExplainerStep
          n={3}
          title="Send privately"
          body="Settled on Solana with the proof attached. Validators verify the proof; nobody — not even Noctura — sees the recipient or the amount."
        />

        {/* Footer note */}
        <View className="flex-row items-center gap-2 mt-4">
          <ShieldCheck size={14} color={ACCENT} strokeWidth={1.75} />
          <Text variant="body-sm" className="text-accent-shielded">
            Screenshots disabled across this flow.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky bar */}
      <View className="px-5 pb-4 gap-3">
        <Pressable
          testID="continue-button"
          onPress={handleContinue}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          className="h-14 rounded-pill bg-accent-shielded items-center justify-center active:opacity-90">
          <Text variant="body-lg" className="font-geist-semibold text-bg-base">
            Continue
          </Text>
        </Pressable>
        <Button
          label="Learn more"
          variant="tertiary"
          onPress={handleLearnMore}
          testID="learn-more-button"
        />
      </View>
    </SafeAreaView>
  );
}

// ── VaultHero · 88dp disc · accent ring + halo + diagonal stripes + Vault icon ──
function VaultHero() {
  return (
    <View className="items-center mt-2">
      <View
        className="rounded-full items-center justify-center border border-accent-shielded"
        style={{
          width: 88,
          height: 88,
          shadowColor: ACCENT,
          shadowOpacity: 0.35,
          shadowRadius: 16,
          shadowOffset: {width: 0, height: 0},
          elevation: 6,
        }}>
        <Svg width={88} height={88} style={{position: 'absolute', top: 0, left: 0}}>
          <Defs>
            <Pattern
              id="stripes"
              patternUnits="userSpaceOnUse"
              width={6}
              height={6}
              patternTransform="rotate(45)">
              <Line
                x1={0}
                y1={0}
                x2={0}
                y2={6}
                stroke={ACCENT}
                strokeOpacity={0.06}
                strokeWidth={2}
              />
            </Pattern>
            <ClipPath id="circleClip">
              <Circle cx={44} cy={44} r={43} />
            </ClipPath>
          </Defs>
          <Rect
            width={88}
            height={88}
            fill="url(#stripes)"
            clipPath="url(#circleClip)"
          />
        </Svg>
        <Vault size={44} color={ACCENT} strokeWidth={1.75} />
      </View>
    </View>
  );
}

// ── ExplainerStep · numbered tinted disc + title + body ─────────────────────
interface ExplainerStepProps {
  n: number;
  title: string;
  body: string;
}

function ExplainerStep({n, title, body}: ExplainerStepProps) {
  return (
    <View className="flex-row gap-4 mb-6">
      <View
        className="w-7 h-7 rounded-full bg-accent-shielded-tint items-center justify-center"
        style={{flexShrink: 0}}>
        <Text variant="body-sm" mono numeral className="text-accent-shielded">
          {n}
        </Text>
      </View>
      <View className="flex-1">
        <Text variant="h3" className="mb-1">
          {title}
        </Text>
        <Text variant="body-sm" className="text-fg-secondary">
          {body}
        </Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 3.2: Verify GREEN — all 9 tests pass**

Run: `npx jest src/screens/shielded/__tests__/ShieldedExplainerScreen.test.tsx 2>&1 | tail -20`
Expected: `Tests: 9 passed, 9 total`.

If any test fails: fix the SCREEN (not the test). Common gotchas:
- `getByText` not finding text → verify `<Text>` content matches exactly (smart quotes, em-dashes)
- `getByTestId('continue-button')` not found → verify `testID` prop on Pressable
- MMKV assertion failing → check `mmkvPublic.set` is called BEFORE `navigation.replace`

- [ ] **Step 3.3: Type-check**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: clean. If errors about `'ShieldedExplainer'` not in `RootStackParamList`, Task 1.2 was skipped — go back and fix.

- [ ] **Step 3.4: Commit GREEN**

```bash
git add src/screens/shielded/ShieldedExplainerScreen.tsx
git commit -m "feat(#17): implement ShieldedExplainerScreen per §s17 spec (GREEN)"
```

---

## Task 4: Wire Navigator to new screen + route

Atomic flip of the modal route registration, import, dashboard nav target, and screen wrapper signature.

**Files:**
- Modify: `src/app/Navigator.tsx` (4 locations)

- [ ] **Step 4.1: Swap the screen import**

In `src/app/Navigator.tsx`, find:
```ts
import {PrivacyExplainerScreen} from '../screens/PrivacyExplainerScreen';
```
Replace with:
```ts
import {ShieldedExplainerScreen} from '../screens/shielded/ShieldedExplainerScreen';
```

- [ ] **Step 4.2: Verify `NativeStackScreenProps` import is present**

In `src/app/Navigator.tsx`, look near the top for an existing import that includes `NativeStackScreenProps`. If absent, ADD:
```ts
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
```
(If only `NativeStackNavigationProp` is imported currently, expand it to include `NativeStackScreenProps` as well.)

- [ ] **Step 4.3: Update Dashboard's `onFirstShieldedToggle` target**

In `src/app/Navigator.tsx`, find:
```ts
onFirstShieldedToggle={() => rootNav.navigate('PrivacyExplainer')}
```
Replace with:
```ts
onFirstShieldedToggle={() => rootNav.navigate('ShieldedExplainer')}
```

- [ ] **Step 4.4: Replace the screen wrapper function**

In `src/app/Navigator.tsx`, find:
```tsx
function PrivacyExplainerScreenNav() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <PrivacyExplainerScreen
      onDismiss={() => nav.goBack()}
    />
  );
}
```
Replace with:
```tsx
function ShieldedExplainerScreenNav(
  props: NativeStackScreenProps<RootStackParamList, 'ShieldedExplainer'>,
) {
  return <ShieldedExplainerScreen {...props} />;
}
```

- [ ] **Step 4.5: Re-register the route**

In `src/app/Navigator.tsx`, find:
```tsx
<RootNav.Screen name="PrivacyExplainer" component={PrivacyExplainerScreenNav} options={modalScreenOptions} />
```
Replace with:
```tsx
<RootNav.Screen name="ShieldedExplainer" component={ShieldedExplainerScreenNav} options={modalScreenOptions} />
```

- [ ] **Step 4.6: Type-check**

Run: `npx tsc --noEmit 2>&1 | tail -10`
Expected: clean. If errors, double-check the wrapper signature — `NativeStackScreenProps` infers both `navigation` and `route`, and we forward both with the spread.

- [ ] **Step 4.7: Commit Navigator wiring**

```bash
git add src/app/Navigator.tsx
git commit -m "feat(#17): wire Navigator to ShieldedExplainerScreen at ShieldedExplainer route"
```

---

## Task 5: Switch Dashboard MMKV key reference

**Files:**
- Modify: `src/screens/dashboard/DashboardScreen.tsx` (1 line)

- [ ] **Step 5.1: Replace the constant**

In `src/screens/dashboard/DashboardScreen.tsx`, find:
```ts
const seen = mmkvPublic.getBoolean(MMKV_KEYS.PRIVACY_EXPLAINER_SHOWN) === true;
```
Replace with:
```ts
const seen = mmkvPublic.getBoolean(MMKV_KEYS.SHIELDED_EXPLAINED) === true;
```

- [ ] **Step 5.2: Type-check + run dashboard-related tests**

Run: `npx tsc --noEmit 2>&1 | tail -5 && npx jest src/screens/dashboard --passWithNoTests 2>&1 | tail -5`
Expected: tsc clean. Jest reports "No tests found" (DashboardScreen currently has no unit tests) — acceptable.

- [ ] **Step 5.3: Commit**

```bash
git add src/screens/dashboard/DashboardScreen.tsx
git commit -m "feat(#17): switch Dashboard explainer gate to SHIELDED_EXPLAINED"
```

---

## Task 6: Delete deprecated code (atomic cleanup)

Nothing references the old screen, MMKV key, or nav route after Tasks 4 and 5. Delete them.

**Files:**
- Delete: `src/screens/PrivacyExplainerScreen.tsx`
- Modify: `src/constants/mmkvKeys.ts` (remove one line)
- Modify: `src/types/navigation.d.ts` (remove one line)

- [ ] **Step 6.1: Verify no orphan references**

Run:
```bash
grep -rn "PrivacyExplainerScreen\|PRIVACY_EXPLAINER_SHOWN\|'PrivacyExplainer'" src --include="*.ts" --include="*.tsx"
```
Expected: empty output. If any matches, FIX them before deleting.

- [ ] **Step 6.2: Delete the old screen file**

```bash
rm src/screens/PrivacyExplainerScreen.tsx
```

- [ ] **Step 6.3: Remove the old MMKV key constant**

In `src/constants/mmkvKeys.ts`, REMOVE the line:
```ts
  PRIVACY_EXPLAINER_SHOWN: 'v1_privacy.explainerShown',
```

- [ ] **Step 6.4: Remove the old nav route type**

In `src/types/navigation.d.ts`, REMOVE the line:
```ts
  PrivacyExplainer: undefined;
```

- [ ] **Step 6.5: Type-check + full test suite**

Run: `npx tsc --noEmit 2>&1 | tail -5 && npx jest 2>&1 | tail -8`
Expected: tsc clean. Jest: all tests pass (the pre-existing `ConfirmSeedScreen` flake under full-suite is acceptable — it passes in isolation; not a regression of this work).

- [ ] **Step 6.6: Commit deletion**

```bash
git add -u src/screens/PrivacyExplainerScreen.tsx src/constants/mmkvKeys.ts src/types/navigation.d.ts
git commit -m "chore(#17): remove deprecated PrivacyExplainerScreen + PRIVACY_EXPLAINER_SHOWN + PrivacyExplainer route"
```

---

## Task 7: Acceptance — lint, suite, build, manual smoke

- [ ] **Step 7.1: Lint clean**

Run: `npx eslint . 2>&1 | tail -10`
Expected: no new errors from this work. Pre-existing warnings are OK.

- [ ] **Step 7.2: Full Jest suite green**

Run: `npx jest 2>&1 | tail -5`
Expected: ~526 tests pass (previous 517 + 9 new). `ConfirmSeedScreen` flake under full-suite acceptable.

- [ ] **Step 7.3: Rebuild bundle + APK for emulator smoke**

```bash
npx react-native bundle --platform android --dev false --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res
cd android && ./gradlew assembleDebug && cd ..
cp android/app/build/outputs/apk/debug/app-debug.apk ~/Downloads/noctura-2026-05-29-devnet-screen17.apk
```

- [ ] **Step 7.4: Manual smoke checklist (Android device / emulator)**

1. `adb uninstall com.nocturawallet`
2. `adb install ~/Downloads/noctura-2026-05-29-devnet-screen17.apk`
3. Restore from seed → dashboard appears with correct SOL balance (e.g. `5 SOL`, no `5,000,000,000`).
4. Tap **Shielded** segmented toggle → ShieldedExplainerScreen renders: vault hero disc, "Private SOL, three steps." H1, 3 numbered steps, footer "Screenshots disabled across this flow.", Continue + Learn more CTAs.
5. Tap **Continue** → lands on ShieldUnshield screen (direction = private).
6. Android back / system back gesture → returns to Dashboard, mode is now `shielded` (accents are mint, "Privacy is on" banner visible).
7. `adb uninstall com.nocturawallet` + reinstall + restore → tap Shielded → explainer re-shows (flag is per-install).
8. Tap **close ×** on explainer → returns to Dashboard in transparent mode → tap Shielded again → explainer re-shows (flag NOT set by close ×).
9. Tap **Learn more** → external browser opens `https://noc-tura.io/privacy`.

If any smoke step fails, open a follow-up task — do not patch under this plan unless trivial (e.g., a missed `accessibilityLabel`).

---

## Acceptance Criteria

- [ ] All 9 unit tests in `ShieldedExplainerScreen.test.tsx` pass (Task 3.2)
- [ ] `npx tsc --noEmit` clean (Task 6.5)
- [ ] `npx eslint .` clean (Task 7.1)
- [ ] Manual smoke (Task 7.4) passes all 9 steps
- [ ] Old `PrivacyExplainerScreen.tsx`, `PRIVACY_EXPLAINER_SHOWN`, `PrivacyExplainer` route fully removed (Task 6.1 grep returns empty)
