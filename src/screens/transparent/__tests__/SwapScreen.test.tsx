import React from 'react';
import {render} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {SwapScreen} from '../SwapScreen';

// ── Module mocks (jest.mock is hoisted above all imports) ─────────────────────

jest.mock('../../../hooks/useSwapQuote', () => ({
  useSwapQuote: () => ({data: undefined, isLoading: false, isError: false}),
}));

// M1d (spec §4.3): this screen stays on the main account and says so while another account is selected
const mockLineSelected: {current: {scheme: string; address: string; label: string; isMain: boolean}} = {
  current: {scheme: 'slip10:0', address: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', label: 'Account 1', isMain: true},
};
jest.mock('../../../hooks/useSelectedAccount', () => ({
  useSelectedAccount: () => mockLineSelected.current,
  useAccountList: () => ({
    accounts: [{scheme: 'slip10:0', address: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', label: 'Account 1', isMain: true}],
    seed: [],
    walletKind: 'slip10',
    unreadable: false,
  }),
}));
const LINE_EXIT = {scheme: 'slip10:3', address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4', isMain: false};
const LINE_MAIN = {scheme: 'slip10:0', address: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', label: 'Account 1', isMain: true};

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

  it('M1d: another account selected → "From: Account 1 (main)"; main selected → no line', () => {
    mockLineSelected.current = LINE_EXIT;
    expect(render(withSafeArea(<SwapScreen onBack={() => {}} onDone={() => {}} />)).getByTestId('swap-main-account')).toHaveTextContent('From: Account 1 (main)');
    mockLineSelected.current = LINE_MAIN;
    expect(render(withSafeArea(<SwapScreen onBack={() => {}} onDone={() => {}} />)).queryByTestId('swap-main-account')).toBeNull();
  });
});
