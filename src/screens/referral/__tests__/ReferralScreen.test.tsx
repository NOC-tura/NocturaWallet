import React from 'react';
import {Share} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import Clipboard from '@react-native-clipboard/clipboard';
import {ReferralScreen} from '../ReferralScreen';
import * as referralModule from '../../../modules/referral/referralModule';

const MOCK_PUBLIC_KEY = 'So11111111111111111111111111111111111111112';
const EXPECTED_LINK = `https://noc-tura.io?ref=${MOCK_PUBLIC_KEY}`;

jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: jest.fn((selector: (s: {publicKey: string}) => unknown) =>
    selector({publicKey: MOCK_PUBLIC_KEY}),
  ),
}));

// Real buildReferralLink (pure), mocked fetchReferralStats (no network).
jest.mock('../../../modules/referral/referralModule', () => {
  const actual = jest.requireActual('../../../modules/referral/referralModule');
  return {
    ...actual,
    fetchReferralStats: jest.fn(),
  };
});

const mockedFetch = referralModule.fetchReferralStats as jest.MockedFunction<
  typeof referralModule.fetchReferralStats
>;

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: {queries: {retry: false}},
  });
  return render(
    <QueryClientProvider client={client}>
      <ReferralScreen onBack={jest.fn()} />
    </QueryClientProvider>,
  );
}

describe('ReferralScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetch.mockResolvedValue({
      totalReferrals: 12,
      totalBaseBonusNoc: 20,
      totalExtraBonusNoc: 12.4,
      totalBonusNoc: 32.4,
      totalReferredNoc: 1000,
      totalReferredUsd: 1234.5,
      tierBonusCount: 2,
    });
  });

  it('renders the screen title', () => {
    const {getByText} = renderScreen();
    expect(getByText('Refer a friend')).toBeTruthy();
  });

  it('shows the three stat values after the query resolves', async () => {
    const {findByText, findAllByText} = renderScreen();
    // "12" appears as the REFERRALS stat and again in "Used 12 times".
    expect((await findAllByText('12')).length).toBeGreaterThanOrEqual(1);
    expect(await findByText('32.40')).toBeTruthy(); // earned NOC
    expect(await findByText('$1,234.50')).toBeTruthy(); // referred USD
  });

  it('copies the ?ref= link to the clipboard', async () => {
    const {findByLabelText} = renderScreen();
    const copyBtn = await findByLabelText('Copy invite link');
    fireEvent.press(copyBtn);
    expect(Clipboard.setString).toHaveBeenCalledWith(EXPECTED_LINK);
  });

  it('shares the ?ref= link', async () => {
    const shareSpy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({action: 'sharedAction'});
    const {findByLabelText} = renderScreen();
    const shareBtn = await findByLabelText('Share invite link');
    fireEvent.press(shareBtn);
    expect(shareSpy).toHaveBeenCalledWith({message: EXPECTED_LINK});
  });

  it('renders the invite-link card even with zero referrals', async () => {
    mockedFetch.mockResolvedValue({
      totalReferrals: 0,
      totalBaseBonusNoc: 0,
      totalExtraBonusNoc: 0,
      totalBonusNoc: 0,
      totalReferredNoc: 0,
      totalReferredUsd: 0,
      tierBonusCount: 0,
    });
    const {getByText, findByLabelText} = renderScreen();
    expect(getByText('YOUR INVITE LINK')).toBeTruthy();
    expect(await findByLabelText('Copy invite link')).toBeTruthy();
  });
});
