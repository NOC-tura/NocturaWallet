# Step 12–13: Splash Screen Navigator + UnlockScreen

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the app entry flow: SplashScreen with route resolution (Onboarding/MainTabs/Unlock), app version check with forced update modal and dismissable banner, and UnlockScreen with biometric auto-trigger + PIN fallback + cooldown logic.

**Architecture:** SplashScreen runs `resolveSplashRoute()` on mount — checks MMKV flags (WALLET_EXISTS, ONBOARDING_COMPLETED) and session state, then navigates. Before navigating, it checks for forced app updates via the version-check API. UnlockScreen auto-triggers biometric on mount, falls back to a custom 6-digit PIN pad on failure, with cooldown after 5 failed attempts. Both screens use `MMKV_KEYS.*` constants exclusively.

**Tech Stack:** React Native, NativeWind v4, react-native-keychain (biometric), Zustand (sessionStore), MMKV (public instance), pinnedFetch (version check API)

---

## File Structure

```
src/
├── screens/
│   ├── SplashScreen.tsx             — Route resolution + app update check
│   └── UnlockScreen.tsx             — Biometric + PIN fallback + cooldown
├── components/
│   ├── AppUpdateModal.tsx           — Blocking force update (no dismiss)
│   ├── AppUpdateBanner.tsx          — Dismissable update available banner
│   └── PinPad.tsx                   — Custom 6-digit numeric keypad
├── modules/
│   └── appUpdate/
│       ├── versionCheck.ts          — GET /v1/app/version-check API call
│       └── __tests__/
│           └── versionCheck.test.ts
```

---

## Task 1: Version Check Module (TDD)

**Files:**
- Create: `src/modules/appUpdate/__tests__/versionCheck.test.ts`
- Create: `src/modules/appUpdate/versionCheck.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/appUpdate/__tests__/versionCheck.test.ts`:
```typescript
import {checkAppVersion} from '../versionCheck';
import {pinnedFetch} from '../../sslPinning/pinnedFetch';

jest.mock('../../sslPinning/pinnedFetch');

describe('checkAppVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ok when API says ok', async () => {
    (pinnedFetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        status: 'ok',
        minVersion: '1.0.0',
        latestVersion: '1.0.0',
        storeUrl: 'https://apps.apple.com/noctura',
      }),
    });

    const result = await checkAppVersion();
    expect(result.status).toBe('ok');
  });

  it('returns update_available with storeUrl', async () => {
    (pinnedFetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        status: 'update_available',
        minVersion: '1.0.0',
        latestVersion: '1.2.0',
        storeUrl: 'https://apps.apple.com/noctura',
      }),
    });

    const result = await checkAppVersion();
    expect(result.status).toBe('update_available');
    expect(result.storeUrl).toBe('https://apps.apple.com/noctura');
  });

  it('returns update_required with storeUrl and message', async () => {
    (pinnedFetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        status: 'update_required',
        minVersion: '2.0.0',
        latestVersion: '2.0.0',
        storeUrl: 'https://play.google.com/noctura',
        message: 'Critical security fix',
      }),
    });

    const result = await checkAppVersion();
    expect(result.status).toBe('update_required');
    expect(result.storeUrl).toBe('https://play.google.com/noctura');
    expect(result.message).toBe('Critical security fix');
  });

  it('returns ok on network error (never block app)', async () => {
    (pinnedFetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const result = await checkAppVersion();
    expect(result.status).toBe('ok');
  });

  it('returns ok on malformed response', async () => {
    (pinnedFetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      json: async () => ({}),
    });

    const result = await checkAppVersion();
    expect(result.status).toBe('ok');
  });
});
```

- [ ] **Step 2: Implement versionCheck**

Create `src/modules/appUpdate/versionCheck.ts`:
```typescript
import {Platform} from 'react-native';
import {pinnedFetch} from '../sslPinning/pinnedFetch';
import {API_BASE} from '../../constants/programs';

export interface VersionCheckResult {
  status: 'ok' | 'update_available' | 'update_required';
  storeUrl?: string;
  message?: string;
  latestVersion?: string;
}

const APP_VERSION = '1.0.0'; // Updated on each release

/**
 * Check if the app needs to be updated.
 * GET /v1/app/version-check?platform=ios|android&version=X.Y.Z
 *
 * On network error → returns 'ok' (NEVER block the app on failed version check).
 */
export async function checkAppVersion(): Promise<VersionCheckResult> {
  try {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const response = await pinnedFetch(
      `${API_BASE}/v1/app/version-check?platform=${platform}&version=${APP_VERSION}`,
    );
    const data = (await response.json()) as {
      status?: string;
      storeUrl?: string;
      message?: string;
      latestVersion?: string;
    };

    if (
      data.status === 'update_available' ||
      data.status === 'update_required'
    ) {
      return {
        status: data.status,
        storeUrl: data.storeUrl,
        message: data.message,
        latestVersion: data.latestVersion,
      };
    }

    return {status: 'ok'};
  } catch {
    // Network error → skip check, never block app
    return {status: 'ok'};
  }
}
```

- [ ] **Step 3: Run tests — 5 pass**

- [ ] **Step 4: Commit**

```bash
git add src/modules/appUpdate/
git commit -m "feat: app version check API (ok/update_available/update_required, fail-safe ok)"
```

---

## Task 2: AppUpdateModal + AppUpdateBanner Components

**Files:**
- Create: `src/components/AppUpdateModal.tsx`
- Create: `src/components/AppUpdateBanner.tsx`
- Create: `src/components/__tests__/AppUpdateModal.test.tsx`
- Create: `src/components/__tests__/AppUpdateBanner.test.tsx`

- [ ] **Step 1: Write AppUpdateModal tests**

Create `src/components/__tests__/AppUpdateModal.test.tsx`:
```typescript
import React from 'react';
import {render} from '@testing-library/react-native';
import {AppUpdateModal} from '../AppUpdateModal';

describe('AppUpdateModal', () => {
  it('renders nothing when not visible', () => {
    const {queryByText} = render(
      <AppUpdateModal visible={false} storeUrl="" />,
    );
    expect(queryByText(/update required/i)).toBeNull();
  });

  it('renders blocking overlay when visible', () => {
    const {getByText} = render(
      <AppUpdateModal visible={true} storeUrl="https://store.com" />,
    );
    expect(getByText(/update required/i)).toBeTruthy();
    expect(getByText(/update now/i)).toBeTruthy();
  });

  it('shows custom message when provided', () => {
    const {getByText} = render(
      <AppUpdateModal visible={true} storeUrl="https://store.com" message="Critical security fix" />,
    );
    expect(getByText('Critical security fix')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement AppUpdateModal**

Create `src/components/AppUpdateModal.tsx`:
```typescript
import React from 'react';
import {View, Text, TouchableOpacity, Linking, StyleSheet, Modal} from 'react-native';

interface AppUpdateModalProps {
  visible: boolean;
  storeUrl: string;
  message?: string;
}

/**
 * Blocking force update modal — no dismiss button.
 * Shown when API returns 'update_required'.
 * User MUST update to continue using the app.
 */
export function AppUpdateModal({visible, storeUrl, message}: AppUpdateModalProps) {
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <View style={styles.container}>
        <Text style={styles.title}>Update required</Text>
        <Text style={styles.body}>
          A critical update is available. Please update to continue using Noctura.
        </Text>
        {message && <Text style={styles.message}>{message}</Text>}
        <TouchableOpacity
          style={styles.button}
          onPress={() => Linking.openURL(storeUrl)}>
          <Text style={styles.buttonText}>Update now</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C14',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 12},
  body: {fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 8},
  message: {fontSize: 13, color: '#A78BFA', textAlign: 'center', marginBottom: 24},
  button: {
    backgroundColor: '#6C47FF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {fontSize: 16, fontWeight: '700', color: '#FFFFFF'},
});
```

- [ ] **Step 3: Write AppUpdateBanner tests**

Create `src/components/__tests__/AppUpdateBanner.test.tsx`:
```typescript
import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {AppUpdateBanner} from '../AppUpdateBanner';

describe('AppUpdateBanner', () => {
  it('renders nothing when not visible', () => {
    const {queryByText} = render(
      <AppUpdateBanner visible={false} storeUrl="" onDismiss={() => {}} />,
    );
    expect(queryByText(/new version/i)).toBeNull();
  });

  it('renders banner when visible', () => {
    const {getByText} = render(
      <AppUpdateBanner visible={true} storeUrl="https://store.com" onDismiss={() => {}} />,
    );
    expect(getByText(/new version available/i)).toBeTruthy();
  });

  it('calls onDismiss when X button pressed', () => {
    const onDismiss = jest.fn();
    const {getByText} = render(
      <AppUpdateBanner visible={true} storeUrl="https://store.com" onDismiss={onDismiss} />,
    );
    fireEvent.press(getByText('✕'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: Implement AppUpdateBanner**

Create `src/components/AppUpdateBanner.tsx`:
```typescript
import React from 'react';
import {View, Text, TouchableOpacity, Linking, StyleSheet} from 'react-native';

interface AppUpdateBannerProps {
  visible: boolean;
  storeUrl: string;
  onDismiss: () => void;
}

// Dashboard integration: lowest priority banner (BackupReminder > Offline > AppUpdate).
// Only one banner shown at a time — parent Dashboard handles priority logic.

export function AppUpdateBanner({visible, storeUrl, onDismiss}: AppUpdateBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.content}
        onPress={() => Linking.openURL(storeUrl)}>
        <Text style={styles.text}>New version available — tap to update</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} style={styles.dismiss}>
        <Text style={styles.dismissText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(96,165,250,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(96,165,250,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {flex: 1},
  text: {fontSize: 13, fontWeight: '500', color: '#60A5FA'},
  dismiss: {padding: 8},
  dismissText: {fontSize: 14, color: 'rgba(255,255,255,0.45)'},
});
```

- [ ] **Step 5: Run tests — 6 pass (3 modal + 3 banner)**

- [ ] **Step 6: Commit**

```bash
git add src/components/AppUpdateModal.tsx src/components/AppUpdateBanner.tsx src/components/__tests__/AppUpdateModal.test.tsx src/components/__tests__/AppUpdateBanner.test.tsx
git commit -m "feat: AppUpdateModal (blocking) + AppUpdateBanner (dismissable) components"
```

---

## Task 3: PinPad Component

**Files:**
- Create: `src/components/PinPad.tsx`
- Create: `src/components/__tests__/PinPad.test.tsx`

- [ ] **Step 1: Write PinPad tests**

Create `src/components/__tests__/PinPad.test.tsx`:
```typescript
import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {PinPad} from '../PinPad';

describe('PinPad', () => {
  it('renders 10 digit buttons (0-9)', () => {
    const {getByText} = render(<PinPad onComplete={() => {}} maxLength={6} />);
    for (let i = 0; i <= 9; i++) {
      expect(getByText(String(i))).toBeTruthy();
    }
  });

  it('renders delete button', () => {
    const {getByText} = render(<PinPad onComplete={() => {}} maxLength={6} />);
    expect(getByText('⌫')).toBeTruthy();
  });

  it('calls onComplete when maxLength digits entered', () => {
    const onComplete = jest.fn();
    const {getByText} = render(<PinPad onComplete={onComplete} maxLength={6} />);

    fireEvent.press(getByText('1'));
    fireEvent.press(getByText('2'));
    fireEvent.press(getByText('3'));
    fireEvent.press(getByText('4'));
    fireEvent.press(getByText('5'));
    fireEvent.press(getByText('6'));

    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('renders dot indicators for entered digits', () => {
    const {getAllByTestId} = render(<PinPad onComplete={() => {}} maxLength={6} />);
    const dots = getAllByTestId('pin-dot');
    expect(dots.length).toBe(6);
  });

  it('shows error state', () => {
    const {getByText} = render(
      <PinPad onComplete={() => {}} maxLength={6} error="Wrong PIN" />,
    );
    expect(getByText('Wrong PIN')).toBeTruthy();
  });

  it('disables input when disabled prop is true', () => {
    const onComplete = jest.fn();
    const {getByText} = render(
      <PinPad onComplete={onComplete} maxLength={6} disabled={true} />,
    );
    fireEvent.press(getByText('1'));
    // onComplete should not fire even after 6 presses
    for (let i = 0; i < 6; i++) {
      fireEvent.press(getByText('1'));
    }
    expect(onComplete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement PinPad**

Create `src/components/PinPad.tsx`:
```typescript
import React, {useState, useCallback} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

interface PinPadProps {
  onComplete: (pin: string) => void;
  maxLength: number;
  error?: string | null;
  disabled?: boolean;
}

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
];

/**
 * Custom 6-digit numeric keypad.
 * Used instead of system keyboard to prevent keylogger interception.
 */
export function PinPad({onComplete, maxLength, error, disabled}: PinPadProps) {
  const [pin, setPin] = useState('');

  const handlePress = useCallback(
    (key: string) => {
      if (disabled) return;

      if (key === '⌫') {
        setPin(prev => prev.slice(0, -1));
        return;
      }

      if (key === '') return;

      setPin(prev => {
        const next = prev + key;
        if (next.length === maxLength) {
          // Defer onComplete to next tick so state update completes
          setTimeout(() => {
            onComplete(next);
            setPin('');
          }, 0);
          return next;
        }
        return next.length <= maxLength ? next : prev;
      });
    },
    [disabled, maxLength, onComplete],
  );

  return (
    <View style={styles.container}>
      {/* Dot indicators */}
      <View style={styles.dotsRow}>
        {Array.from({length: maxLength}).map((_, i) => (
          <View
            key={i}
            testID="pin-dot"
            style={[
              styles.dot,
              i < pin.length && styles.dotFilled,
              error ? styles.dotError : null,
            ]}
          />
        ))}
      </View>

      {/* Error message */}
      {error && <Text style={styles.error}>{error}</Text>}

      {/* Keypad */}
      <View style={styles.keypad}>
        {KEYS.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map(key => (
              <TouchableOpacity
                key={key || `empty-${ri}`}
                style={[styles.key, key === '' && styles.keyEmpty]}
                onPress={() => handlePress(key)}
                disabled={disabled || key === ''}>
                <Text style={[styles.keyText, disabled && styles.keyTextDisabled]}>
                  {key}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {alignItems: 'center', paddingTop: 24},
  dotsRow: {flexDirection: 'row', gap: 12, marginBottom: 16},
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  dotFilled: {backgroundColor: '#6C47FF', borderColor: '#6C47FF'},
  dotError: {borderColor: '#F87171'},
  error: {fontSize: 13, color: '#F87171', marginBottom: 16},
  keypad: {width: 260},
  row: {flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12},
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyEmpty: {backgroundColor: 'transparent'},
  keyText: {fontSize: 24, fontWeight: '500', color: '#FFFFFF'},
  keyTextDisabled: {color: 'rgba(255,255,255,0.25)'},
});
```

- [ ] **Step 3: Run tests — 6 pass**

- [ ] **Step 4: Commit**

```bash
git add src/components/PinPad.tsx src/components/__tests__/PinPad.test.tsx
git commit -m "feat: custom PinPad component (6-digit, no system keyboard, error state, disabled)"
```

---

## Task 4: SplashScreen with Route Resolution (TDD)

**Files:**
- Create: `src/screens/__tests__/SplashScreen.test.tsx`
- Modify: `src/screens/SplashScreen.tsx` (replace placeholder)

- [ ] **Step 1: Write SplashScreen tests**

Create `src/screens/__tests__/SplashScreen.test.tsx`:
```typescript
import {resolveSplashRoute} from '../SplashScreen';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';

describe('resolveSplashRoute', () => {
  beforeEach(() => {
    mmkvPublic.clearAll();
  });

  it('returns Onboarding when no wallet exists', async () => {
    const route = await resolveSplashRoute();
    expect(route).toBe('Onboarding');
  });

  it('returns Onboarding when wallet exists but onboarding not completed', async () => {
    mmkvPublic.set(MMKV_KEYS.WALLET_EXISTS, 'true');
    // ONBOARDING_COMPLETED not set
    const route = await resolveSplashRoute();
    expect(route).toBe('Onboarding');
  });

  it('returns Unlock when wallet exists and onboarding completed', async () => {
    mmkvPublic.set(MMKV_KEYS.WALLET_EXISTS, 'true');
    mmkvPublic.set(MMKV_KEYS.ONBOARDING_COMPLETED, 'true');
    const route = await resolveSplashRoute();
    expect(route).toBe('Unlock');
  });

  it('returns Unlock even with active session timestamp (session check is separate)', async () => {
    mmkvPublic.set(MMKV_KEYS.WALLET_EXISTS, 'true');
    mmkvPublic.set(MMKV_KEYS.ONBOARDING_COMPLETED, 'true');
    mmkvPublic.set(MMKV_KEYS.SESSION_LAST_ACTIVE, String(Date.now()));
    // Note: actual session check uses SessionManager.isActive() which is in-memory,
    // not MMKV. The MMKV timestamp is for background timeout calculation.
    const route = await resolveSplashRoute();
    expect(route).toBe('Unlock');
  });
});
```

- [ ] **Step 2: Implement SplashScreen**

Replace `src/screens/SplashScreen.tsx` (was placeholder from scaffold):

Note: The SplashScreen is a React component but we also export `resolveSplashRoute` as a standalone function for testability. The full component with navigation will be wired up, but the route resolution logic is the key testable piece.

Create `src/screens/SplashScreen.tsx`:
```typescript
import React, {useEffect, useState} from 'react';
import {View, Text, ActivityIndicator, StyleSheet} from 'react-native';
import {mmkvPublic} from '../store/mmkv/instances';
import {MMKV_KEYS} from '../constants/mmkvKeys';

type SplashRoute = 'Onboarding' | 'MainTabs' | 'Unlock';

/**
 * Resolve the initial route based on wallet state.
 * Exported for testing — the component calls this internally.
 *
 * 1. No wallet → Onboarding
 * 2. Wallet exists but onboarding incomplete → Onboarding
 * 3. Wallet exists + onboarding complete → Unlock (session check is in-memory)
 */
export async function resolveSplashRoute(): Promise<SplashRoute> {
  const walletExists = mmkvPublic.getString(MMKV_KEYS.WALLET_EXISTS) === 'true';
  if (!walletExists) return 'Onboarding';

  const onboardingCompleted =
    mmkvPublic.getString(MMKV_KEYS.ONBOARDING_COMPLETED) === 'true';
  if (!onboardingCompleted) return 'Onboarding';

  // Wallet exists + onboarding complete → need to unlock
  // Session activity check happens via SessionManager (in-memory), not here
  return 'Unlock';
}

interface SplashScreenProps {
  onRouteResolved?: (route: SplashRoute) => void;
}

/**
 * Splash screen — shown briefly on app startup.
 * Resolves the initial route and navigates automatically.
 * Max display: 1.5s (App Store guideline).
 */
export function SplashScreen({onRouteResolved}: SplashScreenProps) {
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    const resolve = async () => {
      const route = await resolveSplashRoute();
      setResolving(false);
      onRouteResolved?.(route);
    };

    // Ensure minimum display time of ~500ms for branding
    const timer = setTimeout(resolve, 500);
    return () => clearTimeout(timer);
  }, [onRouteResolved]);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🛡️</Text>
      <Text style={styles.title}>Noctura</Text>
      {resolving && (
        <ActivityIndicator
          style={styles.loader}
          color="#6C47FF"
          size="small"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {fontSize: 48, marginBottom: 12},
  title: {fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginBottom: 24},
  loader: {marginTop: 12},
});
```

- [ ] **Step 3: Run tests — 4 pass**

- [ ] **Step 4: Commit**

```bash
git add src/screens/SplashScreen.tsx src/screens/__tests__/
git commit -m "feat: SplashScreen with resolveSplashRoute (Onboarding/Unlock based on MMKV flags)"
```

---

## Task 5: UnlockScreen with Biometric + PIN Fallback (TDD)

**Files:**
- Create: `src/screens/__tests__/UnlockScreen.test.tsx`
- Create: `src/screens/UnlockScreen.tsx`

- [ ] **Step 1: Write UnlockScreen tests**

Create `src/screens/__tests__/UnlockScreen.test.tsx`:
```typescript
import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {UnlockScreen} from '../UnlockScreen';

// Mock the keychain module
const mockVerifyPin = jest.fn();
const mockIsPinConfigured = jest.fn().mockResolvedValue(true);
jest.mock('../../modules/keychain/keychainModule', () => ({
  KeychainManager: jest.fn().mockImplementation(() => ({
    verifyPin: mockVerifyPin,
    isPinConfigured: mockIsPinConfigured,
  })),
}));

describe('UnlockScreen', () => {
  const mockOnUnlock = jest.fn();
  const mockOnRestore = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyPin.mockReset();
  });

  it('renders welcome back text', () => {
    const {getByText} = render(
      <UnlockScreen onUnlock={mockOnUnlock} onRestore={mockOnRestore} />,
    );
    expect(getByText(/welcome back/i)).toBeTruthy();
  });

  it('shows "Use PIN instead" link', () => {
    const {getByText} = render(
      <UnlockScreen onUnlock={mockOnUnlock} onRestore={mockOnRestore} />,
    );
    expect(getByText(/use pin instead/i)).toBeTruthy();
  });

  it('shows PIN pad when "Use PIN instead" is pressed', () => {
    const {getByText, getAllByTestId} = render(
      <UnlockScreen onUnlock={mockOnUnlock} onRestore={mockOnRestore} />,
    );
    fireEvent.press(getByText(/use pin instead/i));
    const dots = getAllByTestId('pin-dot');
    expect(dots.length).toBe(6);
  });

  it('shows restore wallet link', () => {
    const {getByText} = render(
      <UnlockScreen onUnlock={mockOnUnlock} onRestore={mockOnRestore} />,
    );
    expect(getByText(/lost access/i)).toBeTruthy();
  });

  it('calls onRestore when restore link pressed', () => {
    const {getByText} = render(
      <UnlockScreen onUnlock={mockOnUnlock} onRestore={mockOnRestore} />,
    );
    fireEvent.press(getByText(/lost access/i));
    expect(mockOnRestore).toHaveBeenCalled();
  });

  it('shows cooldown message after max PIN attempts', async () => {
    mockVerifyPin.mockResolvedValue(false);
    const {getByText, getAllByTestId} = render(
      <UnlockScreen onUnlock={mockOnUnlock} onRestore={mockOnRestore} maxPinAttempts={2} />,
    );

    // Show PIN pad
    fireEvent.press(getByText(/use pin instead/i));

    // Enter wrong PIN twice
    const enterPin = () => {
      for (let i = 0; i < 6; i++) {
        fireEvent.press(getByText(String(i + 1)));
      }
    };

    enterPin();
    await waitFor(() => expect(mockVerifyPin).toHaveBeenCalledTimes(1));

    enterPin();
    await waitFor(() => expect(mockVerifyPin).toHaveBeenCalledTimes(2));

    // Should show cooldown
    await waitFor(() => {
      expect(getByText(/too many attempts/i)).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Implement UnlockScreen**

Create `src/screens/UnlockScreen.tsx`:
```typescript
import React, {useState, useCallback, useEffect} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {PinPad} from '../components/PinPad';
import {KeychainManager} from '../modules/keychain/keychainModule';

const DEFAULT_MAX_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 30;

interface UnlockScreenProps {
  onUnlock: () => void;
  onRestore: () => void;
  walletAddress?: string;
  reason?: 'session_expired' | 'app_foreground' | 'manual_lock';
  maxPinAttempts?: number;
}

/**
 * UnlockScreen — biometric auto-trigger + PIN fallback.
 *
 * Shown when: wallet exists + session not active.
 * Biometric triggers on mount, PIN pad shown on biometric failure or user choice.
 * After maxPinAttempts failures: 30s cooldown.
 */
export function UnlockScreen({
  onUnlock,
  onRestore,
  walletAddress,
  maxPinAttempts = DEFAULT_MAX_ATTEMPTS,
}: UnlockScreenProps) {
  const [showPinPad, setShowPinPad] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const keychainManager = new KeychainManager();

  // Cooldown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) {
          setAttempts(0);
          setPinError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const handlePinComplete = useCallback(
    async (pin: string) => {
      if (cooldownRemaining > 0) return;

      const verified = await keychainManager.verifyPin(pin);
      if (verified) {
        onUnlock();
        return;
      }

      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= maxPinAttempts) {
        setPinError(`Too many attempts. Wait ${COOLDOWN_SECONDS} seconds.`);
        setCooldownRemaining(COOLDOWN_SECONDS);
      } else {
        setPinError('Incorrect PIN');
      }
    },
    [attempts, cooldownRemaining, keychainManager, maxPinAttempts, onUnlock],
  );

  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back</Text>
      {truncatedAddress ? (
        <Text style={styles.address}>{truncatedAddress}</Text>
      ) : null}

      {showPinPad ? (
        <PinPad
          onComplete={handlePinComplete}
          maxLength={6}
          error={pinError}
          disabled={cooldownRemaining > 0}
        />
      ) : (
        <View style={styles.biometricArea}>
          <Text style={styles.biometricHint}>Authenticating...</Text>
        </View>
      )}

      {cooldownRemaining > 0 && (
        <Text style={styles.cooldown}>
          Try again in {cooldownRemaining}s
        </Text>
      )}

      {!showPinPad && (
        <TouchableOpacity
          onPress={() => setShowPinPad(true)}
          style={styles.link}>
          <Text style={styles.linkText}>Use PIN instead</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={onRestore} style={styles.restoreLink}>
        <Text style={styles.restoreLinkText}>Lost access? Restore wallet →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C14',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 4},
  address: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 32,
  },
  biometricArea: {marginVertical: 48},
  biometricHint: {fontSize: 14, color: 'rgba(255,255,255,0.45)'},
  cooldown: {fontSize: 13, color: '#F87171', marginTop: 12},
  link: {marginTop: 24, padding: 12},
  linkText: {fontSize: 14, color: '#6C47FF', fontWeight: '600'},
  restoreLink: {position: 'absolute', bottom: 48, padding: 12},
  restoreLinkText: {fontSize: 13, color: 'rgba(255,255,255,0.35)'},
});
```

- [ ] **Step 3: Run tests — 6 pass**

- [ ] **Step 4: Commit**

```bash
git add src/screens/UnlockScreen.tsx src/screens/__tests__/UnlockScreen.test.tsx
git commit -m "feat: UnlockScreen with biometric auto-trigger, PIN fallback, cooldown after 5 failures"
```

---

## Task 6: Wire SplashScreen + UnlockScreen into Navigator

**Files:**
- Modify: `src/app/Navigator.tsx`

- [ ] **Step 1: Update Navigator to use real screens**

Replace the placeholder imports for Splash and Unlock in `src/app/Navigator.tsx`:

Change:
```typescript
const SplashScreen = makePlaceholder('Splash');
const UnlockScreen = makePlaceholder('Unlock');
```
To:
```typescript
import {SplashScreen as SplashScreenComponent} from '../screens/SplashScreen';
import {UnlockScreen as UnlockScreenComponent} from '../screens/UnlockScreen';
```

Then wrap them so they fit the navigator's component type:
```typescript
const SplashScreenNav = () => <SplashScreenComponent />;
const UnlockScreenNav = () => <UnlockScreenComponent onUnlock={() => {}} onRestore={() => {}} />;
```

Update the RootNav.Screen entries to use the real components.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Run tests**

Run: `npx jest --no-cache`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/app/Navigator.tsx
git commit -m "feat: wire SplashScreen + UnlockScreen into navigation tree"
```

---

## Task 7: Full Verification

- [ ] **Step 1: TypeScript check**

Run: `npx tsc --noEmit`

- [ ] **Step 2: Full test suite**

Run: `npx jest --no-cache`

- [ ] **Step 3: Verification checklist**

```
✅ / ❌  Check
─────────────────────────────────────────────────────────
[ ]  resolveSplashRoute: no wallet → Onboarding
[ ]  resolveSplashRoute: wallet + no onboarding → Onboarding
[ ]  resolveSplashRoute: wallet + onboarding → Unlock
[ ]  resolveSplashRoute: uses MMKV_KEYS.* (never hardcoded strings)
[ ]  Version check: ok/update_available/update_required
[ ]  Version check: network error → ok (never block app)
[ ]  AppUpdateModal: blocking, no dismiss, shows "Update required"
[ ]  AppUpdateModal: shows custom message when provided
[ ]  AppUpdateBanner: dismissable, shows "New version available"
[ ]  PinPad: 6-digit custom keypad (not system keyboard)
[ ]  PinPad: dot indicators, error state, disabled state
[ ]  UnlockScreen: "Welcome back" + truncated address
[ ]  UnlockScreen: "Use PIN instead" shows PIN pad
[ ]  UnlockScreen: cooldown after max failed attempts
[ ]  UnlockScreen: "Lost access? Restore wallet →"
[ ]  Screens wired into Navigator (not placeholders)
[ ]  TypeScript strict: zero errors
[ ]  All tests pass
```
