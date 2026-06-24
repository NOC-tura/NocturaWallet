import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {canBuy, FEE_HEADROOM_SOL} from '../PresaleScreen';
import {
  MIN_PURCHASE_USD,
  MAX_PURCHASE_USD,
} from '../../modules/presale/presaleBuyModule';

const SOL_USD = 200;
const base = {solUsd: SOL_USD, solBalance: 10, tokenBalance: 1000};

describe('canBuy (token-aware)', () => {
  it('SOL: zero/min/max/balance', () => {
    expect(canBuy({...base, paymentToken: 'SOL', amount: '0'}).enabled).toBe(false);
    expect(canBuy({...base, paymentToken: 'SOL', amount: '0.04'}).reason).toBe('Minimum $10'); // $8
    expect(canBuy({...base, paymentToken: 'SOL', amount: '300', solBalance: 1000}).reason).toBe('Maximum $50,000 per transaction');
    expect(canBuy({...base, paymentToken: 'SOL', amount: '1', solBalance: 1}).reason).toBe('Insufficient SOL balance');
    expect(canBuy({...base, paymentToken: 'SOL', amount: '0.2'}).enabled).toBe(true);
  });
  it('USDC/USDT: 1:1 USD min/max + token balance + SOL fee headroom', () => {
    expect(canBuy({...base, paymentToken: 'USDC', amount: '8'}).reason).toBe('Minimum $10');
    expect(canBuy({...base, paymentToken: 'USDC', amount: '60000', tokenBalance: 100000}).reason).toBe('Maximum $50,000 per transaction');
    expect(canBuy({...base, paymentToken: 'USDC', amount: '50', tokenBalance: 20}).reason).toBe('Insufficient USDC balance');
    expect(canBuy({...base, paymentToken: 'USDT', amount: '50', solBalance: 0}).reason).toBe('Need a little SOL for the network fee');
    expect(canBuy({...base, paymentToken: 'USDC', amount: '50'}).enabled).toBe(true);
    expect(canBuy({...base, paymentToken: 'USDC', amount: '10'}).enabled).toBe(true); // inclusive $10
  });
  it('exposes MIN $10 / MAX $50,000 + fee headroom', () => {
    expect(MIN_PURCHASE_USD).toBe(10);
    expect(MAX_PURCHASE_USD).toBe(50_000);
    expect(FEE_HEADROOM_SOL).toBe(0.001);
  });
});

// ── Geo-gate wiring (renders PresaleActive) ──────────────────────────────────

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate, goBack: mockGoBack}),
}));

// Mode-aware Button reads useShieldedStore via useMode; pin to transparent.
jest.mock('../../store/zustand/shieldedStore', () => ({
  useShieldedStore: (selector: (s: {mode: string}) => unknown) =>
    selector({mode: 'transparent'}),
}));

jest.mock('../../store/zustand/presaleStore', () => ({
  usePresaleStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      pricePerNoc: '0.05',
      soldInStage: '0',
      stageCapacity: '1000000',
      tokensPurchased: '0',
      referralBonusTokens: '0',
    }),
}));

jest.mock('../../store/zustand/walletStore', () => ({
  useWalletStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({solBalance: '10000000000', tokenBalances: {}}),
}));

jest.mock('../../hooks/useResolvedPrices', () => ({
  useResolvedPrices: () => ({
    prices: {native: {usd: 200}},
    havePrices: true,
  }),
}));

// Real isPresaleBlocked (pure), mocked checkJurisdiction (no network).
// The mock fn is created INSIDE the factory (not captured from outer scope) to
// avoid the jest.mock-hoist TDZ trap; we grab a typed handle below.
jest.mock('../../modules/geoFence/geoFenceModule', () => {
  const actual = jest.requireActual('../../modules/geoFence/geoFenceModule');
  return {
    ...actual,
    geoFenceManager: {checkJurisdiction: jest.fn()},
  };
});

// Imported after the mocks above are registered.
import {geoFenceManager} from '../../modules/geoFence/geoFenceModule';
import {PresaleActive} from '../PresaleScreen';

const mockCheckJurisdiction =
  geoFenceManager.checkJurisdiction as jest.MockedFunction<
    typeof geoFenceManager.checkJurisdiction
  >;

function renderActive() {
  const client = new QueryClient({
    defaultOptions: {queries: {retry: false}},
  });
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: {x: 0, y: 0, width: 390, height: 844},
        insets: {top: 0, left: 0, right: 0, bottom: 0},
      }}>
      <QueryClientProvider client={client}>
        <PresaleActive
          onSkip={jest.fn()}
          onComplete={jest.fn()}
          isOnboarding={false}
          currentStage={1}
        />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('PresaleActive — geo gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks the buy CTA and routes to GeoBlocked when sanctioned', async () => {
    mockCheckJurisdiction.mockResolvedValue({
      action: 'block',
      countryCode: 'KP',
      transparentAllowed: true,
    });
    const {findByText, getByTestId} = renderActive();

    // Wait for the jurisdiction query to resolve — the blocked CTA label
    // ("Not available in your region") replaces the "Buy NOC" label.
    await findByText('Not available in your region');
    const cta = getByTestId('presale-buy-button');

    fireEvent.press(cta);
    // The blocked CTA navigates to GeoBlocked — NOT to the buy confirm flow.
    expect(mockNavigate).toHaveBeenCalledWith('GeoBlocked', {
      countryCode: 'KP',
      presaleBlocked: true,
    });
    expect(mockNavigate).not.toHaveBeenCalledWith(
      'PresaleBuyConfirm',
      expect.anything(),
    );
  });

  it('routes the region link to GeoBlocked', async () => {
    mockCheckJurisdiction.mockResolvedValue({
      action: 'block',
      countryCode: 'KP',
      transparentAllowed: true,
    });
    const {findByText, getByText} = renderActive();
    // Wait for the jurisdiction query to resolve (blocked CTA appears).
    await findByText('Not available in your region');
    fireEvent.press(getByText('Not available in your region?'));
    expect(mockNavigate).toHaveBeenCalledWith('GeoBlocked', {
      countryCode: 'KP',
      presaleBlocked: true,
    });
  });

  it('keeps the normal Buy CTA when allowed (no geo navigation)', async () => {
    mockCheckJurisdiction.mockResolvedValue({
      action: 'allow',
      countryCode: 'SI',
      transparentAllowed: true,
    });
    const {findByTestId, queryByText} = renderActive();
    // Let the query resolve.
    const cta = await findByTestId('presale-buy-button');
    expect(queryByText('Not available in your region')).toBeNull();

    // No amount entered → gate disabled → onBuy is a no-op (no navigation).
    fireEvent.press(cta);
    expect(mockNavigate).not.toHaveBeenCalledWith(
      'GeoBlocked',
      expect.anything(),
    );
  });
});
