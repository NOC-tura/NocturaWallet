/**
 * DashboardScreen tests — shielded-mode real balances + anonymity + empty state.
 *
 * Strategy: mock every external module/hook so the component tree renders in
 * Jest/Node.  Two key new mocks for this feature:
 *   - shieldedBalances: getShieldedBalances (controllable per test)
 *   - poolState: fetchAnonymitySet (resolves null by default → line hidden)
 */
import React from 'react';
import {render, act} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

// ── New shielded-balance + anonymity mocks ──────────────────────────────────
jest.mock('../../../modules/shielded/shieldedBalances', () => ({
  getShieldedBalances: jest.fn(() => []),
}));

jest.mock('../../../modules/shielded/poolState', () => ({
  fetchAnonymitySet: jest.fn().mockResolvedValue(null),
}));

// ── Navigation ──────────────────────────────────────────────────────────────
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    // Call synchronously so useMemo/useState updates happen in the same render.
    // Must use require inside factory to avoid jest.mock hoisting TDZ errors.
    const {useEffect} = require('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(cb, []);
  },
}));

// ── Stores ──────────────────────────────────────────────────────────────────
const mockMode = {current: 'transparent' as 'transparent' | 'shielded'};

jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: () => ({
    publicKey: 'AbCdEfAbCdEf',
    solBalance: '1000000000',
    nocBalance: '2000000000',
    tokens: [],
    tokenBalances: {},
  }),
}));

jest.mock('../../../store/zustand/shieldedStore', () => ({
  useShieldedStore: () => ({mode: mockMode.current, setMode: jest.fn()}),
}));

jest.mock('../../../store/zustand/publicSettingsStore', () => ({
  usePublicSettingsStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({hideBalances: false, setHideBalances: jest.fn()}),
}));

// ── Hooks ───────────────────────────────────────────────────────────────────
jest.mock('../../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({isOnline: true}),
}));

jest.mock('../../../hooks/useAccent', () => ({
  useAccentColor: () => '#B084FC',
}));

jest.mock('../../../hooks/useResolvedPrices', () => ({
  useResolvedPrices: () => ({
    prices: {'native': {usd: 150, change24h: 1.5}},
    havePrices: true,
  }),
}));

jest.mock('../../../hooks/usePresaleSync', () => ({
  usePresaleSync: () => ({isPaused: true}),
}));

// ── Modules ─────────────────────────────────────────────────────────────────
jest.mock('../../../modules/backgroundSync/backgroundSyncModule', () => ({
  forceSync: jest.fn().mockResolvedValue({success: true}),
}));

jest.mock('../../../modules/tokens/tokenModule', () => ({
  TokenManager: jest.fn().mockImplementation(() => ({
    sortTokens: (t: unknown[]) => t,
  })),
}));

jest.mock('../../../modules/prices/holdings', () => ({
  buildHoldings: jest.fn(() => []),
}));

jest.mock('../../../modules/prices/portfolio', () => ({
  computePortfolio: jest.fn(() => ({
    totalUsd: 150,
    change24hPct: 1.5,
    perToken: {},
  })),
}));

// ── Constants ────────────────────────────────────────────────────────────────
jest.mock('../../../constants/features', () => ({
  isShieldedEnabled: () => true,
}));

// ── Components ───────────────────────────────────────────────────────────────
jest.mock('../../../components/TokenLogo', () => ({
  TokenLogo: ({symbol}: {symbol: string}) => {
    const React2 = require('react');
    const {Text} = require('react-native');
    return React2.createElement(Text, null, symbol);
  },
}));

jest.mock('../../../components/PresaleBanner', () => ({
  PresaleBanner: () => null,
}));

// ── Subject ──────────────────────────────────────────────────────────────────
// Import AFTER all mocks are registered.
import {DashboardScreen} from '../DashboardScreen';
import {getShieldedBalances} from '../../../modules/shielded/shieldedBalances';
import {fetchAnonymitySet} from '../../../modules/shielded/poolState';

const mockGetShieldedBalances = getShieldedBalances as jest.MockedFunction<typeof getShieldedBalances>;
const mockFetchAnonymitySet = fetchAnonymitySet as jest.MockedFunction<typeof fetchAnonymitySet>;

// ── Helper ───────────────────────────────────────────────────────────────────
// Render + flush all async effects (fetchAnonymitySet promise) in one go so
// assertions against async-resolved state work without extra await in each test.

async function renderDashboard() {
  const result = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: {x: 0, y: 0, width: 390, height: 844},
        insets: {top: 0, left: 0, right: 0, bottom: 0},
      }}>
      <DashboardScreen />
    </SafeAreaProvider>,
  );
  // Flush all enqueued micro-tasks (resolves the fetchAnonymitySet promise and
  // the subsequent setState so assertions never see the un-flushed state).
  await act(async () => {});
  return result;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockMode.current = 'transparent';
  mockGetShieldedBalances.mockReturnValue([]);
  mockFetchAnonymitySet.mockResolvedValue(null);
});

describe('DashboardScreen — transparent mode', () => {
  it('renders the dashboard root', async () => {
    const {getByTestId} = await renderDashboard();
    expect(getByTestId('dashboard-screen')).toBeTruthy();
  });

  it('shows "Total balance" overline in transparent mode', async () => {
    const {getByText} = await renderDashboard();
    expect(getByText('Total balance')).toBeTruthy();
  });

  it('does NOT render shielded empty state in transparent mode', async () => {
    mockGetShieldedBalances.mockReturnValue([]);
    mockMode.current = 'transparent';
    const {queryByText} = await renderDashboard();
    expect(queryByText('Nothing shielded yet')).toBeNull();
  });
});

describe('DashboardScreen — shielded mode, empty state', () => {
  beforeEach(() => {
    mockMode.current = 'shielded';
    // All-zero rows → empty state
    mockGetShieldedBalances.mockReturnValue([
      {mint: 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW', symbol: 'NOC', name: 'Noctura', decimals: 9, amount: 0n},
    ]);
  });

  it('shows the shielded empty-state heading', async () => {
    const {getByText} = await renderDashboard();
    expect(getByText('Nothing shielded yet')).toBeTruthy();
  });

  it('shows the empty-state sub-line', async () => {
    const {getByText} = await renderDashboard();
    expect(getByText('Tap Shield to make a token private')).toBeTruthy();
  });

  it('does NOT render an anonymity set line when fetch returns null', async () => {
    mockFetchAnonymitySet.mockResolvedValue(null);
    const {queryByText} = await renderDashboard();
    expect(queryByText(/Anonymity set/)).toBeNull();
  });
});

describe('DashboardScreen — shielded mode, with balance', () => {
  beforeEach(() => {
    mockMode.current = 'shielded';
    // 200_000_000 raw units with 9 decimals = 0.2 tokens
    mockGetShieldedBalances.mockReturnValue([
      {mint: 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW', symbol: 'TEST', name: 'Test Token', decimals: 9, amount: 200_000_000n},
    ]);
  });

  it('renders a shielded row with "· shielded" label', async () => {
    const {getByText} = await renderDashboard();
    // uiAmount = 200_000_000 / 1e9 = 0.2; toFixed(4) = "0.2000"
    expect(getByText('0.2000 · shielded')).toBeTruthy();
  });

  it('renders the token name in the row', async () => {
    const {getByText} = await renderDashboard();
    expect(getByText('Test Token')).toBeTruthy();
  });

  it('does NOT render the transparent empty-state in shielded mode with balance', async () => {
    const {queryByText} = await renderDashboard();
    expect(queryByText('No tokens yet · pull to refresh')).toBeNull();
    expect(queryByText('Nothing shielded yet')).toBeNull();
  });

  it('shows the anonymity set line when fetch resolves a number', async () => {
    mockFetchAnonymitySet.mockResolvedValue(42);
    const {getByText} = await renderDashboard();
    expect(getByText('Anonymity set · 42')).toBeTruthy();
  });
});
