# Step 14: Onboarding Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete onboarding flow: Welcome, SecurityIntro, CreateWallet, SeedPhrase (with FLAG_SECURE), ConfirmSeed, SetPin, BiometricSetup, Success (with keychain persist + key derivation), PresaleScreen (3-state), ImportSeed, SyncWallet, PrivacyExplainer. Then wire all screens into the OnboardingStack navigator.

**Architecture:** Each screen is a presentational component with clear props. The onboarding state (generated mnemonic) flows through React state in a parent context — not stored in MMKV until the Success screen's CTA is tapped. The PresaleScreen connects to the live mainnet program via the Solana RPC module. Import flow reuses SecurityIntro and adds ImportSeed → SyncWallet → optional cloud restore.

**Tech Stack:** React Native, NativeWind v4, PinPad component, KeychainManager, mnemonicUtils, deriveTransparentKeypair, deriveShieldedViewKey, ScreenSecurityManager, Zustand stores, MMKV

---

## File Structure

```
src/
├── screens/
│   └── onboarding/
│       ├── WelcomeScreen.tsx
│       ├── SecurityIntroScreen.tsx
│       ├── CreateWalletScreen.tsx
│       ├── SeedPhraseScreen.tsx
│       ├── ConfirmSeedScreen.tsx
│       ├── SetPinScreen.tsx
│       ├── BiometricSetupScreen.tsx
│       ├── SuccessScreen.tsx
│       ├── ImportSeedScreen.tsx
│       ├── SyncWalletScreen.tsx
│       └── __tests__/
│           ├── WelcomeScreen.test.tsx
│           ├── SecurityIntroScreen.test.tsx
│           ├── ConfirmSeedScreen.test.tsx
│           ├── SetPinScreen.test.tsx
│           └── SuccessScreen.test.tsx
│   ├── PresaleScreen.tsx
│   └── PrivacyExplainerScreen.tsx
├── contexts/
│   └── OnboardingContext.tsx          — Shared mnemonic state during onboarding
```

---

## Task 1: OnboardingContext — Shared Mnemonic State

**Files:**
- Create: `src/contexts/OnboardingContext.tsx`

The mnemonic lives in React context during onboarding — NEVER in MMKV or keychain until Success screen.

- [ ] **Step 1: Create OnboardingContext**

Create `src/contexts/OnboardingContext.tsx`:
```typescript
import React, {createContext, useContext, useState, useCallback} from 'react';

interface OnboardingState {
  mnemonic: string | null;
  setMnemonic: (m: string) => void;
  clearMnemonic: () => void;
  isImport: boolean;
  setIsImport: (v: boolean) => void;
}

const OnboardingContext = createContext<OnboardingState | null>(null);

export function OnboardingProvider({children}: {children: React.ReactNode}) {
  const [mnemonic, setMnemonicState] = useState<string | null>(null);
  const [isImport, setIsImport] = useState(false);

  const setMnemonic = useCallback((m: string) => setMnemonicState(m), []);
  const clearMnemonic = useCallback(() => setMnemonicState(null), []);

  return (
    <OnboardingContext.Provider
      value={{mnemonic, setMnemonic, clearMnemonic, isImport, setIsImport}}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingState {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be inside OnboardingProvider');
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/contexts/
git commit -m "feat: OnboardingContext for shared mnemonic state (memory-only until Success)"
```

---

## Task 2: WelcomeScreen + SecurityIntroScreen (TDD)

**Files:**
- Create: `src/screens/onboarding/WelcomeScreen.tsx`
- Create: `src/screens/onboarding/SecurityIntroScreen.tsx`
- Create: `src/screens/onboarding/__tests__/WelcomeScreen.test.tsx`
- Create: `src/screens/onboarding/__tests__/SecurityIntroScreen.test.tsx`

### WelcomeScreen tests:
1. Shows "Welcome to Noctura"
2. Shows "Create new wallet" button
3. Shows "Import existing wallet" button
4. Calls onCreate when create pressed
5. Calls onImport when import pressed

### WelcomeScreen implementation:
- Props: `{onCreate: () => void, onImport: () => void}`
- Noctura logo + "Welcome to Noctura" + "Your private Solana wallet"
- Two buttons: primary accent gradient + ghost

### SecurityIntroScreen tests:
1. Shows "Your wallet, your responsibility"
2. Shows 3 warning bullet points
3. Continue button is disabled initially
4. Continue button enables after checkbox checked
5. Calls onContinue when enabled button pressed
6. Sets MMKV flag on checkbox

### SecurityIntroScreen implementation:
- Props: `{onContinue: () => void}`
- 3 ❗ warning bullet points (exact text from spec)
- Checkbox: "I understand and accept responsibility for my wallet security"
- CTA "Continue" disabled until checkbox checked
- On checkbox: `mmkvPublic.set(MMKV_KEYS.ONBOARDING_SECURITY_ACK, 'true')`

Commit: `git commit -m "feat: WelcomeScreen + SecurityIntroScreen with mandatory acknowledgment"`

---

## Task 3: CreateWalletScreen + SeedPhraseScreen

**Files:**
- Create: `src/screens/onboarding/CreateWalletScreen.tsx`
- Create: `src/screens/onboarding/SeedPhraseScreen.tsx`

### CreateWalletScreen:
- Props: `{onMnemonicGenerated: (mnemonic: string) => void}`
- On mount: `generateMnemonic()` → store in context → auto-navigate
- UI: logo + loading spinner, max 1s

### SeedPhraseScreen tests:
1. Renders 24 word cells
2. Words are blurred by default
3. Shows "I've written them down" CTA
4. Shows security warnings

### SeedPhraseScreen:
- Props: `{mnemonic: string, onConfirm: () => void}`
- 3×8 grid, all blurred by default
- Tap cell → reveal that word only
- FLAG_SECURE on mount/unmount via ScreenSecurityManager
- Warnings: 3 ❗ visible, not dismissable
- CTA "I've written them down"
- Sets MMKV_KEYS.ONBOARDING_SEED_DISPLAYED = true

Commit: `git commit -m "feat: CreateWalletScreen (mnemonic gen) + SeedPhraseScreen (blur grid, FLAG_SECURE)"`

---

## Task 4: ConfirmSeedScreen (TDD)

**Files:**
- Create: `src/screens/onboarding/ConfirmSeedScreen.tsx`
- Create: `src/screens/onboarding/__tests__/ConfirmSeedScreen.test.tsx`

### Tests:
1. Shows 3 word positions to verify
2. Shows shuffled word grid
3. Correct selection → success
4. Incorrect selection → error message
5. After 3 failures → calls onBackToSeed

### Implementation:
- Props: `{mnemonic: string, onSuccess: () => void, onBackToSeed: () => void}`
- Pick 3 random word indices (e.g., 3, 7, 11)
- Show shuffled grid of all 24 words
- User taps words in order matching the indices
- Correct → green ✓ → onSuccess()
- Wrong → shake + "Incorrect — try again"
- 3 failures → onBackToSeed()
- Sets MMKV_KEYS.ONBOARDING_SEED_CONFIRMED = true on success

Commit: `git commit -m "feat: ConfirmSeedScreen (3-word verification, shuffle grid, 3-failure back)"`

---

## Task 5: SetPinScreen + BiometricSetupScreen (TDD)

**Files:**
- Create: `src/screens/onboarding/SetPinScreen.tsx`
- Create: `src/screens/onboarding/BiometricSetupScreen.tsx`
- Create: `src/screens/onboarding/__tests__/SetPinScreen.test.tsx`

### SetPinScreen tests:
1. Shows "Enter PIN" title
2. Shows PinPad with 6-digit
3. After first PIN → shows "Confirm PIN"
4. Matching PINs → calls onPinSet
5. Mismatching PINs → shows error "PINs don't match"

### SetPinScreen:
- Props: `{onPinSet: (pin: string) => void}`
- Two-step: Enter PIN → Confirm PIN
- Uses PinPad component (6-digit)
- Mismatch → "PINs don't match — try again" → reset both
- On match → `keychainManager.setupPin(pin)` → onPinSet(pin)

### BiometricSetupScreen:
- Props: `{onEnable: () => void, onSkip: () => void}`
- FaceID/Fingerprint icon placeholder
- "Enable biometrics for faster access"
- "Enable" primary button → onEnable()
- "Skip for now" ghost → onSkip()

Commit: `git commit -m "feat: SetPinScreen (6-digit PinPad, confirm step) + BiometricSetupScreen"`

---

## Task 6: SuccessScreen — Keychain Persist + Key Derivation (TDD)

**Files:**
- Create: `src/screens/onboarding/SuccessScreen.tsx`
- Create: `src/screens/onboarding/__tests__/SuccessScreen.test.tsx`

### Tests:
1. Shows "Wallet created!" text
2. Shows "Enter wallet" CTA
3. Calls onComplete when CTA pressed

### Implementation:
- Props: `{mnemonic: string, onComplete: () => void}`
- UI: animated checkmark (placeholder), "Wallet created!", "Enter wallet" CTA
- On CTA tap (the CRITICAL sequence):
  1. `keychainManager.storeSeed(mnemonic)` — save to keychain
  2. `mnemonicToSeed(mnemonic)` → seed
  3. `deriveTransparentKeypair(seed)` → publicKey
  4. `deriveShieldedViewKey(seed)` → viewKey
  5. `keychainManager.storeViewKey(viewKey)`
  6. `useWalletStore.getState().setPublicKey(base58(publicKey))`
  7. `mmkvPublic.set(MMKV_KEYS.WALLET_EXISTS, 'true')`
  8. `mmkvPublic.set(MMKV_KEYS.ONBOARDING_COMPLETED, 'true')`
  9. `initSecureMmkv(derivedEncryptionKey)` — initialize encrypted MMKV
  10. `onComplete()`

Commit: `git commit -m "feat: SuccessScreen with keychain persist, key derivation, store initialization"`

---

## Task 7: ImportSeedScreen + SyncWalletScreen

**Files:**
- Create: `src/screens/onboarding/ImportSeedScreen.tsx`
- Create: `src/screens/onboarding/SyncWalletScreen.tsx`

### ImportSeedScreen:
- Props: `{onMnemonicValidated: (mnemonic: string) => void}`
- TextInput for pasting full mnemonic string
- Auto-detect 12 or 24 words
- BIP-39 validation (inline, using validateMnemonic)
- Inline error: "Word N is not a valid BIP-39 word"
- CTA "Continue" disabled until valid mnemonic
- FLAG_SECURE active

### SyncWalletScreen:
- Props: `{mnemonic: string, onSyncComplete: () => void}`
- Animated loading steps:
  1. "Deriving keys..." → ✓ (instant)
  2. "Loading balances..." → ✓ (~1s)
  3. "Checking staking position..." → ✓ (~1s)
  4. "Scanning transaction history..." → ✓ (~2s)
  5. "Ready!" → onSyncComplete()
- Max 5s timeout → onSyncComplete() anyway
- Derives keys, fetches balances, updates stores

Commit: `git commit -m "feat: ImportSeedScreen (BIP-39 validation) + SyncWalletScreen (animated sync)"`

---

## Task 8: PresaleScreen (3-state) + PrivacyExplainerScreen

**Files:**
- Create: `src/screens/PresaleScreen.tsx`
- Create: `src/screens/PrivacyExplainerScreen.tsx`

### PresaleScreen:
- Props: `{onSkip: () => void, onComplete: () => void}`
- 3 states based on TGE status:
  - State A: Presale active → "Buy NOC" + stage info + skip
  - State B: Post-TGE claim → "Claim Your NOC Tokens"
  - State C: Fully claimed → "All Claimed ✓" + quick actions
- For scaffold: show State A UI with mock stage data (real program integration in later step)
- "Skip" button → onSkip()

### PrivacyExplainerScreen:
- Props: `{onDismiss: () => void}`
- "Privacy Mode" heading
- 3 bullet points (user language, no ZK jargon)
- "How it works" explanation
- "Learn more" + "Got it →" buttons

Commit: `git commit -m "feat: PresaleScreen (3-state) + PrivacyExplainerScreen (no ZK jargon)"`

---

## Task 9: Wire All Screens into Navigator

**Files:**
- Modify: `src/app/Navigator.tsx`

Replace ALL remaining onboarding placeholders with real screens. Wrap OnboardingStack in OnboardingProvider.

- [ ] **Step 1: Update Navigator imports and OnboardingStack**

Replace makePlaceholder calls for all onboarding screens with real imports. Wrap OnboardingStack content with `<OnboardingProvider>`.

- [ ] **Step 2: Verify TypeScript compiles + tests pass**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: wire all onboarding screens into Navigator with OnboardingProvider"
```

---

## Task 10: Full Verification

- [ ] **Step 1: TypeScript check**
- [ ] **Step 2: Full test suite**
- [ ] **Step 3: Verification checklist**

```
✅ / ❌  Check
─────────────────────────────────────────────────────────
[ ]  WelcomeScreen: "Welcome to Noctura" + create/import buttons
[ ]  SecurityIntroScreen: 3 ❗ warnings + mandatory checkbox + MMKV flag
[ ]  CreateWalletScreen: generateMnemonic(256) → 24 words, memory only
[ ]  SeedPhraseScreen: 3×8 grid, blur default, tap to reveal, FLAG_SECURE
[ ]  SeedPhraseScreen: warnings visible, "I've written them down" CTA
[ ]  ConfirmSeedScreen: 3 random positions, shuffled grid
[ ]  ConfirmSeedScreen: 3 failures → back to seed display
[ ]  SetPinScreen: 6-digit PinPad, enter → confirm → match check
[ ]  BiometricSetupScreen: Enable (primary) + Skip (ghost)
[ ]  SuccessScreen: saves mnemonic to keychain ONLY on CTA tap
[ ]  SuccessScreen: derives Ed25519 + BLS view key
[ ]  SuccessScreen: sets WALLET_EXISTS + ONBOARDING_COMPLETED in MMKV
[ ]  ImportSeedScreen: BIP-39 validation, inline errors, FLAG_SECURE
[ ]  SyncWalletScreen: animated steps, 5s timeout
[ ]  PresaleScreen: 3 states (active/claim/claimed)
[ ]  PrivacyExplainerScreen: user language, no ZK jargon
[ ]  OnboardingContext: mnemonic in memory only until Success
[ ]  All screens wired into Navigator
[ ]  TypeScript strict: zero errors
[ ]  All tests pass
```
