import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {canBuy, FEE_HEADROOM_SOL} from '../PresaleScreen';
import {
  MIN_PURCHASE_USD,
  MAX_PURCHASE_USD,
} from '../../modules/presale/presaleBuyModule';

const SOL_USD = 200;
const base = {solUsd: SOL_USD, solBalance: 10, tokenBalance: 1000};

describe('canBuy (token-aware)', () => {
  it('SOL: zero/min/max/balance', () => {
    expect(canBuy({...base, paymentToken: 'SOL', amount: '0'}).enabled).toBe(false);
    expect(canBuy({...base, paymentToken: 'SOL', amount: '0.04'}).reason).toBe('Minimum $10'); // $8
    expect(canBuy({...base, paymentToken: 'SOL', amount: '300', solBalance: 1000}).reason).toBe('Maximum $50,000 per transaction');
    expect(canBuy({...base, paymentToken: 'SOL', amount: '1', solBalance: 1}).reason).toBe('Insufficient SOL balance');
    expect(canBuy({...base, paymentToken: 'SOL', amount: '0.2'}).enabled).toBe(true);
  });
  it('USDC/USDT: 1:1 USD min/max + token balance + SOL fee headroom', () => {
    expect(canBuy({...base, paymentToken: 'USDC', amount: '8'}).reason).toBe('Minimum $10');
    expect(canBuy({...base, paymentToken: 'USDC', amount: '60000', tokenBalance: 100000}).reason).toBe('Maximum $50,000 per transaction');
    expect(canBuy({...base, paymentToken: 'USDC', amount: '50', tokenBalance: 20}).reason).toBe('Insufficient USDC balance');
    expect(canBuy({...base, paymentToken: 'USDT', amount: '50', solBalance: 0}).reason).toBe('Need a little SOL for the network fee');
    expect(canBuy({...base, paymentToken: 'USDC', amount: '50'}).enabled).toBe(true);
    expect(canBuy({...base, paymentToken: 'USDC', amount: '10'}).enabled).toBe(true); // inclusive $10
  });
  it('exposes MIN $10 / MAX $50,000 + fee headroom', () => {
    expect(MIN_PURCHASE_USD).toBe(10);
    expect(MAX_PURCHASE_USD).toBe(50_000);
    expect(FEE_HEADROOM_SOL).toBe(0.001);
  });
});

// ── Geo-gate wiring (renders PresaleActive) ──────────────────────────────────

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate, goBack: mockGoBack}),
}));

// Mode-aware Button reads useShieldedStore via useMode; pin to transparent.
jest.mock('../../store/zustand/shieldedStore', () => ({
  useShieldedStore: (selector: (s: {mode: string}) => unknown) =>
    selector({mode: 'transparent'}),
}));

// Mutable presale store backing object so individual tests can vary
// tokensPurchased (to reveal the #23 allocation card) and tgeTimestamp.
const mockPresaleState: Record<string, unknown> = {
  pricePerNoc: '0.05',
  soldInStage: '0',
  stageCapacity: '1000000',
  tokensPurchased: '0',
  referralBonusTokens: '0',
  tgeTimestamp: null,
};

jest.mock('../../store/zustand/presaleStore', () => ({
  usePresaleStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector(mockPresaleState),
}));

const SELF_ADDR = '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd';

// M1d (spec §4.3): this screen stays on the main account and says so while another account is selected
const mockLineSelected: {current: {scheme: string; address: string; label: string; isMain: boolean}} = {
  current: {scheme: 'slip10:0', address: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', label: 'Account 1', isMain: true},
};
jest.mock('../../hooks/useSelectedAccount', () => ({
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

// history spec §7 (H6): the sync fields are switchable per test; the default is a balance that was read
const mockWallet: {lastSyncedAt: number | null; lastSyncFailedAt: number | null} = {lastSyncedAt: 1_700_000_000_000, lastSyncFailedAt: null};
jest.mock('../../store/zustand/walletStore', () => ({
  useWalletStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      solBalance: '10000000000',
      tokenBalances: {},
      publicKey: '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd',
      lastSyncedAt: mockWallet.lastSyncedAt,
      lastSyncFailedAt: mockWallet.lastSyncFailedAt,
    }),
}));

const mockForceSync = jest.fn(() => Promise.resolve({success: true}));
jest.mock('../../modules/backgroundSync/backgroundSyncModule', () => ({forceSync: () => mockForceSync()}));

// Controllable referral-capture store: a mutable backing object the selector
// reads from, plus jest.fn actions so tests can assert set/clear calls.
const mockReferralState: {
  capturedReferrer: string | null;
  setCapturedReferrer: jest.Mock<void, [string]>;
  clearCapturedReferrer: jest.Mock<void, []>;
} = {
  capturedReferrer: null,
  setCapturedReferrer: jest.fn((a: string) => {
    mockReferralState.capturedReferrer = a;
  }),
  clearCapturedReferrer: jest.fn(() => {
    mockReferralState.capturedReferrer = null;
  }),
};

jest.mock('../../store/zustand/referralCaptureStore', () => ({
  useReferralCaptureStore: (selector: (s: typeof mockReferralState) => unknown) =>
    selector(mockReferralState),
}));

jest.mock('../../hooks/useResolvedPrices', () => ({
  useResolvedPrices: () => ({
    prices: {native: {usd: 200}},
    havePrices: true,
  }),
}));

// Real isPresaleBlocked (pure), mocked checkJurisdiction (no network).
// The mock fn is created INSIDE the factory (not captured from outer scope) to
// avoid the jest.mock-hoist TDZ trap; we grab a typed handle below.
jest.mock('../../modules/geoFence/geoFenceModule', () => {
  const actual = jest.requireActual('../../modules/geoFence/geoFenceModule');
  return {
    ...actual,
    geoFenceManager: {checkJurisdiction: jest.fn()},
  };
});

// Imported after the mocks above are registered.
import {geoFenceManager} from '../../modules/geoFence/geoFenceModule';
import {PresaleActive} from '../PresaleScreen';

const mockCheckJurisdiction =
  geoFenceManager.checkJurisdiction as jest.MockedFunction<
    typeof geoFenceManager.checkJurisdiction
  >;

function renderActive() {
  const client = new QueryClient({
    defaultOptions: {queries: {retry: false}},
  });
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: {x: 0, y: 0, width: 390, height: 844},
        insets: {top: 0, left: 0, right: 0, bottom: 0},
      }}>
      <QueryClientProvider client={client}>
        <PresaleActive
          onSkip={jest.fn()}
          onComplete={jest.fn()}
          isOnboarding={false}
          currentStage={1}
        />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('PresaleActive — geo gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks the buy CTA and routes to GeoBlocked when sanctioned', async () => {
    mockCheckJurisdiction.mockResolvedValue({
      action: 'block',
      countryCode: 'KP',
      transparentAllowed: true,
    });
    const {findByText, getByTestId} = renderActive();

    // Wait for the jurisdiction query to resolve — the blocked CTA label
    // ("Not available in your region") replaces the "Buy NOC" label.
    await findByText('Not available in your region');
    const cta = getByTestId('presale-buy-button');

    fireEvent.press(cta);
    // The blocked CTA navigates to GeoBlocked — NOT to the buy confirm flow.
    expect(mockNavigate).toHaveBeenCalledWith('GeoBlocked', {
      countryCode: 'KP',
      presaleBlocked: true,
    });
    expect(mockNavigate).not.toHaveBeenCalledWith(
      'PresaleBuyConfirm',
      expect.anything(),
    );
  });

  it('routes the region link to GeoBlocked', async () => {
    mockCheckJurisdiction.mockResolvedValue({
      action: 'block',
      countryCode: 'KP',
      transparentAllowed: true,
    });
    const {findByText, getByText} = renderActive();
    // Wait for the jurisdiction query to resolve (blocked CTA appears).
    await findByText('Not available in your region');
    fireEvent.press(getByText('Not available in your region?'));
    expect(mockNavigate).toHaveBeenCalledWith('GeoBlocked', {
      countryCode: 'KP',
      presaleBlocked: true,
    });
  });

  it('keeps the normal Buy CTA when allowed (no geo navigation)', async () => {
    mockCheckJurisdiction.mockResolvedValue({
      action: 'allow',
      countryCode: 'SI',
      transparentAllowed: true,
    });
    const {findByTestId, queryByText} = renderActive();
    // Let the query resolve.
    const cta = await findByTestId('presale-buy-button');
    expect(queryByText('Not available in your region')).toBeNull();

    // No amount entered → gate disabled → onBuy is a no-op (no navigation).
    fireEvent.press(cta);
    expect(mockNavigate).not.toHaveBeenCalledWith(
      'GeoBlocked',
      expect.anything(),
    );
  });
});

// ── Manual "Have a referral?" field (B1 interim capture) ─────────────────────

describe('PresaleActive — manual referral field', () => {
  const OTHER_ADDR = '6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt';

  beforeEach(() => {
    jest.clearAllMocks();
    mockReferralState.capturedReferrer = null;
    mockCheckJurisdiction.mockResolvedValue({
      action: 'allow',
      countryCode: 'SI',
      transparentAllowed: true,
    });
  });

  it('applies a valid (non-self) address → setCapturedReferrer', () => {
    const {getByTestId} = renderActive();
    fireEvent.press(getByTestId('referral-toggle'));
    fireEvent.changeText(getByTestId('referral-input'), OTHER_ADDR);
    fireEvent.press(getByTestId('referral-apply'));
    expect(mockReferralState.setCapturedReferrer).toHaveBeenCalledWith(OTHER_ADDR);
  });

  it('rejects a self address with an error and does NOT set it', () => {
    const {getByTestId} = renderActive();
    fireEvent.press(getByTestId('referral-toggle'));
    fireEvent.changeText(getByTestId('referral-input'), SELF_ADDR);
    fireEvent.press(getByTestId('referral-apply'));
    expect(getByTestId('referral-error').props.children).toBe(
      "You can't refer yourself",
    );
    expect(mockReferralState.setCapturedReferrer).not.toHaveBeenCalled();
  });

  it('rejects junk with "Invalid referral address" and does NOT set it', () => {
    const {getByTestId} = renderActive();
    fireEvent.press(getByTestId('referral-toggle'));
    fireEvent.changeText(getByTestId('referral-input'), 'not-an-address');
    fireEvent.press(getByTestId('referral-apply'));
    expect(getByTestId('referral-error').props.children).toBe(
      'Invalid referral address',
    );
    expect(mockReferralState.setCapturedReferrer).not.toHaveBeenCalled();
  });

  it('renders the applied chip + the × clears the capture', () => {
    mockReferralState.capturedReferrer = OTHER_ADDR;
    const {getByTestId} = renderActive();
    const chip = getByTestId('referral-chip');
    // Chip shows the truncated address (first 4 … last 4).
    expect(chip.props.children.join('')).toContain(OTHER_ADDR.slice(0, 4));
    expect(chip.props.children.join('')).toContain(OTHER_ADDR.slice(-4));
    fireEvent.press(getByTestId('referral-clear'));
    expect(mockReferralState.clearCapturedReferrer).toHaveBeenCalled();
  });
});

// ── #23 allocation card — TGE countdown caption ──────────────────────────────

describe('PresaleActive — TGE countdown caption', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReferralState.capturedReferrer = null;
    mockCheckJurisdiction.mockResolvedValue({
      action: 'allow',
      countryCode: 'SI',
      transparentAllowed: true,
    });
    // A non-zero allocation reveals the #23 card; reset tgeTimestamp per test.
    mockPresaleState.tokensPurchased = '1000000000000';
    mockPresaleState.referralBonusTokens = '0';
    mockPresaleState.tgeTimestamp = null;
  });
  afterEach(() => {
    mockPresaleState.tokensPurchased = '0';
    mockPresaleState.tgeTimestamp = null;
  });

  it('shows "Claimable in ~7 months" when TGE is ~204 days out', () => {
    mockPresaleState.tgeTimestamp = Math.floor(Date.now() / 1000) + 204 * 86400;
    const {getByText} = renderActive();
    expect(getByText('Claimable in ~7 months')).toBeTruthy();
  });

  it('falls back to "Claimable after TGE" when tgeTimestamp is null', () => {
    mockPresaleState.tgeTimestamp = null;
    const {getByText} = renderActive();
    expect(getByText('Claimable after TGE')).toBeTruthy();
  });
});

it('M1d: another account selected → "From: Account 1 (main)" above Buy; main selected → no line', async () => {
  mockCheckJurisdiction.mockResolvedValue({action: 'allow', countryCode: 'SI', transparentAllowed: true}); // the file's allowed-region shape
  mockLineSelected.current = LINE_EXIT;
  const r = renderActive();
  expect(await r.findByTestId('presale-main-account')).toHaveTextContent('From: Account 1 (main)');
  r.unmount();
  mockLineSelected.current = LINE_MAIN;
  expect(renderActive().queryByTestId('presale-main-account')).toBeNull();
});

// ── history spec §7 (H6): presale treats a stale or unknown main balance as Send, Swap and #16 do ─────────────

describe('PresaleActive — the main balance must be known (history spec §7, H6)', () => {
  const allow = () => mockCheckJurisdiction.mockResolvedValue({action: 'allow', countryCode: 'SI', transparentAllowed: true});
  const FRESH = {lastSyncedAt: 1_700_000_000_000, lastSyncFailedAt: null};
  const STALE = {lastSyncedAt: 1_700_000_000_000, lastSyncFailedAt: 1_700_000_060_000};
  const UNKNOWN = {lastSyncedAt: null, lastSyncFailedAt: 1_700_000_060_000};
  const NEVER = {lastSyncedAt: null, lastSyncFailedAt: null};
  const buyDisabled = (r: ReturnType<typeof renderActive>): boolean =>
    r.getByTestId('presale-buy-button').props.accessibilityState?.disabled === true;
  /** the amount field's value after typing: the screen keeps it in state */
  const amountOf = (r: ReturnType<typeof renderActive>): string => r.getByTestId('presale-sol-input').props.value as string;

  beforeEach(() => {
    jest.clearAllMocks();
    allow();
    Object.assign(mockWallet, FRESH);
  });
  afterAll(() => {
    Object.assign(mockWallet, FRESH);
  });

  // B1 — the control every other case is compared with
  it('a balance that was read: the figure, no note, MAX fills the amount, Buy turns on, "Insufficient" shows when it is', async () => {
    const r = renderActive();
    await r.findByTestId('presale-buy-button');
    expect(r.getByTestId('presale-available')).toHaveTextContent('10');
    expect(r.queryByTestId('presale-balance-note')).toBeNull();
    expect(r.getByTestId('presale-max').props.accessibilityState).toEqual({disabled: false});
    fireEvent.press(r.getByTestId('presale-max'));
    expect(amountOf(r)).toBe('9.999'); // 10 SOL − the 0.001 fee headroom
    expect(buyDisabled(r)).toBe(false);
    fireEvent.changeText(r.getByTestId('presale-sol-input'), '100');
    expect(r.getByText('Insufficient SOL balance')).toBeTruthy();
  });

  // B2
  it('stale: "—", "Not updated · tap to retry", MAX dimmed and off, Buy off, and no "Insufficient" line', async () => {
    Object.assign(mockWallet, STALE);
    const r = renderActive();
    await r.findByTestId('presale-buy-button');
    expect(r.getByTestId('presale-available')).toHaveTextContent('—');
    expect(r.getByTestId('presale-available')).not.toHaveTextContent('10');
    expect(r.getByTestId('presale-balance-note')).toHaveTextContent('Not updated · tap to retry');
    const max = r.getByTestId('presale-max');
    expect(max.props.accessibilityState).toEqual({disabled: true});
    expect(max.props.className).toContain('opacity-40');
    fireEvent.press(max);
    expect(amountOf(r)).toBe('');
    fireEvent.changeText(r.getByTestId('presale-sol-input'), '0.2'); // $40: a valid purchase when the balance is known
    expect(buyDisabled(r)).toBe(true);
    fireEvent.changeText(r.getByTestId('presale-sol-input'), '100');
    expect(r.queryByText('Insufficient SOL balance')).toBeNull();
    fireEvent.press(r.getByTestId('presale-buy-button'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // B3
  it('never read and a sync failed: "Balance unavailable · tap to retry"; Buy and MAX off', async () => {
    Object.assign(mockWallet, UNKNOWN);
    const r = renderActive();
    await r.findByTestId('presale-buy-button');
    expect(r.getByTestId('presale-available')).toHaveTextContent('—');
    expect(r.getByTestId('presale-balance-note')).toHaveTextContent('Balance unavailable · tap to retry');
    expect(r.getByTestId('presale-max').props.accessibilityState).toEqual({disabled: true});
    fireEvent.changeText(r.getByTestId('presale-sol-input'), '0.2');
    expect(buyDisabled(r)).toBe(true);
  });

  // B4
  it('nothing has read the balance yet: the screen starts the read itself, once, and "Checking balance…" offers no tap', async () => {
    Object.assign(mockWallet, NEVER);
    const r = renderActive();
    await r.findByTestId('presale-buy-button');
    expect(mockForceSync).toHaveBeenCalledTimes(1);
    const note = r.getByTestId('presale-balance-note');
    expect(note).toHaveTextContent('Checking balance…');
    expect(note.props.accessibilityState).toEqual({disabled: true, busy: true});
    fireEvent.press(note);
    expect(mockForceSync).toHaveBeenCalledTimes(1);
    expect(r.getByTestId('presale-available')).toHaveTextContent('—');
    fireEvent.changeText(r.getByTestId('presale-sol-input'), '0.2');
    expect(buyDisabled(r)).toBe(true);
  });

  // B4b
  it('the first read the screen started failed: "Balance unavailable · tap to retry", tappable; Buy and MAX off', async () => {
    Object.assign(mockWallet, NEVER);
    let finish: () => void = () => undefined;
    mockForceSync.mockImplementationOnce(() => new Promise(resolve => {
      finish = () => {
        Object.assign(mockWallet, UNKNOWN); // the failed sync's mark, as the store would hold it
        resolve({success: false});
      };
    }));
    const r = renderActive();
    await r.findByTestId('presale-buy-button');
    expect(r.getByTestId('presale-balance-note')).toHaveTextContent('Checking balance…');
    await act(async () => {
      finish();
    });
    const note = r.getByTestId('presale-balance-note');
    expect(note).toHaveTextContent('Balance unavailable · tap to retry');
    expect(note.props.accessibilityState).toEqual({disabled: false, busy: false});
    expect(r.getByTestId('presale-max').props.accessibilityState).toEqual({disabled: true});
    fireEvent.changeText(r.getByTestId('presale-sol-input'), '0.2');
    expect(buyDisabled(r)).toBe(true);
    fireEvent.press(note);
    expect(mockForceSync).toHaveBeenCalledTimes(2);
  });

  // B5
  it('the note runs the main sync, one in flight, and reads "Checking balance…" while it runs', async () => {
    Object.assign(mockWallet, STALE);
    let finish: () => void = () => undefined;
    mockForceSync.mockImplementationOnce(() => new Promise(resolve => {
      finish = () => resolve({success: true});
    }));
    const r = renderActive();
    await r.findByTestId('presale-buy-button');
    const onPress = r.UNSAFE_getAllByProps({testID: 'presale-balance-note'})[0]!.props.onPress as () => void;
    act(() => {
      onPress();
      onPress(); // two taps in one tick: the ref guard
    });
    expect(mockForceSync).toHaveBeenCalledTimes(1);
    expect(r.getByTestId('presale-balance-note')).toHaveTextContent('Checking balance…');
    await act(async () => {
      finish();
    });
    expect(r.getByTestId('presale-balance-note')).toHaveTextContent('Not updated · tap to retry'); // the store still says stale
  });

  // B6
  it('the same rule for a stablecoin: the token balance is not shown as 0 while the main balance is stale', async () => {
    Object.assign(mockWallet, STALE);
    const r = renderActive();
    await r.findByTestId('presale-buy-button');
    fireEvent.press(r.getByTestId('pay-chip-USDC'));
    expect(r.getByTestId('presale-available')).toHaveTextContent('—');
    fireEvent.changeText(r.getByTestId('presale-sol-input'), '50');
    expect(r.queryByText('Insufficient USDC balance')).toBeNull();
    expect(buyDisabled(r)).toBe(true);
  });
});
