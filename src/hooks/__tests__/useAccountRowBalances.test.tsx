/** M1d spec §3.4 (plan A1): the sheet's balances — read when it opens, at most 10 in flight, every row eventually. */
import React from 'react';
import {act, renderHook, waitFor} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

const mockFetch = jest.fn();
jest.mock('../../modules/accounts/accountSnapshot', () => ({fetchAccountSnapshot: (a: string) => mockFetch(a)}));

import {ROW_WINDOW, useAccountRowBalances} from '../useAccountRowBalances';

const SNAP = {solBalance: '20000000', nocBalance: '0', tokenBalances: {}, tokens: []};
const pending: Record<string, {resolve: (v: unknown) => void; reject: (e: unknown) => void}> = {};
let qc: QueryClient;
function wrapper({children}: {children: React.ReactNode}) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
  for (const k of Object.keys(pending)) delete pending[k];
  mockFetch.mockReset().mockImplementation(
    (a: string) =>
      new Promise((resolve, reject) => {
        pending[a] = {resolve, reject};
      }),
  );
});

it('a closed sheet asks nothing', () => {
  renderHook(() => useAccountRowBalances(['acc0'], false), {wrapper});
  expect(mockFetch).not.toHaveBeenCalled();
});

it('at most 10 in flight; each settled row lets the next start; waiting rows read not-checked; a failure is "failed"', async () => {
  expect(ROW_WINDOW).toBe(10);
  const addrs = Array.from({length: 12}, (_, i) => `acc${i}`);
  const {result} = renderHook(() => useAccountRowBalances(addrs, true), {wrapper});
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(10));
  expect(result.current.acc0).toEqual({state: 'not-checked'}); // in flight
  expect(result.current.acc10).toEqual({state: 'not-checked'}); // waiting
  await act(async () => {
    pending.acc0!.resolve(SNAP);
  });
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(11));
  expect(result.current.acc0).toMatchObject({state: 'ready', data: SNAP});
  await act(async () => {
    pending.acc1!.reject(new Error('429'));
  });
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(12));
  expect(result.current.acc1).toEqual({state: 'failed'});
  expect(mockFetch.mock.calls.map(c => c[0])).toEqual(addrs); // every row, in order, once
});

const KEY = (a: string) => ['accountSnapshot', a];

it('review r1 I1: cached rows older than staleTime are re-read inside the window — 10 in flight, not all', async () => {
  const addrs = Array.from({length: 12}, (_, i) => `acc${i}`);
  for (const a of addrs) qc.setQueryData(KEY(a), SNAP, {updatedAt: Date.now() - 60_000});
  renderHook(() => useAccountRowBalances(addrs, true), {wrapper});
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(10));
  await act(async () => {});
  expect(mockFetch).toHaveBeenCalledTimes(10);
  await act(async () => {
    pending.acc0!.resolve(SNAP);
  });
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(11));
});

it('review r1 I1: one stale cached row among many (the selected account on first open) — still 10 in flight', async () => {
  const addrs = Array.from({length: 12}, (_, i) => `acc${i}`);
  qc.setQueryData(KEY('acc0'), SNAP, {updatedAt: Date.now() - 60_000});
  renderHook(() => useAccountRowBalances(addrs, true), {wrapper});
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(10));
  await act(async () => {});
  expect(mockFetch).toHaveBeenCalledTimes(10);
});

it('review r1 m2: closing the sheet (unmount, or active -> false) stops the window', async () => {
  const addrs = Array.from({length: 12}, (_, i) => `acc${i}`);
  const a = renderHook(() => useAccountRowBalances(addrs, true), {wrapper});
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(10));
  a.unmount();
  await act(async () => {
    pending.acc0!.resolve(SNAP);
  });
  await act(async () => {});
  expect(mockFetch).toHaveBeenCalledTimes(10);

  mockFetch.mockClear();
  const b = renderHook(({on}: {on: boolean}) => useAccountRowBalances(addrs.map(x => `b${x}`), on), {wrapper, initialProps: {on: true}});
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(10));
  b.rerender({on: false});
  await act(async () => {
    pending.bacc0!.resolve(SNAP);
  });
  await act(async () => {});
  expect(mockFetch).toHaveBeenCalledTimes(10);
});

it('post-M1d §3.1 / R5: a failed re-read of a row read earlier in this session is "stale" with that figure (was "failed")', async () => {
  qc.setQueryData(KEY('acc0'), SNAP, {updatedAt: Date.now() - 60_000});
  const {result} = renderHook(() => useAccountRowBalances(['acc0'], true), {wrapper});
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  await act(async () => {
    pending.acc0!.reject(new Error('429'));
  });
  await waitFor(() => expect(result.current.acc0).toMatchObject({state: 'stale', data: SNAP, at: expect.any(Number)}));
});

it('R5: a row never read whose first read fails is "failed" (Balance unavailable)', async () => {
  const {result} = renderHook(() => useAccountRowBalances(['acc0'], true), {wrapper});
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  await act(async () => {
    pending.acc0!.reject(new Error('429'));
  });
  await waitFor(() => expect(result.current.acc0).toEqual({state: 'failed'}));
});

it('review r1 N2: a successful re-read shows the fresh figure (cache seeded OLD, re-read returns NEW → NEW); in flight it still shows OLD', async () => {
  const OLD = {...SNAP, solBalance: '111'};
  const NEW = {...SNAP, solBalance: '222'};
  qc.setQueryData(KEY('acc0'), OLD, {updatedAt: Date.now() - 60_000});
  const {result} = renderHook(() => useAccountRowBalances(['acc0'], true), {wrapper});
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  expect(result.current.acc0).toMatchObject({state: 'ready', data: OLD}); // in flight: the cached figure
  await act(async () => {
    pending.acc0!.resolve(NEW);
  });
  await waitFor(() => expect(result.current.acc0).toMatchObject({state: 'ready', data: NEW}));
});
