import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {SecurityIntroScreen} from '../SecurityIntroScreen';
import {mmkvPublic} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';

beforeEach(() => {
  mmkvPublic.clearAll();
  jest.clearAllMocks();
});

describe('SecurityIntroScreen', () => {
  const onContinue = jest.fn();

  it('shows "Your wallet, your responsibility"', () => {
    const {getByText} = render(<SecurityIntroScreen onContinue={onContinue} />);
    expect(getByText('Your wallet, your responsibility')).toBeTruthy();
  });

  it('shows 3 warning bullet points', () => {
    const {getByText} = render(<SecurityIntroScreen onContinue={onContinue} />);
    expect(
      getByText(
        'If you lose your recovery phrase, you permanently lose access to your funds',
      ),
    ).toBeTruthy();
    expect(
      getByText(
        'Noctura never stores your private keys or recovery phrase',
      ),
    ).toBeTruthy();
    expect(
      getByText(
        'No one — not even Noctura — can recover your wallet for you',
      ),
    ).toBeTruthy();
  });

  it('Continue button is disabled initially', () => {
    const {getByTestId} = render(
      <SecurityIntroScreen onContinue={onContinue} />,
    );
    const button = getByTestId('continue-button');
    expect(button.props.accessibilityState?.disabled).toBe(true);
  });

  it('Continue button enables after checkbox checked', () => {
    const {getByText, getByTestId} = render(
      <SecurityIntroScreen onContinue={onContinue} />,
    );
    fireEvent.press(
      getByText(
        'I understand and accept responsibility for my wallet security',
      ),
    );
    const button = getByTestId('continue-button');
    expect(button.props.accessibilityState?.disabled).toBeFalsy();
  });

  it('calls onContinue when enabled button pressed', () => {
    const {getByText} = render(<SecurityIntroScreen onContinue={onContinue} />);
    fireEvent.press(
      getByText(
        'I understand and accept responsibility for my wallet security',
      ),
    );
    fireEvent.press(getByText('Continue'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('sets MMKV ONBOARDING_SECURITY_ACK flag when checkbox checked', () => {
    const {getByText} = render(<SecurityIntroScreen onContinue={onContinue} />);
    fireEvent.press(
      getByText(
        'I understand and accept responsibility for my wallet security',
      ),
    );
    expect(
      mmkvPublic.getString(MMKV_KEYS.ONBOARDING_SECURITY_ACK),
    ).toBe('true');
  });
});
