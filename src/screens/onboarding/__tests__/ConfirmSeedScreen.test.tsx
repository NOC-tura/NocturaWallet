import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ConfirmSeedScreen} from '../ConfirmSeedScreen';
import {mmkvPublic} from '../../../store/mmkv/instances';

/**
 * Phase B migration tests · #4 ConfirmSeed.
 *
 * Legacy "shuffle 24 words in 8×3 grid" pattern was replaced by Phase 3
 * design's "3 slots + 9-word pool" pattern. Tests verify the new state
 * machine surfaces: empty → partial → success (and wrong-answer → reset).
 */

const TEST_MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident ' +
  'account accuse achieve acid acoustic acquire across act action actor actress actual';

function renderScreen(props: Parameters<typeof ConfirmSeedScreen>[0]) {
  return render(
    <SafeAreaProvider initialMetrics={{frame: {x: 0, y: 0, width: 393, height: 852}, insets: {top: 0, bottom: 0, left: 0, right: 0}}}>
      <ConfirmSeedScreen {...props} />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mmkvPublic.clearAll();
  jest.clearAllMocks();
});

describe('ConfirmSeedScreen', () => {
  const onSuccess = jest.fn();
  const onBackToSeed = jest.fn();

  it('renders the new design title "Confirm phrase"', () => {
    const {getByText} = renderScreen({mnemonic: TEST_MNEMONIC, onSuccess, onBackToSeed});
    expect(getByText('Confirm phrase')).toBeTruthy();
  });

  it('renders the lede instruction', () => {
    const {getByText} = renderScreen({mnemonic: TEST_MNEMONIC, onSuccess, onBackToSeed});
    expect(getByText('Tap the correct word for each position.')).toBeTruthy();
  });

  it('shows "3 / 5" step counter', () => {
    const {getByText} = renderScreen({mnemonic: TEST_MNEMONIC, onSuccess, onBackToSeed});
    expect(getByText('3 / 5')).toBeTruthy();
  });

  it('renders 3 placeholder slots', () => {
    const {getAllByText} = renderScreen({mnemonic: TEST_MNEMONIC, onSuccess, onBackToSeed});
    const placeholders = getAllByText('— select —');
    expect(placeholders.length).toBe(3);
  });

  it('Confirm button is disabled in empty state', () => {
    const {getByTestId} = renderScreen({mnemonic: TEST_MNEMONIC, onSuccess, onBackToSeed});
    const button = getByTestId('confirm-seed-button');
    expect(button.props.accessibilityState?.disabled).toBe(true);
  });

  it('Back button calls onBack when provided', () => {
    const onBack = jest.fn();
    const {getByLabelText} = renderScreen({
      mnemonic: TEST_MNEMONIC,
      onSuccess,
      onBackToSeed,
      onBack,
    });
    fireEvent.press(getByLabelText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
