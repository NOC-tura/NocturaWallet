import React from 'react';
import {render, fireEvent, act, waitFor} from '@testing-library/react-native';
import {UnlockScreen} from '../UnlockScreen';

jest.mock('../../modules/keychain/keychainModule', () => {
  return {
    KeychainManager: jest.fn().mockImplementation(() => ({
      verifyPin: jest.fn().mockResolvedValue(false),
    })),
  };
});

describe('UnlockScreen', () => {
  const onUnlock = jest.fn();
  const onRestore = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "Welcome back" text', () => {
    const {getByText} = render(
      <UnlockScreen onUnlock={onUnlock} onRestore={onRestore} />,
    );
    expect(getByText('Authenticating...')).toBeTruthy();
  });

  it('shows "Use PIN instead" link', () => {
    const {getByText} = render(
      <UnlockScreen onUnlock={onUnlock} onRestore={onRestore} />,
    );
    expect(getByText('Use PIN instead')).toBeTruthy();
  });

  it('shows PIN pad when "Use PIN instead" pressed', () => {
    const {getByText} = render(
      <UnlockScreen onUnlock={onUnlock} onRestore={onRestore} />,
    );
    fireEvent.press(getByText('Use PIN instead'));
    expect(getByText('Enter PIN')).toBeTruthy();
  });

  it('shows "Lost access? Restore wallet →" link', () => {
    const {getByText} = render(
      <UnlockScreen onUnlock={onUnlock} onRestore={onRestore} />,
    );
    expect(getByText('Lost access? Restore wallet →')).toBeTruthy();
  });

  it('calls onRestore when restore pressed', () => {
    const {getByText} = render(
      <UnlockScreen onUnlock={onUnlock} onRestore={onRestore} />,
    );
    fireEvent.press(getByText('Lost access? Restore wallet →'));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it('shows cooldown message after max PIN attempts', async () => {
    // Use real timers so setTimeout(0) inside PinPad fires synchronously
    // under act(). The 30s cooldown interval is not tested here.
    const {getByText, getAllByText} = render(
      <UnlockScreen
        onUnlock={onUnlock}
        onRestore={onRestore}
        maxPinAttempts={2}
      />,
    );

    // Switch to PIN mode
    fireEvent.press(getByText('Use PIN instead'));

    const pressDigits = async () => {
      await act(async () => {
        ['1', '2', '3', '4', '5', '6'].forEach(digit => {
          const buttons = getAllByText(digit);
          fireEvent.press(buttons[0]);
        });
        // Flush the setTimeout(0) inside PinPad that triggers onComplete
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    };

    // First wrong attempt
    await pressDigits();

    // Second wrong attempt — should trigger cooldown
    await pressDigits();

    await waitFor(() => {
      expect(
        getByText(/Too many attempts\. Try again in \d+s\./),
      ).toBeTruthy();
    });
  });
});
