import React from 'react';
import {render} from '@testing-library/react-native';
import {ReferralScreen} from '../ReferralScreen';
import {generateReferralCode} from '../../../utils/generateReferralCode';
import {initSecureMmkv, mmkvSecure} from '../../../store/mmkv/instances';

const MOCK_PUBLIC_KEY = 'So11111111111111111111111111111111111111112';

jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: jest.fn((selector: (s: {publicKey: string}) => unknown) =>
    selector({publicKey: MOCK_PUBLIC_KEY}),
  ),
}));

jest.mock('../../../store/zustand/presaleStore', () => ({
  usePresaleStore: jest.fn(
    (selector: (s: {referralBonusTokens: string}) => unknown) =>
      selector({referralBonusTokens: '500'}),
  ),
}));

describe('ReferralScreen', () => {
  beforeEach(() => {
    initSecureMmkv('test-key');
    mmkvSecure()!.clearAll();
  });

  it('Shows "My Referral Code" heading', () => {
    const {getByText} = render(<ReferralScreen />);
    expect(getByText('My Referral Code')).toBeTruthy();
  });

  it('Shows code in NOC-XXXX format', () => {
    const {getByTestId} = render(<ReferralScreen />);
    const codeEl = getByTestId('referral-code');
    expect(codeEl.props.children).toMatch(/^NOC-[0-9A-Z]{4,6}$/);
    // Verify it matches the deterministic generator
    const expected = generateReferralCode(MOCK_PUBLIC_KEY);
    expect(codeEl.props.children).toBe(expected);
  });

  it('Shows Share and Copy buttons', () => {
    const {getByTestId} = render(<ReferralScreen />);
    expect(getByTestId('copy-button')).toBeTruthy();
    expect(getByTestId('share-button')).toBeTruthy();
  });

  it('Shows "Apply code" input field', () => {
    const {getByTestId} = render(<ReferralScreen />);
    expect(getByTestId('apply-code-input')).toBeTruthy();
    expect(getByTestId('apply-code-button')).toBeTruthy();
  });

  it('Shows referral stats section ("Referrals", "Rewards earned")', () => {
    const {getByTestId, getByText} = render(<ReferralScreen />);
    expect(getByTestId('referral-stats')).toBeTruthy();
    expect(getByText('Referrals')).toBeTruthy();
    expect(getByText('Rewards earned')).toBeTruthy();
  });
});
