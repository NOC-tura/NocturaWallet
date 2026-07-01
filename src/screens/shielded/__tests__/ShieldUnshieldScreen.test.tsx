import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {ShieldUnshieldScreen} from '../ShieldUnshieldScreen';

// Stable fake devnet-pool mint (hoisted jest.mock factories can't close over consts)
const TEST_MINT = 'DevMint1111111111111111111111111111111111111';

jest.mock('../../../constants/programs', () => ({
  SHIELDED_POOL_MINTS: ['DevMint1111111111111111111111111111111111111'],
  SHIELDED_DEVNET_MINT: 'DevMint1111111111111111111111111111111111111',
  NOC_MINT: 'NOCMint11111111111111111111111111111111111111',
  NOC_DECIMALS: 9,
  IS_DEVNET: true,
}));

jest.mock('../../../modules/shielded/poolTokens', () => ({
  poolTokenMeta: jest.fn((mint: string) => {
    if (mint === 'DevMint1111111111111111111111111111111111111') {
      return {mint, symbol: 'TEST', name: 'Devnet Test Token', decimals: 9};
    }
    return {mint, symbol: mint.slice(0, 4), name: 'SPL token', decimals: 9};
  }),
}));

jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: jest.fn().mockReturnValue({
    solBalance: '2000000000', // 2 SOL
    shieldedBalances: {native: '500000000'}, // 0.5 shielded
  }),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));

// NativeWind / cn uses StyleSheet under the hood in test env — no special mock needed.
// react-native-safe-area-context is mocked globally in jest setup.

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('ShieldUnshieldScreen', () => {
  it('renders the screen title', () => {
    const {getByText} = render(<ShieldUnshieldScreen onBack={jest.fn()} />);
    expect(getByText('Shield / Unshield')).toBeTruthy();
  });

  it('renders the token symbol from poolTokenMeta', () => {
    const {getAllByText} = render(<ShieldUnshieldScreen onBack={jest.fn()} />);
    // "TEST" should appear in the token selector and the amount card
    expect(getAllByText('TEST').length).toBeGreaterThan(0);
  });

  it('shield CTA is disabled when no amount is entered', () => {
    const {getByTestId} = render(<ShieldUnshieldScreen onBack={jest.fn()} />);
    const cta = getByTestId('shield-cta');
    expect(cta.props.accessibilityState?.disabled).toBe(true);
  });

  it('navigate is called with mint when CTA is tapped with valid amount', () => {
    const {getByTestId} = render(<ShieldUnshieldScreen onBack={jest.fn()} />);
    fireEvent.changeText(getByTestId('shield-amount-input'), '0.5');
    fireEvent.press(getByTestId('shield-cta'));
    expect(mockNavigate).toHaveBeenCalledWith(
      'ZkProofModal',
      expect.objectContaining({
        direction: 'private',
        mint: TEST_MINT,
        amount: expect.any(String),
      }),
    );
  });

  it('navigate params.mint equals the selected pool mint', () => {
    const {getByTestId} = render(<ShieldUnshieldScreen onBack={jest.fn()} />);
    fireEvent.changeText(getByTestId('shield-amount-input'), '0.1');
    fireEvent.press(getByTestId('shield-cta'));
    const call = mockNavigate.mock.calls[0];
    // call[0] = route name, call[1] = params
    expect(call[1]).toHaveProperty('mint', TEST_MINT);
  });

  it('onBack is called when back button is pressed', () => {
    const onBack = jest.fn();
    const {getByRole} = render(<ShieldUnshieldScreen onBack={onBack} />);
    // The back button has accessibilityRole="button" and accessibilityLabel="Back"
    const backButton = getByRole('button', {name: 'Back'});
    fireEvent.press(backButton);
    expect(onBack).toHaveBeenCalled();
  });

  it('switches to Make public direction', () => {
    const {getByRole} = render(<ShieldUnshieldScreen onBack={jest.fn()} />);
    const makePublicTab = getByRole('tab', {name: 'Make public'});
    fireEvent.press(makePublicTab);
    // After switching, the CTA label should reference unshield
    // The CTA label depends on canSubmit; with no amount it shows "Unshield TEST"
    // (we look for the tab being selected instead, which is safe to assert)
    expect(makePublicTab.props.accessibilityState?.selected).toBe(true);
  });
});
