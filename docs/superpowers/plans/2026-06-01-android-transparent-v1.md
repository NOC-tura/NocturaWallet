# Android Transparent v1 (Faza 2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the unfinished shielded mode behind a feature flag, then build a signed, sideloadable mainnet release APK of the transparent wallet and deliver it to `/home/user/Downloads/`, plus an on-phone smoke-test runbook.

**Architecture:** A single `FEATURES.shielded` flag in `src/constants/features.ts` (with pure helpers) is consumed at every shielded entry point — the Dashboard `ModeToggle` (disabled "coming soon" state), the Navigator entry callbacks (defensive no-op), and the Settings "Export View Key" row (hidden). Then an ephemeral mainnet `.env` + `./gradlew assembleRelease` (release signs with the existing debug keystore, no minify) produces a self-contained APK.

**Tech Stack:** React Native 0.84 (New Arch/Hermes), TypeScript strict, Zustand, NativeWind, Jest + @testing-library/react-native, Gradle/Android SDK at `/home/user/Android/Sdk`.

**Reference spec:** `docs/superpowers/specs/2026-06-01-android-transparent-v1-design.md`
**Visual source of truth (do not alter):** `/home/user/Downloads/index.html`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/constants/features.ts` (create) | `FEATURES` flag + `isShieldedEnabled()` |
| `src/constants/__tests__/features.test.ts` (create) | Unit test for the flag default |
| `src/app/deepLinkConfig.ts` (modify) | Gate shielded deep-link paths (`deposit`/`transfer`/`withdraw`) behind `isShieldedEnabled()` |
| `src/app/__tests__/deepLinkConfig.test.ts` (create) | Assert shielded deep links absent when gated |
| `src/screens/dashboard/DashboardScreen.tsx` (modify) | Export `ModeButton`; add `comingSoon` prop; gate `handleModeToggle` |
| `src/screens/dashboard/__tests__/ModeButton.test.tsx` (create) | `ModeButton` coming-soon behavior |
| `src/app/Navigator.tsx` (modify) | Defensive guard on `onShield` / `onFirstShieldedToggle` |
| `src/screens/settings/SettingsScreen.tsx` (modify) | Hide "Export View Key" row when shielded disabled |
| `docs/runbooks/2026-06-01-android-transparent-v1-runbook.md` (create) | Sideload + staged A/B/C smoke test |
| `.env` (ephemeral, gitignored — NOT committed) | Mainnet build config, restored after build |

---

## Task 1: `features.ts` flag + helpers

**Files:**
- Create: `src/constants/features.ts`
- Test: `src/constants/__tests__/features.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/constants/__tests__/features.test.ts`:

> **As-shipped note (post-review):** the original plan also added `SHIELDED_ROUTES` /
> `isShieldedRoute()` helpers. The final review found them unused (dead code, with a
> `'ZkProof'` vs `'ZkProofModal'` name bug), so they were removed; deep-link gating
> (see the deep-link task below) covers route-level gating instead. The snippets below
> reflect the **shipped** `features.ts` (only `FEATURES` + `isShieldedEnabled`).

```ts
import {FEATURES, isShieldedEnabled} from '../features';

describe('features flag', () => {
  it('shielded is disabled in v1', () => {
    expect(FEATURES.shielded).toBe(false);
    expect(isShieldedEnabled()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=features.test`
Expected: FAIL — cannot find module `../features`.

- [ ] **Step 3: Create the module**

Create `src/constants/features.ts`:

```ts
/**
 * Build-time feature flags. Single source of truth for gating unfinished
 * features out of a shippable build without deleting their code.
 */
export const FEATURES = {
  /**
   * Shielded (private) mode. false until ZK proving is live end-to-end
   * (backend prover + Polygen WASM). Flip to true to restore the shielded
   * UX exactly as designed (index.html s16–s18).
   */
  shielded: false,
} as const;

/** Whether shielded mode is enabled in this build. */
export function isShieldedEnabled(): boolean {
  return FEATURES.shielded;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=features.test`
Expected: PASS (1 test — the flag default).

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint src/constants/features.ts src/constants/__tests__/features.test.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/constants/features.ts src/constants/__tests__/features.test.ts
git commit -m "feat(android): FEATURES flag + shielded gating helpers"
```

---

## Task 2: `ModeButton` coming-soon state

Export `ModeButton` from `DashboardScreen.tsx` and add a `comingSoon` prop that
disables the press and appends " · soon" to the label.

**Files:**
- Modify: `src/screens/dashboard/DashboardScreen.tsx` (the `ModeButton` component near line 596)
- Test: `src/screens/dashboard/__tests__/ModeButton.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/screens/dashboard/__tests__/ModeButton.test.tsx`:

```tsx
import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {ModeButton} from '../DashboardScreen';

describe('ModeButton', () => {
  it('calls onPress when enabled', () => {
    const onPress = jest.fn();
    const {getByText} = render(
      <ModeButton label="Transparent" isActive mode="transparent" onPress={onPress} />,
    );
    fireEvent.press(getByText('Transparent'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders a "soon" label and does NOT call onPress when comingSoon', () => {
    const onPress = jest.fn();
    const {getByText, queryByText} = render(
      <ModeButton
        label="Shielded"
        isActive={false}
        mode="shielded"
        onPress={onPress}
        withShieldIcon
        comingSoon
      />,
    );
    expect(getByText('Shielded · soon')).toBeTruthy();
    expect(queryByText('Shielded')).toBeNull();
    fireEvent.press(getByText('Shielded · soon'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=ModeButton.test`
Expected: FAIL — `ModeButton` is not exported (or `comingSoon` not handled).

- [ ] **Step 3: Update `ModeButton`**

In `src/screens/dashboard/DashboardScreen.tsx`, change the `ModeButtonProps` interface to add `comingSoon`, export the function, and apply the behavior. Replace:

```tsx
interface ModeButtonProps {
  label: string;
  isActive: boolean;
  mode: 'transparent' | 'shielded';
  onPress: () => void;
  withShieldIcon?: boolean;
}

function ModeButton({label, isActive, mode, onPress, withShieldIcon}: ModeButtonProps) {
  const activeBg = mode === 'shielded' ? 'bg-accent-shielded' : 'bg-accent-transparent';
  const activeText = 'text-bg-base';
  const inactiveText = 'text-fg-secondary';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{selected: isActive}}
      className={cn(
        'flex-1 flex-row items-center justify-center gap-2 py-2 rounded-pill',
        isActive && activeBg,
      )}>
      {withShieldIcon ? (
        <Shield
          size={14}
          color={isActive ? '#0A0A0A' : '#A8ACB5'}
          strokeWidth={1.75}
        />
      ) : null}
```

with:

```tsx
interface ModeButtonProps {
  label: string;
  isActive: boolean;
  mode: 'transparent' | 'shielded';
  onPress: () => void;
  withShieldIcon?: boolean;
  /** Render as a disabled "· soon" teaser (feature gated out of this build). */
  comingSoon?: boolean;
}

export function ModeButton({label, isActive, mode, onPress, withShieldIcon, comingSoon}: ModeButtonProps) {
  const activeBg = mode === 'shielded' ? 'bg-accent-shielded' : 'bg-accent-transparent';
  const activeText = 'text-bg-base';
  const inactiveText = 'text-fg-secondary';
  return (
    <Pressable
      onPress={comingSoon ? undefined : onPress}
      disabled={comingSoon}
      accessibilityRole="tab"
      accessibilityState={{selected: isActive, disabled: !!comingSoon}}
      className={cn(
        'flex-1 flex-row items-center justify-center gap-2 py-2 rounded-pill',
        isActive && activeBg,
        comingSoon && 'opacity-50',
      )}>
      {withShieldIcon ? (
        <Shield
          size={14}
          color={isActive ? '#0A0A0A' : '#A8ACB5'}
          strokeWidth={1.75}
        />
      ) : null}
```

Then find the `<Text>` that renders `{label}` inside `ModeButton` (just below this block) and change `{label}` to `{comingSoon ? `${label} · soon` : label}`.

> Keep `activeText`/`inactiveText` usage exactly as-is — only the three changes above (interface field, `export` + destructure, `onPress`/`disabled`/`opacity`, and the label expression).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=ModeButton.test`
Expected: PASS (2 tests).

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint src/screens/dashboard/DashboardScreen.tsx`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/screens/dashboard/DashboardScreen.tsx src/screens/dashboard/__tests__/ModeButton.test.tsx
git commit -m "feat(android): ModeButton coming-soon disabled state"
```

---

## Task 3: Gate the Dashboard shielded toggle

Wire the flag into the Dashboard: the Shielded `ModeButton` shows "coming soon",
and `handleModeToggle` refuses to switch to shielded when gated.

**Files:**
- Modify: `src/screens/dashboard/DashboardScreen.tsx` (import, `handleModeToggle` ~line 200, the `<ModeButton label="Shielded" ...>` ~line 420)

- [ ] **Step 1: Add the import**

At the top of `src/screens/dashboard/DashboardScreen.tsx`, with the other `../../constants` imports, add:

```tsx
import {isShieldedEnabled} from '../../constants/features';
```

- [ ] **Step 2: Guard `handleModeToggle`**

In `handleModeToggle` (around line 200), add a guard as the FIRST statement inside the callback body (before `if (target === mode) return;`):

```tsx
  const handleModeToggle = useCallback(
    (target: 'transparent' | 'shielded') => {
      // Shielded is gated out of this build (FEATURES.shielded === false).
      if (target === 'shielded' && !isShieldedEnabled()) return;
      if (target === mode) return;
```

(Leave the rest of the callback unchanged.)

- [ ] **Step 3: Pass `comingSoon` to the Shielded `ModeButton`**

In the segmented pill (around line 420), update the Shielded button:

```tsx
          <ModeButton
            label="Shielded"
            isActive={isShielded}
            mode="shielded"
            onPress={() => onModeToggle('shielded')}
            withShieldIcon
            comingSoon={!isShieldedEnabled()}
          />
```

- [ ] **Step 4: Verify the full Dashboard still type-checks, lints, and tests pass**

Run: `npx tsc --noEmit && npx eslint src/screens/dashboard/DashboardScreen.tsx && npx jest --testPathPattern="ModeButton|features"`
Expected: clean + all green.

- [ ] **Step 5: Commit**

```bash
git add src/screens/dashboard/DashboardScreen.tsx
git commit -m "feat(android): gate dashboard shielded toggle (coming soon)"
```

---

## Task 4: Defensive Navigator guard

The Dashboard entry points (`onShield`, `onFirstShieldedToggle`) are wired in
`Navigator.tsx`. Even though the toggle is now disabled, guard the navigation
calls so a stale deep link / programmatic call can't reach shielded routes.

**Files:**
- Modify: `src/app/Navigator.tsx` (around lines 267 and 273)

- [ ] **Step 1: Add the import**

At the top of `src/app/Navigator.tsx`, with the other imports, add:

```tsx
import {isShieldedEnabled} from '../constants/features';
```

- [ ] **Step 2: Guard the two entry callbacks**

Find (around line 267–273):

```tsx
      onShield={() => rootNav.navigate('ShieldUnshieldModal', {direction: 'private'})}
```
```tsx
      onFirstShieldedToggle={() => rootNav.navigate('ShieldedExplainer')}
```

Change them to:

```tsx
      onShield={() => {
        if (isShieldedEnabled()) {
          rootNav.navigate('ShieldUnshieldModal', {direction: 'private'});
        }
      }}
```
```tsx
      onFirstShieldedToggle={() => {
        if (isShieldedEnabled()) {
          rootNav.navigate('ShieldedExplainer');
        }
      }}
```

> Leave shielded `Screen` registrations intact — only the entry callbacks are guarded.

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint src/app/Navigator.tsx`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/Navigator.tsx
git commit -m "feat(android): defensive guard on shielded navigation entry points"
```

---

## Task 5: Hide "Export View Key" in Settings

The shielded view key (`sk_view`) export is meaningless in a transparent-only
build. Hide that settings row when shielded is gated.

**Files:**
- Modify: `src/screens/settings/SettingsScreen.tsx` (import + line 188)

- [ ] **Step 1: Add the import**

At the top of `src/screens/settings/SettingsScreen.tsx`, add:

```tsx
import {isShieldedEnabled} from '../../constants/features';
```

- [ ] **Step 2: Conditionally render the row**

Find (line 188):

```tsx
      <NavRow label="Export View Key" onPress={() => navigation.navigate('ExportViewKey')} />
```

Change to:

```tsx
      {isShieldedEnabled() ? (
        <NavRow label="Export View Key" onPress={() => navigation.navigate('ExportViewKey')} />
      ) : null}
```

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint src/screens/settings/SettingsScreen.tsx`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/screens/settings/SettingsScreen.tsx
git commit -m "feat(android): hide shielded view-key export when shielded gated"
```

---

## Task 6: Full-suite gate checkpoint

Confirm the gating changes broke nothing across the whole project before building.

- [ ] **Step 1: Run the full suite + types + lint**

Run:
```bash
npx jest 2>&1 | tail -6
npx tsc --noEmit && echo "TSC OK"
npx eslint . 2>&1 | tail -5
```
Expected: all tests pass (same count as before + the new gating tests), no type errors, no new lint errors.

- [ ] **Step 2: Verify onboarding does not force shielded (spec §4.4)**

Run: `grep -nE "Shielded|ShieldUnshield|Deposit|Withdraw|ZkProof" src/screens/onboarding/SuccessScreen.tsx src/screens/onboarding/SyncWalletScreen.tsx`
Expected: no matches (onboarding never navigates into shielded). If a match exists, gate that navigation with `isShieldedEnabled()` the same way as Task 4, then re-run the suite.

- [ ] **Step 3: If anything fails, fix it, re-run, then continue.** (No commit needed if Tasks 1–5 already committed and this is green.)

---

## Task 7: Build the mainnet release APK → Downloads

This is an execution task (not TDD). It edits the gitignored `.env` ephemerally,
builds, restores `.env`, and copies the APK out.

**Files:**
- Ephemeral: `.env` (gitignored — never committed; backed up and restored)
- Output: `/home/user/Downloads/noctura-transparent-v1.apk`

- [ ] **Step 1: Back up `.env` and write the mainnet config**

```bash
cd /home/user/Solana/Project/NocturaWallet
cp .env .env.backup-faza2a
```
Then edit `.env` so it has exactly these (preserve the existing Helius API key value — only swap the host `devnet`→`mainnet`; set NETWORK; add API_BASE):
- `NETWORK=mainnet-beta`
- `HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=<existing key>`
- `HELIUS_WS_URL=wss://mainnet.helius-rpc.com/?api-key=<existing key>`
- `API_BASE=https://api.noc-tura.io/v1`

Verify (key masked): `grep -E '^(NETWORK|API_BASE)=' .env` → `NETWORK=mainnet-beta`, `API_BASE=https://api.noc-tura.io/v1`.

- [ ] **Step 2: Trial-build feasibility + assemble release**

```bash
export ANDROID_HOME=/home/user/Android/Sdk
export PATH="$ANDROID_HOME/platform-tools:$PATH"
cd /home/user/Solana/Project/NocturaWallet/android
./gradlew assembleRelease 2>&1 | tail -30
```
Expected: `BUILD SUCCESSFUL`; APK at `app/build/outputs/apk/release/app-release.apk`.

**Fallback (if BUILD FAILS — sandbox cannot build):** restore `.env` (Step 4), then skip Steps 3; instead commit all source changes and note in the runbook that the user must run `assembleRelease` themselves (the runbook already documents the commands). Report the exact gradle error.

- [ ] **Step 3: Copy the APK to Downloads**

```bash
cp /home/user/Solana/Project/NocturaWallet/android/app/build/outputs/apk/release/app-release.apk \
   /home/user/Downloads/noctura-transparent-v1.apk
ls -lh /home/user/Downloads/noctura-transparent-v1.apk
```
Expected: file present, non-zero size (tens of MB).

- [ ] **Step 4: Restore the original `.env`**

```bash
cd /home/user/Solana/Project/NocturaWallet
mv .env.backup-faza2a .env
git status --short   # confirm .env is NOT staged/changed in git (it is gitignored)
```

- [ ] **Step 5: Sanity-confirm gitignore**

Run: `git check-ignore .env .env.backup-faza2a 2>/dev/null; git status --short`
Expected: no `.env*` files appear in `git status` (nothing leaked).

---

## Task 8: Sideload + smoke-test runbook

**Files:**
- Create: `docs/runbooks/2026-06-01-android-transparent-v1-runbook.md`

- [ ] **Step 1: Write the runbook**

Create `docs/runbooks/2026-06-01-android-transparent-v1-runbook.md`:

```markdown
# Android Transparent v1 — Sideload & Smoke Test Runbook

**APK:** `/home/user/Downloads/noctura-transparent-v1.apk` (release, debug-signed,
self-contained, mainnet env). Shielded mode is gated ("coming soon").

## Install (sideload)
1. Transfer the APK to your Android phone (USB / cloud / cable).
2. On the phone: Settings → Apps → Special access → Install unknown apps → allow your
   file manager / browser. (Android warns about the source — expected for a debug-signed build.)
3. Open the APK → Install → Open.

## Stage A — install & UI (read-only, no spending)
- [ ] App installs and launches
- [ ] Onboarding: create wallet → seed phrase → confirm seed → set PIN → biometric → success
- [ ] Import existing seed works
- [ ] Unlock with PIN and with biometric
- [ ] All tabs navigate (Home / Portfolio / Nfts / Profile); settings screens open
- [ ] Dashboard "Shielded" toggle shows **"Shielded · soon"** disabled (tapping does nothing)
- [ ] Seed and PIN screens are screenshot-blocked (FLAG_SECURE)

## Stage B — real on-chain reads (mainnet, no spending)
- [ ] Dashboard shows real SOL + $NOC balances
- [ ] Receive screen shows correct address + scannable QR
- [ ] Transaction history loads
- [ ] Presale / Staking / Referral screens show real on-chain state

## Stage C — tiny real transactions (mainnet, small amounts)
> **Prerequisite:** `NOCTURA_FEE_TREASURY` must be a real address (currently
> `TODO_MAINNET_FEE_TREASURY`). Set the Squads multisig (or a temporary wallet you
> control) in `src/constants/programs.ts`, then request a rebuilt APK. Until then,
> transparent send will crash at transaction build.
- [ ] Send a tiny amount of SOL to yourself → status → appears in history
- [ ] Send a tiny amount of $NOC to yourself
- [ ] Minimal stake / unstake (if testing staking)
- [ ] Verify each on a Solana explorer

## Reporting issues
For any failure, capture: the on-screen error, and `adb logcat | grep -i noctura`
(or full logcat around the crash). Send it back for an iterative fix + rebuild.
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/2026-06-01-android-transparent-v1-runbook.md
git commit -m "docs(android): sideload + staged smoke-test runbook"
```

---

## Final verification

- [ ] **All gating tests + full suite green**

Run: `npx jest 2>&1 | tail -6 && npx tsc --noEmit && npx eslint . 2>&1 | tail -3`
Expected: green, no type errors, no new lint errors.

- [ ] **APK delivered (or fallback noted)**

Confirm `/home/user/Downloads/noctura-transparent-v1.apk` exists (Task 7 succeeded), OR
the build-fallback was taken and the runbook + committed source let the user build.

- [ ] **No secrets leaked**

Confirm `git status` shows no `.env*` files and the diff contains no Helius key.
