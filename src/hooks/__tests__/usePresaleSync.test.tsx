/**
 * The dashboard's presale sync asks nothing in a build without presale (S13: the devnet build):
 * no coordinator stats, no on-chain allocation, no TGE read. Mainnet is the positive control.
 */
import React from 'react';
import {render, waitFor} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

const mockStats = jest.fn(async () => ({displayStage: 1, pricePerNocUsd: 0.01, soldInStageBase: '0', stageCapacityBase: '1', isPaused: false}));
const mockAlloc = jest.fn(async () => ({tokensPurchasedBase: '0', referralBonusBase: '0'}));
const mockOnChain = jest.fn(async () => ({exists: false}));
const mockTge = jest.fn(async () => 0);
jest.mock('../../modules/presale/presaleModule', () => ({
  fetchPresaleStats: () => mockStats(),
  fetchUserAllocation: () => mockAlloc(),
}));
jest.mock('../../modules/presale/presaleBuyModule', () => ({
  fetchOnChainAllocation: () => mockOnChain(),
  fetchTgeTimestamp: () => mockTge(),
}));
jest.mock('../../store/zustand/walletStore', () => ({
  useWalletStore: (sel: (s: {publicKey: string}) => unknown) => sel({publicKey: '7iQkaB129HR4mWZ8tNxF6jqLK3sP8eM2vRgCd4Y7abcd'}),
}));
jest.mock('../../store/zustand/presaleStore', () => ({
  usePresaleStore: (sel: (s: Record<string, () => void>) => unknown) =>
    sel({setStageInfo: () => {}, setAllocation: () => {}, setTgeTimestamp: () => {}}),
}));
let mockPresale = false;
jest.mock('../../constants/chain', () => ({isPresaleEnabled: () => mockPresale}));

import {usePresaleSync} from '../usePresaleSync';

function Probe() {
  usePresaleSync();
  return null;
}
function mount() {
  const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return render(
    <QueryClientProvider client={qc}>
      <Probe />
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

it('devnet (no presale): not one presale request', async () => {
  mockPresale = false;
  const r = mount();
  await new Promise(res => setTimeout(res, 50));
  expect(mockStats).not.toHaveBeenCalled();
  expect(mockOnChain).not.toHaveBeenCalled();
  expect(mockAlloc).not.toHaveBeenCalled();
  expect(mockTge).not.toHaveBeenCalled();
  r.unmount();
});

it('mainnet (control): the stats, the allocation and the TGE are read', async () => {
  mockPresale = true;
  const r = mount();
  await waitFor(() => {
    expect(mockStats).toHaveBeenCalled();
    expect(mockOnChain).toHaveBeenCalled();
    expect(mockTge).toHaveBeenCalled();
  });
  r.unmount();
});
