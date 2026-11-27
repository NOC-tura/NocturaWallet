/**
 * History spec §5.1–§5.3, §4.5 "Shown as", §4.6: the pure row view, the sections, the time, and #27's
 * hero / parties / balance-change helpers. `now` and
 * the IANA zone are always passed in; nothing here reads the clock or asserts `toLocaleString` output.
 */
import {
  activityWord,
  changeLine,
  chipMatches,
  counterpartyLabel,
  groupSections,
  heroAmount,
  partiesAgree,
  primaryUsdToday,
  rowTime,
  rowView,
  sectionOf,
  zonedDate,
} from '../activityView';
import {VALUE_HIDDEN} from '../../../copy/accounts';
import type {ActivityRow, Delta} from '../activity';
import type {TxTransfer} from '../txDetail';
import type {HistoryRow} from '../history';
import type {AccountList} from '../../accounts/accountList';

const LJ = 'Europe/Ljubljana';
/** seconds, as a block time */
const at = (iso: string): number => Date.parse(iso) / 1000;
const ms = (iso: string): number => Date.parse(iso);
// Thursday 26 Nov 2026, 12:00 in Ljubljana (CET, UTC+1)
const NOW = ms('2026-11-26T11:00:00Z');

const delta = (mint: string, symbol: string, raw: bigint, decimals = 9, role: Delta['role'] = 'moved'): Delta => ({mint, symbol, raw, decimals, role});
const activity = (over: Partial<ActivityRow>): ActivityRow => ({
  signature: 'SIG',
  slot: 1,
  blockTime: at('2026-11-26T08:14:00Z'),
  status: 'finalized',
  kind: 'unknown',
  primary: null,
  secondary: null,
  extraAssets: 0,
  deltas: [],
  counterparty: null,
  via: null,
  feePaidByAccount: null,
  incomplete: false,
  ...over,
});
const row = (over: Partial<ActivityRow> | null, blockTime: number | null = at('2026-11-26T08:14:00Z')): HistoryRow => ({
  item: {signature: 'SIG', slot: 1, blockTime, status: 'finalized', finalized: true},
  activity: over === null ? null : activity({...over, blockTime}),
});
const label = (a: string): string => `<${a}>`;
const view = (r: HistoryRow) => rowView(r, label, NOW, LJ);

describe('sectionOf (§5.3)', () => {
  // V1
  it('Today / Yesterday are calendar days in the zone passed in', () => {
    // 00:30 on the 26th in Ljubljana is 23:30 on the 25th in UTC
    const t = at('2026-11-25T23:30:00Z');
    expect(sectionOf(t, NOW, LJ)).toEqual({key: 'today', title: 'Today'});
    expect(sectionOf(t, NOW, 'UTC')).toEqual({key: 'yesterday', title: 'Yesterday'});
    expect(sectionOf(at('2026-11-25T10:00:00Z'), NOW, LJ).title).toBe('Yesterday');
  });

  // V2
  it('This week: an earlier day of the same Monday-start week; Sunday before it is This month', () => {
    expect(sectionOf(at('2026-11-24T10:00:00Z'), NOW, LJ).title).toBe('This week'); // Tuesday
    expect(sectionOf(at('2026-11-22T23:00:00Z'), NOW, LJ).title).toBe('This week'); // Monday 00:00 local
    expect(sectionOf(at('2026-11-22T22:59:00Z'), NOW, LJ).title).toBe('This month'); // Sunday 23:59 local
    expect(sectionOf(at('2026-11-01T12:00:00Z'), NOW, LJ).title).toBe('This month');
  });

  // V3
  it('on a Monday the week holds nothing earlier: Sunday is Yesterday, Saturday is This month', () => {
    const monday = ms('2026-11-23T11:00:00Z');
    expect(sectionOf(at('2026-11-22T12:00:00Z'), monday, LJ).title).toBe('Yesterday');
    expect(sectionOf(at('2026-11-21T12:00:00Z'), monday, LJ).title).toBe('This month');
  });

  // V4
  it('a week that crosses a month or a year stays This week; older is "{Month YYYY}"', () => {
    const wed2Dec = ms('2026-12-02T11:00:00Z');
    expect(sectionOf(at('2026-11-30T12:00:00Z'), wed2Dec, LJ).title).toBe('This week'); // Monday, in November
    expect(sectionOf(at('2026-11-29T12:00:00Z'), wed2Dec, LJ)).toEqual({key: '2026-11', title: 'November 2026'});
    const sat2Jan = ms('2027-01-02T11:00:00Z');
    expect(sectionOf(at('2026-12-31T12:00:00Z'), sat2Jan, LJ).title).toBe('This week');
    expect(sectionOf(at('2026-12-27T12:00:00Z'), sat2Jan, LJ)).toEqual({key: '2026-12', title: 'December 2026'});
    expect(sectionOf(at('2026-10-31T12:00:00Z'), NOW, LJ)).toEqual({key: '2026-10', title: 'October 2026'});
  });

  // V5 (r2 m7)
  it('an IANA zone, not a fixed offset: a summer date falls on its own day across the DST change', () => {
    // 22:30 UTC on 15 July is 00:30 on 16 July in Ljubljana (CEST, UTC+2); a fixed +1 would say 23:30 on the 15th
    const t = at('2026-07-15T22:30:00Z');
    expect(zonedDate(t * 1000, LJ)).toEqual({year: 2026, month: 7, day: 16, hour: 0, minute: 30});
    expect(rowTime(t, NOW, LJ)).toBe('16 Jul');
    expect(sectionOf(t, NOW, LJ).title).toBe('July 2026');
    // the night the clocks go back (25 Oct 2026): 00:30 local is still CEST
    const night = at('2026-10-24T22:30:00Z');
    expect(rowTime(night, ms('2026-10-25T11:00:00Z'), LJ)).toBe('00:30');
  });

  // V6
  it('no block time → Date unknown; a time ahead of the clock → Today', () => {
    expect(sectionOf(null, NOW, LJ)).toEqual({key: 'unknown', title: 'Date unknown'});
    expect(sectionOf(at('2026-11-27T12:00:00Z'), NOW, LJ).title).toBe('Today');
    expect(rowTime(null, NOW, LJ)).toBe('');
  });

  // V7
  it('a zone the engine does not know falls back to the device clock instead of throwing', () => {
    expect(() => sectionOf(at('2026-11-26T08:00:00Z'), NOW, 'Not/AZone')).not.toThrow();
  });
});

describe('rowTime (§5.1)', () => {
  // V8
  it('"HH:mm" for Today and Yesterday, else "d MMM"', () => {
    expect(rowTime(at('2026-11-26T08:14:00Z'), NOW, LJ)).toBe('09:14');
    expect(rowTime(at('2026-11-25T15:36:00Z'), NOW, LJ)).toBe('16:36');
    expect(rowTime(at('2026-11-24T15:36:00Z'), NOW, LJ)).toBe('24 Nov');
    expect(rowTime(at('2026-05-06T10:00:00Z'), NOW, LJ)).toBe('6 May');
  });
});

describe('groupSections', () => {
  // V9
  it('keeps the row order, one group per section, Date unknown last', () => {
    const rows = [row(null, null), row(null, at('2026-11-26T08:00:00Z')), row(null, at('2026-11-25T08:00:00Z')), row(null, at('2026-11-26T07:00:00Z'))];
    const groups = groupSections(rows, NOW, LJ);
    expect(groups.map(g => [g.title, g.data.length])).toEqual([
      ['Today', 2],
      ['Yesterday', 1],
      ['Date unknown', 1],
    ]);
  });
});

describe('rowView (§5.1)', () => {
  const TEST = delta('MINT', 'TEST', -100000n);
  const SOL_IN = delta('native', 'SOL', 5_000_000n);

  // V10
  it('sent: arrow, "Sent {sym}", "to {cp} · {time}", −amount without a symbol', () => {
    expect(view(row({kind: 'sent', primary: TEST, counterparty: 'CP'}))).toEqual({
      icon: 'sent', title: 'Sent TEST', badge: false, secondary: 'to <CP> · 09:14', amount: '−0.0001', amountTone: 'default', note: null, sub: null,
    });
    // no counter-party known: the time alone, never a guessed address
    expect(view(row({kind: 'sent', primary: TEST})).secondary).toBe('09:14');
  });

  // V11
  it('received: "+amount" in the success tone, "from {cp} · {time}"', () => {
    expect(view(row({kind: 'received', primary: SOL_IN, counterparty: 'CP'}))).toMatchObject({
      icon: 'received', title: 'Received SOL', secondary: 'from <CP> · 09:14', amount: '+0.005', amountTone: 'success',
    });
  });

  // V12
  it('swap: "Swapped {out} → {in}", −out, the incoming leg under it with its symbol, via Jupiter', () => {
    const out = delta('native', 'SOL', -1_200_000_000n);
    const into = delta('NOC', 'NOC', 9_524_100_000_000n);
    expect(view(row({kind: 'swap', primary: out, secondary: into, via: 'Jupiter'}))).toMatchObject({
      icon: 'swap', title: 'Swapped SOL → NOC', secondary: 'via Jupiter · 09:14', amount: '−1.2', sub: '+9,524.1 NOC', amountTone: 'default',
    });
    expect(view(row({kind: 'swap', primary: out, secondary: into})).secondary).toBe('09:14');
  });

  // V13
  it('the two pool rows carry the badge; the amount is "—" when the row has no pool-token change', () => {
    expect(view(row({kind: 'made-private', primary: TEST}))).toMatchObject({icon: 'private', badge: true, title: 'Made private TEST', secondary: '09:14', amount: '−0.0001'});
    expect(view(row({kind: 'made-public', primary: delta('MINT', 'TEST', 10000n)}))).toMatchObject({badge: true, title: 'Made public TEST', amount: '+<0.0001', amountTone: 'success'});
    expect(view(row({kind: 'made-private', primary: null}))).toMatchObject({title: 'Made private', amount: '—'});
  });

  // V14
  it('wrap / unwrap: their own titles, the SOL amount', () => {
    expect(view(row({kind: 'wrap', primary: delta('native', 'SOL', -59_167_663_567n)}))).toMatchObject({icon: 'swap', title: 'Wrapped SOL', amount: '−59.1677'});
    expect(view(row({kind: 'unwrap', primary: delta('native', 'SOL', 13_229_146n)}))).toMatchObject({title: 'Unwrapped SOL', amount: '+0.0132', amountTone: 'success'});
  });

  // V15
  it('account setup: "Transaction", "Account setup · {time}", the true amount with SOL', () => {
    expect(view(row({kind: 'account-setup', primary: delta('native', 'SOL', -1_488_440n, 9, 'rent')}))).toMatchObject({
      icon: 'setup', title: 'Transaction', secondary: 'Account setup · 09:14', amount: '−0.0015 SOL',
    });
    expect(view(row({kind: 'account-setup', primary: delta('native', 'SOL', 1_574_800n, 9, 'rent')})).amount).toBe('+0.0016 SOL');
  });

  // V16
  it('failed: "—", and the fee line only when this account paid it', () => {
    expect(view(row({kind: 'failed', status: 'failed', feePaidByAccount: 5000n}))).toMatchObject({icon: 'failed', title: 'Failed', amount: '—', sub: 'fee 0.000005 SOL'});
    expect(view(row({kind: 'failed', status: 'failed', feePaidByAccount: null})).sub).toBeNull();
  });

  // V17
  it('no funds moved, unknown and partial rows: a dot, "Transaction", never a direction', () => {
    expect(view(row({kind: 'no-funds-moved'}))).toMatchObject({icon: 'dot', title: 'Transaction', amount: 'No funds moved', amountTone: 'tertiary'});
    expect(view(row({kind: 'unknown'}))).toMatchObject({icon: 'dot', title: 'Transaction', amount: '—'});
    expect(view(row(null))).toEqual({icon: 'dot', title: 'Transaction', badge: false, secondary: '09:14', amount: '—', amountTone: 'default', note: null, sub: null});
  });

  // V18
  it('"+N more" after the amount; " · incomplete" as a note on sent / received / swap only', () => {
    expect(view(row({kind: 'sent', primary: TEST, extraAssets: 2})).amount).toBe('−0.0001 +2 more');
    expect(view(row({kind: 'sent', primary: TEST, incomplete: true})).note).toBe(' · incomplete');
    expect(view(row({kind: 'received', primary: SOL_IN, incomplete: true})).note).toBe(' · incomplete');
    expect(view(row({kind: 'unknown', incomplete: true})).note).toBeNull();
    expect(view(row({kind: 'made-private', primary: TEST, incomplete: true})).note).toBeNull();
  });

  // V19 (Review Focus 3)
  it('an amount below the shown precision reads "<0.0001" with its sign, never 0 and never scientific notation', () => {
    expect(view(row({kind: 'received', primary: delta('native', 'SOL', 1n)})).amount).toBe('+<0.0001');
    expect(view(row({kind: 'sent', primary: delta('native', 'SOL', -1n)})).amount).toBe('−<0.0001');
  });

  // V20
  it('a row with no block time has no time: the counter-party alone, or nothing', () => {
    expect(rowView(row({kind: 'sent', primary: TEST, counterparty: 'CP'}, null), label, NOW, LJ).secondary).toBe('to <CP>');
    expect(rowView(row(null, null), label, NOW, LJ).secondary).toBe('');
  });

  // V20b (owner, Q2): the dashboard's hide-balances setting
  it('hidden: every figure reads "•••" — the amount with its "+N more", and the line under it; words stay', () => {
    const hide = (r: HistoryRow) => rowView(r, label, NOW, LJ, true);
    const sent = row({kind: 'sent', primary: TEST, counterparty: 'CP', extraAssets: 2, incomplete: true});
    expect(hide(sent)).toEqual({...view(sent), amount: VALUE_HIDDEN, amountTone: 'default'});
    expect(hide(sent)).toMatchObject({title: 'Sent TEST', secondary: 'to <CP> · 09:14', note: ' · incomplete'});
    // a received amount loses its green too
    expect(hide(row({kind: 'received', primary: SOL_IN}))).toMatchObject({title: 'Received SOL', amount: VALUE_HIDDEN, amountTone: 'default'});
    // the incoming leg of a swap, and the fee of a failed transaction, are figures
    expect(hide(row({kind: 'swap', primary: delta('native', 'SOL', -1n), secondary: delta('N', 'NOC', 5n)}))).toMatchObject({amount: VALUE_HIDDEN, sub: VALUE_HIDDEN});
    expect(hide(row({kind: 'failed', feePaidByAccount: 5000n}))).toMatchObject({title: 'Failed', amount: '—', sub: VALUE_HIDDEN});
    expect(hide(row({kind: 'account-setup', primary: delta('native', 'SOL', -1_488_440n, 9, 'rent')})).amount).toBe(VALUE_HIDDEN);
    // what is not an amount stays as it is
    expect(hide(row({kind: 'no-funds-moved'}))).toEqual(view(row({kind: 'no-funds-moved'})));
    expect(hide(row({kind: 'unknown'})).amount).toBe('—');
    expect(hide(row(null)).amount).toBe('—');
    expect(hide(row({kind: 'failed'})).sub).toBeNull();
  });
});

describe('chipMatches (§5.2)', () => {
  // V21
  it('each chip shows its kinds; the pool moves are never Sent or Received; a partial row is under All only', () => {
    const kinds = ['sent', 'received', 'swap', 'made-private', 'made-public', 'wrap', 'failed', 'unknown'] as const;
    const under = (chip: Parameters<typeof chipMatches>[0]) => kinds.filter(kind => chipMatches(chip, row({kind})));
    expect(under('all')).toEqual([...kinds]);
    expect(under('sent')).toEqual(['sent']);
    expect(under('received')).toEqual(['received']);
    expect(under('swaps')).toEqual(['swap']);
    expect(under('private')).toEqual(['made-private', 'made-public']);
    expect(chipMatches('all', row(null))).toBe(true);
    expect(chipMatches('sent', row(null))).toBe(false);
  });
});

describe('counterpartyLabel (§4.5)', () => {
  const MAIN = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
  const EXIT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
  const OTHER = 'EfHSPxjapWuecfjRp6eRL2PR3YjpKbk86jm5kqmwXGgk';
  const list: AccountList = {
    accounts: [
      {scheme: 'slip10:0', address: MAIN, label: 'Account 1', number: 1, role: 'main', isMain: true, linked: false},
      {scheme: 'slip10:1', address: EXIT, label: 'Account 2', number: 2, role: 'fresh-exit', isMain: false, linked: false},
    ],
    seed: [],
    walletKind: 'slip10',
    unreadable: false,
  };

  // V22
  it('own wallets by label, any other wallet as first 6 … last 6 (never 4…4)', () => {
    expect(counterpartyLabel(list, EXIT)).toBe('Account 2');
    expect(counterpartyLabel(list, MAIN)).toBe('Account 1 (main)');
    expect(counterpartyLabel(list, OTHER)).toBe('EfHSPx…mwXGgk');
  });

  // V23
  it('an unreadable registry (or none) names nobody: the short form for every address', () => {
    expect(counterpartyLabel({...list, unreadable: true}, EXIT)).toBe('9Y7Ftt…epTki4');
    expect(counterpartyLabel(null, MAIN)).toBe('Da83cA…Zxe31B');
  });
});

// ── #27 (§4.6) ───────────────────────────────────────────────────────────────────────────────────────

describe('the detail (#27, §4.6)', () => {
  const ME = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
  const THEM = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
  const TEST = delta('MINT', 'TEST', -200000n);
  const transfer = (over: Partial<TxTransfer> = {}): TxTransfer => ({
    mint: 'MINT', symbol: 'TEST', amount: '0.0002', from: ME, authority: ME, fromTokenAccount: 'SRC_TA',
    to: THEM, toIsTokenAccount: false, toTokenAccount: 'DST_TA', ...over,
  });

  // V24
  it('activityWord: one word per kind; everything without a direction — and no account — is "Transaction"', () => {
    const word = (kind: ActivityRow['kind']) => activityWord(activity({kind}));
    expect(word('sent')).toBe('Sent');
    expect(word('received')).toBe('Received');
    expect(word('swap')).toBe('Swapped');
    expect(word('made-private')).toBe('Made private');
    expect(word('made-public')).toBe('Made public');
    expect(word('wrap')).toBe('Wrapped SOL');
    expect(word('unwrap')).toBe('Unwrapped SOL');
    expect(word('failed')).toBe('Failed');
    expect(word('account-setup')).toBe('Transaction');
    expect(word('no-funds-moved')).toBe('Transaction');
    expect(word('unknown')).toBe('Transaction');
    expect(activityWord(null)).toBe('Transaction');
  });

  // V25
  it('heroAmount: the exact figure without a sign, with its symbol; a swap as "{out} → {in}"; null with no primary', () => {
    expect(heroAmount(activity({kind: 'sent', primary: TEST}))).toBe('0.0002 TEST');
    expect(heroAmount(activity({kind: 'received', primary: delta('native', 'SOL', 1n)}))).toBe('0.000000001 SOL'); // exact, not "<0.0001"
    expect(
      heroAmount(activity({kind: 'swap', primary: delta('native', 'SOL', -1_200_000_000n), secondary: delta('N', 'NOC', 9_524_100_000_000n)})),
    ).toBe('1.2 SOL → 9524.1 NOC');
    expect(heroAmount(activity({kind: 'failed'}))).toBeNull();
    expect(heroAmount(null)).toBeNull();
  });

  // V26 (r2 N7)
  it('partiesAgree: only when the transfer IS the row — asset, side, counter-party, a recipient wallet', () => {
    const sent = activity({kind: 'sent', primary: TEST, counterparty: THEM});
    expect(partiesAgree(transfer(), sent, ME)).toBe(true);
    const received = activity({kind: 'received', primary: delta('MINT', 'TEST', 200000n), counterparty: THEM});
    expect(partiesAgree(transfer({from: THEM, to: ME}), received, ME)).toBe(true);
    // each condition alone breaks it
    expect(partiesAgree(transfer({mint: 'OTHER'}), sent, ME)).toBe(false); // another asset
    expect(partiesAgree(transfer({from: THEM}), sent, ME)).toBe(false); // the account is not the transfer's From
    expect(partiesAgree(transfer({to: 'SOMEONE'}), sent, ME)).toBe(false); // not the row's counter-party
    expect(partiesAgree(transfer(), {...sent, counterparty: null}, ME)).toBe(false); // two recipients: nobody named
    expect(partiesAgree(transfer({toIsTokenAccount: true}), sent, ME)).toBe(false); // a token account is not a wallet
    expect(partiesAgree(transfer({from: null, to: ME}), {...received, counterparty: THEM}, ME)).toBe(false); // a null From
    expect(partiesAgree(transfer(), {...sent, primary: null}, ME)).toBe(false);
    expect(partiesAgree(null, sent, ME)).toBe(false);
    expect(partiesAgree(transfer(), null, ME)).toBe(false);
    expect(partiesAgree(transfer(), sent, null)).toBe(false);
    // a swap, a pool move, a wrap never show From / To
    for (const kind of ['swap', 'made-private', 'made-public', 'wrap', 'unwrap', 'failed', 'unknown'] as const) {
      expect(partiesAgree(transfer(), {...sent, kind}, ME)).toBe(false);
    }
  });

  // V27
  it('changeLine: the sign, the exact figure, the symbol, and the role in words', () => {
    expect(changeLine(delta('MINT', 'TEST', -100000n))).toBe('−0.0001 TEST');
    expect(changeLine(delta('native', 'SOL', -2_040_000n, 9, 'rent'))).toBe('−0.00204 SOL · account rent');
    expect(changeLine(delta('native', 'SOL', 1_488_440n, 9, 'rent'))).toBe('+0.00148844 SOL · account rent');
    expect(changeLine(delta('native', 'SOL', 2_000_000n, 9, 'grant'))).toBe('+0.002 SOL · gas grant');
    expect(changeLine(delta('native', 'SOL', -20_000n, 9, 'markup'))).toBe('−0.00002 SOL · Noctura fee');
    // hidden (owner, Q2): the figure goes, the role stays
    expect(changeLine(delta('MINT', 'TEST', -100000n), true)).toBe(VALUE_HIDDEN);
    expect(changeLine(delta('native', 'SOL', -2_040_000n, 9, 'rent'), true)).toBe(`${VALUE_HIDDEN} · account rent`);
  });

  // V28 (H7)
  it("primaryUsdToday: the hero asset's value at the price handed in; null with no price, no primary, or a price that is not one", () => {
    const sent = activity({kind: 'sent', primary: delta('native', 'SOL', -1_000_000n)});
    expect(primaryUsdToday(sent, () => 150)).toBeCloseTo(0.15, 10);
    expect(primaryUsdToday(sent, () => null)).toBeNull();
    expect(primaryUsdToday(sent, () => 0)).toBeNull();
    expect(primaryUsdToday(sent, () => Number.NaN)).toBeNull();
    expect(primaryUsdToday(activity({kind: 'failed'}), () => 150)).toBeNull();
    expect(primaryUsdToday(null, () => 150)).toBeNull();
    const asked: string[] = [];
    primaryUsdToday(activity({kind: 'received', primary: delta('MINT', 'TEST', 5n)}), mint => {
      asked.push(mint);
      return null;
    });
    expect(asked).toEqual(['MINT']);
  });
});
