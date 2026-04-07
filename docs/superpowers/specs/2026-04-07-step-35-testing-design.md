# Step 35: E2E Tests + Accessibility Audit + CI Pipeline

## Overview

Quality gate step: Detox E2E test suite (9 flows), accessibility audit with fixes across all interactive components, and GitHub Actions CI pipeline (lint, typecheck, unit tests, audit, Detox smoke).

---

## Section 1: Detox E2E Setup + Tests

### Setup

- `detox.config.js` — iOS simulator (iPhone 16, iOS 18.0) + Android emulator (Pixel 7, API 34)
- `e2e/jest.config.js` — separate Jest config using `@detox/jest-circus` test runner
- `e2e/environment.js` — Detox test environment adapter

### Test Files (9)

All tests use Detox's `element(by.id(...))` API matching `testID` props already present in screens.

1. **`e2e/onboarding.test.ts`** — Create wallet flow: Welcome → SecurityIntro → SetPin (6 digits) → seed display → ConfirmSeed → Success. Verifies navigation through all steps and landing on Dashboard.

2. **`e2e/importWallet.test.ts`** — Import mnemonic flow: tap "Import" on Welcome → enter 12/24 words → set PIN → sync → optional cloud restore prompt. Verifies wallet address appears on dashboard.

3. **`e2e/transparentSend.test.ts`** — Send SOL: Dashboard → Send → enter recipient + amount → review step → confirm → "Securing transaction..." overlay → success screen. Mocked transaction builder.

4. **`e2e/shieldedFlow.test.ts`** — Deposit → Transfer → Withdraw sequence: navigate to each screen, verify titles ("Move to private balance", "Send privately", "Move to public balance"), confirm state transitions.

5. **`e2e/staking.test.ts`** — Navigate to Staking tab → verify staking screen renders → initiate stake flow (mock program interaction).

6. **`e2e/sessionLock.test.ts`** — Verify auto-lock: simulate background → foreground → UnlockScreen appears → enter PIN → dashboard restored.

7. **`e2e/deepLink.test.ts`** — Open `noctura://pay?to=...&amount=...` → verify SendScreen pre-filled with recipient and amount.

8. **`e2e/backup.test.ts`** — Settings → Backup → enable cloud toggle → force backup → verify timestamp updates.

9. **`e2e/notifications.test.ts`** — Mock notification payload → tap → verify correct screen navigation (incoming_tx → Dashboard, security_alert → Settings).

### Constraints

E2E tests run against the app with mocked native modules (no real backend/devnet). They validate UI flow, navigation, state transitions, and rendering — not on-chain transactions. API calls are stubbed at the pinnedFetch level.

---

## Section 2: Accessibility Audit + Fixes

### Audit Utility

**`src/utils/accessibilityAudit.ts`** — test-time helper:
- `auditAccessibility(component)` — renders component, walks tree, flags interactive elements (TouchableOpacity, Pressable, TextInput, Switch) missing `accessibilityLabel`
- Returns `{ pass: boolean, violations: { component: string, testID?: string, issue: string }[] }`

### Fixes Required

Add `accessibilityLabel` to every interactive element across:
- All screen files in `src/screens/` (buttons, inputs, toggles)
- All components in `src/components/` (PinPad keys, TokenSelector items, PrivacyMeter dismiss)
- Navigation buttons (back, close)

### Balance Hiding for Screen Readers

Components displaying monetary amounts check `usePublicSettingsStore().hideBalances`:
- When true: set `accessibilityElementsHidden={true}` (iOS) and `importantForAccessibility="no-hide-descendants"` (Android) on balance containers
- Prevents VoiceOver/TalkBack from reading hidden balances aloud

Affected components: BalanceCard, TokenRow, any Text showing SOL/NOC amounts.

### Minimum Touch Target

Verify 44×44pt (iOS) / 48×48dp (Android) on all interactive elements. Fix any undersized targets with `minHeight`/`minWidth` or `hitSlop`.

---

## Section 3: GitHub Actions CI

### `.github/workflows/ci.yml`

Triggers: push to `main`, pull requests to `main`.

**Parallel jobs (ubuntu-latest):**
1. **lint** — `npx eslint .`
2. **typecheck** — `npx tsc --noEmit`
3. **unit-tests** — `npx jest --no-coverage --forceExit`
4. **audit** — `npm audit --production`

**Sequential job (macos-latest, after jobs 1-4):**
5. **detox-ios** — build iOS app → run Detox smoke test (onboarding flow only for CI speed)

Node version: 22.x. Caching: `node_modules` via `actions/cache`.

---

## File Structure

```
.github/
└── workflows/
    └── ci.yml
detox.config.js
e2e/
├── jest.config.js
├── environment.js
├── onboarding.test.ts
├── importWallet.test.ts
├── transparentSend.test.ts
├── shieldedFlow.test.ts
├── staking.test.ts
├── sessionLock.test.ts
├── deepLink.test.ts
├── backup.test.ts
└── notifications.test.ts
src/
└── utils/
    ├── accessibilityAudit.ts
    └── __tests__/
        └── accessibilityAudit.test.ts
```

Plus modifications to existing screen/component files for accessibility labels.

---

## Testing Strategy

- **E2E tests**: Detox tests with mocked native modules — verify navigation, state, rendering
- **Accessibility audit**: Jest unit test using the audit helper on key screens
- **CI validation**: YAML lint + dry-run verification
- **Screen reader tests**: Manual verification checklist (cannot be fully automated)
