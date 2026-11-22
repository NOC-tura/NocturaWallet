import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {SwapScreen} from '../SwapScreen';

// ── Module mocks (jest.mock is hoisted above all imports) ─────────────────────

const mockQuote: {current: {outAmount: string} | undefined} = {current: undefined};
jest.mock('../../../hooks/useSwapQuote', () => ({
  useSwapQuote: () => ({data: mockQuote.current, isLoading: false, isError: false}),
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

const mockForceSync = jest.fn();
jest.mock('../../../modules/backgroundSync/backgroundSyncModule', () => ({forceSync: () => mockForceSync()}));

// post-M1d Task 5 (controller ruling): the sync stamps are switchable per test
const mockStore: {current: {lastSyncedAt: number | null; lastSyncFailedAt: number | null}} = {
  current: {lastSyncedAt: 1, lastSyncFailedAt: null},
};
jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: () => ({solBalance: '2000000000', nocBalance: '0', tokenBalances: {}, tokens: [], ...mockStore.current}),
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

  it('r1-10: a sub-precision quote reads "<0.0001" with no "≈" in front; a normal one keeps "≈"', () => {
    mockQuote.current = {outAmount: '1'};
    const tiny = render(withSafeArea(<SwapScreen onBack={() => {}} onDone={() => {}} />));
    expect(tiny.getByText('<0.0001')).toBeTruthy();
    expect(tiny.queryByText('≈ <0.0001')).toBeNull();
    tiny.unmount();
    mockQuote.current = {outAmount: '1500000'};
    const normal = render(withSafeArea(<SwapScreen onBack={() => {}} onDone={() => {}} />));
    expect(normal.getByText('≈ 1.5')).toBeTruthy();
    mockQuote.current = undefined;
  });
});

describe('post-M1d Task 5 ruling: Swap refuses a stale or unknown main balance', () => {
  const STATES = {
    fresh: {lastSyncedAt: 1, lastSyncFailedAt: null},
    stale: {lastSyncedAt: 1, lastSyncFailedAt: 2}, // read once, the last sync failed
    unknown: {lastSyncedAt: null, lastSyncFailedAt: 2}, // never read, the sync failed
    neverSynced: {lastSyncedAt: null, lastSyncFailedAt: null}, // fix round 1 #3: nothing read yet, no failure yet
  };
  afterEach(() => {
    mockStore.current = STATES.fresh;
    mockQuote.current = undefined;
    jest.useRealTimers();
  });

  const renderSwap = () => render(withSafeArea(<SwapScreen onBack={() => {}} onDone={() => {}} />));

  it('fresh (control): the from-balance line shows the figure', () => {
    const r = renderSwap();
    expect(r.getByText('2 SOL')).toBeTruthy();
  });

  it.each(['stale', 'unknown'] as const)('%s: the from-balance line reads "— SOL", never the figure', state => {
    mockStore.current = STATES[state];
    const r = renderSwap();
    expect(r.getByText('— SOL')).toBeTruthy();
    expect(r.queryByText('2 SOL')).toBeNull();
  });

  it('fresh (control): MAX fills the amount', () => {
    const r = renderSwap();
    fireEvent.press(r.getByLabelText('Max'));
    expect(r.getByLabelText('Amount to swap').props.value).toBe('1.998');
  });

  it.each(['stale', 'unknown'] as const)('%s: MAX is disabled and fills nothing', state => {
    mockStore.current = STATES[state];
    const r = renderSwap();
    expect(r.getByLabelText('Max').props.accessibilityState).toMatchObject({disabled: true});
    fireEvent.press(r.getByLabelText('Max'));
    expect(r.getByLabelText('Amount to swap').props.value).toBe('');
  });

  it('fresh (control): the token picker shows balances', () => {
    const r = renderSwap();
    fireEvent.press(r.getByLabelText('From token SOL, tap to change'));
    expect(r.getAllByText('2').length).toBeGreaterThan(0);
  });

  it.each(['stale', 'unknown'] as const)('%s: the token picker shows "—" for every balance', state => {
    mockStore.current = STATES[state];
    const r = renderSwap();
    fireEvent.press(r.getByLabelText('From token SOL, tap to change'));
    expect(r.getAllByText('—').length).toBeGreaterThan(0);
    expect(r.queryByText('2')).toBeNull();
  });

  function typeAmountWithQuote(r: ReturnType<typeof renderSwap>) {
    mockQuote.current = {outAmount: '1500000'};
    fireEvent.changeText(r.getByLabelText('Amount to swap'), '1');
    act(() => {
      jest.advanceTimersByTime(500);
    });
  }

  it('fresh (control): with an amount and a quote the swap CTA is enabled', () => {
    jest.useFakeTimers();
    const r = renderSwap();
    typeAmountWithQuote(r);
    expect(r.getByLabelText('Swap SOL → USDC').props.accessibilityState).toMatchObject({disabled: false});
  });

  it.each(['stale', 'unknown'] as const)('%s: with an amount and a quote the swap CTA is still disabled', state => {
    jest.useFakeTimers();
    mockStore.current = STATES[state];
    const r = renderSwap();
    typeAmountWithQuote(r);
    expect(r.getByLabelText('Swap SOL → USDC').props.accessibilityState).toMatchObject({disabled: true});
  });

  // ── Fix round 1 ──────────────────────────────────────────────────────────
  it.each(['stale', 'unknown', 'neverSynced'] as const)('fix 1/3: %s with amount 5 SOL (> any known figure): the CTA never says "Insufficient"', state => {
    jest.useFakeTimers();
    mockStore.current = STATES[state];
    const r = renderSwap();
    mockQuote.current = {outAmount: '1500000'};
    fireEvent.changeText(r.getByLabelText('Amount to swap'), '5');
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(r.queryByText(/Insufficient/)).toBeNull();
    expect(r.getByLabelText('Swap SOL → USDC').props.accessibilityState).toMatchObject({disabled: true});
  });

  it('fix 1 (control): fresh with amount 5 > balance 2 → "Insufficient SOL"', () => {
    jest.useFakeTimers();
    const r = renderSwap();
    fireEvent.changeText(r.getByLabelText('Amount to swap'), '5');
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(r.getByText('Insufficient SOL')).toBeTruthy();
  });

  it('fix 3: before the first sync the balance reads "—", MAX and the CTA are disabled', () => {
    mockStore.current = STATES.neverSynced;
    const r = renderSwap();
    expect(r.getByText('— SOL')).toBeTruthy();
    expect(r.getByLabelText('Max').props.accessibilityState).toMatchObject({disabled: true});
    expect(r.getByLabelText('Swap SOL → USDC').props.accessibilityState).toMatchObject({disabled: true});
    expect(r.queryByText(/Insufficient/)).toBeNull();
  });

  it('fix 2: the note says why — stale / unknown-after-failure / checking', () => {
    mockStore.current = STATES.stale;
    expect(renderSwap().getByTestId('swap-balance-note')).toHaveTextContent('Not updated · tap to retry');
    mockStore.current = STATES.unknown;
    expect(renderSwap().getByTestId('swap-balance-note')).toHaveTextContent('Balance unavailable · tap to retry');
    mockStore.current = STATES.neverSynced;
    expect(renderSwap().getByTestId('swap-balance-note')).toHaveTextContent('Checking balance…');
    mockStore.current = STATES.fresh;
    expect(renderSwap().queryByTestId('swap-balance-note')).toBeNull();
  });

  it('fix 2: tapping the note runs forceSync once; a second tap while in flight does not run another', async () => {
    mockStore.current = STATES.stale;
    let resolve!: (v: {success: boolean}) => void;
    mockForceSync.mockReset().mockReturnValue(new Promise(res => { resolve = res; }));
    const r = renderSwap();
    fireEvent.press(r.getByTestId('swap-balance-note'));
    fireEvent.press(r.getByTestId('swap-balance-note'));
    expect(mockForceSync).toHaveBeenCalledTimes(1);
    expect(r.getByTestId('swap-balance-note')).toHaveTextContent('Checking balance…');
    await act(async () => { resolve({success: true}); });
    expect(r.getByTestId('swap-balance-note')).toHaveTextContent('Not updated · tap to retry');
  });
});
