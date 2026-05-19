import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {SecurityIntroScreen} from '../SecurityIntroScreen';
import {mmkvPublic} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';

/**
 * Phase B migration tests · #2 SecurityIntro.
 *
 * The legacy checkbox-gated consent pattern was replaced by an educational
 * 3-layer + footer-disclaimer pattern per Phase 3 design. Continue is no
 * longer gated by a checkbox; the MMKV ONBOARDING_SECURITY_ACK flag still
 * gets written on Continue tap for App Store audit-trail parity.
 */

function renderScreen(props: Parameters<typeof SecurityIntroScreen>[0]) {
  return render(
    <SafeAreaProvider initialMetrics={{frame: {x: 0, y: 0, width: 393, height: 852}, insets: {top: 0, bottom: 0, left: 0, right: 0}}}>
      <SecurityIntroScreen {...props} />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mmkvPublic.clearAll();
  jest.clearAllMocks();
});

describe('SecurityIntroScreen', () => {
  const onContinue = jest.fn();

  it('shows the new design title "Three layers protect your wallet"', () => {
    const {getByText} = renderScreen({onContinue});
    expect(getByText('Three layers protect your wallet')).toBeTruthy();
  });

  it('shows the lede "You hold the keys. We never can."', () => {
    const {getByText} = renderScreen({onContinue});
    expect(getByText('You hold the keys. We never can.')).toBeTruthy();
  });

  it('shows the three layer card titles', () => {
    const {getByText} = renderScreen({onContinue});
    expect(getByText('Local PIN')).toBeTruthy();
    expect(getByText('Biometric (optional)')).toBeTruthy();
    expect(getByText('Recovery seed')).toBeTruthy();
  });

  it('Continue button is always enabled (no checkbox gate)', () => {
    const {getByTestId} = renderScreen({onContinue});
    const button = getByTestId('continue-button');
    expect(button.props.accessibilityState?.disabled).toBeFalsy();
  });

  it('calls onContinue when Continue button is pressed', () => {
    const {getByText} = renderScreen({onContinue});
    fireEvent.press(getByText('Continue'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('sets MMKV ONBOARDING_SECURITY_ACK on Continue tap', () => {
    const {getByText} = renderScreen({onContinue});
    fireEvent.press(getByText('Continue'));
    expect(mmkvPublic.getString(MMKV_KEYS.ONBOARDING_SECURITY_ACK)).toBe('true');
  });

  it('renders a Back button when onBack prop is provided', () => {
    const onBack = jest.fn();
    const {getByLabelText} = renderScreen({onContinue, onBack});
    const back = getByLabelText('Back');
    fireEvent.press(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows the "1 / 5" step counter', () => {
    const {getByText} = renderScreen({onContinue});
    expect(getByText('1 / 5')).toBeTruthy();
  });
});
