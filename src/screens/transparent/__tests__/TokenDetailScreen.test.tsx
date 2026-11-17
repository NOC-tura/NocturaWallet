import React from 'react';
import {render} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {TokenDetailScreen} from '../TokenDetailScreen';

// ── Module mocks (jest.mock is hoisted above all imports) ─────────────────────

// The build's chain, switchable per test (mainnet by default: every pre-existing row unchanged).
const mockNetwork = {current: 'mainnet-beta' as 'devnet' | 'mainnet-beta'};
jest.mock('../../../constants/chain', () => {
  const actual = jest.requireActual('../../../constants/chain');
  return {...actual, isPricingEnabled: () => actual.isPricingEnabled(mockNetwork.current)};
});

// As the real hook resolves: no price at all on a build without pricing (devnet).
jest.mock('../../../hooks/useResolvedPrices', () => ({
  useResolvedPrices: () =>
    mockNetwork.current === 'devnet'
      ? {prices: {}, havePrices: false}
      : {prices: {native: {usd: 150, change24h: 2}}, havePrices: true},
}));

// As the real (react-query) hook: with no id the query is disabled and holds no data.
const mockPriceHistory = jest.fn((id: string | null, _tf: string) => ({
  data: id == null ? undefined : {prices: [100, 120, 150]},
  isLoading: false,
  isError: false,
}));
jest.mock('../../../hooks/usePriceHistory', () => ({
  usePriceHistory: (id: string | null, tf: string) => mockPriceHistory(id, tf),
}));

jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: () => ({
    solBalance: '2000000000',
    nocBalance: '0',
    tokenBalances: {},
    tokens: [],
  }),
}));

jest.mock('../../../store/mmkv/instances', () => ({
  mmkvPublic: {
    set: jest.fn(),
    getString: jest.fn().mockReturnValue(undefined),
    getBoolean: jest.fn().mockReturnValue(false),
    getAllKeys: jest.fn().mockReturnValue([]),
    remove: jest.fn(),
  },
  mmkvSecure: jest.fn().mockReturnValue(null),
  initSecureMmkv: jest.fn(),
  onSecureMmkvReady: jest.fn(),
}));

jest.mock('../../../modules/swap/swapTokens', () => ({
  isSwappable: (mint: string) => mint === 'native' || mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
}));

jest.mock('../../../constants/programs', () => ({
  NOC_MINT: 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW',
  NOC_DECIMALS: 9,
  IS_DEVNET: false,
  NETWORK: 'mainnet-beta',
  PROGRAM_ID: '6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt',
  ADMIN_ADDRESS: 'KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr',
  SOL_TREASURY: '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd',
  NOCTURA_FEE_TREASURY: 'KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr',
  RPC_ENDPOINT: 'https://rpc.helius.xyz',
  RPC_WEBSOCKET: 'wss://rpc.helius.xyz',
  API_BASE: 'https://api.noctura.io/v1',
  TRANSPARENT_FEES: {transferMarkup: 20000n},
  SHIELDED_FEES: {},
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function withSafeArea(node: React.ReactElement) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        insets: {top: 0, bottom: 0, left: 0, right: 0},
        frame: {x: 0, y: 0, width: 0, height: 0},
      }}>
      {node}
    </SafeAreaProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

it('renders Send action button', () => {
  const {getByText} = render(
    withSafeArea(
      <TokenDetailScreen
        mint="native"
        onBack={() => {}}
        onSend={jest.fn()}
        onReceive={() => {}}
        onSwap={jest.fn()}
      />,
    ),
  );
  expect(getByText('Send')).toBeTruthy();
});

it('renders Receive action button', () => {
  const {getByText} = render(
    withSafeArea(
      <TokenDetailScreen
        mint="native"
        onBack={() => {}}
        onSend={jest.fn()}
        onReceive={() => {}}
        onSwap={jest.fn()}
      />,
    ),
  );
  expect(getByText('Receive')).toBeTruthy();
});

it('renders token symbol in top bar', () => {
  const {getAllByText} = render(
    withSafeArea(
      <TokenDetailScreen
        mint="native"
        onBack={() => {}}
        onSend={jest.fn()}
        onReceive={() => {}}
        onSwap={jest.fn()}
      />,
    ),
  );
  // SOL appears in the top bar title and in the holdings balance line
  expect(getAllByText('SOL').length).toBeGreaterThanOrEqual(1);
});

it('renders holdings card overline', () => {
  const {getByText} = render(
    withSafeArea(
      <TokenDetailScreen
        mint="native"
        onBack={() => {}}
        onSend={jest.fn()}
        onReceive={() => {}}
        onSwap={jest.fn()}
      />,
    ),
  );
  expect(getByText('YOUR HOLDINGS')).toBeTruthy();
});

it('renders Swap action for swappable token (SOL)', () => {
  const {getByText, queryByText} = render(
    withSafeArea(
      <TokenDetailScreen
        mint="native"
        onBack={() => {}}
        onSend={jest.fn()}
        onReceive={() => {}}
        onSwap={jest.fn()}
      />,
    ),
  );
  // SOL is swappable → Swap cell renders, no "Soon" label
  expect(getByText('Swap')).toBeTruthy();
  expect(queryByText('Soon')).toBeNull();
});

it('hides Swap action for NOC (not swappable)', () => {
  const {queryByText} = render(
    withSafeArea(
      <TokenDetailScreen
        mint="B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW"
        onBack={() => {}}
        onSend={jest.fn()}
        onReceive={() => {}}
        onSwap={jest.fn()}
      />,
    ),
  );
  // NOC is not swappable → Swap cell must not render at all
  expect(queryByText('Swap')).toBeNull();
});

it('renders NOC variant with pre-TGE ticker and no chart', () => {
  const {getByText, queryByText} = render(
    withSafeArea(
      <TokenDetailScreen
        mint="B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW"
        onBack={() => {}}
        onSend={jest.fn()}
        onReceive={() => {}}
        onSwap={jest.fn()}
      />,
    ),
  );
  expect(getByText('NOC · pre-TGE')).toBeTruthy();
  expect(getByText('Pre-TGE · no market chart yet')).toBeTruthy();
  // Timeframe chips should not render for NOC
  expect(queryByText('24H')).toBeNull();
});

describe('the chart on a build without pricing (devnet)', () => {
  beforeEach(() => mockPriceHistory.mockClear());
  afterEach(() => {
    mockNetwork.current = 'mainnet-beta';
    mockPriceHistory.mockClear();
  });

  function renderSol() {
    return render(
      withSafeArea(
        <TokenDetailScreen
          mint="native"
          onBack={() => {}}
          onSend={jest.fn()}
          onReceive={() => {}}
          onSwap={jest.fn()}
        />,
      ),
    );
  }

  it('devnet: "Chart unavailable", no timeframe chips, price "—", no history query', () => {
    mockNetwork.current = 'devnet';
    const {getByText, queryByText, queryAllByText} = renderSol();
    expect(getByText('Chart unavailable')).toBeTruthy();
    for (const tf of ['24H', '7D', '30D', '1Y']) {
      expect(queryByText(tf)).toBeNull();
    }
    expect(queryAllByText(/\$/)).toHaveLength(0);
    expect(queryAllByText('—').length).toBeGreaterThan(0);
    // The history hook is handed no id, so it schedules no query.
    expect(mockPriceHistory).toHaveBeenCalled();
    for (const call of mockPriceHistory.mock.calls) {
      expect(call[0]).toBeNull();
    }
  });

  it('mainnet (control): the chart, the four chips and the price; history asked for solana', () => {
    const {getByText, queryByText} = renderSol();
    expect(queryByText('Chart unavailable')).toBeNull();
    for (const tf of ['24H', '7D', '30D', '1Y']) {
      expect(getByText(tf)).toBeTruthy();
    }
    expect(getByText('$150.00')).toBeTruthy();
    expect(mockPriceHistory).toHaveBeenCalledWith('solana', expect.any(String));
  });
});
