import React from 'react';
import {AccessibilityInfo} from 'react-native';
import {render, fireEvent, act} from '@testing-library/react-native';
import {SendScreen} from '../SendScreen';

// The screen calls useNavigation() for the QR/address-book routes; the suite
// drives inputs, not navigation.
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({navigate: jest.fn(), goBack: jest.fn()}),
  useRoute: () => ({params: {}}),
}));

jest.mock('../../../modules/solana/simulation', () => ({
  simulateTransaction: jest.fn().mockResolvedValue({success: true}),
}));
jest.mock('../../../modules/solana/connection', () => ({
  getConnection: jest.fn(() => ({})),
}));
jest.mock('../../../modules/solana/transactionBuilder', () => ({
  buildTransferTx: jest.fn().mockResolvedValue({}),
  // Real implementation: the MAX/insufficient math must use the same markup
  // the builders charge, so stubbing it would test nothing.
  getTransferMarkupLamports: jest.requireActual(
    '../../../modules/solana/transactionBuilder',
  ).getTransferMarkupLamports,
}));

// M1d (review m7): the walletStore mock is gone — #12 no longer reads it; its 1 SOL is READY_1_SOL below

// M1d (spec §3.3): #12 sends from the account selected when it opened, with that account's balances
const MAIN_SRC = {scheme: 'slip10:0', address: 'So11111111111111111111111111111111111111112', label: 'Account 1', number: 1, role: 'main', isMain: true, linked: false};
const A3_SRC = {scheme: 'slip10:3', address: '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k', label: 'Account 4', number: 4, role: 'fresh-exit', isMain: false, linked: false};
const READY_1_SOL = {status: 'ready', syncedAt: 1, solBalance: '1000000000', nocBalance: '0', tokens: [], tokenBalances: {}};
const mockSendSelected: {current: unknown} = {current: MAIN_SRC};
const mockSendList: {current: unknown} = {current: null};
const mockSendRefresh = jest.fn();
// post-M1d §4: #12 must never write the tag (that is #21's)
const mockRecordLinks = jest.fn((_a: readonly string[]) => 0);
jest.mock('../../../modules/accounts/linkQueue', () => ({
  recordConfirmedSendLinks: (a: readonly string[]) => mockRecordLinks(a),
  drainLinkQueue: jest.fn(() => 0),
}));
jest.mock('../../../hooks/useSelectedAccount', () => ({
  useSelectedAccount: () => mockSendSelected.current,
  useAccountList: () => mockSendList.current,
  useRefreshAccounts: () => mockSendRefresh,
}));
// post-M1d R4: the main account's "tap to retry" runs the main sync (refetch is a no-op for main)
const mockForceSync = jest.fn(() => Promise.resolve({success: true, partial: false, timestamp: 1}));
jest.mock('../../../modules/backgroundSync/backgroundSyncModule', () => ({forceSync: () => mockForceSync()}));
const mockSendPublic: {current: unknown} = {current: READY_1_SOL};
const mockSendRefetch = jest.fn(() => Promise.resolve(true));
jest.mock('../../../hooks/useAccountPublicData', () => ({
  NO_PUBLIC_DATA: {solBalance: '0', nocBalance: '0', tokenBalances: {}, tokens: []},
  useAccountPublicData: () => ({data: mockSendPublic.current, refetch: mockSendRefetch}),
}));

/**
 * Rewritten 2026-08-09. The previous suite was `describe.skip`'d against
 * Phase-2 chrome (placeholder-based queries, a "Review" CTA, token pills) that
 * no longer exists, leaving the app's money-entry screen at 3.4% coverage.
 *
 * These drive the screen through stable testIDs and assert behaviour rather
 * than copy, so a chrome change fails them instead of silently skipping them.
 */
describe('SendScreen', () => {
  const setup = () => render(<SendScreen onReview={jest.fn()} />);

  it('renders the recipient and amount inputs', () => {
    const {getByTestId} = setup();
    expect(getByTestId('recipient-input')).toBeTruthy();
    expect(getByTestId('amount-input')).toBeTruthy();
  });

  it('keeps the CTA disabled until both fields are valid', () => {
    const {getByTestId} = setup();
    expect(getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('rejects an off-curve recipient', () => {
    // findProgramAddressSync([b'noctura-test'], SystemProgram) — a real PDA.
    // The old validator was a base58 regex, so this passed as a wallet and SOL
    // sent here would be unrecoverable.
    const {getByTestId} = setup();
    fireEvent.changeText(
      getByTestId('recipient-input'),
      'E4E6ZBCXe3s5tBjEwTfXm2NthmxLQBZiPyTVoc2E8HNw',
    );
    fireEvent.changeText(getByTestId('amount-input'), '0.1');
    expect(getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('accepts a real on-curve recipient with a valid amount', () => {
    const {getByTestId} = setup();
    fireEvent.changeText(
      getByTestId('recipient-input'),
      'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk',
    );
    fireEvent.changeText(getByTestId('amount-input'), '0.1');
    expect(getByTestId('review-button').props.accessibilityState?.disabled).toBe(false);
  });

  it('blocks an amount larger than the balance', () => {
    // Balance is 1 SOL in the mocked store.
    const {getByTestId} = setup();
    fireEvent.changeText(
      getByTestId('recipient-input'),
      'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk',
    );
    fireEvent.changeText(getByTestId('amount-input'), '999');
    expect(getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('MAX leaves enough for fees — the resulting amount is payable', () => {
    // MAX used to subtract only base + priority while the builder also appended
    // a 20,000-lamport markup, so every MAX send failed on-chain. The markup is
    // now sourced from the same function the builder uses.
    const {getByTestId} = setup();
    fireEvent.changeText(
      getByTestId('recipient-input'),
      'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk',
    );
    fireEvent.press(getByTestId('max-button'));
    const amount = getByTestId('amount-input').props.value as string;
    expect(Number(amount)).toBeGreaterThan(0);
    expect(Number(amount)).toBeLessThan(1);
    expect(getByTestId('review-button').props.accessibilityState?.disabled).toBe(false);
  });

  it('rejects an amount with more decimals than the token has', () => {
    // parseTokenAmount throws on over-precision and SendScreen swallows it in a
    // catch {}, so the CTA just greys out. Asserting the CTA state pins the
    // behaviour; the missing user-visible message is tracked separately.
    const {getByTestId} = setup();
    fireEvent.changeText(
      getByTestId('recipient-input'),
      'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk',
    );
    fireEvent.changeText(getByTestId('amount-input'), '0.1234567891');
    expect(getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
  });
});

describe('M1d — #12 sends from the account selected when it opened (spec §3.3)', () => {
  const FOREIGN = 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N';
  beforeEach(() => {
    mockSendSelected.current = MAIN_SRC;
    mockSendList.current = null;
    mockSendPublic.current = READY_1_SOL;
  });
  const fill = (r: ReturnType<typeof render>) => {
    fireEvent.changeText(r.getByTestId('recipient-input'), FOREIGN);
    fireEvent.changeText(r.getByTestId('amount-input'), '0.001');
  };

  it('the intent carries the source (scheme, address, label, main) and the source\'s balances', () => {
    mockSendSelected.current = A3_SRC;
    mockSendPublic.current = {status: 'ready', syncedAt: 1, solBalance: '3000000', nocBalance: '0', tokens: [], tokenBalances: {}};
    const onReview = jest.fn();
    const r = render(<SendScreen onReview={onReview} />);
    fill(r);
    fireEvent.press(r.getByTestId('review-button'));
    expect(onReview).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: FOREIGN,
        from: {scheme: 'slip10:3', address: A3_SRC.address, label: 'Account 4', isMain: false},
        sourceBalances: {solBalance: '3000000', tokenBalances: {}},
        linksAccounts: [], // post-M1d §4: a foreign recipient links nothing
      }),
    );
  });

  it('Review Focus 2: a selection change after #12 opened does not move the Send', () => {
    mockSendSelected.current = A3_SRC;
    const onReview = jest.fn();
    const r = render(<SendScreen onReview={onReview} />);
    mockSendSelected.current = MAIN_SRC;
    r.rerender(<SendScreen onReview={onReview} />);
    fill(r);
    fireEvent.press(r.getByTestId('review-button'));
    expect(onReview.mock.calls[0]![0].from.scheme).toBe('slip10:3');
  });

  it('Review Focus 4: the source\'s data not loaded → Available "—", the CTA disabled', () => {
    mockSendPublic.current = {status: 'loading'};
    const r = render(<SendScreen onReview={jest.fn()} />);
    fill(r);
    expect(r.getByTestId('send-available')).toHaveTextContent('— SOL');
    expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('owner 2A (2026-11-22): a failed read of the source → "Balance unavailable · tap to retry", the tap re-reads, the CTA stays disabled', async () => {
    // post-M1d R4: the refetch path is the non-main one — main retries through forceSync (its own row below)
    mockSendSelected.current = A3_SRC;
    mockSendPublic.current = {status: 'error'};
    mockSendRefetch.mockClear();
    const r = render(<SendScreen onReview={jest.fn()} />);
    fill(r);
    expect(r.queryByTestId('send-available')).toBeNull(); // never a figure, never "0"
    const retry = r.getByTestId('send-balance-retry');
    expect(retry).toHaveTextContent('Balance unavailable · tap to retry');
    expect(retry.props.accessibilityRole).toBe('button');
    expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
    // review 2A I1: no "short by" and no MAX from an unknown balance
    expect(r.queryByText(/Insufficient balance/)).toBeNull();
    expect(r.getByTestId('max-button').props.accessibilityState?.disabled).toBe(true);
    let release: (ok: boolean) => void = () => undefined;
    mockSendRefetch.mockImplementationOnce(() => new Promise<boolean>(res => (release = res)));
    await act(async () => {
      fireEvent.press(retry);
      fireEvent.press(retry); // a double tap reads once (in flight)
    });
    expect(mockSendRefetch).toHaveBeenCalledTimes(1);
    expect(r.getByTestId('send-balance-retry')).toHaveTextContent('Checking balance…'); // review 2A m2: never silent
    await act(async () => {
      release(false);
    });
    expect(r.getByTestId('send-balance-retry')).toHaveTextContent('Balance unavailable · tap to retry');
    await act(async () => {
      fireEvent.press(r.getByTestId('send-balance-retry'));
    });
    expect(mockSendRefetch).toHaveBeenCalledTimes(2); // review 2A m4: the guard is released after a read settles
  });

  const STALE_1_SOL = {status: 'stale', syncedAt: 1, failedAt: 2, solBalance: '1000000000', nocBalance: '0', tokens: [], tokenBalances: {}};

  it('post-M1d §3.2: a stale balance is not usable — "Not updated · tap to retry", no figure, CTA / MAX / "short by" off', () => {
    mockSendPublic.current = STALE_1_SOL;
    const r = render(<SendScreen onReview={jest.fn()} />);
    fill(r);
    expect(r.queryByTestId('send-available')).toBeNull(); // the stale 1 SOL is never offered as Available
    expect(r.getByTestId('send-balance-retry')).toHaveTextContent('Not updated · tap to retry');
    expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
    expect(r.getByTestId('max-button').props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(r.getByTestId('max-button'));
    expect(r.getByTestId('amount-input').props.value).toBe('0.001'); // MAX filled nothing
    fireEvent.changeText(r.getByTestId('amount-input'), '5'); // more than the stale 1 SOL
    expect(r.queryByText(/Insufficient balance/)).toBeNull(); // never judged against a stale figure
  });

  it('post-M1d review: a stale balance → the token picker shows "—" for each balance, never "0"', () => {
    mockSendPublic.current = STALE_1_SOL;
    const r = render(<SendScreen onReview={jest.fn()} />);
    fireEvent.press(r.getByTestId('token-picker'));
    expect(r.queryByText('0')).toBeNull();
    expect(r.getAllByText('—').length).toBeGreaterThanOrEqual(2); // SOL and NOC rows
  });

  // final review m3: while stale the token list keeps its (stale) labels — the selected token never falls back to SOL
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const USDC_TOKEN = {mint: USDC_MINT, symbol: 'USDC', name: 'USD Coin', decimals: 6};
  it('final review m3: stale + a non-SOL selected mint → the label stays that token, the balance is still refused', () => {
    mockSendPublic.current = {...STALE_1_SOL, tokens: [USDC_TOKEN], tokenBalances: {[USDC_MINT]: '5000000'}};
    const r = render(<SendScreen onReview={jest.fn()} initialMint={USDC_MINT} />);
    expect(r.getByTestId('token-picker').props.accessibilityLabel).toBe('Token USDC, tap to change');
    fill(r);
    expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
    expect(r.getByTestId('max-button').props.accessibilityState?.disabled).toBe(true);
    expect(r.queryByTestId('send-available')).toBeNull();
    expect(r.queryByText(/5 USDC/)).toBeNull(); // the stale figure is never shown
    fireEvent.changeText(r.getByTestId('amount-input'), '50');
    expect(r.queryByText(/Insufficient balance/)).toBeNull();
    expect(r.queryByText(/short by/i)).toBeNull();
    fireEvent.press(r.getByTestId('token-picker'));
    expect(r.getAllByText('USDC').length).toBeGreaterThanOrEqual(1);
    expect(r.queryByText('5')).toBeNull(); // the picker row shows "—", not the stale figure
  });

  it('control (m3): error (no figure at all) → the stale list is not there; the selection falls back as before', () => {
    mockSendPublic.current = {status: 'error'};
    const r = render(<SendScreen onReview={jest.fn()} initialMint={USDC_MINT} />);
    expect(r.getByTestId('token-picker').props.accessibilityLabel).toBe('Token SOL, tap to change');
  });

  it('positive control: READY → the picker shows the real figures', () => {
    mockSendPublic.current = READY_1_SOL;
    const r = render(<SendScreen onReview={jest.fn()} />);
    fireEvent.press(r.getByTestId('token-picker'));
    expect(r.queryAllByText('—')).toHaveLength(0);
  });

  it('positive control: the same figure as READY is usable', () => {
    mockSendPublic.current = READY_1_SOL;
    const r = render(<SendScreen onReview={jest.fn()} />);
    fill(r);
    expect(r.getByTestId('send-available')).toHaveTextContent('1 SOL');
    expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(false);
  });

  it('R4: main + stale → the tap runs forceSync once (never the no-op refetch); a double tap reads once', async () => {
    mockSendSelected.current = MAIN_SRC;
    mockSendPublic.current = STALE_1_SOL;
    mockSendRefetch.mockClear();
    mockForceSync.mockClear();
    let release: (v: {success: boolean; partial: boolean; timestamp: number}) => void = () => undefined;
    mockForceSync.mockImplementationOnce(() => new Promise(res => (release = res)));
    const r = render(<SendScreen onReview={jest.fn()} />);
    await act(async () => {
      fireEvent.press(r.getByTestId('send-balance-retry'));
      fireEvent.press(r.getByTestId('send-balance-retry'));
    });
    expect(mockForceSync).toHaveBeenCalledTimes(1);
    expect(mockSendRefetch).not.toHaveBeenCalled();
    expect(r.getByTestId('send-balance-retry')).toHaveTextContent('Checking balance…');
    await act(async () => {
      release({success: false, partial: true, timestamp: 2});
    });
    expect(r.getByTestId('send-balance-retry')).toHaveTextContent('Not updated · tap to retry');
  });

  it('another account + stale → the tap re-reads that account (refetch), not the main sync', async () => {
    mockSendSelected.current = A3_SRC;
    mockSendPublic.current = STALE_1_SOL;
    mockSendRefetch.mockClear();
    mockForceSync.mockClear();
    const r = render(<SendScreen onReview={jest.fn()} />);
    await act(async () => {
      fireEvent.press(r.getByTestId('send-balance-retry'));
    });
    expect(mockSendRefetch).toHaveBeenCalledTimes(1);
    expect(mockForceSync).not.toHaveBeenCalled();
  });

  it('a rejected forceSync frees the retry (never stuck on "Checking balance…")', async () => {
    mockSendSelected.current = MAIN_SRC;
    mockSendPublic.current = STALE_1_SOL;
    mockForceSync.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    const r = render(<SendScreen onReview={jest.fn()} />);
    await act(async () => {
      fireEvent.press(r.getByTestId('send-balance-retry'));
    });
    expect(r.getByTestId('send-balance-retry')).toHaveTextContent('Not updated · tap to retry');
  });

  // UNTESTED INVARIANT (race unconstructible): the generation guard itself has no test that can make it bite — the
  // source moves only null → account. This row pins the condition that makes it safe, not the guard.
  it('final review m2: no retry can start while the source is unknown (the guard is keyed on the source)', () => {
    mockSendSelected.current = null;
    mockSendPublic.current = {status: 'loading'};
    const r = render(<SendScreen onReview={jest.fn()} />);
    expect(r.queryByTestId('send-balance-retry')).toBeNull();
  });

  it('review 2A I1: while loading, MAX does not fill a 0 and no "short by" is shown', () => {
    mockSendPublic.current = {status: 'loading'};
    const r = render(<SendScreen onReview={jest.fn()} />);
    fill(r);
    fireEvent.press(r.getByTestId('max-button'));
    expect(r.getByTestId('amount-input').props.value).toBe('0.001');
    expect(r.queryByText(/Insufficient balance/)).toBeNull();
  });

  it('owner 2A: no retry row while loading or ready', () => {
    mockSendPublic.current = {status: 'loading'};
    const r = render(<SendScreen onReview={jest.fn()} />);
    expect(r.queryByTestId('send-balance-retry')).toBeNull();
    mockSendPublic.current = READY_1_SOL;
    r.rerender(<SendScreen onReview={jest.fn()} />);
    expect(r.queryByTestId('send-balance-retry')).toBeNull();
  });

  it('review m2: an account not known on the first render is captured when it resolves — and then never moves', () => {
    mockSendSelected.current = null;
    const onReview = jest.fn();
    const r = render(<SendScreen onReview={onReview} />);
    mockSendSelected.current = A3_SRC;
    r.rerender(<SendScreen onReview={onReview} />);
    mockSendSelected.current = MAIN_SRC;
    r.rerender(<SendScreen onReview={onReview} />);
    fill(r);
    expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(false);
    fireEvent.press(r.getByTestId('review-button'));
    expect(onReview.mock.calls[0]![0].from.scheme).toBe('slip10:3');
  });

  it('no account known (no wallet) → the CTA disabled', () => {
    mockSendSelected.current = null;
    const r = render(<SendScreen onReview={jest.fn()} />);
    fill(r);
    expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('plan A11 (ruling C1): the source\'s pool token is in the picker and can be sent', () => {
    const TEST_MINT = 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
    mockSendSelected.current = A3_SRC;
    mockSendPublic.current = {
      status: 'ready',
      syncedAt: 1,
      solBalance: '3000000',
      nocBalance: '0',
      tokenBalances: {[TEST_MINT]: '1250000000'},
      tokens: [{mint: TEST_MINT, symbol: 'TEST', name: 'Devnet test token', decimals: 9, trust: 'unknown'}],
    };
    const onReview = jest.fn();
    const r = render(<SendScreen onReview={onReview} />);
    fireEvent.press(r.getByTestId('token-picker'));
    fireEvent.press(r.getByLabelText('Select TEST'));
    fill(r);
    fireEvent.press(r.getByTestId('review-button'));
    expect(onReview).toHaveBeenCalledWith(expect.objectContaining({tokenMint: TEST_MINT, tokenSymbol: 'TEST', decimals: 9, amount: '0.001'}));
  });
});

describe('M1d — the linking warning and its second tap (spec §4.4)', () => {
  const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
  const A1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
  const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
  const FOREIGN = 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N';
  const SEED_LIST = {
    accounts: [],
    seed: [
      {address: MAIN, role: 'main'},
      {address: A3, role: 'fresh-exit'},
      {address: A1, role: 'fresh-pending'},
    ],
    walletKind: 'slip10',
    unreadable: false,
  };
  let now = 1_000_000;
  beforeEach(() => {
    mockSendSelected.current = A3_SRC; // the exit account is the source
    mockSendList.current = SEED_LIST;
    mockSendPublic.current = READY_1_SOL;
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => jest.restoreAllMocks());
  const setup = (recipient: string) => {
    const onReview = jest.fn();
    const r = render(<SendScreen onReview={onReview} />);
    fireEvent.changeText(r.getByTestId('recipient-input'), recipient);
    fireEvent.changeText(r.getByTestId('amount-input'), '0.001');
    return {r, onReview};
  };
  /** one tap, past the 500 ms debounce */
  const tap = (r: ReturnType<typeof render>) => {
    now += 600;
    fireEvent.press(r.getByTestId('review-button'));
  };

  it('exit → main: the warning before #19; the first tap only acknowledges, the second goes on', () => {
    const {r, onReview} = setup(MAIN);
    const w = r.getByTestId('send-link-warning');
    expect(w).toHaveTextContent('Sending between your own accounts links them on chain.Anyone can see that these two accounts belong to the same person.');
    tap(r);
    expect(onReview).not.toHaveBeenCalled();
    expect(r.getByText('Tap again to send anyway')).toBeTruthy();
    tap(r);
    expect(onReview).toHaveBeenCalledTimes(1);
    expect(onReview.mock.calls[0]![0]).toMatchObject({recipient: MAIN, from: {address: A3}});
  });

  // post-M1d P3 (owner): the limit this row used to pin is closed — the intent now names the accounts to tag
  it('post-M1d §4: exit → main, second tap → the intent carries linksAccounts = [the exit]; never the main account', () => {
    const {r, onReview} = setup(MAIN);
    tap(r);
    tap(r);
    expect(onReview.mock.calls[0]![0].linksAccounts).toEqual([A3]);
  });

  it('post-M1d §4 / R3: exit → a fresh-pending reservation → both travel (the pending one is queued by #21)', () => {
    const {r, onReview} = setup(A1);
    tap(r);
    tap(r);
    expect(onReview.mock.calls[0]![0].linksAccounts).toEqual([A3, A1]);
  });

  it('post-M1d §4: a Pay URI recipient (solana:<exit>) → linksAccounts names the exit address, not the raw string', () => {
    const {r, onReview} = setup(`solana:${A1}`);
    tap(r);
    tap(r);
    expect(onReview.mock.calls[0]![0].linksAccounts).toEqual([A3, A1]);
  });

  it('post-M1d §4: a foreign recipient → linksAccounts is empty', () => {
    const {r, onReview} = setup(FOREIGN);
    tap(r);
    expect(onReview.mock.calls[0]![0].linksAccounts).toEqual([]);
  });

  it('post-M1d §4: no registry known (list null) → empty, never a guess', () => {
    mockSendList.current = null;
    const {r, onReview} = setup(MAIN);
    tap(r);
    expect(onReview.mock.calls[0]![0].linksAccounts).toEqual([]);
  });

  // pin (passes before the change): #12 never imported the queue. It keeps a later edit from moving the write here.
  it('post-M1d §4: #12 itself writes nothing — the tag belongs to #21', () => {
    const {r} = setup(MAIN);
    tap(r);
    tap(r);
    expect(mockRecordLinks).not.toHaveBeenCalled();
  });

  it('the debounce still holds: a second tap within 500 ms is not the second tap', () => {
    const {r, onReview} = setup(MAIN);
    tap(r);
    now += 100;
    fireEvent.press(r.getByTestId('review-button'));
    expect(onReview).not.toHaveBeenCalled();
    tap(r);
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('changing the amount resets the acknowledgement', () => {
    const {r, onReview} = setup(MAIN);
    tap(r);
    fireEvent.changeText(r.getByTestId('amount-input'), '0.002');
    expect(r.queryByText('Tap again to send anyway')).toBeNull();
    tap(r);
    expect(onReview).not.toHaveBeenCalled(); // acknowledged again, not sent
    tap(r);
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('changing the recipient resets the acknowledgement', () => {
    const {r, onReview} = setup(MAIN);
    tap(r);
    fireEvent.changeText(r.getByTestId('recipient-input'), A1);
    expect(r.queryByText('Tap again to send anyway')).toBeNull();
    tap(r);
    expect(onReview).not.toHaveBeenCalled();
  });

  it('Review Focus 3: main → a fresh-pending reservation warns too', () => {
    mockSendSelected.current = {...MAIN_SRC, address: MAIN};
    const {r} = setup(A1);
    expect(r.getByTestId('send-link-warning')).toBeTruthy();
  });

  it('a foreign recipient: no warning, one tap reviews', () => {
    const {r, onReview} = setup(FOREIGN);
    expect(r.queryByTestId('send-link-warning')).toBeNull();
    tap(r);
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('review r1 m6: #12 re-reads the registry as it opens (a reservation made since is in the seed set)', () => {
    mockSendRefresh.mockClear();
    setup(MAIN);
    expect(mockSendRefresh).toHaveBeenCalledTimes(1);
  });

  it('review r1 m5: MAX changes the amount → the acknowledgement resets', () => {
    const {r, onReview} = setup(MAIN);
    tap(r);
    fireEvent.press(r.getByTestId('max-button'));
    expect(r.queryByText('Tap again to send anyway')).toBeNull();
    tap(r);
    expect(onReview).not.toHaveBeenCalled();
  });

  it('review r1 m5: picking a token clears the amount → the acknowledgement resets', () => {
    const {r} = setup(MAIN);
    tap(r);
    fireEvent.press(r.getByTestId('token-picker'));
    fireEvent.press(r.getByLabelText('Select SOL'));
    expect(r.queryByText('Tap again to send anyway')).toBeNull();
  });

  it('control: no registry known (list null) → no warning', () => {
    mockSendList.current = null;
    const {r} = setup(MAIN);
    expect(r.queryByTestId('send-link-warning')).toBeNull();
  });

  it('no "fund this account" shortcut anywhere on #12 (the warning is shown in this row)', () => {
    const {r} = setup(MAIN);
    expect(r.getByTestId('send-link-warning')).toBeTruthy(); // M1d review M3: positive control — the row is about the warning state
    expect(r.queryByText(/fund this account|fund account/i)).toBeNull();
  });

  // M1d review I1: the recipient-recognition path on the screen
  it('review I1: a Solana Pay URI to an own account warns, and the first tap does not review', () => {
    const {r, onReview} = setup(`solana:${MAIN}?amount=0.001`);
    expect(r.getByTestId('send-link-warning')).toBeTruthy();
    tap(r);
    expect(onReview).not.toHaveBeenCalled();
  });

  it('review I1: a padded address warns', () => {
    const {r} = setup(`  ${MAIN}  `);
    expect(r.getByTestId('send-link-warning')).toBeTruthy();
  });

  it('review I1: acknowledge, then blur on the recipient → the acknowledgement resets', () => {
    const {r, onReview} = setup(`solana:${MAIN}?amount=0.001`);
    tap(r);
    expect(r.getByText('Tap again to send anyway')).toBeTruthy();
    fireEvent(r.getByTestId('recipient-input'), 'blur');
    expect(r.queryByText('Tap again to send anyway')).toBeNull();
    tap(r);
    expect(onReview).not.toHaveBeenCalled();
  });

  it('review M1: after the second tap goes on, the next attempt (Back from #19) needs a second tap again', () => {
    const {r, onReview} = setup(MAIN);
    tap(r);
    tap(r);
    expect(onReview).toHaveBeenCalledTimes(1);
    tap(r);
    expect(onReview).toHaveBeenCalledTimes(1);
    tap(r);
    expect(onReview).toHaveBeenCalledTimes(2);
  });

  it('review M2: the warning is an alert live region and the CTA label change is announced', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    announce.mockClear(); // the RN jest setup shares one mock across tests
    const {r} = setup(MAIN);
    expect(r.getByTestId('send-link-warning').props.accessibilityLiveRegion).toBe('polite');
    expect(r.getByTestId('send-link-warning').props.accessibilityRole).toBe('alert');
    expect(r.getByTestId('review-button').props.accessibilityLabel).toBe('Send SOL');
    expect(announce).not.toHaveBeenCalled();
    tap(r);
    expect(r.getByTestId('review-button').props.accessibilityLabel).toBe('Tap again to send anyway');
    expect(announce).toHaveBeenCalledTimes(1); // M1d: announced once, at the acknowledgement (was: a live region on the CTA text)
    expect(announce).toHaveBeenCalledWith('Tap again to send anyway');
  });

  it('review r1 N2: the CTA text is not a live region (no announcement per amount keystroke); the warning stays an alert', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    announce.mockClear(); // the RN jest setup shares one mock across tests
    const {r} = setup(MAIN);
    expect(r.getByText('Send 0.001 SOL').props.accessibilityLiveRegion).toBeUndefined();
    for (const a of ['0.0011', '0.00112', '0.001123']) {
      fireEvent.changeText(r.getByTestId('amount-input'), a);
    }
    expect(r.getByText('Send 0.001123 SOL').props.accessibilityLiveRegion).toBeUndefined();
    expect(announce).not.toHaveBeenCalled();
    expect(r.getByTestId('send-link-warning').props.accessibilityRole).toBe('alert');
  });

  it('review M5 / r1 N1: source = recipient on an exit account (MAIN is the fresh-exit here) → no warning, one tap reviews — bites on the recipient === source guard', () => {
    mockSendList.current = {...SEED_LIST, seed: [{address: MAIN, role: 'fresh-exit'}, {address: A3, role: 'main'}]};
    mockSendSelected.current = {...MAIN_SRC, address: MAIN}; // M1d: an on-curve exit, so only the same-address guard stops the warning
    const {r, onReview} = setup(MAIN);
    expect(r.queryByTestId('send-link-warning')).toBeNull();
    tap(r);
    expect(onReview).toHaveBeenCalledTimes(1);
  });
});
