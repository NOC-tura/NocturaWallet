import React from 'react';
import {Share} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import Clipboard from '@react-native-clipboard/clipboard';
import {ReferralScreen} from '../ReferralScreen';
import * as referralModule from '../../../modules/referral/referralModule';

const MOCK_PUBLIC_KEY = 'So11111111111111111111111111111111111111112';
const EXPECTED_LINK = `https://noc-tura.io?ref=${MOCK_PUBLIC_KEY}`;

// M1d (spec §4.3): this screen stays on the main account and says so while another account is selected
const mockLineSelected: {current: {scheme: string; address: string; label: string; isMain: boolean}} = {
  current: {scheme: 'slip10:0', address: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', label: 'Account 1', isMain: true},
};
jest.mock('../../../hooks/useSelectedAccount', () => ({
  useSelectedAccount: () => mockLineSelected.current,
  useAccountList: () => ({
    accounts: [{scheme: 'slip10:0', address: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', label: 'Account 1', isMain: true}],
    seed: [],
    walletKind: 'slip10',
    unreadable: false,
  }),
}));
const LINE_EXIT = {scheme: 'slip10:3', address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4', isMain: false};
const LINE_MAIN = {scheme: 'slip10:0', address: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', label: 'Account 1', isMain: true};

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

  it('M1d: another account selected → "Uses your main account"; main selected → no line', () => {
    mockLineSelected.current = LINE_EXIT;
    expect(renderScreen().getByTestId('referral-main-account')).toHaveTextContent('Uses your main account');
    mockLineSelected.current = LINE_MAIN;
    expect(renderScreen().queryByTestId('referral-main-account')).toBeNull();
  });
});
