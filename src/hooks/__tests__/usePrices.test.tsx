/**
 * usePrices schedules no query on a build without pricing (devnet): the price function is never
 * called and the data stays undefined. Mainnet is the positive control.
 */
import React from 'react';
import {render, act, waitFor} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

const mockNetwork = {current: 'mainnet-beta' as 'devnet' | 'mainnet-beta'};
jest.mock('../../constants/chain', () => {
  const actual = jest.requireActual('../../constants/chain');
  return {...actual, isPricingEnabled: () => actual.isPricingEnabled(mockNetwork.current)};
});
const mockFetchPrices = jest.fn(async () => ({native: {usd: 150, change24h: 1}}));
jest.mock('../../modules/prices/priceModule', () => ({fetchPrices: () => mockFetchPrices()}));

import {usePrices} from '../usePrices';

type Result = ReturnType<typeof usePrices>;
const seen: {current: Result | null} = {current: null};
function Probe() {
  seen.current = usePrices();
  return null;
}

let qc: QueryClient;
let unmount: (() => void) | null = null;

async function mount() {
  qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
  const r = render(
    <QueryClientProvider client={qc}>
      <Probe />
    </QueryClientProvider>,
  );
  unmount = r.unmount;
  await act(async () => {});
}

afterEach(() => {
  unmount?.();
  unmount = null;
  qc.clear();
  mockFetchPrices.mockClear();
  mockNetwork.current = 'mainnet-beta';
});

it('devnet: no query is scheduled — the price function is never called', async () => {
  mockNetwork.current = 'devnet';
  await mount();
  expect(mockFetchPrices).not.toHaveBeenCalled();
  expect(seen.current?.fetchStatus).toBe('idle');
  expect(seen.current?.data).toBeUndefined();
});

it('mainnet (control): the prices are fetched', async () => {
  await mount();
  await waitFor(() => expect(seen.current?.data).toEqual({native: {usd: 150, change24h: 1}}), {timeout: 5000});
  expect(mockFetchPrices).toHaveBeenCalledTimes(1);
});
