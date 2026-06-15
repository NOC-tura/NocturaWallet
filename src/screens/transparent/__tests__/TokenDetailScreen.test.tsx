import React from 'react';
import {render} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {TokenDetailScreen} from '../TokenDetailScreen';

// ── Module mocks (jest.mock is hoisted above all imports) ─────────────────────

jest.mock('../../../hooks/useResolvedPrices', () => ({
  useResolvedPrices: () => ({prices: {native: {usd: 150, change24h: 2}}, havePrices: true}),
}));

jest.mock('../../../hooks/usePriceHistory', () => ({
  usePriceHistory: () => ({data: {prices: [100, 120, 150]}, isLoading: false, isError: false}),
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
  SHIELDED_ADDRESS_HRP: 'noc',
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
      />,
    ),
  );
  expect(getByText('YOUR HOLDINGS')).toBeTruthy();
});

it('renders Swap action with Soon sub-label', () => {
  const {getByText} = render(
    withSafeArea(
      <TokenDetailScreen
        mint="native"
        onBack={() => {}}
        onSend={jest.fn()}
        onReceive={() => {}}
      />,
    ),
  );
  expect(getByText('Swap')).toBeTruthy();
  expect(getByText('Soon')).toBeTruthy();
});

it('renders NOC variant with pre-TGE ticker and no chart', () => {
  const {getByText, queryByText} = render(
    withSafeArea(
      <TokenDetailScreen
        mint="B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW"
        onBack={() => {}}
        onSend={jest.fn()}
        onReceive={() => {}}
      />,
    ),
  );
  expect(getByText('NOC · pre-TGE')).toBeTruthy();
  expect(getByText('Pre-TGE · no market chart yet')).toBeTruthy();
  // Timeframe chips should not render for NOC
  expect(queryByText('24H')).toBeNull();
});
