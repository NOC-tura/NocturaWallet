/**
 * DashboardScreen tests — the shielded mode on the A0 note store + the A0 pool's note count +
 * the states before the startup restore finished (never a 0).
 *
 * Strategy: mock every external module/hook so the component tree renders in Jest/Node. The
 * shielded view (`useA0Shielded`) and the pool count (`readA0PoolNoteCount`) are controllable per
 * test.
 */
import React from 'react';
import {render, act, fireEvent} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import type {A0ShieldedView} from '../../../hooks/useA0Shielded';
import type {A0PoolNoteCount} from '../../../modules/shielded/a0/poolSize';

// ── The A0 shielded view + the pool's note count ────────────────────────────
const mockView: {current: A0ShieldedView} = {current: {kind: 'ready', unspent: 0n, pending: 0n, notes: 0}};
const mockCheck = {disabled: false, checking: false, note: null as string | null, run: jest.fn()};
const mockRefusal: {current: string | null} = {current: null};
jest.mock('../../../hooks/useA0Shielded', () => ({
  useA0Shielded: () => ({view: mockView.current, refresh: jest.fn(), checkAgain: mockCheck, refusal: mockRefusal.current}),
}));
const mockPoolCount = jest.fn<Promise<A0PoolNoteCount>, []>();
jest.mock('../../../modules/shielded/a0/poolSize', () => ({
  readA0PoolNoteCount: () => mockPoolCount(),
}));
jest.mock('../../../modules/solana/connection', () => ({getConnection: () => ({})}));

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
    mockMode.current = 'transparent';
    const {queryByText} = await renderDashboard();
    expect(queryByText('Nothing shielded yet')).toBeNull();
  });
});

describe('DashboardScreen — shielded mode, empty state', () => {
  beforeEach(() => {
    mockMode.current = 'shielded';
    mockView.current = {kind: 'ready', unspent: 0n, pending: 0n, notes: 0};
  });

  it('shows the shielded empty-state heading', async () => {
    const {getByText} = await renderDashboard();
    expect(getByText('Nothing shielded yet')).toBeTruthy();
  });

  it('shows the empty-state sub-line', async () => {
    const {getByText} = await renderDashboard();
    expect(getByText('Tap Shield to make a token private')).toBeTruthy();
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
    Object.assign(mockCheck, {note: 'Not sent · your note is back in your shielded balance.'});
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-check-caption').props.children).toBe('Not sent · your note is back in your shielded balance.');
    expect(r.queryByTestId('dashboard-check-again')).toBeNull();
  });
});

describe('DashboardScreen — shielded mode, with balance (the A0 store, ready)', () => {
  beforeEach(() => {
    mockMode.current = 'shielded';
    mockView.current = {kind: 'ready', unspent: 200_000_000n, pending: 0n, notes: 1};
  });

  it('renders the shielded row "0.2 · shielded" (exact BigInt display)', async () => {
    const {getByText} = await renderDashboard();
    expect(getByText('0.2 · shielded')).toBeTruthy();
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
    expect(queryByText('Nothing shielded yet')).toBeNull();
  });

  it('shows the anonymity set line: the A0 pool note count', async () => {
    mockPoolCount.mockResolvedValue({status: 'ok', count: 42});
    const {getByText} = await renderDashboard();
    expect(getByText('Anonymity set · 42')).toBeTruthy();
  });

  it('no Send action in shielded mode (the shielded transfer is hidden until M1c); Shield is there', async () => {
    const {queryByText, getByText} = await renderDashboard();
    expect(queryByText('Send')).toBeNull();
    expect(getByText('Shield')).toBeTruthy();
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
    expect(queryByText('Nothing shielded yet')).toBeNull();
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
    const i = labels.indexOf('Shield');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(labels[i + 1]).toBe('Make public');
    fireEvent.press(r.getByLabelText('Make public'));
    expect(onMakePublic).toHaveBeenCalledTimes(1);
    expect(onShield).not.toHaveBeenCalled();
  });

  it('absent without onMakePublic (a build without the unshield route passes none)', async () => {
    mockMode.current = 'shielded';
    const r = await renderDashboard({onShield: jest.fn()});
    expect(r.getByLabelText('Shield')).toBeTruthy(); // positive control
    expect(r.queryByLabelText('Make public')).toBeNull();
  });

  it('absent in transparent mode even with onMakePublic', async () => {
    mockMode.current = 'transparent';
    const r = await renderDashboard({onMakePublic: jest.fn()});
    expect(r.getByLabelText('Swap')).toBeTruthy(); // positive control
    expect(r.queryByLabelText('Make public')).toBeNull();
  });
});
