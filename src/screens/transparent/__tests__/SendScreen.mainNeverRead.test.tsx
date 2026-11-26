/**
 * post-M1d §3.1 (review r1-1): a main account that was NEVER read and whose sync failed has no figure.
 * This suite does NOT mock useAccountPublicData or walletStore: the state is the store's real one, read
 * through the real hook. (SendScreen.test.tsx mocks the hook and so cannot prove this path.)
 */
import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useWalletStore} from '../../../store/zustand/walletStore';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({navigate: jest.fn(), goBack: jest.fn()}),
  useRoute: () => ({params: {}}),
}));
jest.mock('../../../modules/solana/simulation', () => ({simulateTransaction: jest.fn().mockResolvedValue({success: true})}));
jest.mock('../../../modules/solana/connection', () => ({getConnection: jest.fn(() => ({}))}));
jest.mock('../../../modules/solana/transactionBuilder', () => ({
  buildTransferTx: jest.fn().mockResolvedValue({}),
  getTransferMarkupLamports: jest.requireActual('../../../modules/solana/transactionBuilder').getTransferMarkupLamports,
}));

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const FOREIGN = 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N';
const mockMainSrc = {scheme: 'slip10:0', address: MAIN, label: 'Account 1', number: 1, role: 'main', isMain: true, linked: false};
const mockRefresh = jest.fn();
jest.mock('../../../hooks/useSelectedAccount', () => ({
  useSelectedAccount: () => mockMainSrc,
  useAccountList: () => null,
  useRefreshAccounts: () => mockRefresh,
}));
const mockForceSync = jest.fn(() => Promise.resolve({success: false, partial: false, timestamp: 1}));
jest.mock('../../../modules/backgroundSync/backgroundSyncModule', () => ({forceSync: () => mockForceSync()}));

import {SendScreen} from '../SendScreen';

const screen = () => {
  const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
  const r = render(
    <QueryClientProvider client={qc}>
      <SendScreen onReview={jest.fn()} />
    </QueryClientProvider>,
  );
  fireEvent.changeText(r.getByTestId('recipient-input'), FOREIGN);
  fireEvent.changeText(r.getByTestId('amount-input'), '0.001');
  return r;
};

beforeEach(() => {
  mockForceSync.mockClear();
  // a fresh import: the store's defaults, and the first sync of this session failed
  useWalletStore.setState({publicKey: MAIN, solBalance: '0', nocBalance: '0', tokenBalances: {}, tokens: [], lastSyncedAt: null, lastSyncFailedAt: 5});
});

it('never read + the sync failed → no "Available 0 SOL": the retry row, CTA / MAX off, nothing judged against 0', () => {
  const r = screen();
  expect(r.queryByTestId('send-available')).toBeNull();
  expect(r.queryByText(/Available/)).toBeNull();
  expect(r.getByTestId('send-balance-retry')).toHaveTextContent('Balance unavailable · tap to retry');
  expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
  expect(r.getByTestId('max-button').props.accessibilityState?.disabled).toBe(true);
  expect(r.queryByText(/Insufficient balance/)).toBeNull(); // 0.001 SOL is NOT "more than the balance": there is none
});

it('R4: the tap on that row runs the main sync once (never the no-op refetch)', async () => {
  const r = screen();
  await act(async () => {
    fireEvent.press(r.getByTestId('send-balance-retry'));
  });
  expect(mockForceSync).toHaveBeenCalledTimes(1);
});

// controller ruling 2026-11-22: never read and no failed sync yet → 'loading', the non-main branch exactly
it('never read, no sync failed yet → "Available — SOL": no figure, no retry row, CTA / MAX off', () => {
  useWalletStore.setState({lastSyncFailedAt: null});
  const r = screen();
  expect(r.getByTestId('send-available')).toHaveTextContent('— SOL');
  expect(r.queryByText(/Available\s*0/)).toBeNull();
  expect(r.queryByTestId('send-balance-retry')).toBeNull();
  expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
  expect(r.getByTestId('max-button').props.accessibilityState?.disabled).toBe(true);
  expect(r.queryByText(/Insufficient balance/)).toBeNull();
});

it('positive control: the same store after one good sync → "Available 1 SOL" and a usable CTA', () => {
  expect(useWalletStore.getState().lastSyncedAt).toBeNull(); // the arranged state really is "never read"
  const r = screen();
  act(() => {
    useWalletStore.getState().updateBalances('1000000000', '0', {});
  });
  expect(r.queryByTestId('send-balance-retry')).toBeNull();
  expect(r.getByTestId('send-available')).toHaveTextContent('1 SOL');
  expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(false);
});


// post-M1d review: the main retry end to end, real hook and store, no remount
it('retry succeeds: forceSync writes the store → the row flips to "Available 1 SOL", CTA enabled, same render', async () => {
  mockForceSync.mockImplementationOnce(() => {
    useWalletStore.getState().updateBalances('1000000000', '0', {});
    return Promise.resolve({success: true, partial: false, timestamp: 2});
  });
  const r = screen();
  expect(r.getByTestId('send-balance-retry')).toBeTruthy();
  await act(async () => {
    fireEvent.press(r.getByTestId('send-balance-retry'));
  });
  expect(r.queryByTestId('send-balance-retry')).toBeNull();
  expect(r.getByTestId('send-available')).toHaveTextContent('1 SOL');
  expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(false);
});

it('retry fails with "wallet changed": the row returns to "Not updated"/unavailable and is enabled again', async () => {
  useWalletStore.setState({lastSyncedAt: 1, solBalance: '1000000000'}); // a stale (once-read) main
  mockForceSync.mockImplementationOnce(() => Promise.resolve({success: false, partial: false, timestamp: 2, error: 'wallet changed'}));
  const r = screen();
  expect(r.getByTestId('send-balance-retry')).toHaveTextContent('Not updated · tap to retry');
  await act(async () => {
    fireEvent.press(r.getByTestId('send-balance-retry'));
  });
  const row = r.getByTestId('send-balance-retry');
  expect(row).toHaveTextContent('Not updated · tap to retry');
  expect(row.props.accessibilityState?.disabled).toBe(false);
  expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
});
