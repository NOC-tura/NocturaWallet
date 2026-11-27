/**
 * #26 (history spec 2026-11-26 §5, §8 "Screen"): the list against a scripted `useActivityHistory`.
 * What a row SAYS is pinned in activityView.test.ts; here: that the screen shows it, the chips, the
 * empty-chip line, "Load older" and the 3-page cap, the skeleton, and the states PR 1 fixed
 * (retry single-flight, no claim without a read). Real timers only.
 */
import React from 'react';
import {AppState} from 'react-native';
import {render, fireEvent, act} from '@testing-library/react-native';
import {TransactionHistoryScreen} from '../TransactionHistoryScreen';
import * as activityView from '../../../modules/solana/activityView';
import {mmkvPublic} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';
import {VALUE_HIDDEN, VALUE_HIDDEN_SPOKEN} from '../../../copy/accounts';
import type {ActivityKind, ActivityRow, Delta} from '../../../modules/solana/activity';
import type {HistoryRow, HistorySnapshot} from '../../../modules/solana/history';

const ME = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
const ACC_2 = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const OUTSIDE = 'EfHSPxjapWuecfjRp6eRL2PR3YjpKbk86jm5kqmwXGgk';
const LJ = 'Europe/Ljubljana';
const NOW = Date.parse('2026-11-26T11:00:00Z');
const at = (iso: string): number => Date.parse(iso) / 1000;

// M1d (spec §4.2): the history is the SELECTED account's
const mockHistSelected: {current: {address: string; label: string} | null} = {current: {address: ME, label: 'Account 1'}};
// one stable object, as the real hook's memoised list is (a fresh one per call would defeat the row memo)
const mockAccountList = {
  accounts: [
    {scheme: 'slip10:0', address: 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B', label: 'Account 1', number: 1, role: 'main', isMain: true, linked: false},
    {scheme: 'slip10:1', address: '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4', label: 'Account 2', number: 2, role: 'fresh-exit', isMain: false, linked: false},
  ],
  seed: [],
  walletKind: 'slip10',
  unreadable: false,
};
jest.mock('../../../hooks/useSelectedAccount', () => ({
  useSelectedAccount: () => mockHistSelected.current,
  useAccountList: () => mockAccountList,
}));

const mockHistory: {
  data: HistorySnapshot | undefined;
  isSuccess: boolean;
  isError: boolean;
  refetch: jest.Mock;
  loadOlder: jest.Mock;
  loadingOlder: boolean;
} = {data: undefined, isSuccess: false, isError: false, refetch: jest.fn(), loadOlder: jest.fn(), loadingOlder: false};
const mockUseActivityHistory = jest.fn((_account: string | null) => mockHistory);
jest.mock('../../../hooks/useActivityHistory', () => ({useActivityHistory: (account: string | null) => mockUseActivityHistory(account)}));

// owner, Q2: the dashboard's hide-balances setting, controlled here (the store's one field this screen reads)
const mockHide = {current: false};
jest.mock('../../../store/zustand/publicSettingsStore', () => ({
  usePublicSettingsStore: (sel: (s: {hideBalances: boolean}) => unknown) => sel({hideBalances: mockHide.current}),
}));

const delta = (mint: string, symbol: string, raw: bigint, role: Delta['role'] = 'moved'): Delta => ({mint, symbol, raw, decimals: 9, role});
let n = 0;
function row(kind: ActivityKind | null, over: Partial<ActivityRow> = {}, blockTime: number | null = at('2026-11-26T08:14:00Z')): HistoryRow {
  n += 1;
  const signature = over.signature ?? `sig${n}`;
  const item = {signature, slot: 1000 - n, blockTime, status: kind === 'failed' ? ('failed' as const) : ('finalized' as const), finalized: true};
  if (kind === null) {
    return {item, activity: null};
  }
  return {
    item,
    activity: {
      signature, slot: item.slot, blockTime, status: item.status, kind, primary: null, secondary: null, extraAssets: 0, deltas: [],
      counterparty: null, via: null, feePaidByAccount: null, incomplete: false, ...over,
    },
  };
}
const snapshot = (rows: HistoryRow[], endReached = true, coverage = {read: 0, total: 0}): HistorySnapshot => ({sessionId: 1, rows, endReached, coverage});
function show(rows: HistoryRow[], endReached = true, coverage?: {read: number; total: number}): void {
  mockHistory.data = snapshot(rows, endReached, coverage);
  mockHistory.isSuccess = true;
}

const onSelectTx = jest.fn();
const onBack = jest.fn();
const screen = () => render(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} now={NOW} timeZone={LJ} />);

beforeEach(() => {
  jest.clearAllMocks();
  mmkvPublic.remove(MMKV_KEYS.ACTIVITY_FILTER);
  n = 0;
  mockHide.current = false;
  mockHistSelected.current = {address: ME, label: 'Account 1'};
  mockHistory.data = undefined;
  mockHistory.isSuccess = false;
  mockHistory.isError = false;
  mockHistory.loadingOlder = false;
  mockHistory.refetch = jest.fn(() => Promise.resolve());
  mockHistory.loadOlder = jest.fn(() => Promise.resolve(null));
});

describe('rows (§5.1)', () => {
  // T1
  it('each row form: icon, title, secondary line, amount, the line under it', () => {
    show([
      row('sent', {signature: 'sent', primary: delta('M', 'TEST', -100000n), counterparty: OUTSIDE}),
      row('received', {signature: 'recv', primary: delta('native', 'SOL', 250_000_000n), counterparty: ACC_2}),
      row('swap', {signature: 'swap', primary: delta('native', 'SOL', -1_200_000_000n), secondary: delta('N', 'NOC', 9_524_100_000_000n), via: 'Jupiter'}),
      row('made-private', {signature: 'priv', primary: delta('M', 'TEST', -100000n)}),
      row('made-public', {signature: 'pub', primary: delta('M', 'TEST', 100000n)}),
      row('wrap', {signature: 'wrap', primary: delta('native', 'SOL', -2_000_000_000n)}),
      row('account-setup', {signature: 'setup', primary: delta('native', 'SOL', -1_488_440n, 'rent')}),
      row('failed', {signature: 'fail', feePaidByAccount: 5000n}),
      row('no-funds-moved', {signature: 'none'}),
      row('unknown', {signature: 'unk'}),
      row(null, {signature: 'partial'}),
    ]);
    const {getByTestId, queryByTestId} = screen();
    const text = (id: string) => getByTestId(id);

    expect(getByTestId('tx-row-sent-icon-sent')).toBeTruthy();
    expect(text('tx-row-sent-title')).toHaveTextContent('Sent TEST');
    expect(text('tx-row-sent-secondary')).toHaveTextContent('to EfHSPx…mwXGgk · 09:14'); // 6…6, never 4…4
    expect(text('tx-row-sent-amount')).toHaveTextContent('−0.0001');
    expect(queryByTestId('tx-row-sent-sub')).toBeNull(); // H7: no USD line on a row

    expect(getByTestId('tx-row-recv-icon-received')).toBeTruthy();
    expect(text('tx-row-recv-title')).toHaveTextContent('Received SOL');
    expect(text('tx-row-recv-secondary')).toHaveTextContent('from Account 2 · 09:14'); // a wallet of this seed by its label
    expect(text('tx-row-recv-amount')).toHaveTextContent('+0.25');

    expect(getByTestId('tx-row-swap-icon-swap')).toBeTruthy();
    expect(text('tx-row-swap-title')).toHaveTextContent('Swapped SOL → NOC');
    expect(text('tx-row-swap-secondary')).toHaveTextContent('via Jupiter · 09:14');
    expect(text('tx-row-swap-amount')).toHaveTextContent('−1.2');
    expect(text('tx-row-swap-sub')).toHaveTextContent('+9,524.1 NOC');

    expect(getByTestId('tx-row-priv-icon-private')).toBeTruthy();
    expect(text('tx-row-priv-title')).toHaveTextContent('Made private TEST');
    // owner, Q1: the badge is an icon with no word — the transaction is public on chain, the badge claims nothing
    expect(getByTestId('tx-row-priv-badge')).toHaveTextContent('');
    expect(getByTestId('tx-row-priv-badge').props.accessibilityLabel).toBe('Pool transaction');
    expect(getByTestId('tx-row-priv').props.accessibilityLabel).toBe('Made private TEST, Pool transaction, 09:14, −0.0001');
    expect(text('tx-row-pub-title')).toHaveTextContent('Made public TEST');
    expect(getByTestId('tx-row-pub-badge')).toHaveTextContent('');
    expect(queryByTestId('tx-row-sent-badge')).toBeNull();
    expect(getByTestId('tx-row-sent').props.accessibilityLabel).toBe('Sent TEST, to EfHSPx…mwXGgk · 09:14, −0.0001');

    expect(text('tx-row-wrap-title')).toHaveTextContent('Wrapped SOL');
    expect(text('tx-row-wrap-amount')).toHaveTextContent('−2');

    expect(getByTestId('tx-row-setup-icon-setup')).toBeTruthy();
    expect(text('tx-row-setup-title')).toHaveTextContent('Transaction');
    expect(text('tx-row-setup-secondary')).toHaveTextContent('Account setup · 09:14');
    expect(text('tx-row-setup-amount')).toHaveTextContent('−0.0015 SOL');

    expect(getByTestId('tx-row-fail-icon-failed')).toBeTruthy();
    expect(text('tx-row-fail-title')).toHaveTextContent('Failed');
    expect(text('tx-row-fail-amount')).toHaveTextContent('—');
    expect(text('tx-row-fail-sub')).toHaveTextContent('fee 0.000005 SOL');

    expect(text('tx-row-none-amount')).toHaveTextContent('No funds moved');
    expect(getByTestId('tx-row-unk-icon-dot')).toBeTruthy();
    expect(text('tx-row-unk-amount')).toHaveTextContent('—');

    // §3.4: a partial row is shown, as "Transaction" with "—": never dropped, never a Sent
    expect(getByTestId('tx-row-partial-icon-dot')).toBeTruthy();
    expect(text('tx-row-partial-title')).toHaveTextContent('Transaction');
    expect(text('tx-row-partial-amount')).toHaveTextContent('—');
  });

  // T1b (owner, Q2)
  it('hide balances: every figure of a row reads "•••"; title, counter-party, time and status stay', () => {
    const rows = () => [
      row('sent', {signature: 'sent', primary: delta('M', 'TEST', -100000n), counterparty: OUTSIDE}),
      row('swap', {signature: 'swap', primary: delta('native', 'SOL', -1_200_000_000n), secondary: delta('N', 'NOC', 9_524_100_000_000n), via: 'Jupiter'}),
      row('failed', {signature: 'fail', feePaidByAccount: 5000n}),
      row('no-funds-moved', {signature: 'none'}),
    ];
    mockHide.current = true;
    show(rows());
    const hidden = screen();
    expect(hidden.getByTestId('tx-row-sent-amount')).toHaveTextContent(VALUE_HIDDEN, {exact: true});
    expect(hidden.getByTestId('tx-row-sent-title')).toHaveTextContent('Sent TEST');
    expect(hidden.getByTestId('tx-row-sent-secondary')).toHaveTextContent('to EfHSPx…mwXGgk · 09:14');
    expect(hidden.getByTestId('tx-row-sent').props.accessibilityLabel).toBe(`Sent TEST, to EfHSPx…mwXGgk · 09:14, ${VALUE_HIDDEN_SPOKEN}`);
    // ruling C: the mask is for the eyes; a screen reader hears "Hidden", never the bullets
    for (const id of ['sent', 'swap', 'fail', 'none']) {
      expect(hidden.getByTestId(`tx-row-${id}`).props.accessibilityLabel).not.toContain('•');
    }
    expect(hidden.getByTestId('tx-row-swap').props.accessibilityLabel).toBe(`Swapped SOL → NOC, via Jupiter · 09:14, ${VALUE_HIDDEN_SPOKEN}, ${VALUE_HIDDEN_SPOKEN}`);
    expect(hidden.getByTestId('tx-row-swap-amount')).toHaveTextContent(VALUE_HIDDEN, {exact: true});
    expect(hidden.getByTestId('tx-row-swap-sub')).toHaveTextContent(VALUE_HIDDEN, {exact: true});
    expect(hidden.getByTestId('tx-row-fail-title')).toHaveTextContent('Failed');
    expect(hidden.getByTestId('tx-row-fail-sub')).toHaveTextContent(VALUE_HIDDEN, {exact: true});
    expect(hidden.getByTestId('tx-row-none-amount')).toHaveTextContent('No funds moved');
    expect(hidden.queryByText(/0\.0001|1\.2|9,524|0\.000005/)).toBeNull();
    hidden.unmount();
    mockHide.current = false; // control: the same rows, shown
    n = 0;
    show(rows());
    const shown = screen();
    expect(shown.getByTestId('tx-row-sent-amount')).toHaveTextContent('−0.0001');
    expect(shown.getByTestId('tx-row-swap-sub')).toHaveTextContent('+9,524.1 NOC');
    expect(shown.getByTestId('tx-row-fail-sub')).toHaveTextContent('fee 0.000005 SOL');
  });

  // T2
  it('"+N more" and " · incomplete" follow the amount', () => {
    show([row('sent', {signature: 'a', primary: delta('M', 'TEST', -100000n), extraAssets: 1, incomplete: true})]);
    const {getByTestId} = screen();
    expect(getByTestId('tx-row-a-amount')).toHaveTextContent('−0.0001 +1 more · incomplete');
  });

  // T3
  it('a row tap opens #27 with the signature and the account the row was shown for', () => {
    show([row('sent', {signature: 'a', primary: delta('M', 'TEST', -1n)})]);
    const {getByTestId} = screen();
    fireEvent.press(getByTestId('tx-row-a'));
    expect(onSelectTx).toHaveBeenCalledWith('a', ME);
  });

  // T4
  it('rows sit under date sections; "Date unknown" is last', () => {
    show([
      row('unknown', {signature: 'nodate'}, null),
      row('unknown', {signature: 'today'}, at('2026-11-26T08:00:00Z')),
      row('unknown', {signature: 'yday'}, at('2026-11-25T08:00:00Z')),
      row('unknown', {signature: 'old'}, at('2026-05-06T08:00:00Z')),
    ]);
    const {getByTestId, getAllByTestId} = screen();
    expect(getAllByTestId(/^history-section-/).map(x => x.props.children)).toEqual(['Today · Nov 26', 'Yesterday · Nov 25', 'May 2026', 'Date unknown']);
    expect(getByTestId('tx-row-old-secondary')).toHaveTextContent('6 May');
  });

  // T5 (M1d)
  it('asks the history of the selected account and names it', () => {
    mockHistSelected.current = {address: ACC_2, label: 'Account 2'};
    show([]);
    const {getByTestId} = screen();
    expect(mockUseActivityHistory).toHaveBeenLastCalledWith(ACC_2);
    expect(getByTestId('history-account-label')).toHaveTextContent('Account 2');
  });
});

describe('design elements of #26', () => {
  it('the Private chip carries the shield glyph, the others none', () => {
    show([]);
    const {getByTestId, queryByTestId} = screen();
    expect(getByTestId('history-chip-private-icon')).toBeTruthy();
    expect(queryByTestId('history-chip-sent-icon')).toBeNull();
  });

  it('the dated headers: Today and Yesterday carry their date in the zone, the others none', () => {
    show([
      row('unknown', {signature: 'late'}, at('2026-11-26T23:30:00Z')), // Nov 27 in Ljubljana: ahead of the clock, still Today
      row('unknown', {signature: 'yday'}, at('2026-11-25T08:00:00Z')),
      row('unknown', {signature: 'week'}, at('2026-11-24T08:00:00Z')),
    ]);
    const {getByTestId} = screen();
    expect(getByTestId('history-section-today')).toHaveTextContent('Today · Nov 26');
    expect(getByTestId('history-section-yesterday')).toHaveTextContent('Yesterday · Nov 25');
    expect(getByTestId('history-section-week')).toHaveTextContent('This week', {exact: true});
  });

  it('a counter-party address is set in the mono face; a wallet label and a time-only line are not', () => {
    show([
      row('sent', {signature: 'out', primary: delta('M', 'TEST', -1n), counterparty: OUTSIDE}),
      row('received', {signature: 'own', primary: delta('M', 'TEST', 1n), counterparty: ACC_2}),
      row('swap', {signature: 'swp', primary: delta('native', 'SOL', -1n), secondary: delta('N', 'NOC', 1n), via: 'Jupiter'}),
    ]);
    const {getByTestId} = screen();
    expect(getByTestId('tx-row-out-secondary').props.className).toContain('font-geist-mono');
    expect(getByTestId('tx-row-own-secondary').props.className).not.toContain('font-geist-mono');
    expect(getByTestId('tx-row-swp-secondary').props.className).not.toContain('font-geist-mono');
  });

  it('the chip chosen survives a remount; an unknown stored value reads as All', () => {
    show([row('sent', {signature: 's', primary: delta('M', 'TEST', -1n)}), row('received', {signature: 'r', primary: delta('M', 'TEST', 1n)})]);
    const first = screen();
    fireEvent.press(first.getByTestId('history-chip-received'));
    expect(mmkvPublic.getString(MMKV_KEYS.ACTIVITY_FILTER)).toBe('received');
    first.unmount();
    const again = screen();
    expect(again.getByTestId('history-chip-received').props.accessibilityState).toEqual({selected: true});
    expect(again.queryByTestId('tx-row-s')).toBeNull();
    again.unmount();
    mmkvPublic.set(MMKV_KEYS.ACTIVITY_FILTER, 'nonsense');
    const unknown = screen();
    expect(unknown.getByTestId('history-chip-all').props.accessibilityState).toEqual({selected: true});
    expect(unknown.getByTestId('tx-row-s')).toBeTruthy();
  });

  it('a row that did not change is not rendered again when an unrelated state flips', () => {
    show([row('sent', {signature: 'a', primary: delta('M', 'TEST', -1n)})], false);
    const view = screen();
    const spy = jest.spyOn(activityView, 'rowView');
    try {
      mockHistory.loadingOlder = true;
      view.rerender(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} now={NOW} timeZone={LJ} />);
      expect(view.getByTestId('history-loading-older')).toBeTruthy(); // the screen did re-render
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('chips (§5.2)', () => {
  const mixed = (): HistoryRow[] => [
    row('sent', {signature: 's', primary: delta('M', 'TEST', -1n)}),
    row('received', {signature: 'r', primary: delta('M', 'TEST', 1n)}),
    row('swap', {signature: 'w', primary: delta('native', 'SOL', -1n), secondary: delta('M', 'TEST', 1n)}),
    row('made-private', {signature: 'p', primary: delta('M', 'TEST', -1n)}),
    row('made-public', {signature: 'q', primary: delta('M', 'TEST', 1n)}),
    row('failed', {signature: 'f'}),
  ];
  const shown = (q: (id: string) => unknown, ids: string[]) => ids.filter(id => q(`tx-row-${id}`) !== null);
  const ALL = ['s', 'r', 'w', 'p', 'q', 'f'];

  // T6
  it('All / Sent / Received / Swaps / Private filter the loaded rows; the pool moves are never Sent or Received', () => {
    show(mixed());
    const {getByTestId, queryByTestId} = screen();
    // the fifth chip reads "Private" — the app's one word for that side (copy guard: bannedWords.test.ts)
    const labels = {all: 'All', sent: 'Sent', received: 'Received', swaps: 'Swaps', private: 'Private'};
    for (const [id, text] of Object.entries(labels)) {
      expect(getByTestId(`history-chip-${id}`)).toHaveTextContent(text);
    }
    expect(shown(queryByTestId, ALL)).toEqual(ALL);
    fireEvent.press(getByTestId('history-chip-sent'));
    expect(shown(queryByTestId, ALL)).toEqual(['s']);
    fireEvent.press(getByTestId('history-chip-received'));
    expect(shown(queryByTestId, ALL)).toEqual(['r']);
    fireEvent.press(getByTestId('history-chip-swaps'));
    expect(shown(queryByTestId, ALL)).toEqual(['w']);
    fireEvent.press(getByTestId('history-chip-private'));
    expect(shown(queryByTestId, ALL)).toEqual(['p', 'q']);
    expect(getByTestId('history-chip-private').props.accessibilityState).toEqual({selected: true});
    expect(getByTestId('history-chip-all').props.accessibilityState).toEqual({selected: false});
  });

  // T7 (review I6)
  it('a chip with no loaded match, while older pages exist: "No {chip} transactions in the last {n}" and "Load older"', () => {
    show([row('sent', {primary: delta('M', 'TEST', -1n)}), row('sent', {primary: delta('M', 'TEST', -1n)})], false);
    const {getByTestId, getByText, queryByText} = screen();
    fireEvent.press(getByTestId('history-chip-swaps'));
    expect(getByText('No swaps in the last 2 transactions')).toBeTruthy();
    expect(queryByText('No swaps yet')).toBeNull();
    expect(queryByText('No transactions yet')).toBeNull();
    fireEvent.press(getByTestId('history-load-older'));
    expect(mockHistory.loadOlder).toHaveBeenCalledTimes(1);
  });

  // N4: the All chip with rows never shows an empty state, and no chip says "No … in the last 0"
  it('the All chip with rows shows no chip-empty line; a chip with zero loaded rows shows none either', () => {
    show([row('sent', {primary: delta('M', 'TEST', -1n)})], false);
    const view = screen();
    expect(view.queryByTestId('history-chip-empty')).toBeNull();
    expect(view.queryByText('No transactions yet')).toBeNull();
    view.unmount();
    show([], false);
    const none = screen();
    fireEvent.press(none.getByTestId('history-chip-sent'));
    expect(none.queryByTestId('history-chip-empty')).toBeNull();
    expect(none.queryByText(/in the last 0/)).toBeNull();
  });

  // T8
  it('"No {chip} transactions yet" only at the end of history, with no "Load older"', () => {
    show([row('sent', {primary: delta('M', 'TEST', -1n)})], true);
    const {getByTestId, getByText, queryByTestId} = screen();
    fireEvent.press(getByTestId('history-chip-private'));
    expect(getByText('No Made private or Made public transactions yet')).toBeTruthy();
    expect(queryByTestId('history-load-older')).toBeNull();
  });

  // T9 (r2 m4)
  it('automatic loading stops after 3 consecutive pages with no row under the chip; "Load older" still loads; a match resets it', async () => {
    const base = [row('sent', {signature: 's', primary: delta('M', 'TEST', -1n)}), row('received', {signature: 'r', primary: delta('M', 'TEST', 1n)})];
    show(base, false);
    // every page adds a Sent row: nothing new under Received
    const sentOnly = async () => snapshot([...base, row('sent', {primary: delta('M', 'TEST', -1n)})], false);
    mockHistory.loadOlder = jest.fn(sentOnly);
    const view = screen();
    fireEvent.press(view.getByTestId('history-chip-received'));
    const reachEnd = async () => {
      await act(async () => {
        fireEvent(view.getByTestId('history-list'), 'endReached');
      });
    };
    for (let k = 0; k < 5; k++) {
      await reachEnd();
    }
    expect(mockHistory.loadOlder).toHaveBeenCalledTimes(3);
    // the explicit control still loads
    await act(async () => {
      fireEvent.press(view.getByTestId('history-load-older'));
    });
    expect(mockHistory.loadOlder).toHaveBeenCalledTimes(4);
    // a page that adds a Received row resets the count: scrolling loads again
    mockHistory.loadOlder.mockImplementationOnce(async () => snapshot([...base, row('received', {primary: delta('M', 'TEST', 1n)})], false));
    await act(async () => {
      fireEvent.press(view.getByTestId('history-load-older'));
    });
    expect(mockHistory.loadOlder).toHaveBeenCalledTimes(5);
    await reachEnd();
    expect(mockHistory.loadOlder).toHaveBeenCalledTimes(6);
  });

  // T9b (plan review r1 m3)
  it('a chip change starts the count again: scrolling under the new chip loads', async () => {
    const base = [row('sent', {signature: 's', primary: delta('M', 'TEST', -1n)}), row('received', {signature: 'r', primary: delta('M', 'TEST', 1n)})];
    show(base, false);
    mockHistory.loadOlder = jest.fn(async () => snapshot([...base, row('swap', {primary: delta('M', 'TEST', -1n), secondary: delta('N', 'NOC', 1n)})], false));
    const view = screen();
    const reachEnd = async () => {
      await act(async () => {
        fireEvent(view.getByTestId('history-list'), 'endReached');
      });
    };
    fireEvent.press(view.getByTestId('history-chip-received'));
    for (let k = 0; k < 5; k++) {
      await reachEnd();
    }
    expect(mockHistory.loadOlder).toHaveBeenCalledTimes(3); // stopped under Received
    fireEvent.press(view.getByTestId('history-chip-sent'));
    await reachEnd();
    expect(mockHistory.loadOlder).toHaveBeenCalledTimes(4); // Sent has its own three
  });

  // T10 (I1): a failed page on All is not retried by the list's own re-firing; the user's tap retries
  it('All: one failed older page → no further automatic reads, "Load older" shown; a tap reads once; a success clears it', async () => {
    show([row('sent', {primary: delta('M', 'TEST', -1n)})], false);
    mockHistory.loadOlder = jest.fn(async () => null);
    const view = screen();
    const reachEnd = async () => {
      await act(async () => {
        fireEvent(view.getByTestId('history-list'), 'endReached');
      });
    };
    expect(view.queryByTestId('history-load-older')).toBeNull();
    await reachEnd();
    expect(mockHistory.loadOlder).toHaveBeenCalledTimes(1);
    await reachEnd();
    await reachEnd();
    expect(mockHistory.loadOlder).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('history-load-older')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('history-load-older'));
    });
    expect(mockHistory.loadOlder).toHaveBeenCalledTimes(2);
    // a page that is read clears it: scrolling loads again, the button is gone
    mockHistory.loadOlder.mockImplementationOnce(async () => snapshot([row('sent', {primary: delta('M', 'TEST', -1n)})], false));
    await act(async () => {
      fireEvent.press(view.getByTestId('history-load-older'));
    });
    expect(view.queryByTestId('history-load-older')).toBeNull();
    await reachEnd();
    expect(mockHistory.loadOlder).toHaveBeenCalledTimes(4);
  });

  // I1: the failure belongs to the chip and the account it was read under
  it('a chip change clears a failed-page stop on All', async () => {
    show([row('sent', {primary: delta('M', 'TEST', -1n)})], false);
    mockHistory.loadOlder = jest.fn(async () => null);
    const view = screen();
    const reachEnd = async () => {
      await act(async () => {
        fireEvent(view.getByTestId('history-list'), 'endReached');
      });
    };
    await reachEnd();
    fireEvent.press(view.getByTestId('history-chip-sent'));
    fireEvent.press(view.getByTestId('history-chip-all'));
    await reachEnd();
    expect(mockHistory.loadOlder).toHaveBeenCalledTimes(2);
  });

  // m2: a page that finishes after the chip changed says nothing about the new chip
  it('a load that finishes after a chip change does not count against the new chip', async () => {
    const base = [row('sent', {signature: 's', primary: delta('M', 'TEST', -1n)}), row('received', {signature: 'r', primary: delta('M', 'TEST', 1n)})];
    show(base, false);
    const pending: Array<(v: HistorySnapshot | null) => void> = [];
    mockHistory.loadOlder = jest.fn(() => new Promise<HistorySnapshot | null>(r => pending.push(r)));
    const view = screen();
    fireEvent.press(view.getByTestId('history-chip-received'));
    for (let k = 0; k < 3; k++) {
      fireEvent.press(view.getByTestId('history-load-older'));
    }
    fireEvent.press(view.getByTestId('history-chip-sent'));
    await act(async () => {
      pending.forEach(r => r(snapshot(base, false))); // each adds nothing under Received
    });
    await act(async () => {
      fireEvent(view.getByTestId('history-list'), 'endReached');
    });
    expect(mockHistory.loadOlder).toHaveBeenCalledTimes(4); // Sent still has its own three: the scroll loads
  });

  // T11
  it('at the end of history nothing more is loaded', async () => {
    show([row('sent', {primary: delta('M', 'TEST', -1n)})], true);
    const view = screen();
    await act(async () => {
      fireEvent(view.getByTestId('history-list'), 'endReached');
    });
    expect(mockHistory.loadOlder).not.toHaveBeenCalled();
    expect(view.queryByTestId('history-load-older')).toBeNull();
  });
});

describe('states (§5.3)', () => {
  // T12 (26a)
  it('cold load: 5 skeleton rows across 2 sections, never the empty state', () => {
    const {getAllByTestId, queryByText, getByText} = screen();
    expect(getAllByTestId('history-skeleton-row')).toHaveLength(5);
    expect(getByText('Today')).toBeTruthy();
    expect(getByText('Yesterday')).toBeTruthy();
    expect(queryByText('No transactions yet')).toBeNull();
  });

  // T13 (§3.4)
  it('"No transactions yet" only when a successful read reached the end of history with zero rows', () => {
    show([], true);
    expect(screen().getByText('No transactions yet')).toBeTruthy();
    // a first page that read zero rows but did NOT reach the end claims nothing
    show([], false);
    const notEnd = screen();
    expect(notEnd.queryByText('No transactions yet')).toBeNull();
    expect(notEnd.queryByTestId('history-skeleton')).toBeNull();
  });

  // I2: the three conditions at once — a failed refresh of an empty, fully read history claims nothing
  it('a failed refresh after an empty read: no "No transactions yet", the retry line instead', () => {
    show([], true);
    expect(screen().getByText('No transactions yet')).toBeTruthy();
    mockHistory.isSuccess = false;
    mockHistory.isError = true;
    const failed = screen();
    expect(failed.queryByText('No transactions yet')).toBeNull();
    expect(failed.getByTestId('history-retry')).toBeTruthy();
  });

  // T14 (post-M1d §7, m1)
  it('no selected account → the list area is empty: no skeleton, no "No transactions yet", no retry', () => {
    mockHistSelected.current = null;
    mockHistory.isError = true;
    const {queryByText, queryByTestId} = screen();
    expect(queryByTestId('history-skeleton')).toBeNull();
    expect(queryByText('No transactions yet')).toBeNull();
    expect(queryByTestId('history-retry')).toBeNull();
    expect(mockUseActivityHistory).toHaveBeenLastCalledWith(null);
  });

  // T15 (r1-1)
  it('an error shows the retry line, never the empty state or the skeleton; tapping refetches once', async () => {
    mockHistory.isError = true;
    let resolve: () => void = () => undefined;
    mockHistory.refetch = jest.fn(() => new Promise<void>(r => { resolve = r; }));
    const {getByTestId, getByText, queryByText, queryByTestId, UNSAFE_getAllByProps} = screen();
    expect(getByText("Couldn't load transactions · tap to retry")).toBeTruthy();
    expect(queryByText('No transactions yet')).toBeNull();
    expect(queryByTestId('history-skeleton')).toBeNull();
    // two taps in one tick (before a re-render can disable the button) still read once: the ref guard
    const onPress = UNSAFE_getAllByProps({testID: 'history-retry'})[0]!.props.onPress as () => void;
    act(() => { onPress(); onPress(); });
    fireEvent.press(getByTestId('history-retry')); // disabled while busy
    expect(mockHistory.refetch).toHaveBeenCalledTimes(1);
    expect(getByText('Loading transactions…')).toBeTruthy();
    expect(getByTestId('history-retry').props.accessibilityState).toEqual(expect.objectContaining({busy: true}));
    await act(async () => { resolve(); });
    expect(getByText("Couldn't load transactions · tap to retry")).toBeTruthy();
  });

  // T16 (r1-1)
  it('a failed refresh keeps the rows already read and shows the retry line above them', () => {
    show([row('sent', {signature: 'a', primary: delta('M', 'TEST', -1n)}), row('received', {signature: 'b', primary: delta('M', 'TEST', 1n)})]);
    mockHistory.isSuccess = false;
    mockHistory.isError = true;
    const {getByTestId, getByText, queryByText} = screen();
    expect(getByText("Couldn't load transactions · tap to retry")).toBeTruthy();
    expect(getByTestId('tx-row-a')).toBeTruthy();
    expect(getByTestId('tx-row-b')).toBeTruthy();
    expect(queryByText('No transactions yet')).toBeNull();
  });

  // T17 (m5)
  it('switching account resets a retry that was in flight; a stale retry finishing frees nothing', async () => {
    mockHistory.isError = true;
    const resolvers: Array<() => void> = [];
    mockHistory.refetch = jest.fn(() => new Promise<void>(r => { resolvers.push(r); }));
    const view = screen();
    fireEvent.press(view.getByTestId('history-retry')); // account 1
    expect(view.getByText('Loading transactions…')).toBeTruthy();
    mockHistSelected.current = {address: ACC_2, label: 'Account 2'};
    view.rerender(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} now={NOW} timeZone={LJ} />);
    expect(view.getByText("Couldn't load transactions · tap to retry")).toBeTruthy();
    fireEvent.press(view.getByTestId('history-retry')); // account 2
    expect(mockHistory.refetch).toHaveBeenCalledTimes(2);
    await act(async () => { resolvers[0]!(); }); // account 1's read finishes late
    expect(view.getByText('Loading transactions…')).toBeTruthy(); // account 2's is still running
  });

  // T18 (§3.2 bound)
  it('the footer names the bound only when the wallet owns more token accounts than are read', () => {
    show([row('sent', {primary: delta('M', 'TEST', -1n)})], true, {read: 24, total: 31});
    expect(screen().getByTestId('history-coverage')).toHaveTextContent('History from 24 of 31 token accounts');
    show([row('sent', {primary: delta('M', 'TEST', -1n)})], true, {read: 3, total: 3});
    expect(screen().queryByTestId('history-coverage')).toBeNull();
  });

  // T18b (plan review r1 I4; spec §1.2)
  it('"No transactions yet" is never said alone about a history that was only partly read', () => {
    show([], true, {read: 24, total: 31});
    const partly = screen();
    expect(partly.getByText('No transactions yet')).toBeTruthy();
    expect(partly.getByTestId('history-coverage')).toHaveTextContent('History from 24 of 31 token accounts');
    partly.unmount();
    show([], true, {read: 3, total: 3}); // control: everything was read
    const whole = screen();
    expect(whole.getByText('No transactions yet')).toBeTruthy();
    expect(whole.queryByTestId('history-coverage')).toBeNull();
  });

  // T18c (plan review r1 I4)
  it('an empty chip also names the bound — at the end of history and before it', () => {
    show([row('sent', {primary: delta('M', 'TEST', -1n)})], true, {read: 24, total: 31});
    const atEnd = screen();
    fireEvent.press(atEnd.getByTestId('history-chip-received'));
    expect(atEnd.getByText('No received transactions yet')).toBeTruthy();
    expect(atEnd.getAllByTestId('history-coverage')).toHaveLength(1);
    expect(atEnd.getByTestId('history-coverage')).toHaveTextContent('History from 24 of 31 token accounts');
    atEnd.unmount();
    show([row('sent', {primary: delta('M', 'TEST', -1n)})], false, {read: 24, total: 31});
    const before = screen();
    fireEvent.press(before.getByTestId('history-chip-received'));
    expect(before.getByText('No received transactions in the last transaction')).toBeTruthy();
    expect(before.getByTestId('history-coverage')).toBeTruthy();
    before.unmount();
    show([row('sent', {primary: delta('M', 'TEST', -1n)})], true, {read: 3, total: 3}); // control
    const whole = screen();
    fireEvent.press(whole.getByTestId('history-chip-received'));
    expect(whole.queryByTestId('history-coverage')).toBeNull();
  });

  // T19
  it('pull-to-refresh runs the refetch (the §3.4 refresh), one at a time', async () => {
    show([row('sent', {primary: delta('M', 'TEST', -1n)})]);
    let resolve: () => void = () => undefined;
    mockHistory.refetch = jest.fn(() => new Promise<void>(r => { resolve = r; }));
    const {getByTestId} = screen();
    const control = getByTestId('history-list').props.refreshControl as {props: {onRefresh: () => void; refreshing: boolean}};
    expect(control.props.refreshing).toBe(false);
    act(() => { control.props.onRefresh(); control.props.onRefresh(); });
    expect(mockHistory.refetch).toHaveBeenCalledTimes(1);
    expect((getByTestId('history-list').props.refreshControl as {props: {refreshing: boolean}}).props.refreshing).toBe(true);
    await act(async () => { resolve(); });
    expect((getByTestId('history-list').props.refreshControl as {props: {refreshing: boolean}}).props.refreshing).toBe(false);
  });

  // T21 (Review Focus 4)
  it('a list left open past midnight: the sections follow the clock handed in, not the first render', () => {
    show([row('unknown', {signature: 'a'}, at('2026-11-26T08:00:00Z'))]);
    const view = screen();
    expect(view.getByTestId('history-section-today')).toBeTruthy();
    expect(view.getByTestId('tx-row-a-secondary')).toHaveTextContent('09:00');
    view.rerender(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} now={NOW + 2 * 86_400_000} timeZone={LJ} />);
    expect(view.queryByTestId('history-section-today')).toBeNull();
    expect(view.getByTestId('history-section-week')).toBeTruthy(); // Saturday: Thursday is "This week"
    expect(view.getByTestId('tx-row-a-secondary')).toHaveTextContent('26 Nov');
  });

  // T21b (plan review r1 m8): the product path — no `now` prop; the clock is the device's, read again on foreground
  it('coming back to the foreground re-reads the clock: yesterday\'s "Today" moves on without a reload', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(NOW);
    // react-native's jest setup makes AppState.addEventListener a jest.fn: its calls hold the screen's listener
    const listen = AppState.addEventListener as unknown as jest.Mock<unknown, [string, (state: string) => void]>;
    try {
      show([row('unknown', {signature: 'a'}, at('2026-11-26T08:00:00Z'))]);
      const view = render(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} timeZone={LJ} />);
      expect(view.getByTestId('history-section-today')).toBeTruthy();
      clock.mockReturnValue(NOW + 86_400_000);
      const onChange = listen.mock.calls.filter(c => c[0] === 'change').map(c => c[1]);
      expect(onChange.length).toBeGreaterThan(0);
      act(() => onChange.forEach(f => f('background')));
      expect(view.getByTestId('history-section-today')).toBeTruthy(); // going away re-reads nothing
      act(() => onChange.forEach(f => f('active')));
      expect(view.queryByTestId('history-section-today')).toBeNull();
      expect(view.getByTestId('history-section-yesterday')).toBeTruthy();
    } finally {
      clock.mockRestore();
    }
  });

  // m1: the clock is read again when the data changes, not only on the foreground
  it('new data re-reads the clock', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(NOW);
    try {
      show([row('unknown', {signature: 'a'}, at('2026-11-26T08:00:00Z'))]);
      const view = render(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} timeZone={LJ} />);
      expect(view.getByTestId('history-section-today')).toBeTruthy();
      clock.mockReturnValue(NOW + 86_400_000);
      show([row('unknown', {signature: 'a'}, at('2026-11-26T08:00:00Z'))]); // a new data object
      view.rerender(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} timeZone={LJ} />);
      expect(view.queryByTestId('history-section-today')).toBeNull();
      expect(view.getByTestId('history-section-yesterday')).toBeTruthy();
    } finally {
      clock.mockRestore();
    }
  });

  // T22
  it('while an older page loads: a spinner under All; under a filter the control is busy and reads "Loading transactions…"', () => {
    show([row('sent', {primary: delta('M', 'TEST', -1n)})], false);
    mockHistory.loadingOlder = true;
    const view = screen();
    expect(view.getByTestId('history-loading-older')).toBeTruthy();
    expect(view.queryByTestId('history-load-older')).toBeNull();
    fireEvent.press(view.getByTestId('history-chip-sent'));
    const control = view.getByTestId('history-load-older');
    expect(control).toHaveTextContent('Loading transactions…');
    expect(control.props.accessibilityState).toEqual({disabled: true, busy: true});
    fireEvent.press(control);
    expect(mockHistory.loadOlder).not.toHaveBeenCalled();
  });

  // T20
  it('Back calls onBack', () => {
    show([]);
    fireEvent.press(screen().getByText('← Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
