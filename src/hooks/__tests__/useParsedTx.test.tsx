/**
 * History spec §4.6, §3.3: #27's read of the raw transaction — the shared per-signature cache, and a
 * transaction that is not indexed yet (an error, never cached data). Real timers only; every test
 * unmounts and clears its client, so the 4 s retry never outlives it.
 */
import React from 'react';
import {renderHook, waitFor} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useParsedTx} from '../useParsedTx';
import {applyParsedTxDefaults, parsedTxKey} from '../../modules/solana/historyReads';
import {_resetRateLimitersForTest} from '../../modules/solana/rpcLimiter';

const mockGetParsedTransaction = jest.fn();
jest.mock('../../modules/solana/connection', () => ({getConnection: () => ({getParsedTransaction: mockGetParsedTransaction})}));

let client: QueryClient;
const wrapper = ({children}: {children: React.ReactNode}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const KEY = parsedTxKey('mainnet-beta', 'SIG'); // the jest Config mock's NETWORK

beforeEach(() => {
  _resetRateLimitersForTest();
  mockGetParsedTransaction.mockReset();
  client = new QueryClient();
  applyParsedTxDefaults(client);
});
afterEach(() => {
  client.clear();
});

// U1
it('reads the transaction once, at version 1, and keeps it under the shared key', async () => {
  const answer = {slot: 7, transaction: {signatures: ['SIG']}};
  mockGetParsedTransaction.mockResolvedValue(answer);
  const {result, unmount} = renderHook(() => useParsedTx('SIG'), {wrapper});
  expect(result.current).toEqual({raw: undefined, isLoading: true, notFound: false});
  await waitFor(() => expect(result.current.raw).toEqual(answer));
  expect(result.current).toMatchObject({isLoading: false, notFound: false});
  expect(mockGetParsedTransaction).toHaveBeenCalledWith('SIG', {maxSupportedTransactionVersion: 1});
  expect(client.getQueryData(KEY)).toEqual(answer);
  unmount();
});

// U5 (plan review r2 C1 / n4): #27 never shows a transaction under another one's signature
it('an answer that is another transaction is notFound, and nothing is cached', async () => {
  mockGetParsedTransaction.mockResolvedValue({slot: 7, transaction: {signatures: ['OTHER']}});
  const {result, unmount} = renderHook(() => useParsedTx('SIG'), {wrapper});
  await waitFor(() => expect(result.current.notFound).toBe(true));
  expect(result.current.raw).toBeUndefined();
  expect(client.getQueryData(KEY)).toBeUndefined();
  unmount();
});

// U2
it('a row opened from the history costs no request: the cache #26 filled is used', () => {
  client.setQueryData(KEY, {slot: 9});
  const {result, unmount} = renderHook(() => useParsedTx('SIG'), {wrapper});
  expect(result.current).toEqual({raw: {slot: 9}, isLoading: false, notFound: false});
  expect(mockGetParsedTransaction).not.toHaveBeenCalled();
  unmount();
});

// U3
it('not indexed yet (null): notFound, and nothing is cached', async () => {
  mockGetParsedTransaction.mockResolvedValue(null);
  const {result, unmount} = renderHook(() => useParsedTx('SIG'), {wrapper});
  await waitFor(() => expect(result.current.notFound).toBe(true));
  expect(result.current).toEqual({raw: undefined, isLoading: false, notFound: true});
  expect(client.getQueryData(KEY)).toBeUndefined();
  unmount();
});

// U4
it('a read that fails is notFound too; no signature reads nothing', async () => {
  mockGetParsedTransaction.mockRejectedValue(new Error('rpc down'));
  const failing = renderHook(() => useParsedTx('SIG'), {wrapper});
  await waitFor(() => expect(failing.result.current.notFound).toBe(true));
  failing.unmount();
  mockGetParsedTransaction.mockClear();
  const none = renderHook(() => useParsedTx(null), {wrapper});
  expect(none.result.current.raw).toBeUndefined();
  expect(mockGetParsedTransaction).not.toHaveBeenCalled();
  none.unmount();
});
