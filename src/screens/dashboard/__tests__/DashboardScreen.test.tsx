/**
 * DashboardScreen tests — the shielded mode on the A0 note store + the A0 pool's note count +
 * the states before the startup restore finished (never a 0).
 *
 * Strategy: mock every external module/hook so the component tree renders in Jest/Node. The
 * shielded view (`useA0Shielded`) and the pool count (`readA0PoolNoteCount`) are controllable per
 * test.
 */
import React from 'react';
import {Alert, RefreshControl} from 'react-native';
import {render, act, fireEvent} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import type {A0ShieldedView} from '../../../hooks/useA0Shielded';
import type {A0PoolNoteCount} from '../../../modules/shielded/a0/poolSize';

// ── The A0 shielded view + the pool's note count ────────────────────────────
const mockView: {current: A0ShieldedView} = {current: {kind: 'ready', unspent: 0n, pending: 0n, notes: 0}};
const mockCheck = {disabled: false, checking: false, note: null as string | null, run: jest.fn()};
const mockRefusal: {current: string | null} = {current: null};
const mockA0Args: unknown[][] = [];
jest.mock('../../../hooks/useA0Shielded', () => ({
  useA0Shielded: (...args: unknown[]) => {
    mockA0Args.push(args);
    return {view: mockView.current, refresh: jest.fn(), checkAgain: mockCheck, refusal: mockRefusal.current};
  },
}));
const mockPoolCount = jest.fn<Promise<A0PoolNoteCount>, []>();
jest.mock('../../../modules/shielded/a0/poolSize', () => ({
  readA0PoolNoteCount: () => mockPoolCount(),
}));
jest.mock('../../../modules/solana/connection', () => ({getConnection: () => ({})}));

// ── M1d: the selected account and its public data (spec §3.4) ────────────────
import type {WalletAccount} from '../../../modules/accounts/accountList';
import type {AccountPublicData} from '../../../hooks/useAccountPublicData';
const MAIN_ACCOUNT: WalletAccount = {scheme: 'slip10:0', address: 'AbCdEfAbCdEf', label: 'Account 1', number: 1, role: 'main', isMain: true, linked: false};
const EXIT_ACCOUNT: WalletAccount = {scheme: 'slip10:3', address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4', number: 4, role: 'fresh-exit', isMain: false, linked: false};
const mockSelected: {current: WalletAccount | null} = {current: MAIN_ACCOUNT};
const mockRefreshAccounts = jest.fn();
const mockSelect = jest.fn(() => true);
const mockListUnreadable = {current: false};
jest.mock('../../../hooks/useSelectedAccount', () => ({
  useSelectedAccount: () => mockSelected.current,
  useAccountList: () => (mockSelected.current ? {accounts: [mockSelected.current], seed: [], walletKind: 'slip10', unreadable: mockListUnreadable.current} : null),
  useAccounts: () => null,
  useSelectAccount: () => mockSelect,
  useRefreshAccounts: () => mockRefreshAccounts,
}));
const READY_MAIN: AccountPublicData = {status: 'ready', solBalance: '1000000000', nocBalance: '2000000000', tokens: [], tokenBalances: {}, syncedAt: 1};
const mockPublic: {current: AccountPublicData} = {current: READY_MAIN};
const mockPublicArgs: unknown[] = [];
const mockRefetchPublic = jest.fn(() => Promise.resolve());
jest.mock('../../../hooks/useAccountPublicData', () => ({
  NO_PUBLIC_DATA: {solBalance: '0', nocBalance: '0', tokenBalances: {}, tokens: []},
  ACCOUNT_SNAPSHOT_KEY: 'accountSnapshot',
  useAccountPublicData: (a: unknown) => {
    mockPublicArgs.push(a);
    return {data: mockPublic.current, refetch: mockRefetchPublic};
  },
}));

// M1d (review r1 m7): opening the encrypted store when the registry is unreadable, controlled here
const mockUnlock = jest.fn(() => Promise.resolve());
jest.mock('../../../modules/session/secureStorageSession', () => ({unlockSecureStorage: () => mockUnlock()}));

// M1d (spec §4.1): the Accounts sheet, stubbed — records its props, renders a marker
const mockSheetProps: Array<Record<string, unknown>> = [];
jest.mock('../../../components/accounts/AccountsSheet', () => ({
  AccountsSheet: (p: Record<string, unknown>) => {
    mockSheetProps.push(p);
    const {Text: RNText} = require('react-native');
    return require('react').createElement(RNText, {testID: 'mock-accounts-sheet'}, 'sheet');
  },
}));

// M1d (review r1 m6): whether the encrypted store is open, controlled here
const mockSecure: {current: object | null} = {current: null};
jest.mock('../../../store/mmkv/instances', () => ({
  ...jest.requireActual('../../../store/mmkv/instances'),
  mmkvSecure: () => mockSecure.current,
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

const mockHide = {current: false};
jest.mock('../../../store/zustand/publicSettingsStore', () => ({
  usePublicSettingsStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({hideBalances: mockHide.current, setHideBalances: jest.fn()}),
}));

// ── Hooks ───────────────────────────────────────────────────────────────────
jest.mock('../../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({isOnline: true}),
}));

jest.mock('../../../hooks/useAccent', () => ({
  useAccentColor: () => '#B084FC',
}));

// M1d: switchable — the combined line's USD form depends on the prices the dashboard hands it
const mockResolved = {
  current: {prices: {native: {usd: 150, change24h: 1.5}} as Record<string, {usd: number; change24h: number | null}>, havePrices: true},
};
jest.mock('../../../hooks/useResolvedPrices', () => ({
  useResolvedPrices: () => mockResolved.current,
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
// M1d (plan A9): switchable — the combined line exists only in a build with private balances
const mockFeatures = {shielded: true};
jest.mock('../../../constants/features', () => ({
  isShieldedEnabled: () => mockFeatures.shielded,
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

// ── Helper ───────────────────────────────────────────────────────────────────
// Render + flush all async effects (fetchAnonymitySet promise) in one go so
// assertions against async-resolved state work without extra await in each test.

async function renderDashboard(props: React.ComponentProps<typeof DashboardScreen> = {}) {
  const result = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: {x: 0, y: 0, width: 390, height: 844},
        insets: {top: 0, left: 0, right: 0, bottom: 0},
      }}>
      <DashboardScreen {...props} />
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
  mockView.current = {kind: 'ready', unspent: 0n, pending: 0n, notes: 0};
  mockPoolCount.mockResolvedValue({status: 'unavailable'});
  Object.assign(mockCheck, {disabled: false, checking: false, note: null});
  mockRefusal.current = null;
  mockHide.current = false;
  mockSelected.current = MAIN_ACCOUNT; // M1d: the main account selected unless a row says otherwise
  mockPublic.current = READY_MAIN; // M1d: the same values the walletStore mock holds
  mockPublicArgs.length = 0;
  mockSheetProps.length = 0; // M1d: the sheet stub reset
  mockListUnreadable.current = false; // M1d: a readable list unless a row says otherwise
  mockUnlock.mockClear(); // M1d: the unlock count reset
  mockSecure.current = null; // M1d: the encrypted store closed unless a row says otherwise
  mockA0Args.length = 0; // M1d: the private-balance hook's recorded arguments
  mockFeatures.shielded = true; // M1d: the shielded build unless a row says otherwise
  mockResolved.current = {prices: {native: {usd: 150, change24h: 1.5}}, havePrices: true}; // M1d: priced SOL unless a row says otherwise
});

describe('DashboardScreen — transparent mode', () => {
  it('renders the dashboard root', async () => {
    const {getByTestId} = await renderDashboard();
    expect(getByTestId('dashboard-screen')).toBeTruthy();
  });

  it('shows "Public balance" overline in transparent mode', async () => {
    const {getByText} = await renderDashboard();
    expect(getByText('Public balance')).toBeTruthy();
  });

  it('does NOT render shielded empty state in transparent mode', async () => {
    mockMode.current = 'transparent';
    const {queryByText} = await renderDashboard();
    expect(queryByText('Nothing private yet')).toBeNull(); // part B: Nothing shielded yet → Nothing private yet
  });
});

describe('DashboardScreen — shielded mode, empty state', () => {
  beforeEach(() => {
    mockMode.current = 'shielded';
    mockView.current = {kind: 'ready', unspent: 0n, pending: 0n, notes: 0};
  });

  it('shows the shielded empty-state heading', async () => {
    const {getByText} = await renderDashboard();
    expect(getByText('Nothing private yet')).toBeTruthy(); // part B: Nothing shielded yet → Nothing private yet
  });

  it('shows the empty-state sub-line', async () => {
    const {getByText} = await renderDashboard();
    expect(getByText('Tap Make private to move a token in')).toBeTruthy(); // part B: Tap Shield to make a token private → Tap Make private to move a token in
  });

  it('does NOT render an anonymity set line when the count is unavailable', async () => {
    const {queryByText} = await renderDashboard();
    expect(queryByText(/Anonymity set/)).toBeNull();
  });
});

describe('final review I-1: a verifier refusal is LOUD on the shielded assets (undrawn)', () => {
  beforeEach(() => {
    mockMode.current = 'shielded';
  });
  it.each<[string, A0ShieldedView]>([
    ['nothing shielded any more', {kind: 'ready', unspent: 0n, pending: 0n, notes: 0}],
    ['a balance', {kind: 'ready', unspent: 200_000_000n, pending: 0n, notes: 1}],
  ])('%s: the loud line from the code; none without a refusal', async (_l, view) => {
    mockView.current = view;
    mockRefusal.current = 'E_A0_VERIFY_GRANT_TERMS';
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-shielded-refusal')).toBeTruthy();
    expect(r.getByText("Landed, but failed verification: E_A0_VERIFY_GRANT_TERMS · its SOL grant is not the relayer's quoted one")).toBeTruthy();
    r.unmount();
    mockRefusal.current = null;
    expect((await renderDashboard()).queryByTestId('dashboard-shielded-refusal')).toBeNull();
  });
});

describe('re-review N-2: the decided caption outlives the last pending item (no "Check again")', () => {
  beforeEach(() => {
    mockMode.current = 'shielded';
  });
  it.each<[string, A0ShieldedView]>([
    ['nothing shielded any more', {kind: 'ready', unspent: 0n, pending: 0n, notes: 0}],
    ['a balance', {kind: 'ready', unspent: 200_000_000n, pending: 0n, notes: 1}],
  ])('%s: the caption shown, the link absent', async (_l, view) => {
    mockView.current = view;
    Object.assign(mockCheck, {note: 'Not sent · your note is back in your private balance.'}); // part B: shielded balance → private balance
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-check-caption').props.children).toBe('Not sent · your note is back in your private balance.'); // part B: shielded balance → private balance
    expect(r.queryByTestId('dashboard-check-again')).toBeNull();
  });
});

describe('DashboardScreen — shielded mode, with balance (the A0 store, ready)', () => {
  beforeEach(() => {
    mockMode.current = 'shielded';
    mockView.current = {kind: 'ready', unspent: 200_000_000n, pending: 0n, notes: 1};
  });

  it('renders the shielded row "0.2 · private" (exact BigInt display)', async () => {
    const {getByText} = await renderDashboard();
    expect(getByText('0.2 · private')).toBeTruthy(); // part B: 0.2 · shielded → 0.2 · private
  });

  it('renders the pool token name in the row', async () => {
    const {getByText} = await renderDashboard();
    expect(getByText('Devnet test token')).toBeTruthy();
  });

  it('the hero is the shielded balance in the token, not a USD figure', async () => {
    const {getByTestId, getByText, queryByText} = await renderDashboard();
    expect(getByTestId('dashboard-shielded-balance')).toBeTruthy();
    expect(getByText('0.2 TEST')).toBeTruthy();
    expect(queryByText('$150')).toBeNull(); // the transparent USD total is not the shielded hero
  });

  it('UX-A 4: a pending item is shown as pending, "not confirmed yet" (never "settled at the next start")', async () => {
    mockView.current = {kind: 'ready', unspent: 200_000_000n, pending: 50_000_000n, notes: 1};
    const {getByText, queryByText} = await renderDashboard();
    expect(getByText('0.05 pending · not confirmed yet')).toBeTruthy();
    expect(queryByText(/settled at the next start/)).toBeNull();
  });

  it('R1-m9: the pending line carries "Check again"; a tap runs the check', async () => {
    mockView.current = {kind: 'ready', unspent: 200_000_000n, pending: 50_000_000n, notes: 1};
    const {getByTestId} = await renderDashboard();
    const b = getByTestId('dashboard-check-again');
    expect(b.props.accessibilityState?.disabled).toBe(false);
    fireEvent.press(b);
    expect(mockCheck.run).toHaveBeenCalledTimes(1);
  });

  it('R1-m9: "Check again" disabled while the startup step runs / a check is in flight: a tap does nothing; the result is said', async () => {
    mockView.current = {kind: 'ready', unspent: 200_000_000n, pending: 50_000_000n, notes: 1};
    Object.assign(mockCheck, {disabled: true, checking: true, note: 'E_A0_SYNC_RPC · timeout'});
    const {getByTestId, getByText} = await renderDashboard();
    const b = getByTestId('dashboard-check-again');
    expect(b.props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(b);
    expect(mockCheck.run).not.toHaveBeenCalled();
    expect(getByText('E_A0_SYNC_RPC · timeout')).toBeTruthy();
  });

  it('R1-m9 control: nothing pending → no "Check again"', async () => {
    const {queryByTestId} = await renderDashboard();
    expect(queryByTestId('dashboard-check-again')).toBeNull();
  });

  it('does NOT render the transparent empty-state in shielded mode with balance', async () => {
    const {queryByText} = await renderDashboard();
    expect(queryByText('No tokens yet · pull to refresh')).toBeNull();
    expect(queryByText('Nothing private yet')).toBeNull(); // part B: Nothing shielded yet → Nothing private yet
  });

  it('the anonymity set (the A0 pool note count) is behind the card\'s Details (spec §4)', async () => {
    mockPoolCount.mockResolvedValue({status: 'ok', count: 42});
    const {getByText, queryByText, getByTestId} = await renderDashboard();
    expect(queryByText('Anonymity set · 42')).toBeNull(); // part B: collapsed by default
    fireEvent.press(getByTestId('dashboard-details-toggle'));
    expect(getByText('Anonymity set · 42')).toBeTruthy();
  });

  it('no Send action in shielded mode (the shielded transfer is hidden until M1c); Shield is there', async () => {
    const {queryByText, getByText} = await renderDashboard();
    expect(queryByText('Send')).toBeNull();
    expect(getByText('Make private')).toBeTruthy(); // part B: Shield → Make private
  });
});

describe('DashboardScreen — shielded mode before the restore finished: a state, never a 0', () => {
  beforeEach(() => {
    mockMode.current = 'shielded';
  });

  it.each([
    [{kind: 'running'} as A0ShieldedView, 'Restoring from the chain…', /being restored from the chain/],
    [{kind: 'error', code: 'E_A0_SYNC_RPC', message: 'x'} as A0ShieldedView, 'Not restored · E_A0_SYNC_RPC', /could not be restored \(E_A0_SYNC_RPC\)/],
    [{kind: 'idle'} as A0ShieldedView, 'Not loaded yet', /not loaded yet/],
    [{kind: 'unsupported'} as A0ShieldedView, 'Not available on this device', /needs the on-device prover/],
  ])('%j: hero %s, the assets line says so, no "Nothing shielded yet", no 0', async (view, hero, line) => {
    mockView.current = view;
    const {getByText, queryByText} = await renderDashboard();
    expect(getByText(hero)).toBeTruthy();
    expect(getByText(line)).toBeTruthy();
    expect(queryByText('Nothing private yet')).toBeNull(); // part B: Nothing shielded yet → Nothing private yet
    expect(queryByText(/^0 TEST$/)).toBeNull();
  });
});

describe('DashboardScreen — transparent mode keeps Send', () => {
  it('Send is there in transparent mode', async () => {
    mockMode.current = 'transparent';
    const {getByText} = await renderDashboard();
    expect(getByText('Send')).toBeTruthy();
  });
});

describe('DashboardScreen — Receive and Buy (M1b: I9, S13)', () => {
  it('no Receive in shielded mode (no valid shielded receive address until M2); Receive in transparent mode', async () => {
    mockMode.current = 'shielded';
    const shielded = await renderDashboard({onReceive: jest.fn()});
    expect(shielded.queryByText('Receive')).toBeNull();
    shielded.unmount();
    mockMode.current = 'transparent';
    const onReceive = jest.fn();
    const transparent = await renderDashboard({onReceive});
    fireEvent.press(transparent.getByText('Receive'));
    expect(onReceive).toHaveBeenCalledWith();
  });

  it('Buy (the presale) is shown only with an onBuy — the devnet build passes none', async () => {
    const without = await renderDashboard({});
    expect(without.queryByText('Buy')).toBeNull();
    without.unmount();
    const onBuy = jest.fn();
    const withBuy = await renderDashboard({onBuy});
    fireEvent.press(withBuy.getByText('Buy'));
    expect(onBuy).toHaveBeenCalledTimes(1);
  });
});

describe('UX-A 7: "Make public" next to Shield (owner-approved departure: the design\'s shielded dashboard has Send / Receive / Shield / Buy)', () => {
  it('shielded mode with onMakePublic: "Make public" right after "Shield"; a tap calls it', async () => {
    mockMode.current = 'shielded';
    const onMakePublic = jest.fn();
    const onShield = jest.fn();
    const r = await renderDashboard({onShield, onMakePublic});
    const labels = r.getAllByRole('button').map(b => b.props.accessibilityLabel as string | undefined);
    const i = labels.indexOf('Make private'); // part B: Shield → Make private
    expect(i).toBeGreaterThanOrEqual(0);
    expect(labels[i + 1]).toBe('Make public');
    fireEvent.press(r.getByLabelText('Make public'));
    expect(onMakePublic).toHaveBeenCalledTimes(1);
    expect(onShield).not.toHaveBeenCalled();
  });

  it('absent without onMakePublic (a build without the unshield route passes none)', async () => {
    mockMode.current = 'shielded';
    const r = await renderDashboard({onShield: jest.fn()});
    expect(r.getByLabelText('Make private')).toBeTruthy(); // positive control; part B: Shield → Make private
    expect(r.queryByLabelText('Make public')).toBeNull();
  });

  it('absent in transparent mode even with onMakePublic', async () => {
    mockMode.current = 'transparent';
    const r = await renderDashboard({onMakePublic: jest.fn()});
    expect(r.getByLabelText('Swap')).toBeTruthy(); // positive control
    expect(r.queryByLabelText('Make public')).toBeNull();
  });
});

describe('part B: the one vocabulary on the dashboard (spec §2, §4)', () => {
  it('the toggle reads Public | Private (both modes); no old word', async () => {
    for (const m of ['transparent', 'shielded'] as const) {
      mockMode.current = m;
      const r = await renderDashboard();
      expect(r.getByText('Public')).toBeTruthy();
      expect(r.getByText('Private')).toBeTruthy();
      expect(r.queryByText(/^(Transparent|Shielded)$/)).toBeNull();
      r.unmount();
    }
  });

  it('Private mode: the "Private balance" card, "Private assets", the two actions, the Private balance card\'s honest sentence', async () => {
    mockMode.current = 'shielded';
    mockView.current = {kind: 'ready', unspent: 200_000_000n, pending: 0n, notes: 1};
    const r = await renderDashboard({onShield: jest.fn(), onMakePublic: jest.fn()});
    expect(r.getAllByText('Private balance').length).toBe(2); // the hero overline and the info card's title
    expect(r.getByText('Private assets')).toBeTruthy(); // the overline renders "PRIVATE ASSETS"
    expect(r.getByText('Private assets').props.className).toMatch(/\buppercase\b/); // Task 5 carry: through the overline variant
    expect(r.getByLabelText('Make private')).toBeTruthy();
    expect(r.getByLabelText('Make public')).toBeTruthy();
    expect(r.getByText('When you make tokens private, a proof is made on this device. Deposits are public on chain.')).toBeTruthy(); // owner phone pass 2026-11-21
    expect(r.queryByText(/vault/i)).toBeNull();
  });

  it('Public mode: only the toggle changed — "Public balance", Send, Receive, Swap, "Tokens"', async () => {
    mockMode.current = 'transparent';
    const r = await renderDashboard({onReceive: jest.fn()});
    expect(r.getByText('Public balance')).toBeTruthy();
    expect(r.getByText('Send')).toBeTruthy();
    expect(r.getByText('Receive')).toBeTruthy();
    expect(r.getByLabelText('Swap')).toBeTruthy();
    expect(r.getByText('Tokens')).toBeTruthy();
  });

  it('Review Focus 5: balances hidden → no Details toggle and no anonymity number on the Private balance card', async () => {
    mockMode.current = 'shielded';
    mockHide.current = true;
    mockPoolCount.mockResolvedValue({status: 'ok', count: 42});
    const r = await renderDashboard();
    expect(r.getByText('Tap eye to reveal')).toBeTruthy(); // positive control: the hidden state
    expect(r.queryByTestId('dashboard-details-toggle')).toBeNull();
    expect(r.queryByText(/Anonymity set/)).toBeNull();
  });

  it('the pending caption is unchanged: "{x} pending · not confirmed yet" with Check again', async () => {
    mockMode.current = 'shielded';
    mockView.current = {kind: 'ready', unspent: 200_000_000n, pending: 50_000_000n, notes: 1};
    const r = await renderDashboard();
    expect(r.getByText('0.05 pending · not confirmed yet')).toBeTruthy();
    expect(r.getByTestId('dashboard-check-again')).toBeTruthy();
  });
});

describe('M1d — Public mode follows the selected account (spec §3.4, D1/D2)', () => {
  it('the public data is asked for the SELECTED account', async () => {
    mockSelected.current = EXIT_ACCOUNT;
    await renderDashboard();
    expect(mockPublicArgs[mockPublicArgs.length - 1]).toEqual(EXIT_ACCOUNT);
  });

  it('Review Focus 4: loading → "—" hero and sub-balances, "Loading balances…", no token row', async () => {
    mockSelected.current = EXIT_ACCOUNT;
    mockPublic.current = {status: 'loading'};
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-public-balance')).toHaveTextContent('—');
    expect(r.getByTestId('dashboard-sub-sol')).toHaveTextContent('—');
    expect(r.getByTestId('dashboard-sub-noc')).toHaveTextContent('—');
    expect(r.getByTestId('dashboard-public-empty')).toHaveTextContent('Loading balances…');
    expect(r.queryByText('$150')).toBeNull();
    expect(r.queryByText(/· 24h/)).toBeNull();
  });

  it('Review Focus 4: failed → "Balance unavailable · pull to refresh"', async () => {
    mockSelected.current = EXIT_ACCOUNT;
    mockPublic.current = {status: 'error'};
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-public-empty')).toHaveTextContent('Balance unavailable · pull to refresh');
  });

  it('control: ready → the figures show (the same mocks as the other rows)', async () => {
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-public-balance')).toHaveTextContent('$150.00');
    expect(r.getByTestId('dashboard-sub-sol')).toHaveTextContent('1');
  });

  it('review I1: a READY non-main dataset is what the dashboard shows — not walletStore\'s figures', async () => {
    mockSelected.current = EXIT_ACCOUNT;
    mockPublic.current = {status: 'ready', solBalance: '3000000', nocBalance: '0', tokens: [], tokenBalances: {}, syncedAt: 1};
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-sub-sol')).toHaveTextContent('0.003');
    expect(r.getByTestId('dashboard-sub-noc')).toHaveTextContent('0');
    expect(r.getByTestId('dashboard-sub-sol')).not.toHaveTextContent('1'); // walletStore's SOL is 1
  });

  it('plan A6: forceSync still runs with another account selected (the main slot stays fresh for main-only screens)', async () => {
    const {forceSync} = jest.requireMock('../../../modules/backgroundSync/backgroundSyncModule') as {forceSync: jest.Mock};
    mockSelected.current = EXIT_ACCOUNT;
    await renderDashboard();
    expect(forceSync).toHaveBeenCalled();
    expect(mockRefetchPublic).toHaveBeenCalled(); // and the selected account's own data is refreshed with it
  });

  it('the account list is re-read on focus (an exit that landed appears)', async () => {
    await renderDashboard();
    expect(mockRefreshAccounts).toHaveBeenCalled();
  });
});

describe('M1d — the combined line under the toggle (spec §4.5, D2–D4)', () => {
  // the mocks: public 1 SOL (priced $150) + 2 NOC (unpriced here) → token form; private 0 TEST
  it('Public mode: "Public 2 NOC, 1 SOL · Private 0 TEST"; the big figure below is unchanged', async () => {
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-combined-line')).toHaveTextContent('Public 2 NOC, 1 SOL · Private 0 TEST');
    expect(r.getByTestId('dashboard-public-balance')).toHaveTextContent('$150.00');
  });

  it('Private mode: the same line (both modes, D3)', async () => {
    mockMode.current = 'shielded';
    mockView.current = {kind: 'ready', unspent: 1_003_800_000n, pending: 0n, notes: 1};
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-combined-line')).toHaveTextContent('Public 2 NOC, 1 SOL · Private 1.0038 TEST');
  });

  it('Review Focus 4: the selected account not loaded → "Public — · …"; the private restore not ready → "… · Private —"', async () => {
    mockSelected.current = EXIT_ACCOUNT;
    mockPublic.current = {status: 'loading'};
    expect((await renderDashboard()).getByTestId('dashboard-combined-line')).toHaveTextContent('Public — · Private 0 TEST');
    mockPublic.current = READY_MAIN;
    mockView.current = {kind: 'running'};
    expect((await renderDashboard()).getByTestId('dashboard-combined-line')).toHaveTextContent('Public 2 NOC, 1 SOL · Private —');
  });

  it('hidden balances → "Public ••• · Private •••"', async () => {
    mockHide.current = true;
    expect((await renderDashboard()).getByTestId('dashboard-combined-line')).toHaveTextContent('Public ••• · Private •••');
  });

  it('I1: only priced assets held and prices known → the USD form "Public $150.00 · Private 0 TEST"', async () => {
    mockPublic.current = {...READY_MAIN, nocBalance: '0', tokenBalances: {}};
    expect((await renderDashboard()).getByTestId('dashboard-combined-line')).toHaveTextContent('Public $150.00 · Private 0 TEST');
  });

  it('I1: havePrices false (prices not empty) → the token form, never a USD figure from half-loaded prices', async () => {
    mockPublic.current = {...READY_MAIN, nocBalance: '0', tokenBalances: {}};
    mockResolved.current = {prices: {native: {usd: 150, change24h: 1.5}}, havePrices: false};
    expect((await renderDashboard()).getByTestId('dashboard-combined-line')).toHaveTextContent('Public 1 SOL · Private 0 TEST');
  });

  it('plan A9: a build without private balances shows no line', async () => {
    mockFeatures.shielded = false;
    expect((await renderDashboard()).queryByTestId('dashboard-combined-line')).toBeNull();
  });
});

describe('M1d — the numbered avatar opens the Accounts sheet (spec §4.1, D5)', () => {
  it('the avatar shows the selected account\'s number and says what it does', async () => {
    mockSelected.current = EXIT_ACCOUNT;
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-avatar')).toHaveTextContent('4');
    expect(r.getByTestId('dashboard-avatar').props.accessibilityLabel).toBe('Account 4, switch account');
    mockSelected.current = MAIN_ACCOUNT;
    expect((await renderDashboard()).getByTestId('dashboard-avatar')).toHaveTextContent('1');
  });

  it('a tap opens the sheet (re-reading the list) with the selection checked — never Profile', async () => {
    mockSelected.current = EXIT_ACCOUNT;
    const r = await renderDashboard();
    expect(r.queryByTestId('mock-accounts-sheet')).toBeNull();
    mockRefreshAccounts.mockClear();
    await act(async () => {
      fireEvent.press(r.getByTestId('dashboard-avatar'));
    });
    expect(r.getByTestId('mock-accounts-sheet')).toBeTruthy();
    expect(mockRefreshAccounts).toHaveBeenCalled();
    expect(mockSheetProps[mockSheetProps.length - 1]).toMatchObject({visible: true, selectedScheme: 'slip10:3'});
  });

  it('selecting a row selects it, closes the sheet and refreshes the dashboard', async () => {
    const {forceSync} = jest.requireMock('../../../modules/backgroundSync/backgroundSyncModule') as {forceSync: jest.Mock};
    const r = await renderDashboard();
    await act(async () => {
      fireEvent.press(r.getByTestId('dashboard-avatar'));
    });
    forceSync.mockClear();
    await act(async () => {
      (mockSheetProps[mockSheetProps.length - 1]!.onSelect as (s: string) => void)('slip10:3');
    });
    expect(mockSelect).toHaveBeenCalledWith('slip10:3');
    expect(r.queryByTestId('mock-accounts-sheet')).toBeNull();
    expect(forceSync).toHaveBeenCalled();
  });

  it('review r1 m11: a switch does not re-read the account just left (the new one\'s query starts by itself)', async () => {
    const r = await renderDashboard();
    await act(async () => {
      fireEvent.press(r.getByTestId('dashboard-avatar'));
    });
    mockRefetchPublic.mockClear();
    await act(async () => {
      (mockSheetProps[mockSheetProps.length - 1]!.onSelect as (s: string) => void)('slip10:3');
    });
    expect(mockRefetchPublic).not.toHaveBeenCalled();
  });

  it('review r1 m4: the sheet gets the eye\'s state', async () => {
    mockHide.current = true;
    const r = await renderDashboard();
    await act(async () => {
      fireEvent.press(r.getByTestId('dashboard-avatar'));
    });
    expect(mockSheetProps[mockSheetProps.length - 1]).toMatchObject({hidden: true});
  });

  it('review r1 m7: an unreadable registry with the encrypted store closed → the store is opened, then the list re-read', async () => {
    mockListUnreadable.current = true;
    const r = await renderDashboard();
    mockRefreshAccounts.mockClear();
    await act(async () => {
      fireEvent.press(r.getByTestId('dashboard-avatar'));
    });
    expect(mockUnlock).toHaveBeenCalledTimes(1);
    expect(mockRefreshAccounts).toHaveBeenCalledTimes(2); // on open, and after the store opened
    mockListUnreadable.current = false;
    mockUnlock.mockClear();
    const r2 = await renderDashboard();
    await act(async () => {
      fireEvent.press(r2.getByTestId('dashboard-avatar'));
    });
    expect(mockUnlock).not.toHaveBeenCalled(); // control: a readable list asks nothing
  });

  it('Private mode: the same avatar and sheet; the private balance is not keyed on the selection', async () => {
    mockMode.current = 'shielded';
    mockView.current = {kind: 'ready', unspent: 200_000_000n, pending: 0n, notes: 1};
    mockSelected.current = EXIT_ACCOUNT;
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-avatar')).toHaveTextContent('4');
    expect(r.getByTestId('dashboard-shielded-balance')).toHaveTextContent('0.2 TEST');
    // review r1 m5: red if the private-balance hook were handed the selected account (it takes no arguments)
    expect(mockA0Args.length).toBeGreaterThan(0);
    expect(mockA0Args.every(a => a.length === 0)).toBe(true);
    await act(async () => {
      fireEvent.press(r.getByTestId('dashboard-avatar'));
    });
    expect(r.getByTestId('mock-accounts-sheet')).toBeTruthy();
    expect(mockA0Args.every(a => a.length === 0)).toBe(true);
  });

  it('review r1 m6: an unreadable list with the encrypted store already open asks for no unlock', async () => {
    mockListUnreadable.current = true;
    mockSecure.current = {};
    const r = await renderDashboard();
    await act(async () => {
      fireEvent.press(r.getByTestId('dashboard-avatar'));
    });
    expect(mockUnlock).not.toHaveBeenCalled();
  });
});

describe('M1d review M2 — the pull-to-refresh alert speaks for the account shown', () => {
  const pull = async (r: Awaited<ReturnType<typeof renderDashboard>>) => {
    await act(async () => {
      await (r.UNSAFE_getByType(RefreshControl).props.onRefresh as () => Promise<void>)();
    });
  };
  const failMain = () => (jest.requireMock('../../../modules/backgroundSync/backgroundSyncModule') as {forceSync: jest.Mock}).forceSync.mockResolvedValueOnce({success: false, error: 'boom'});

  it('main selected, main sync fails → the alert (as before)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const r = await renderDashboard();
    failMain();
    await pull(r);
    expect(alert).toHaveBeenCalledWith('Could not refresh balance', expect.stringContaining('RPC error: boom'));
    alert.mockRestore();
  });

  it('a non-main account selected, only MAIN\'s sync fails → no alert (the figures on screen refreshed fine)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockSelected.current = EXIT_ACCOUNT;
    const r = await renderDashboard();
    failMain();
    await pull(r);
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('a non-main account selected and ITS read fails → the alert names this account', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockSelected.current = EXIT_ACCOUNT;
    const r = await renderDashboard();
    (mockRefetchPublic as jest.Mock).mockResolvedValueOnce(false);
    await pull(r);
    expect(alert).toHaveBeenCalledWith('Could not refresh balance', "This account's balance could not be read. Pull down to try again.");
    alert.mockRestore();
  });
});
