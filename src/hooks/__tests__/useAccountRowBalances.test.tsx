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
