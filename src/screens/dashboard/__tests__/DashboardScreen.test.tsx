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
import {render, act, fireEvent, within} from '@testing-library/react-native';
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

// post-M1d §4 / R2: the link queue, observed here
const mockDrain = jest.fn(() => 0);
jest.mock('../../../modules/accounts/linkQueue', () => ({drainLinkQueue: () => mockDrain()}));

// history spec §6.4: the retroactive link scan, observed here
const mockScanLinks = jest.fn((_main: string | null, _client: unknown) => Promise.resolve(0));
jest.mock('../../../modules/accounts/linkScanRunner', () => ({scanLinksForWallet: (main: string | null, client: unknown) => mockScanLinks(main, client)}));

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
// M1d Task 5: stable, so a tap on a split column is observable
const mockSetMode = jest.fn();

// post-M1d ruling 2: the refresh alert reads lastSyncedAt (written in this sync?) through getState
const mockStoreSync: {lastSyncedAt: number | null} = {lastSyncedAt: null};
jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: Object.assign(
    () => ({
      publicKey: 'AbCdEfAbCdEf',
      solBalance: '1000000000',
      nocBalance: '2000000000',
      tokens: [],
      tokenBalances: {},
    }),
    {getState: () => ({lastSyncedAt: mockStoreSync.lastSyncedAt})},
  ),
}));

jest.mock('../../../store/zustand/shieldedStore', () => ({
  useShieldedStore: () => ({mode: mockMode.current, setMode: mockSetMode}),
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

// M1d: switchable — the split row's USD form depends on the prices the dashboard hands it
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
// M1d (plan A9): switchable — the split row exists only in a build with private balances
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
import {computePortfolio} from '../../../modules/prices/portfolio';
import {mmkvPublic} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';

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
  mockStoreSync.lastSyncedAt = null;
  mockResolved.current = {prices: {native: {usd: 150, change24h: 1.5}}, havePrices: true}; // M1d: priced SOL unless a row says otherwise
});

describe('DashboardScreen — transparent mode', () => {
  it('M1d: in transparent mode the History button calls onHistory', async () => {
    const onHistory = jest.fn();
    const r = await renderDashboard({onHistory});
    expect(r.getByTestId('dashboard-history').props.accessibilityLabel).toBe('Transaction history');
    fireEvent.press(r.getByTestId('dashboard-history'));
    expect(onHistory).toHaveBeenCalledTimes(1);
  });

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

  // controller ruling 2026-11-22 — pin: the MAIN account in 'loading' takes the same branch a non-main account does
  it('main never read, no failed sync yet (the hook\'s "loading") → "—" and "Loading balances…", never $0.00 or "No tokens yet"', async () => {
    mockSelected.current = MAIN_ACCOUNT;
    mockPublic.current = {status: 'loading'};
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-public-balance')).toHaveTextContent('—');
    expect(r.getByTestId('dashboard-public-empty')).toHaveTextContent('Loading balances…');
    expect(r.getByTestId('dashboard-sub-sol')).toHaveTextContent('—');
    expect(r.getAllByTestId('dashboard-split-public-line').map(l => l.props.children)).toEqual(['—']);
    expect(r.queryByText(/\$0\.00/)).toBeNull();
    expect(r.queryByText('No tokens yet · pull to refresh')).toBeNull();
  });

  // review r1-1 — pin: the real state is pinned in useAccountPublicData.test.tsx
  it('post-M1d §3.1: main never read + a failed sync (the hook\'s "error") → "—" and "Balance unavailable", never $0.00', async () => {
    mockPublic.current = {status: 'error'};
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-public-balance')).toHaveTextContent('—');
    expect(r.getByTestId('dashboard-public-empty')).toHaveTextContent('Balance unavailable · pull to refresh');
    expect(r.getByTestId('dashboard-sub-sol')).toHaveTextContent('—');
    expect(r.queryByText(/\$0\.00/)).toBeNull();
    expect(r.queryByText(/^0 SOL$/)).toBeNull();
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
    const {getByTestId, queryByText} = await renderDashboard();
    expect(getByTestId('dashboard-shielded-balance')).toBeTruthy();
    expect(within(getByTestId('dashboard-shielded-balance')).getByText('0.2 TEST')).toBeTruthy(); // Task 5: the split's Private column reads it too
    expect(getByTestId('dashboard-split-private')).toHaveTextContent('Private0.2 TEST');
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
      // Task 5: the split row's labels read the same words, so the toggle is read through its tabs
      expect(r.getAllByRole('tab').map(t => within(t).getByText(/^(Public|Private)/).props.children)).toEqual(['Public', 'Private']);
      expect(within(r.getByTestId('dashboard-split-public')).getByText('Public')).toBeTruthy();
      expect(within(r.getByTestId('dashboard-split-private')).getByText('Private')).toBeTruthy();
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

describe('M1d — the Public | Private split inside the balance card (spec §4.5, 2026-11-22 addendum; plan r1-3)', () => {
  const pub = (r: Awaited<ReturnType<typeof renderDashboard>>) => r.getByTestId('dashboard-split-public');
  const priv = (r: Awaited<ReturnType<typeof renderDashboard>>) => r.getByTestId('dashboard-split-private');

  // the mocks: public 1 SOL (priced $150) + 2 NOC (unpriced here) → token form; private 0 TEST
  it('Public mode: Public "2 NOC" / "1 SOL", Private "0 TEST"; the old line is gone; the big figure is unchanged', async () => {
    const r = await renderDashboard();
    expect(r.queryByTestId('dashboard-combined-line')).toBeNull();
    expect(pub(r)).toHaveTextContent('Public2 NOC1 SOL');
    expect(r.getAllByTestId('dashboard-split-public-line').map(l => l.props.children)).toEqual(['2 NOC', '1 SOL']);
    expect(priv(r)).toHaveTextContent('Private0 TEST');
    expect(r.getByTestId('dashboard-public-balance')).toHaveTextContent('$150.00');
    expect(pub(r).props.accessibilityState).toEqual({selected: true});
    expect(priv(r).props.accessibilityState).toEqual({selected: false});
    expect(pub(r).props.accessibilityLabel).toBe('Public, 2 NOC, 1 SOL');
    expect(priv(r).props.accessibilityLabel).toBe('Private, 0 TEST, switch to Private');
  });

  it('Private mode: the same split (both modes)', async () => {
    mockMode.current = 'shielded';
    mockView.current = {kind: 'ready', unspent: 1_003_800_000n, pending: 0n, notes: 1};
    const r = await renderDashboard();
    expect(r.queryByTestId('dashboard-combined-line')).toBeNull();
    expect(pub(r)).toHaveTextContent('Public2 NOC1 SOL');
    expect(priv(r)).toHaveTextContent('Private1.0038 TEST');
    expect(priv(r).props.accessibilityState).toEqual({selected: true});
    expect(pub(r).props.accessibilityState).toEqual({selected: false});
  });

  it('Review Focus 2/4: the selected account not loaded → Public "—" (one line); the private restore not ready → Private "—"', async () => {
    mockSelected.current = EXIT_ACCOUNT;
    mockPublic.current = {status: 'loading'};
    let r = await renderDashboard();
    expect(r.getAllByTestId('dashboard-split-public-line').map(l => l.props.children)).toEqual(['—']);
    expect(priv(r)).toHaveTextContent('Private0 TEST');
    mockPublic.current = READY_MAIN;
    mockView.current = {kind: 'running'};
    r = await renderDashboard();
    expect(pub(r)).toHaveTextContent('Public2 NOC1 SOL');
    expect(r.getAllByTestId('dashboard-split-private-line').map(l => l.props.children)).toEqual(['—']);
  });

  it.each(['transparent', 'shielded'] as const)('Review Focus 1: hidden balances (%s mode) → "•••" in both columns, one line each, and no digit in either a11y label', async mode => {
    mockHide.current = true;
    mockMode.current = mode; // review Task 5 I1: both modes, not only Private
    mockView.current = {kind: 'ready', unspent: 1_003_800_000n, pending: 0n, notes: 1};
    const r = await renderDashboard();
    expect(r.getAllByTestId('dashboard-split-public-line').map(l => l.props.children)).toEqual(['•••']);
    expect(r.getAllByTestId('dashboard-split-private-line').map(l => l.props.children)).toEqual(['•••']);
    for (const col of [pub(r), priv(r)]) {
      expect(col.props.accessibilityLabel).toContain('Hidden');
      expect(col.props.accessibilityLabel).not.toContain('•');
      expect(col.props.accessibilityLabel).not.toMatch(/\d/);
      expect(col).not.toHaveTextContent(/\d/);
    }
  });

  it('Task 11b: hidden → each split line and each sub-balance amount is spoken "Hidden" (visible text unchanged); unhidden → no label', async () => {
    mockHide.current = true;
    mockMode.current = 'transparent';
    let r = await renderDashboard();
    for (const id of ['dashboard-split-public-line', 'dashboard-split-private-line']) {
      for (const l of r.getAllByTestId(id)) {
        expect(l.props.children).toBe('•••');
        expect(l.props.accessibilityLabel).toBe('Hidden');
      }
    }
    expect(r.getByTestId('dashboard-sub-sol')).toHaveTextContent('••••');
    expect(r.getByTestId('dashboard-sub-sol').props.accessibilityLabel).toBe('Hidden');
    expect(r.getByTestId('dashboard-sub-noc').props.accessibilityLabel).toBe('Hidden');
    const rows = r.getAllByText(/^•{6} \S+/);
    expect(rows.length).toBeGreaterThan(0); // the token rows
    for (const row of rows) expect(row.props.accessibilityLabel).toBe(`Hidden ${String(row.props.children[0]).slice(7)}`);
    r.unmount();
    mockHide.current = false;
    r = await renderDashboard();
    expect(r.queryAllByText(/^•{6} /)).toEqual([]);
    for (const l of r.getAllByTestId('dashboard-split-public-line')) expect(l.props.accessibilityLabel).toBeUndefined();
    expect(r.getByTestId('dashboard-sub-sol').props.accessibilityLabel).toBeUndefined();
  });

  it.each(['transparent', 'shielded'] as const)('Task 11b sweep: hidden (%s mode) → no accessibilityLabel anywhere in the dashboard tree contains a bullet', async mode => {
    mockHide.current = true;
    mockMode.current = mode;
    mockView.current = {kind: 'ready', unspent: 1_003_800_000n, pending: 0n, notes: 1};
    const r = await renderDashboard();
    const labels: string[] = [];
    const walk = (n: {props?: {accessibilityLabel?: unknown}; children?: unknown} | string): void => {
      if (typeof n === 'string') return;
      const l = n.props?.accessibilityLabel;
      if (typeof l === 'string') labels.push(l);
      for (const c of (n.children as Array<typeof n> | undefined) ?? []) walk(c);
    };
    walk(r.toJSON() as never);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.some(l => l.includes('Hidden'))).toBe(true); // positive control: the walk does see the labels
    expect(labels.filter(l => l.includes('•'))).toEqual([]);
  });

  it('Task 11b: the shielded asset row hidden is spoken "Hidden <symbol>" (control: unhidden has no label)', async () => {
    mockMode.current = 'shielded';
    mockView.current = {kind: 'ready', unspent: 1_003_800_000n, pending: 0n, notes: 1};
    mockHide.current = true;
    let r = await renderDashboard();
    const row = r.getByTestId('shielded-assets-row');
    const amt = r.getByText(/^•{6} /);
    expect(amt.props.accessibilityLabel).toMatch(/^Hidden \S+$/);
    expect(row).toBeTruthy();
    r.unmount();
    mockHide.current = false;
    r = await renderDashboard();
    expect(r.getByTestId('shielded-assets-row')).toBeTruthy();
    expect(r.queryByText(/^•{6} /)).toBeNull();
  });

  it('I1: only priced assets held and prices known → the USD form, Public "$150.00"', async () => {
    mockPublic.current = {...READY_MAIN, nocBalance: '0', tokenBalances: {}};
    const r = await renderDashboard();
    expect(r.getAllByTestId('dashboard-split-public-line').map(l => l.props.children)).toEqual(['$150.00']);
    expect(priv(r)).toHaveTextContent('Private0 TEST');
  });

  it('I1: havePrices false (prices not empty) → the token form, never a USD figure from half-loaded prices', async () => {
    mockPublic.current = {...READY_MAIN, nocBalance: '0', tokenBalances: {}};
    mockResolved.current = {prices: {native: {usd: 150, change24h: 1.5}}, havePrices: false};
    const r = await renderDashboard();
    expect(r.getAllByTestId('dashboard-split-public-line').map(l => l.props.children)).toEqual(['1 SOL']);
    expect(priv(r)).toHaveTextContent('Private0 TEST');
  });

  it('r1-4: each value line fits on one line (shrinks, never wraps)', async () => {
    const r = await renderDashboard();
    for (const l of [...r.getAllByTestId('dashboard-split-public-line'), ...r.getAllByTestId('dashboard-split-private-line')]) {
      expect(l.props.numberOfLines).toBe(1);
      expect(l.props.adjustsFontSizeToFit).toBe(true);
      expect(l.props.minimumFontScale).toBe(0.75);
    }
  });

  it('a tap on the inactive column switches the mode; a tap on the active one does nothing (Public mode)', async () => {
    const r = await renderDashboard();
    fireEvent.press(pub(r));
    expect(mockSetMode).not.toHaveBeenCalled();
    fireEvent.press(priv(r));
    expect(mockSetMode).toHaveBeenCalledTimes(1);
    expect(mockSetMode).toHaveBeenCalledWith('shielded');
  });

  it('a tap on the inactive column switches the mode; a tap on the active one does nothing (Private mode)', async () => {
    mockMode.current = 'shielded';
    const r = await renderDashboard();
    fireEvent.press(priv(r));
    expect(mockSetMode).not.toHaveBeenCalled();
    fireEvent.press(pub(r));
    expect(mockSetMode).toHaveBeenCalledTimes(1);
    expect(mockSetMode).toHaveBeenCalledWith('transparent');
  });

  it('plan A9: a build without private balances shows no split (and no old line)', async () => {
    mockFeatures.shielded = false;
    const r = await renderDashboard();
    expect(r.queryByTestId('dashboard-split-public')).toBeNull();
    expect(r.queryByTestId('dashboard-split-private')).toBeNull();
    expect(r.queryByTestId('dashboard-combined-line')).toBeNull();
  });
});

describe('M1d — the numbered avatar opens the Accounts sheet (spec §4.1, D5)', () => {
  it('post-M1d §4 / R2: opening the sheet drains the link queue BEFORE the list is re-read (the tag shows at once)', async () => {
    const r = await renderDashboard();
    mockRefreshAccounts.mockClear();
    mockDrain.mockClear();
    await act(async () => {
      fireEvent.press(r.getByTestId('dashboard-avatar'));
    });
    expect(mockDrain).toHaveBeenCalledTimes(1);
    expect(mockDrain.mock.invocationCallOrder[0]!).toBeLessThan(mockRefreshAccounts.mock.invocationCallOrder[0]!);
  });

  it('history spec §6.4: opening the sheet starts the link scan for the main wallet AFTER the queue is drained; the sheet does not wait for it', async () => {
    const r = await renderDashboard();
    mockDrain.mockClear();
    mockScanLinks.mockClear();
    mockScanLinks.mockImplementationOnce(() => new Promise<number>(() => undefined)); // a scan that never ends
    await act(async () => {
      fireEvent.press(r.getByTestId('dashboard-avatar'));
    });
    expect(mockScanLinks).toHaveBeenCalledTimes(1);
    expect(mockScanLinks.mock.calls[0]![0]).toBe('AbCdEfAbCdEf'); // walletStore.publicKey: the MAIN account, whichever is selected
    expect(mockDrain.mock.invocationCallOrder[0]!).toBeLessThan(mockScanLinks.mock.invocationCallOrder[0]!);
    expect(r.getByTestId('mock-accounts-sheet')).toBeTruthy();
  });

  it('history spec H5: an open that has to unlock the encrypted store starts the scan again once it is open', async () => {
    mockListUnreadable.current = true; // the registry cannot be read: the store is closed (mockSecure.current === null)
    const r = await renderDashboard();
    mockScanLinks.mockClear();
    mockRefreshAccounts.mockClear();
    let opened: () => void = () => undefined;
    mockUnlock.mockImplementationOnce(() => new Promise<void>(resolve => { opened = resolve; }));
    await act(async () => {
      fireEvent.press(r.getByTestId('dashboard-avatar'));
    });
    expect(mockScanLinks).toHaveBeenCalledTimes(1); // at the open: with the store closed this one reads nothing
    await act(async () => {
      opened();
    });
    expect(mockScanLinks).toHaveBeenCalledTimes(2); // after the unlock
    expect(mockScanLinks.mock.calls[1]![0]).toBe('AbCdEfAbCdEf');
    expect(mockRefreshAccounts.mock.invocationCallOrder[1]!).toBeLessThan(mockScanLinks.mock.invocationCallOrder[1]!);
    // control: a readable list unlocks nothing and scans once
    mockListUnreadable.current = false;
    mockScanLinks.mockClear();
    const r2 = await renderDashboard();
    await act(async () => {
      fireEvent.press(r2.getByTestId('dashboard-avatar'));
    });
    expect(mockScanLinks).toHaveBeenCalledTimes(1);
  });

  it('history spec §6.4: a scan that rejects is silent', async () => {
    const r = await renderDashboard();
    mockScanLinks.mockImplementationOnce(() => Promise.reject(new Error('rpc down')));
    await act(async () => {
      fireEvent.press(r.getByTestId('dashboard-avatar'));
    });
    expect(r.getByTestId('mock-accounts-sheet')).toBeTruthy();
  });

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

// the token row's own Text (the split column repeats the same words under a testID)
const rowText = (r: Awaited<ReturnType<typeof renderDashboard>>, text: string) =>
  r.getAllByText(text).find(n => !String(n.props.testID ?? '').endsWith('-line')) ?? r.getByText(text);
const TERTIARY = /(^|\s)text-fg-tertiary(\s|$)/;

describe('post-M1d §3.2 — a stale public balance', () => {
  const NOW = 1_800_000_000_000;
  const STALE_MAIN: AccountPublicData = {
    status: 'stale',
    syncedAt: NOW - 5 * 60_000,
    failedAt: NOW - 1000,
    solBalance: '1000000000',
    nocBalance: '2000000000',
    tokens: [{mint: 'USDCMINT', symbol: 'USDC', name: 'USD Coin', decimals: 6, trust: 'core'}],
    tokenBalances: {USDCMINT: '5000000'},
  };
  const LINE = 'Not updated · 5 min ago · pull to refresh';
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    mockPublic.current = STALE_MAIN;
    (computePortfolio as jest.Mock).mockReturnValue({totalUsd: 150, change24hPct: 1.5, perToken: {USDCMINT: {usd: 5, change24h: 0.1}}});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    (computePortfolio as jest.Mock).mockReturnValue({totalUsd: 150, change24hPct: 1.5, perToken: {}});
  });

  it('D1: the hero shows the figure, dimmed', async () => {
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-public-balance')).toHaveTextContent('$150.00');
    expect(r.getByText('$150').props.className).toMatch(TERTIARY);
  });

  it('D2: the stale line carries the age and the way out', async () => {
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-stale-line')).toHaveTextContent(LINE);
  });

  it('D3: the 24h line is hidden while stale (control: shown when ready)', async () => {
    let r = await renderDashboard();
    expect(r.queryByText(/· 24h/)).toBeNull();
    r.unmount();
    mockPublic.current = READY_MAIN;
    r = await renderDashboard();
    expect(r.getByText(/· 24h/)).toBeTruthy();
  });

  it('D4: the sub-balances are dimmed', async () => {
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-sub-sol')).toHaveTextContent('1');
    expect(r.getByTestId('dashboard-sub-noc')).toHaveTextContent('2');
    expect(r.getByTestId('dashboard-sub-sol').props.className).toMatch(TERTIARY);
    expect(r.getByTestId('dashboard-sub-noc').props.className).toMatch(TERTIARY);
  });

  it('D5: a token row keeps its figures, dimmed, without the 24h change (R16); control: ready shows it', async () => {
    let r = await renderDashboard();
    expect(rowText(r, '5 USDC').props.className).toMatch(TERTIARY);
    expect(r.getByText('$5.00').props.className).toMatch(TERTIARY);
    expect(r.queryByText('+0.1%')).toBeNull();
    r.unmount();
    mockPublic.current = {...STALE_MAIN, status: 'ready'} as AccountPublicData;
    r = await renderDashboard();
    expect(r.getByText('+0.1%')).toBeTruthy();
    expect(rowText(r, '5 USDC').props.className).not.toMatch(TERTIARY);
  });

  it('D6 (Review Focus 1): hidden wins — the stale line stays, no digit of any figure appears', async () => {
    mockHide.current = true;
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-stale-line')).toHaveTextContent(LINE);
    expect(r.queryByText(/\$150/)).toBeNull();
    expect(r.getByTestId('dashboard-sub-sol')).toHaveTextContent('••••');
    expect(r.queryByText(/5 USDC|\$5\.00|\$150/)).toBeNull();
    const label = r.getByTestId('dashboard-split-public').props.accessibilityLabel as string;
    expect(label).toBe('Public, Hidden, not updated');
    expect(label).not.toMatch(/\d/);
    for (const l of r.getAllByTestId('dashboard-split-public-line')) {
      expect(l.props.children).not.toMatch(/\d/);
    }
  });

  it('D7 (Review Focus 4): a later good read removes every stale mark', async () => {
    const tree = () => (
      <SafeAreaProvider initialMetrics={{frame: {x: 0, y: 0, width: 390, height: 844}, insets: {top: 0, left: 0, right: 0, bottom: 0}}}>
        <DashboardScreen />
      </SafeAreaProvider>
    );
    const r = render(tree());
    await act(async () => {});
    expect(r.getByTestId('dashboard-stale-line')).toBeTruthy();
    mockPublic.current = READY_MAIN;
    r.rerender(tree()); // a fresh element: the same reference would bail out
    await act(async () => {});
    expect(r.queryByTestId('dashboard-stale-line')).toBeNull();
    expect(r.getByText(/· 24h/)).toBeTruthy();
    expect(r.getByText('$150').props.className).not.toMatch(TERTIARY);
  });

  it('D8: the public split column shows the same lines as a ready figure, dimmed, with "not updated" in its label', async () => {
    const r = await renderDashboard();
    const lines = r.getAllByTestId('dashboard-split-public-line');
    expect(lines.map(l => l.props.children)).toEqual(['5 USDC', '2 NOC', '+1 more']);
    for (const l of lines) {
      expect(l.props.className).toMatch(TERTIARY);
    }
    expect(r.getByTestId('dashboard-split-public').props.accessibilityLabel).toBe('Public, 5 USDC, 2 NOC, +1 more, not updated');
    for (const l of r.getAllByTestId('dashboard-split-private-line')) {
      expect(l.props.className).not.toMatch(TERTIARY);
    }
  });

  it('D9: Private mode has no stale line, but the public column is still dimmed and says "not updated"', async () => {
    mockMode.current = 'shielded';
    const r = await renderDashboard();
    expect(r.queryByTestId('dashboard-stale-line')).toBeNull();
    expect(r.getByTestId('dashboard-split-public').props.accessibilityLabel).toMatch(/, not updated, switch to Public$/);
    for (const l of r.getAllByTestId('dashboard-split-public-line')) {
      expect(l.props.className).toMatch(TERTIARY);
    }
  });

  it('D10: a non-main account gets the same display', async () => {
    mockSelected.current = EXIT_ACCOUNT;
    const r = await renderDashboard();
    expect(r.getByText('$150').props.className).toMatch(TERTIARY);
    expect(r.getByTestId('dashboard-stale-line')).toHaveTextContent(LINE);
  });

  it('fix 2: the hero cents are dimmed while stale (control: not when ready)', async () => {
    let r = await renderDashboard();
    expect(r.getByText('.00').props.className).toMatch(TERTIARY);
    r.unmount();
    mockPublic.current = READY_MAIN;
    r = await renderDashboard();
    expect(r.getByText('.00').props.className).not.toMatch(TERTIARY);
  });

  it.each(['transparent', 'shielded'] as const)('fix 3: the Public column carries a visible "not updated" caption (%s mode), hidden too, and the label is unchanged', async mode => {
    mockMode.current = mode;
    let r = await renderDashboard();
    const cap = r.getByTestId('dashboard-split-public-stale');
    expect(cap).toHaveTextContent('not updated');
    expect(cap.props.className).toMatch(TERTIARY);
    expect(r.queryByTestId('dashboard-split-private-stale')).toBeNull();
    r.unmount();
    mockHide.current = true;
    r = await renderDashboard();
    expect(r.getByTestId('dashboard-split-public-stale')).toHaveTextContent('not updated');
    expect(r.getByTestId('dashboard-split-public').props.accessibilityLabel).toMatch(/^Public, Hidden, not updated/);
    r.unmount();
    mockHide.current = false;
    mockPublic.current = READY_MAIN;
    r = await renderDashboard();
    expect(r.queryByTestId('dashboard-split-public-stale')).toBeNull();
  });

  it('fix 4: a (re)focus ticks once at once, so the age never lags', async () => {
    let clock = NOW;
    jest.spyOn(Date, 'now').mockImplementation(() => clock);
    // the focus effect starts its interval, then the clock has moved on by the time the screen re-renders
    jest.spyOn(global, 'setInterval').mockImplementation((() => {
      clock = NOW + 60_000;
      return 1;
    }) as unknown as typeof setInterval);
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-stale-line')).toHaveTextContent('Not updated · 6 min ago · pull to refresh');
  });

  it('D11 (R16): the age ticks every 60 s', async () => {
    // No jest fake timers here: under Node 22 (CI) `useFakeTimers` + `await act(async…)` never settled and hung
    // the whole CI job. The 60 s intervals are captured instead and fired by hand, with the clock moved on.
    let clock = NOW;
    jest.spyOn(Date, 'now').mockImplementation(() => clock);
    const minuteTicks: Array<() => void> = [];
    const realSetInterval = global.setInterval;
    jest.spyOn(global, 'setInterval').mockImplementation(((fn: () => void, ms?: number) => {
      if (ms === 60_000) {
        minuteTicks.push(fn);
        return 0;
      }
      return realSetInterval(fn, ms);
    }) as unknown as typeof setInterval);
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-stale-line')).toHaveTextContent(LINE);
    expect(minuteTicks.length).toBeGreaterThan(0);
    clock = NOW + 60_000;
    await act(async () => {
      minuteTicks.forEach(fn => fn());
    });
    expect(r.getByTestId('dashboard-stale-line')).toHaveTextContent('Not updated · 6 min ago · pull to refresh');
  });
});

describe('post-M1d — the pull-to-refresh alert', () => {
  const forceSyncMock = () => (jest.requireMock('../../../modules/backgroundSync/backgroundSyncModule') as {forceSync: jest.Mock}).forceSync;
  const pull = async (r: Awaited<ReturnType<typeof renderDashboard>>) => {
    await act(async () => {
      await (r.UNSAFE_getByType(RefreshControl).props.onRefresh as () => Promise<void>)();
    });
  };
  afterEach(() => jest.restoreAllMocks());

  it('D12 (pin): a partial failure still alerts, with the failed read named', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const r = await renderDashboard();
    forceSyncMock().mockResolvedValueOnce({success: false, partial: true, error: 'tokens: timeout', timestamp: 1});
    await pull(r);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith('Could not refresh balance', expect.stringContaining('tokens: timeout'));
  });

  it('ruling 2: "wallet changed" shows no alert (it is not an RPC failure)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const r = await renderDashboard();
    forceSyncMock().mockResolvedValueOnce({success: false, partial: false, error: 'wallet changed', timestamp: 1});
    await pull(r);
    expect(alert).not.toHaveBeenCalled();
  });

  it('ruling 2: a failure after the balances were written in THIS sync shows no alert', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const r = await renderDashboard();
    jest.spyOn(Date, 'now').mockReturnValue(2_000_000);
    forceSyncMock().mockImplementationOnce(async () => {
      mockStoreSync.lastSyncedAt = 2_000_001; // written during this sync
      return {success: false, partial: false, error: 'post-write boom', timestamp: 1};
    });
    await pull(r);
    expect(alert).not.toHaveBeenCalled();
  });

  it('ruling 2 control: an old lastSyncedAt does not silence a real failure', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockStoreSync.lastSyncedAt = 5;
    const r = await renderDashboard();
    jest.spyOn(Date, 'now').mockReturnValue(2_000_000);
    forceSyncMock().mockResolvedValueOnce({success: false, partial: false, error: 'boom', timestamp: 1});
    await pull(r);
    expect(alert).toHaveBeenCalledWith('Could not refresh balance', expect.stringContaining('RPC error: boom'));
  });
});

describe('post-M1d §7 coverage — dashboard pins', () => {
  it('K1: "<0.0001" on the token row and the sub-balance, never exponent notation', async () => {
    mockPublic.current = {
      ...(READY_MAIN as Extract<AccountPublicData, {status: 'ready'}>),
      solBalance: '10',
      tokens: [{mint: 'USDCMINT', symbol: 'USDC', name: 'USD Coin', decimals: 6, trust: 'core'}],
      tokenBalances: {USDCMINT: '10'},
    };
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-sub-sol')).toHaveTextContent('<0.0001');
    expect(rowText(r, '<0.0001 USDC')).toBeTruthy();
    expect(r.queryByText(/e-\d/)).toBeNull();
  });

  it('K2: a split-column tap fires first-private onboarding once, then switches', async () => {
    try {
      mmkvPublic.remove(MMKV_KEYS.SHIELDED_EXPLAINED);
      const onFirst = jest.fn();
      let r = await renderDashboard({onFirstShieldedToggle: onFirst});
      fireEvent.press(r.getByTestId('dashboard-split-private'));
      expect(onFirst).toHaveBeenCalledTimes(1);
      expect(mockSetMode).not.toHaveBeenCalled();
      r.unmount();
      mmkvPublic.set(MMKV_KEYS.SHIELDED_EXPLAINED, true);
      r = await renderDashboard({onFirstShieldedToggle: onFirst});
      fireEvent.press(r.getByTestId('dashboard-split-private'));
      expect(mockSetMode).toHaveBeenCalledWith('shielded');
      expect(onFirst).toHaveBeenCalledTimes(1);
    } finally {
      mmkvPublic.remove(MMKV_KEYS.SHIELDED_EXPLAINED);
    }
  });
});

describe('post-M1d R7 / r2-4 — the native row is keyed by the mint, not by the symbol', () => {
  const WSOL = 'So11111111111111111111111111111111111111112';
  const withWsol = (solBalance: string): AccountPublicData => ({
    status: 'ready', syncedAt: 1, solBalance, nocBalance: '0',
    tokens: [{mint: WSOL, symbol: 'wSOL', name: 'Wrapped SOL', decimals: 9, trust: 'core'}],
    tokenBalances: {[WSOL]: '500000000'},
  });

  it('SOL and wSOL are two rows: "1 SOL" (native only) and "0.5 wSOL" (its own amount)', async () => {
    mockPublic.current = withWsol('1000000000');
    const r = await renderDashboard();
    expect(r.getByText('1 SOL')).toBeTruthy();
    expect(r.getByText('0.5 wSOL')).toBeTruthy();
    expect(r.getByText('Wrapped SOL')).toBeTruthy();
    expect(r.queryByText('1.5 SOL')).toBeNull();
  });

  it('Review Focus 5: wSOL held and 0 native SOL → the SOL row is still there, reading "0 SOL"', async () => {
    mockPublic.current = withWsol('0');
    const r = await renderDashboard();
    expect(r.getByText('0 SOL')).toBeTruthy();
    expect(r.getByText('0.5 wSOL')).toBeTruthy();
  });

  it('a row that merely CALLS itself "SOL" is not the native row: it shows its own mint\'s amount', async () => {
    mockPublic.current = {
      status: 'ready', syncedAt: 1, solBalance: '1000000000', nocBalance: '0',
      tokens: [{mint: 'FAKEMINT', symbol: 'SOL', name: 'Not Solana', decimals: 9, trust: 'verified'}],
      tokenBalances: {FAKEMINT: '7000000000'},
    };
    const r = await renderDashboard();
    expect(r.getAllByText('7 SOL').length).toBeGreaterThan(0);
    expect(r.getAllByText('1 SOL')).toHaveLength(2); // the native row + the sub-balance line; a symbol-named row is not given the native amount (a third)
  });

  // pin: publicSide already folds wSOL; the list rows stop folding, the split keeps folding
  it('the split\'s Public column keeps folding wSOL into SOL (a summary, R7)', async () => {
    mockPublic.current = withWsol('1000000000');
    mockResolved.current = {prices: {}, havePrices: false};
    const r = await renderDashboard();
    expect(r.getAllByTestId('dashboard-split-public-line').map(l => l.props.children)).toEqual(['1.5 SOL']);
  });
});
