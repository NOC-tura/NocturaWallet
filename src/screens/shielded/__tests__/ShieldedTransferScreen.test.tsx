import React from 'react';
import {render} from '@testing-library/react-native';
import {ShieldedTransferScreen} from '../ShieldedTransferScreen';

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

describe('ShieldedTransferScreen', () => {
  it('renders "Send privately" title', () => {
    const {getByTestId} = render(<ShieldedTransferScreen />);
    const title = getByTestId('screen-title');
    expect(title.props.children).toBe('Send privately');
  });

  it('shows ShieldedAddressInput', () => {
    const {getByTestId} = render(<ShieldedTransferScreen />);
    expect(getByTestId('shielded-address-input')).toBeTruthy();
  });

  it('shows "Remainder stays in your private balance"', () => {
    const {getByTestId} = render(<ShieldedTransferScreen />);
    const note = getByTestId('change-note');
    expect(note.props.children).toBe('Remainder stays in your private balance');
  });

  it('confirm button disabled when address is empty', () => {
    const {getByTestId} = render(<ShieldedTransferScreen />);
    const btn = getByTestId('confirm-button');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it('shows fee display row', () => {
    const {getByTestId} = render(<ShieldedTransferScreen />);
    expect(getByTestId('fee-display-row')).toBeTruthy();
  });
});
