import React from 'react';
import {render} from '@testing-library/react-native';
import {DepositScreen} from '../DepositScreen';

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
      tokens: [{mint: 'NOC_MINT', symbol: 'NOC'}],
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
});
