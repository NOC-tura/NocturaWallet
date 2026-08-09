import React from 'react';
import {render, fireEvent, act, waitFor, screen} from '@testing-library/react-native';
import {UnlockScreen} from '../UnlockScreen';

// UnlockScreen constructs its OWN instance (`new KeychainManager()`), so the
// exported singleton is never used. A mock that only stubs the singleton leaves
// `verifyPin` undefined on the instance, and the resulting TypeError vanished
// into the unguarded await — the harness reproduced the production bug by
// accident. Share one spy across both shapes.
const mockVerifyPin = jest.fn();
jest.mock('../../modules/keychain/keychainModule', () => ({
  KeychainManager: jest.fn().mockImplementation(() => ({
    verifyPin: (...args: unknown[]) => mockVerifyPin(...args),
    retrieveSeed: jest.fn().mockRejectedValue(new Error('no biometric in tests')),
  })),
  keychainManager: {verifyPin: (...args: unknown[]) => mockVerifyPin(...args)},
}));

jest.mock('../../modules/keychain/pinLockout', () => ({
  checkCooldown: jest.fn().mockReturnValue({blocked: false}),
  recordFailedAttempt: jest.fn().mockReturnValue({shouldWipeSession: false, cooldownStarted: false}),
  resetAttempts: jest.fn(),
}));

/**
 * Rewritten 2026-08-09. The previous suite was `describe.skip`'d against Phase-2
 * chrome ("Use PIN instead", a legacy restore link) that no longer exists, so
 * the highest-stakes auth surface in the app sat at 5.4% coverage.
 *
 * These test behaviour rather than copy, so a chrome change doesn't skip them
 * again.
 */
describe('UnlockScreen', () => {
  const onUnlock = jest.fn();
  const onRestore = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyPin.mockResolvedValue(false);
  });

  /**
   * Press the keypad by accessibility label — chrome-independent.
   * Presses are NOT individually wrapped in act(): fireEvent already wraps
   * synchronously, and an extra async act between digits lets the hook's
   * closure re-capture a stale `digits`, so the PIN never completes.
   * Mirrors the harness in SetPinScreen.test.tsx, which does drive this keypad.
   */
  const enterPin = async (getByLabelText: (t: string) => any, pin: string) => {
    for (const d of pin) {
      fireEvent.press(getByLabelText(`Digit ${d}`));
    }
    await act(async () => {
      await Promise.resolve();
    });
  };

  it('renders and accepts PIN entry', () => {
    const {getByTestId} = render(
      <UnlockScreen onUnlock={onUnlock} onRestore={onRestore} />,
    );
    expect(getByTestId('unlock-screen')).toBeTruthy();
  });

  it('unlocks when the PIN verifies', async () => {
    mockVerifyPin.mockResolvedValue(true);
    const {getByLabelText} = render(
      <UnlockScreen onUnlock={onUnlock} onRestore={onRestore} />,
    );
    await enterPin(getByLabelText, '123456');
    await waitFor(() => expect(onUnlock).toHaveBeenCalled());
  });

  it('does not unlock on a wrong PIN', async () => {
    const {getByLabelText} = render(
      <UnlockScreen onUnlock={onUnlock} onRestore={onRestore} />,
    );
    await enterPin(getByLabelText, '999999');
    await waitFor(() => expect(mockVerifyPin).toHaveBeenCalled());
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('SURVIVES verifyPin throwing while a persisted cooldown is active', async () => {
    // The lockout counter lives in MMKV and survives an app restart; the React
    // `cooldownRemaining` does not. So after 5 failures and a relaunch the
    // screen believes it is not cooling down, calls verifyPin, and verifyPin
    // throws ("Too many incorrect attempts. Try again in Ns").
    //
    // There was no try/catch: the rejection was unhandled, the dots reset, and
    // the user saw no error and no countdown — a silent dead end on the app's
    // primary auth surface.
    mockVerifyPin.mockRejectedValue(
      new Error('Too many incorrect attempts. Try again in 27s'),
    );
    const {getByLabelText} = render(
      <UnlockScreen onUnlock={onUnlock} onRestore={onRestore} />,
    );

    await enterPin(getByLabelText, '123456');

    await waitFor(() => expect(mockVerifyPin).toHaveBeenCalled());
    expect(onUnlock).not.toHaveBeenCalled();
    // The message must reach the user rather than vanishing into a rejection.
    await waitFor(() =>
      expect(screen.getByText(/too many incorrect attempts/i)).toBeTruthy(),
    );
  });
});
