/**
 * The dashboard says which chain it is on, and the devnet build shows no mainnet prices.
 *
 * Devnet: a "Devnet" chip in the header, and the real price pipeline (usePrices → fetchPrices →
 * useResolvedPrices → computePortfolio) yields no price, so the hero is its no-price "—", no
 * "· 24h" line and no "$" figure anywhere — and not one price request is made. Mainnet is the
 * control: no chip, the prices render as before. Every request is a mock; no host is contacted.
 */
import React from 'react';
import {render, act, waitFor} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

// ── The build's chain, switchable per test ──────────────────────────────────
const mockNetwork = {current: 'mainnet-beta' as 'devnet' | 'mainnet-beta'};
jest.mock('../../../constants/chain', () => {
  const actual = jest.requireActual('../../../constants/chain');
  return {
    ...actual,
    get CHAIN() {
      return actual.chainIdentity(mockNetwork.current);
    },
    isPricingEnabled: () => actual.isPricingEnabled(mockNetwork.current),
    isPresaleEnabled: () => actual.isPresaleEnabled(mockNetwork.current),
  };
});

// ── The price requests (the only network the real pipeline would touch) ─────
jest.mock('../../../modules/sslPinning/pinnedFetch', () => ({
  pinnedFetch: jest.fn(),
  rethrowIfSSLPinningError: () => {},
}));
import {pinnedFetch} from '../../../modules/sslPinning/pinnedFetch';
const mockPinned = pinnedFetch as jest.Mock;
const backendBody = {
  success: true,
  data: {
    solana: {usd: 178.42, usd_24h_change: 2.34},
    'usd-coin': {usd: 1, usd_24h_change: 0},
    tether: {usd: 1, usd_24h_change: 0},
  },
};

// ── The A0 shielded view + the pool's note count (as in DashboardScreen.test) ─
jest.mock('../../../hooks/useA0Shielded', () => ({
  useA0Shielded: () => ({
    view: {kind: 'ready', unspent: 0n, pending: 0n, notes: 0},
    refresh: jest.fn(),
    checkAgain: {disabled: false, checking: false, note: null, run: jest.fn()},
  }),
}));
jest.mock('../../../modules/shielded/a0/poolSize', () => ({
  readA0PoolNoteCount: () => Promise.resolve({status: 'unavailable'}),
}));
jest.mock('../../../modules/solana/connection', () => ({getConnection: () => ({})}));

// M1d: the dashboard reads the selected account (main here) and its public data — the walletStore mock's values
jest.mock('../../../hooks/useSelectedAccount', () => ({
  useSelectedAccount: () => ({scheme: 'slip10:0', address: 'AbCdEfAbCdEf', label: 'Account 1', number: 1, role: 'main', isMain: true, linked: false}),
  useAccountList: () => null,
  useAccounts: () => null,
  useSelectAccount: () => () => true,
  useRefreshAccounts: () => () => undefined,
}));
jest.mock('../../../hooks/useAccountPublicData', () => {
  const store = jest.requireMock('../../../store/zustand/walletStore') as {useWalletStore: () => Record<string, unknown>};
  return {
    NO_PUBLIC_DATA: {solBalance: '0', nocBalance: '0', tokenBalances: {}, tokens: []},
    useAccountPublicData: () => ({data: {status: 'ready', syncedAt: 1, ...store.useWalletStore()}, refetch: () => undefined}),
  };
});

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    const {useEffect} = require('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(cb, []);
  },
}));

// ── Stores ──────────────────────────────────────────────────────────────────
jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: () => ({
    publicKey: 'AbCdEfAbCdEf',
    solBalance: '1000000000', // 1 SOL
    nocBalance: '2000000000', // 2 NOC
    tokens: [],
    tokenBalances: {},
  }),
}));
jest.mock('../../../store/zustand/shieldedStore', () => ({
  useShieldedStore: () => ({mode: 'transparent', setMode: jest.fn()}),
}));
jest.mock('../../../store/zustand/publicSettingsStore', () => ({
  usePublicSettingsStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({hideBalances: false, setHideBalances: jest.fn()}),
}));
jest.mock('../../../store/zustand/presaleStore', () => ({
  usePresaleStore: (sel: (s: {currentStage: number; pricePerNoc: string | null}) => unknown) =>
    sel({currentStage: 1, pricePerNoc: null}),
}));

// ── Hooks / modules unrelated to prices ─────────────────────────────────────
jest.mock('../../../hooks/useNetworkStatus', () => ({useNetworkStatus: () => ({isOnline: true})}));
jest.mock('../../../hooks/useAccent', () => ({useAccentColor: () => '#B084FC'}));
jest.mock('../../../hooks/usePresaleSync', () => ({usePresaleSync: () => ({isPaused: true})}));
jest.mock('../../../modules/backgroundSync/backgroundSyncModule', () => ({
  forceSync: jest.fn().mockResolvedValue({success: true}),
}));
jest.mock('../../../modules/tokens/tokenModule', () => ({
  TokenManager: jest.fn().mockImplementation(() => ({sortTokens: (t: unknown[]) => t})),
}));
jest.mock('../../../constants/features', () => ({isShieldedEnabled: () => true}));
jest.mock('../../../components/TokenLogo', () => ({
  TokenLogo: ({symbol}: {symbol: string}) => {
    const React2 = require('react');
    const {Text} = require('react-native');
    return React2.createElement(Text, null, symbol);
  },
}));
jest.mock('../../../components/PresaleBanner', () => ({PresaleBanner: () => null}));

import {DashboardScreen} from '../DashboardScreen';

let qc: QueryClient | null = null;
let fetchSpy: jest.Mock;
let mounted: {unmount: () => void} | null = null;

async function renderDashboard() {
  qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
  const result = render(
    <QueryClientProvider client={qc}>
      <SafeAreaProvider
        initialMetrics={{
          frame: {x: 0, y: 0, width: 390, height: 844},
          insets: {top: 0, left: 0, right: 0, bottom: 0},
        }}>
        <DashboardScreen />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
  mounted = result;
  await act(async () => {});
  return result;
}

beforeEach(() => {
  mockPinned.mockReset();
  mockPinned.mockResolvedValue({status: 200, json: async () => backendBody});
  fetchSpy = jest.fn(() => Promise.reject(new Error('no network in tests')));
  global.fetch = fetchSpy as unknown as typeof fetch;
});

// Teardown on every path: a failing row never leaves its tree or its queries behind.
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  qc?.clear();
  qc = null;
});

describe('DashboardScreen — the chain identity', () => {
  it('devnet: the "Devnet" chip is shown; no "$" figure, no "· 24h"; not one price request', async () => {
    mockNetwork.current = 'devnet';
    const r = await renderDashboard();
    // Nothing is scheduled on devnet (usePrices is disabled), so the first committed tree is final.
    await waitFor(() => expect(r.getByTestId('dashboard-chain-badge')).toBeTruthy(), {timeout: 10000});
    expect(qc?.isFetching()).toBe(0);
    expect(r.getByText('Devnet')).toBeTruthy();
    expect(r.queryAllByText(/\$/)).toHaveLength(0);
    expect(r.queryByText(/· 24h/)).toBeNull();
    expect(r.getAllByText('—').length).toBeGreaterThan(0); // the hero's existing no-price form
    expect(mockPinned).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30000);

  it('mainnet (control): no chip; the total, the 24h change and the row values render', async () => {
    mockNetwork.current = 'mainnet-beta';
    const r = await renderDashboard();
    await waitFor(() => expect(r.queryByText(/· 24h/)).not.toBeNull(), {timeout: 10000});

    expect(r.queryByTestId('dashboard-chain-badge')).toBeNull();
    expect(r.queryByText('Devnet')).toBeNull();
    expect(r.getByText('+2.34% · 24h')).toBeTruthy(); // SOL's change (NOC carries none)
    expect(r.getByText('$178.42')).toBeTruthy(); // the SOL row: 1 SOL × 178.42
    expect(mockPinned).toHaveBeenCalled();
  }, 30000);
});
