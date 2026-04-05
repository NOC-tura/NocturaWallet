import React from 'react';
import {render} from '@testing-library/react-native';
import {WithdrawScreen} from '../WithdrawScreen';

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
  useWalletStore: jest.fn().mockReturnValue({
    publicKey: 'TestPubkey1111111111111111111111111111111111',
    tokens: [{mint: 'NOC_MINT', symbol: 'NOC'}],
  }),
}));
jest.mock('../../../store/zustand/shieldedStore', () => ({
  useShieldedStore: jest.fn().mockReturnValue({merkleLeafCount: 50}),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: jest.fn()}),
  useRoute: () => ({params: {}}),
}));

describe('WithdrawScreen', () => {
  it('renders "Move to public balance" title', () => {
    const {getByTestId} = render(<WithdrawScreen />);
    const title = getByTestId('screen-title');
    expect(title.props.children).toBe('Move to public balance');
  });

  it('shows transparent address input', () => {
    const {getByTestId} = render(<WithdrawScreen />);
    expect(getByTestId('destination-input')).toBeTruthy();
  });

  it('shows withdrawal warning', () => {
    const {getByTestId} = render(<WithdrawScreen />);
    expect(getByTestId('withdraw-warning')).toBeTruthy();
  });

  it('confirm button disabled when amount is empty', () => {
    const {getByTestId} = render(<WithdrawScreen />);
    const btn = getByTestId('confirm-button');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it('shows fee display row', () => {
    const {getByTestId} = render(<WithdrawScreen />);
    expect(getByTestId('fee-display-row')).toBeTruthy();
  });
});
