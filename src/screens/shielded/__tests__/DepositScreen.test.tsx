import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {DepositScreen} from '../DepositScreen';

// Stable fake devnet-pool mint — must match the literal used in the jest.mock factories below
// (jest.mock is hoisted before const declarations, so factories cannot close over this).
const TEST_DEVNET_MINT = 'DevMint1111111111111111111111111111111111111';

jest.mock('../../../constants/programs', () => ({
  // Keep the same literal as TEST_DEVNET_MINT (hoisting prevents closing over the const).
  SHIELDED_DEVNET_MINT: 'DevMint1111111111111111111111111111111111111',
  SHIELDED_CU: {deposit: 400_000},
}));

// ---- Mock new self-relay depositShield flow ----
jest.mock('../../../modules/shielded/depositFlow', () => ({
  depositShield: jest.fn().mockResolvedValue({
    txSignature: 'mockTxSig1111111111111111111111111111111111111111111111111111111111',
    leafIndex: 42,
    amount: 1_000_000_000n,
  }),
}));

// ---- Mock keychain + derivation (biometric gate) ----
jest.mock('../../../modules/keychain/keychainModule', () => ({
  keychainManager: {retrieveSeed: jest.fn().mockResolvedValue('test mnemonic words here')},
}));
jest.mock('../../../modules/keyDerivation/mnemonicUtils', () => ({
  mnemonicToSeed: jest.fn().mockResolvedValue(new Uint8Array(64)),
}));
jest.mock('../../../modules/keyDerivation/transparent', () => ({
  deriveTransparentKeypair: jest.fn().mockReturnValue({
    publicKey: new Uint8Array(32),
    secretKey: new Uint8Array(64),
  }),
}));
jest.mock('../../../modules/keyDerivation/derivationScheme', () => ({
  loadTransparentScheme: jest.fn().mockReturnValue({kind: 'slip10', account: 0}),
}));
jest.mock('../../../modules/session/zeroize', () => ({zeroize: jest.fn()}));
jest.mock('@solana/web3.js', () => ({
  Keypair: {fromSecretKey: jest.fn().mockReturnValue({publicKey: {toBase58: () => 'MockPubkey'}})},
}));

// ---- Existing mocks ----
jest.mock('../../../modules/sslPinning/pinnedFetch', () => ({pinnedFetch: jest.fn()}));
jest.mock('../../../store/mmkv/instances', () => {
  const actual = jest.requireActual('../../../store/mmkv/instances') as Record<string, unknown>;
  return {...actual, mmkvSecure: () => actual.mmkvPublic};
});
jest.mock('../../../store/zustand/presaleStore', () => ({
  usePresaleStore: Object.assign(
    jest.fn().mockReturnValue({tgeStatus: 'pre_tge', isZeroFeeEligible: false}),
    {getState: jest.fn().mockReturnValue({tgeStatus: 'pre_tge', isZeroFeeEligible: false})},
  ),
}));
jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: Object.assign(
    jest.fn().mockReturnValue({
      publicKey: 'TestPubkey1111111111111111111111111111111111',
      // First token uses the devnet pool mint so the mint-guard passes by default.
      // Must be the same literal as TEST_DEVNET_MINT (jest.mock is hoisted).
      tokens: [{mint: 'DevMint1111111111111111111111111111111111111', symbol: 'POOL'}],
    }),
    {getState: jest.fn().mockReturnValue({nocUsdPrice: 0, setNocUsdPrice: jest.fn()})},
  ),
}));
jest.mock('../../../store/zustand/shieldedStore', () => ({
  useShieldedStore: jest.fn().mockReturnValue({merkleLeafCount: 50}),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: jest.fn()}),
  useRoute: () => ({params: {}}),
}));

import {depositShield} from '../../../modules/shielded/depositFlow';

describe('DepositScreen', () => {
  it('renders "Move to private balance" title', () => {
    const {getByTestId} = render(<DepositScreen />);
    const title = getByTestId('screen-title');
    expect(title.props.children).toBe('Move to private balance');
  });

  it('shows amount input', () => {
    const {getByTestId} = render(<DepositScreen />);
    expect(getByTestId('amount-input')).toBeTruthy();
  });

  it('shows PrivacyMeter when leafCount < 1000', () => {
    const {getByTestId} = render(<DepositScreen />);
    // merkleLeafCount is 50 (< 1000), so PrivacyMeter should be visible
    expect(getByTestId('privacy-meter')).toBeTruthy();
  });

  it('confirm button disabled when amount is empty', () => {
    const {getByTestId} = render(<DepositScreen />);
    const btn = getByTestId('confirm-button');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it('shows fee display row', () => {
    const {getByTestId} = render(<DepositScreen />);
    expect(getByTestId('fee-display-row')).toBeTruthy();
  });

  it('calls depositShield on confirm and shows success', async () => {
    jest.useFakeTimers();
    const {getByTestId, getByText} = render(<DepositScreen />);

    // Enter amount to enable the confirm button
    await act(async () => {
      fireEvent.changeText(getByTestId('amount-input'), '1');
    });

    // Tap "Review deposit" — advances to confirm step (debounce: first tap at t=0)
    await act(async () => {
      fireEvent.press(getByTestId('confirm-button'));
    });

    // Advance time past the 500ms debounce so the next tap is accepted
    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    // Now on confirm step — tap "Confirm deposit" to trigger depositShield
    await act(async () => {
      fireEvent.press(getByTestId('confirm-button'));
    });

    // Let the async depositShield promise resolve
    await act(async () => {
      await Promise.resolve();
    });

    expect(depositShield).toHaveBeenCalled();
    // Success screen text
    expect(getByText('Moved to private balance')).toBeTruthy();

    jest.useRealTimers();
  }, 15_000);

  it('shows error and does not call depositShield when selected mint is not the devnet pool mint', async () => {
    // Override the walletStore to expose a non-pool token as the only option.
    const {useWalletStore} = require('../../../store/zustand/walletStore') as {
      useWalletStore: jest.Mock;
    };
    const prevImpl = useWalletStore.getMockImplementation();
    useWalletStore.mockReturnValue({
      publicKey: 'TestPubkey1111111111111111111111111111111111',
      tokens: [{mint: 'SomeOtherMint111111111111111111111111111111', symbol: 'OTHER'}],
    });

    // Clear depositShield call history so this test is independent.
    (depositShield as jest.Mock).mockClear();

    jest.useFakeTimers();
    const {getByTestId, getByText} = render(<DepositScreen />);

    await act(async () => {
      fireEvent.changeText(getByTestId('amount-input'), '1');
    });
    await act(async () => {
      fireEvent.press(getByTestId('confirm-button'));
    });
    await act(async () => { jest.advanceTimersByTime(600); });
    // On confirm step — tap confirm; guard should fire before depositShield
    await act(async () => {
      fireEvent.press(getByTestId('confirm-button'));
    });
    await act(async () => { await Promise.resolve(); });

    expect(depositShield).not.toHaveBeenCalled();
    expect(
      getByText('Shielding is only available for the devnet pool token on this build.'),
    ).toBeTruthy();

    jest.useRealTimers();
    // Restore the original mock so later tests are unaffected.
    if (prevImpl) {
      useWalletStore.mockImplementation(prevImpl);
    } else {
      useWalletStore.mockReturnValue({
        publicKey: 'TestPubkey1111111111111111111111111111111111',
        tokens: [{mint: TEST_DEVNET_MINT, symbol: 'POOL'}],
      });
    }
  }, 15_000);
});
