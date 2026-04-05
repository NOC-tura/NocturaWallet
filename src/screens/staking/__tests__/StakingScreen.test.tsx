import React from 'react';
import {render} from '@testing-library/react-native';
import {StakingScreen} from '../StakingScreen';

jest.mock('../../../store/zustand/presaleStore', () => ({
  usePresaleStore: jest.fn(() => ({isZeroFeeEligible: false})),
}));
jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: jest.fn(() => ({nocBalance: '10000000000', publicKey: 'mock-pk'})),
}));

describe('StakingScreen', () => {
  it('shows tier selector with 3 options', () => {
    const {getByText} = render(<StakingScreen />);
    expect(getByText('90 Days')).toBeTruthy();
    expect(getByText('182 Days')).toBeTruthy();
    expect(getByText('365 Days')).toBeTruthy();
  });

  it('shows "Stake NOC" CTA button', () => {
    const {getByText} = render(<StakingScreen />);
    expect(getByText('STAKE NOC')).toBeTruthy();
  });

  it('shows "Zero-fee eligible" badge when isZeroFeeEligible is true', () => {
    const {usePresaleStore} = require('../../../store/zustand/presaleStore');
    (usePresaleStore as jest.Mock).mockReturnValue({isZeroFeeEligible: true});
    const {getByText} = render(<StakingScreen />);
    expect(getByText(/Zero-fee eligible/)).toBeTruthy();
  });

  it('shows fee discount text for selected tier (10% off for 90d default)', () => {
    const {getByText} = render(<StakingScreen />);
    expect(getByText(/10% off/)).toBeTruthy();
  });
});
