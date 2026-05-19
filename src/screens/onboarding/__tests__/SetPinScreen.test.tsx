import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {SetPinScreen} from '../SetPinScreen';

function withSafeArea(node: React.ReactElement) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        insets: {top: 0, bottom: 0, left: 0, right: 0},
        frame: {x: 0, y: 0, width: 0, height: 0},
      }}>
      {node}
    </SafeAreaProvider>
  );
}

jest.mock('../../../modules/keychain/keychainModule', () => ({
  KeychainManager: jest.fn().mockImplementation(() => ({
    setupPin: jest.fn().mockResolvedValue(undefined),
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// Helper: press digit keys on the PinPad to enter a full PIN,
// then flush the setTimeout that PinPad uses to fire onComplete.
async function enterPin(getByText: (text: string | RegExp) => any, pin: string) {
  for (const digit of pin) {
    fireEvent.press(getByText(digit));
  }
  // PinPad fires onComplete via setTimeout 0 — run all pending timers inside act
  await act(async () => {
    jest.runAllTimers();
  });
}

describe('SetPinScreen', () => {
  const onPinSet = jest.fn();

  it('shows the "Create a PIN" title', () => {
    const {queryByText} = render(withSafeArea(<SetPinScreen onPinSet={onPinSet} />));
    expect(queryByText(/Create a PIN/i)).toBeTruthy();
  });

  it('after entering 6 digits shows the "Confirm your PIN" step', async () => {
    const {getByText} = render(withSafeArea(<SetPinScreen onPinSet={onPinSet} />));
    await enterPin(getByText, '123456');
    expect(getByText(/Confirm your PIN/i)).toBeTruthy();
  });

  it('matching PINs calls onPinSet', async () => {
    const {getByText} = render(withSafeArea(<SetPinScreen onPinSet={onPinSet} />));

    // Step 1: enter PIN
    await enterPin(getByText, '123456');

    // Step 2: confirm same PIN
    await enterPin(getByText, '123456');

    expect(onPinSet).toHaveBeenCalledTimes(1);
  });

  it('mismatching PINs shows "PINs don\'t match" error', async () => {
    const {getByText, queryByText} = render(
      withSafeArea(<SetPinScreen onPinSet={onPinSet} />),
    );

    // Step 1
    await enterPin(getByText, '123456');

    // Step 2: different PIN — press digits but DO NOT flush timers yet.
    // The error message auto-clears after a 600 ms setTimeout; if we run all
    // timers immediately the error is gone before we can assert it.
    for (const digit of '654321') {
      fireEvent.press(getByText(digit));
    }
    // Flush React state updates from the press chain, but NOT the auto-reset.
    await act(async () => {
      // single microtask flush; no timer advance
    });

    expect(queryByText(/PINs don't match/i)).toBeTruthy();
    expect(onPinSet).not.toHaveBeenCalled();
  });
});
