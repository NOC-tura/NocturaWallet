import React from 'react';
import {render} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {SwapScreen} from '../SwapScreen';

// ── Module mocks (jest.mock is hoisted above all imports) ─────────────────────

jest.mock('../../../hooks/useSwapQuote', () => ({
  useSwapQuote: () => ({data: undefined, isLoading: false, isError: false}),
}));

jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: () => ({solBalance: '2000000000', nocBalance: '0', tokenBalances: {}, tokens: []}),
}));

jest.mock('../../../store/mmkv/instances', () => ({
  mmkvPublic: {
    set: jest.fn(),
    getString: jest.fn().mockReturnValue(undefined),
    getNumber: jest.fn().mockReturnValue(undefined),
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

describe('SwapScreen', () => {
  it('renders the Swap title', () => {
    const {getByText} = render(
      withSafeArea(<SwapScreen onBack={() => {}} onDone={() => {}} />),
    );
    expect(getByText('Swap')).toBeTruthy();
  });
});
