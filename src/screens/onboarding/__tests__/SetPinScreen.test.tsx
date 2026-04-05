import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {SetPinScreen} from '../SetPinScreen';

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

  it('shows "Create PIN" or "Set PIN" title', () => {
    const {queryByText} = render(<SetPinScreen onPinSet={onPinSet} />);
    const hasCreate = queryByText(/Create PIN/i);
    const hasSet = queryByText(/Set PIN/i);
    expect(hasCreate || hasSet).toBeTruthy();
  });

  it('after entering 6 digits shows "Confirm PIN" step', async () => {
    const {getByText} = render(<SetPinScreen onPinSet={onPinSet} />);
    await enterPin(getByText, '123456');
    expect(getByText(/Confirm PIN/i)).toBeTruthy();
  });

  it('matching PINs calls onPinSet', async () => {
    const {getByText} = render(<SetPinScreen onPinSet={onPinSet} />);

    // Step 1: enter PIN
    await enterPin(getByText, '123456');

    // Step 2: confirm same PIN
    await enterPin(getByText, '123456');

    expect(onPinSet).toHaveBeenCalledTimes(1);
  });

  it('mismatching PINs shows "PINs don\'t match" error', async () => {
    const {getByText, queryByText} = render(<SetPinScreen onPinSet={onPinSet} />);

    // Step 1
    await enterPin(getByText, '123456');

    // Step 2: different PIN
    await enterPin(getByText, '654321');

    expect(queryByText(/PINs don't match/i)).toBeTruthy();
    expect(onPinSet).not.toHaveBeenCalled();
  });
});
