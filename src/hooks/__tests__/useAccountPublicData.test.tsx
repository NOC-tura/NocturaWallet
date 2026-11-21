/** M1d spec §3.4: the selected account's public data — main from walletStore, any other by address. */
import React from 'react';
import {renderHook, waitFor} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useWalletStore} from '../../store/zustand/walletStore';

const mockFetch = jest.fn();
jest.mock('../../modules/accounts/accountSnapshot', () => ({fetchAccountSnapshot: (a: string) => mockFetch(a)}));
const mockFeatures = {shielded: true};
jest.mock('../../constants/features', () => ({isShieldedEnabled: () => mockFeatures.shielded}));

import {NO_PUBLIC_DATA, useAccountPublicData} from '../useAccountPublicData';
import {A0_TOKEN} from '../../modules/shielded/a0/screenSupport';

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const SNAP = {solBalance: '3000000', nocBalance: '0', tokenBalances: {}, tokens: []};

function wrapper({children}: {children: React.ReactNode}) {
  const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFeatures.shielded = true;
  useWalletStore.setState({publicKey: MAIN, solBalance: '1000000000', nocBalance: '7', tokenBalances: {}, tokens: [], lastSyncedAt: 123});
});

it('main → walletStore\'s values, ready, no request (forceSync owns that slot)', () => {
  const {result} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  expect(result.current.data).toEqual({status: 'ready', solBalance: '1000000000', nocBalance: '7', tokenBalances: {}, tokens: [], syncedAt: 123});
  expect(mockFetch).not.toHaveBeenCalled();
});

it('plan A12: main never synced → syncedAt null', () => {
  useWalletStore.setState({lastSyncedAt: null});
  const {result} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  expect(result.current.data).toMatchObject({status: 'ready', syncedAt: null});
});

it('another account → loading, then its own snapshot (by its address)', async () => {
  mockFetch.mockResolvedValue(SNAP);
  const {result} = renderHook(() => useAccountPublicData({address: A3, isMain: false}), {wrapper});
  expect(result.current.data).toEqual({status: 'loading'});
  await waitFor(() => expect(result.current.data.status).toBe('ready'));
  expect(result.current.data).toMatchObject({status: 'ready', solBalance: '3000000'});
  expect(mockFetch).toHaveBeenCalledWith(A3);
});

it('Review Focus 4: a failed read → error, never zeros', async () => {
  mockFetch.mockRejectedValue(new Error('429'));
  const {result} = renderHook(() => useAccountPublicData({address: A3, isMain: false}), {wrapper});
  await waitFor(() => expect(result.current.data).toEqual({status: 'error'}));
});

it('plan A11 (ruling C1): the main account\'s held pool token is listed where private balances exist; never otherwise', () => {
  useWalletStore.setState({tokenBalances: {[A0_TOKEN.mint]: '1250000000'}});
  const on = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  expect(on.result.current.data).toMatchObject({status: 'ready', tokens: [expect.objectContaining({mint: A0_TOKEN.mint, symbol: 'TEST'})]});
  expect(useWalletStore.getState().tokens).toEqual([]); // display only: the store is not written
  mockFeatures.shielded = false;
  const off = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  expect(off.result.current.data).toMatchObject({status: 'ready', tokens: []});
});

it('refetch resolves (a no-op for main)', async () => {
  const {result} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  await expect(result.current.refetch()).resolves.toBeUndefined();
});

it('no account → loading; NO_PUBLIC_DATA is all zeros (shown only behind a not-ready state)', () => {
  const {result} = renderHook(() => useAccountPublicData(null), {wrapper});
  expect(result.current.data).toEqual({status: 'loading'});
  expect(NO_PUBLIC_DATA).toEqual({solBalance: '0', nocBalance: '0', tokenBalances: {}, tokens: []});
});

it('the main branch is referentially stable across renders (Fable r2 minor 1)', () => {
  const {result, rerender} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  const first = result.current.data;
  rerender({});
  expect(result.current.data).toBe(first);
});
