/** M1d spec §3.4: the selected account's public data — main from walletStore, any other by address. */
import React from 'react';
import {act, renderHook, waitFor} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useWalletStore} from '../../store/zustand/walletStore';

const mockFetch = jest.fn();
jest.mock('../../modules/accounts/accountSnapshot', () => ({fetchAccountSnapshot: (a: string) => mockFetch(a)}));
const mockFeatures = {shielded: true};
jest.mock('../../constants/features', () => ({isShieldedEnabled: () => mockFeatures.shielded}));

import {ACCOUNT_SNAPSHOT_KEY, NO_PUBLIC_DATA, useAccountPublicData} from '../useAccountPublicData';
import {A0_TOKEN} from '../../modules/shielded/a0/screenSupport';

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const SNAP = {solBalance: '3000000', nocBalance: '0', tokenBalances: {}, tokens: []};

// One client per test, created outside the wrapper so a rerender keeps the same cache (a new client per
// render would make every switch row read "loading" for the wrong reason); cleared after each test. NOTE: a
// single-file run of this suite still prints "Jest did not exit" (the full run is fine); the likely cause is
// react-query's 5-minute gcTime timers (not proven) — clear() does not stop it.
let qc: QueryClient;
function wrapper({children}: {children: React.ReactNode}) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

afterEach(() => {
  qc.clear();
});

beforeEach(() => {
  qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
  mockFetch.mockReset();
  mockFeatures.shielded = true;
  useWalletStore.setState({publicKey: MAIN, solBalance: '1000000000', nocBalance: '7', tokenBalances: {}, tokens: [], lastSyncedAt: 123, lastSyncFailedAt: null});
});

it('main → walletStore\'s values, ready, no request (forceSync owns that slot)', () => {
  const {result} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  expect(result.current.data).toEqual({status: 'ready', solBalance: '1000000000', nocBalance: '7', tokenBalances: {}, tokens: [], syncedAt: 123});
  expect(mockFetch).not.toHaveBeenCalled();
});

// post-M1d controller ruling 2026-11-22: a never-read main is never ready
it('main never synced → loading (was: ready with syncedAt null)', () => {
  useWalletStore.setState({lastSyncedAt: null});
  const {result} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  expect(result.current.data).toEqual({status: 'loading'});
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
  await expect(result.current.refetch()).resolves.toBe(true); // M1d: refetch now says whether the read succeeded (review M2)
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

it('review I2: a switch never shows the previous account\'s data (another → another, and main → another)', async () => {
  const A4 = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
  mockFetch.mockImplementation((a: string) => (a === A3 ? Promise.resolve(SNAP) : new Promise(() => undefined)));
  const {result, rerender} = renderHook(
    ({acc}: {acc: {address: string; isMain: boolean}}) => useAccountPublicData(acc),
    {wrapper, initialProps: {acc: {address: A3, isMain: false}}},
  );
  await waitFor(() => expect(result.current.data.status).toBe('ready'));
  rerender({acc: {address: A4, isMain: false}});
  expect(result.current.data).toEqual({status: 'loading'}); // the very first render after the change
  rerender({acc: {address: MAIN, isMain: true}});
  expect(result.current.data).toMatchObject({status: 'ready', solBalance: '1000000000'});
  rerender({acc: {address: A4, isMain: false}});
  expect(result.current.data).toEqual({status: 'loading'}); // not the main values
});

it('post-M1d §3.1: another account — read then failed → stale with the old figure and its age; read again → ready', async () => {
  const OLD = {...SNAP, solBalance: '111'};
  const NEW = {...SNAP, solBalance: '222'};
  const readAt = Date.now() - 60_000;
  qc.setQueryData([ACCOUNT_SNAPSHOT_KEY, A3], OLD, {updatedAt: readAt});
  mockFetch.mockRejectedValueOnce(new Error('429'));
  const {result} = renderHook(() => useAccountPublicData({address: A3, isMain: false}), {wrapper});
  await waitFor(() => expect(result.current.data.status).toBe('stale')); // post-M1d §3.1 / R5 (was: error)
  expect(result.current.data).toMatchObject({status: 'stale', solBalance: '111', syncedAt: readAt, failedAt: expect.any(Number)});
  mockFetch.mockResolvedValueOnce(NEW);
  await act(async () => {
    await result.current.refetch();
  });
  await waitFor(() => expect(result.current.data).toMatchObject({status: 'ready', solBalance: '222'}));
});

it('R5: another account never read in this session + a failed read → error (no figure exists)', async () => {
  mockFetch.mockRejectedValue(new Error('429'));
  const {result} = renderHook(() => useAccountPublicData({address: A3, isMain: false}), {wrapper});
  await waitFor(() => expect(result.current.data).toEqual({status: 'error'}));
});

it('post-M1d §3.1: main — read then failed → stale, the age from lastSyncedAt; a good sync → ready', () => {
  useWalletStore.setState({lastSyncedAt: 123, lastSyncFailedAt: 456});
  const {result} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  expect(result.current.data).toEqual({status: 'stale', solBalance: '1000000000', nocBalance: '7', tokenBalances: {}, tokens: [], syncedAt: 123, failedAt: 456});
  act(() => {
    useWalletStore.getState().updateBalances('5', '7', {});
  });
  expect(result.current.data).toMatchObject({status: 'ready', solBalance: '5'});
  expect(mockFetch).not.toHaveBeenCalled();
});

// review r1-1: 'ready' here made every screen show the store's default 0 as a current balance
it("post-M1d §3.1: main — never read + the sync failed → error: no figure, never the store's default 0", () => {
  useWalletStore.setState({solBalance: '0', nocBalance: '0', lastSyncedAt: null, lastSyncFailedAt: 456});
  const {result} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  expect(result.current.data).toEqual({status: 'error'});
  expect(mockFetch).not.toHaveBeenCalled();
});

it('post-M1d §3.1: main — that state, then a good sync → ready with the read figure', () => {
  useWalletStore.setState({lastSyncedAt: null, lastSyncFailedAt: 456});
  const {result} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  act(() => {
    useWalletStore.getState().updateBalances('5', '7', {});
  });
  expect(result.current.data).toMatchObject({status: 'ready', solBalance: '5', syncedAt: expect.any(Number)});
});

// controller ruling 2026-11-22: a never-read main is never 'ready' — the store's defaults are not a balance
it('main — never read and no sync of this session has failed → loading (as a non-main account before its first read)', () => {
  useWalletStore.setState({solBalance: '0', nocBalance: '0', lastSyncedAt: null, lastSyncFailedAt: null});
  const {result} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  expect(result.current.data).toEqual({status: 'loading'});
  expect(mockFetch).not.toHaveBeenCalled();
});

it('main — the three states in order: loading → (the sync fails) error → (a sync succeeds) ready', () => {
  useWalletStore.setState({lastSyncedAt: null, lastSyncFailedAt: null});
  const {result} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  expect(result.current.data.status).toBe('loading');
  act(() => {
    useWalletStore.getState().markSyncFailed();
  });
  expect(result.current.data).toEqual({status: 'error'});
  act(() => {
    useWalletStore.getState().updateBalances('5', '7', {});
  });
  expect(result.current.data).toMatchObject({status: 'ready', solBalance: '5', syncedAt: expect.any(Number)});
});

it('main is never ready with syncedAt null (property over the four store states)', () => {
  for (const [syncedAt, failedAt] of [[null, null], [null, 9], [5, null], [5, 9]] as const) {
    useWalletStore.setState({lastSyncedAt: syncedAt, lastSyncFailedAt: failedAt});
    const {result, unmount} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
    const d = result.current.data;
    expect(d.status === 'ready' && d.syncedAt === null).toBe(false);
    expect(d.status).toBe(syncedAt === null ? (failedAt === null ? 'loading' : 'error') : failedAt === null ? 'ready' : 'stale');
    unmount();
  }
});

it('review r1 N1: the main account is unchanged by a failing snapshot read (walletStore, no request)', () => {
  qc.setQueryData([ACCOUNT_SNAPSHOT_KEY, MAIN], {...SNAP, solBalance: '1'});
  mockFetch.mockRejectedValue(new Error('429'));
  const {result} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  expect(result.current.data).toMatchObject({status: 'ready', solBalance: '1000000000'});
  expect(mockFetch).not.toHaveBeenCalled();
});
