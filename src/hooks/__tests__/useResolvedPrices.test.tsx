/**
 * The resolved prices on devnet: none. Devnet SOL has no market, and NOC's presale price exists on
 * mainnet only, so the devnet build reports no price at all (`havePrices` false) — every surface
 * then shows its no-price form instead of a mainnet figure. Mainnet is the positive control.
 */
import React from 'react';
import {render} from '@testing-library/react-native';
import type {TokenPrice} from '../../modules/prices/priceModule';

const mockNetwork = {current: 'mainnet-beta' as 'devnet' | 'mainnet-beta'};
jest.mock('../../constants/chain', () => {
  const actual = jest.requireActual('../../constants/chain');
  return {...actual, isPricingEnabled: () => actual.isPricingEnabled(mockNetwork.current)};
});
const mockMarket: {current: Record<string, TokenPrice> | undefined} = {current: undefined};
jest.mock('../usePrices', () => ({usePrices: () => ({data: mockMarket.current})}));
jest.mock('../../store/zustand/presaleStore', () => ({
  usePresaleStore: (sel: (s: {currentStage: number; pricePerNoc: string | null}) => unknown) =>
    sel({currentStage: 1, pricePerNoc: null}),
}));

import {useResolvedPrices} from '../useResolvedPrices';
import {NOC_MINT} from '../../constants/programs';

function resolve(): ReturnType<typeof useResolvedPrices> {
  const out: {current: ReturnType<typeof useResolvedPrices> | null} = {current: null};
  function Probe() {
    out.current = useResolvedPrices();
    return null;
  }
  render(<Probe />);
  if (out.current == null) throw new Error('the probe did not render');
  return out.current;
}

describe('useResolvedPrices', () => {
  it('devnet: no prices and havePrices false — not even NOC\'s presale price', () => {
    mockNetwork.current = 'devnet';
    mockMarket.current = {}; // what fetchPrices resolves to on devnet
    const r = resolve();
    expect(r.havePrices).toBe(false);
    expect(r.prices).toEqual({});
  });

  it('mainnet (control): the market prices plus NOC, havePrices true', () => {
    mockNetwork.current = 'mainnet-beta';
    mockMarket.current = {native: {usd: 150, change24h: 1}};
    const r = resolve();
    expect(r.havePrices).toBe(true);
    expect(r.prices.native).toEqual({usd: 150, change24h: 1});
    expect(r.prices[NOC_MINT]?.usd).toBeGreaterThan(0);
  });
});
