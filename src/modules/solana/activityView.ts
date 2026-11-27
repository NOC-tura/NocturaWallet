/**
 * History spec (2026-11-26) §5: what a history row SAYS — pure, so every form is tested without a
 * screen. The words are `src/copy/transactions.ts`; this file only puts them together.
 *
 * TIME (§5.3): calendar days are in the device's zone, passed in as an IANA name (never a fixed
 * offset: old dates across a DST change must fall on the right day). `now` is passed in too. No
 * `toLocaleString`: the parts come from `Intl.DateTimeFormat.formatToParts` and the month names
 * from the copy file, so the output does not depend on the engine's locale data.
 */
import {formatBalanceForDisplay, formatTokenAmount, groupInteger} from '../../utils/parseTokenAmount';
import {shortAccountAddress} from '../accounts/accountList';
import type {AccountList} from '../accounts/accountList';
import type {ActivityRow, Delta} from './activity';
import type {TxTransfer} from './txDetail';
import type {HistoryRow} from './history';
import {
  MONTH_NAMES,
  MONTH_SHORT,
  SECTION_DATE_UNKNOWN,
  SECTION_THIS_MONTH,
  SECTION_THIS_WEEK,
  SECTION_TODAY,
  SECTION_YESTERDAY,
  sectionWithDate,
  TX_ACCOUNT_SETUP,
  TX_AMOUNT_UNKNOWN,
  TX_FAILED,
  TX_INCOMPLETE,
  TX_MADE_PRIVATE,
  TX_MADE_PUBLIC,
  TX_NEUTRAL,
  TX_NO_FUNDS_MOVED,
  TX_RECEIVED,
  TX_ROLE_GRANT,
  TX_ROLE_MARKUP,
  TX_ROLE_RENT,
  TX_SENT,
  TX_SWAPPED,
  TX_UNWRAPPED_SOL,
  TX_VIA_JUPITER,
  TX_WRAPPED_SOL,
  txFeeLine,
  txFrom,
  txMadePrivateTitle,
  txMadePublicTitle,
  txMoreAssets,
  txReceivedTitle,
  txSentTitle,
  txSwapTitle,
  txTo,
} from '../../copy/transactions';
import type {HistoryChipId} from '../../copy/transactions';
import {VALUE_HIDDEN, mainLabelled} from '../../copy/accounts';

export type RowIcon = 'sent' | 'received' | 'swap' | 'private' | 'setup' | 'failed' | 'dot';

export interface RowView {
  icon: RowIcon;
  title: string;
  /** the pool badge beside the title (the two pool rows): an icon, no word */
  badge: boolean;
  /** "to {cp} · {time}" — may be '' when neither is known */
  secondary: string;
  /** the figure with its sign, "—", or "No funds moved" */
  amount: string;
  amountTone: 'default' | 'success' | 'tertiary';
  /** tertiary text after the amount (" · incomplete"); null when there is none */
  note: string | null;
  /** the line under the amount: a swap's incoming leg, a failed row's fee; null when there is none */
  sub: string | null;
}

const MINUS = '−'; // U+2212, as the design draws it
const DAY_MS = 86_400_000;

interface ZonedDate {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar date and wall-clock time of `ms` in the IANA zone `tz`; the device's own zone if `tz` is not usable. */
export function zonedDate(ms: number, tz: string): ZonedDate {
  try {
    let f = formatters.get(tz);
    if (f === undefined) {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23',
      });
      formatters.set(tz, f);
    }
    const parts = f.formatToParts(new Date(ms));
    if (parts.some(p => p.type === 'dayPeriod')) {
      throw new Error('12-hour answer'); // the engine ignored hourCycle h23: its hour is not ours
    }
    const part = (type: string): number => Number(parts.find(p => p.type === type)?.value);
    const z = {year: part('year'), month: part('month'), day: part('day'), hour: part('hour') % 24, minute: part('minute')};
    if (Object.values(z).every(Number.isFinite)) {
      return z;
    }
  } catch {
    // an engine without this zone: fall through to the device's own clock
  }
  const d = new Date(ms);
  return {year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), minute: d.getMinutes()};
}

/** The device's IANA zone; 'UTC' when the engine does not say. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** A calendar date as a day count (days since 1970-01-01 of that calendar date) */
const dayNumber = (z: ZonedDate): number => Math.round(Date.UTC(z.year, z.month - 1, z.day) / DAY_MS);
/** Monday = 0 … Sunday = 6 (1970-01-01 was a Thursday) */
const weekday = (dayNo: number): number => (((dayNo + 3) % 7) + 7) % 7;

export interface Section {
  key: string;
  title: string;
}

/**
 * A block time that names a date: a finite number whose date a `Date` can hold (final review 9 — 1e20 is
 * finite, and would print "undefined NaN").
 */
function knownTime(blockTime: number | null): blockTime is number {
  return blockTime !== null && Number.isFinite(blockTime) && Number.isFinite(new Date(blockTime * 1000).getTime());
}

/**
 * §5.3. `blockTime` is in seconds (chain), `now` in milliseconds. A week starts on Monday. A time in
 * the future (a device clock behind the chain) is Today.
 */
export function sectionOf(blockTime: number | null, now: number, tz: string): Section {
  if (!knownTime(blockTime)) {
    return {key: 'unknown', title: SECTION_DATE_UNKNOWN};
  }
  const then = zonedDate(blockTime * 1000, tz);
  const today = zonedDate(now, tz);
  const thenDay = dayNumber(then);
  const todayDay = dayNumber(today);
  if (thenDay >= todayDay) {
    return {key: 'today', title: SECTION_TODAY};
  }
  if (thenDay === todayDay - 1) {
    return {key: 'yesterday', title: SECTION_YESTERDAY};
  }
  if (thenDay >= todayDay - weekday(todayDay)) {
    return {key: 'week', title: SECTION_THIS_WEEK};
  }
  if (then.year === today.year && then.month === today.month) {
    return {key: 'month', title: SECTION_THIS_MONTH};
  }
  return {key: `${then.year}-${String(then.month).padStart(2, '0')}`, title: `${MONTH_NAMES[then.month - 1]} ${then.year}`};
}

/** §5.1 {time}: "HH:mm" for Today and Yesterday, else "d MMM" ("6 May"); '' with no block time. */
export function rowTime(blockTime: number | null, now: number, tz: string): string {
  if (!knownTime(blockTime)) {
    return '';
  }
  const section = sectionOf(blockTime, now, tz).key;
  const z = zonedDate(blockTime * 1000, tz);
  if (section === 'today' || section === 'yesterday') {
    return `${String(z.hour).padStart(2, '0')}:${String(z.minute).padStart(2, '0')}`;
  }
  return `${z.day} ${MONTH_SHORT[z.month - 1]}`;
}

/** The list's block time, else the one read from the transaction itself */
function rowBlockTime(row: HistoryRow): number | null {
  return row.item.blockTime ?? row.activity?.blockTime ?? null;
}

/** Rows under their date sections, in the order given; "Date unknown" always last. */
export function groupSections(rows: readonly HistoryRow[], now: number, tz: string): Array<Section & {data: HistoryRow[]}> {
  const groups = new Map<string, Section & {data: HistoryRow[]}>();
  for (const row of rows) {
    const section = sectionOf(rowBlockTime(row), now, tz);
    const have = groups.get(section.key);
    if (have) {
      have.data.push(row);
    } else {
      groups.set(section.key, {...section, data: [row]});
    }
  }
  const all = [...groups.values()];
  return [...all.filter(g => g.key !== 'unknown'), ...all.filter(g => g.key === 'unknown')];
}

/**
 * The design's header (#26 26b: "TODAY · MAY 8"): Today and Yesterday carry their date, in the zone; the
 * other sections are their title alone. Today's date is the clock's (a row ahead of the clock is still Today);
 * Yesterday's is its first row's. Added by controller ruling (Task 7 review I3), after Task 5.
 */
export function sectionHeading(section: Section, first: HistoryRow | undefined, now: number, tz: string): string {
  if (section.key === 'today') {
    const z = zonedDate(now, tz);
    return sectionWithDate(section.title, MONTH_SHORT[z.month - 1], z.day);
  }
  const t = first === undefined ? null : rowBlockTime(first);
  if (section.key === 'yesterday' && knownTime(t)) {
    const z = zonedDate(t * 1000, tz);
    return sectionWithDate(section.title, MONTH_SHORT[z.month - 1], z.day);
  }
  return section.title;
}

/** §5.2 */
export function chipMatches(chip: HistoryChipId, row: HistoryRow): boolean {
  const kind = row.activity?.kind;
  switch (chip) {
    case 'all':
      return true;
    case 'sent':
      return kind === 'sent';
    case 'received':
      return kind === 'received';
    case 'swaps':
      return kind === 'swap';
    case 'private':
      return kind === 'made-private' || kind === 'made-public';
  }
}

/**
 * §4.5 "Shown as": a wallet of this seed by its label ("Account 2", "Account 1 (main)"); any other
 * wallet — and every wallet when the registry is unreadable — as first 6 … last 6.
 */
export function counterpartyLabel(list: AccountList | null, address: string): string {
  if (list !== null && !list.unreadable) {
    const own = list.accounts.find(a => a.address === address);
    if (own) {
      return mainLabelled(own.label, own.isMain);
    }
  }
  return shortAccountAddress(address);
}

/** An unsigned figure with the shared formatter ("<0.0001" applies); the sign is added outside it. */
export function unsignedAmount(d: Delta): string {
  const abs = d.raw < 0n ? -d.raw : d.raw;
  return formatBalanceForDisplay(abs.toString(), d.decimals);
}

function signedAmount(d: Delta): string {
  return `${d.raw < 0n ? MINUS : '+'}${unsignedAmount(d)}`;
}

const joined = (...parts: Array<string | null>): string => parts.filter(p => p !== null && p !== '').join(' · ');

/**
 * §5.1: one row. `labelOf` names a counter-party (`counterpartyLabel`). `hidden` is the dashboard's
 * hide-balances setting (owner, Q2): every FIGURE of the row reads "•••" (`VALUE_HIDDEN`, the mask
 * the Accounts sheet and the balance card's split already use) — the amount with its
 * "+N more", and the line under it. The title, the counter-party, the time and the icon stay, and so
 * do "—" and "No funds moved", which are not amounts.
 */
export function rowView(row: HistoryRow, labelOf: (address: string) => string, now: number, tz: string, hidden = false): RowView {
  const view = shownRow(row, labelOf, now, tz);
  if (!hidden) {
    return view;
  }
  const figure = row.activity !== null && row.activity.primary !== null;
  return {
    ...view,
    amount: figure ? VALUE_HIDDEN : view.amount,
    amountTone: figure ? 'default' : view.amountTone,
    sub: view.sub === null ? null : VALUE_HIDDEN,
  };
}

function shownRow(row: HistoryRow, labelOf: (address: string) => string, now: number, tz: string): RowView {
  const time = rowTime(rowBlockTime(row), now, tz);
  const a = row.activity;
  const plain: RowView = {icon: 'dot', title: TX_NEUTRAL, badge: false, secondary: time, amount: TX_AMOUNT_UNKNOWN, amountTone: 'default', note: null, sub: null};
  if (a === null) {
    // partial (§3.4): never a Sent. The signature list's own `err` is known without the transaction (final review 16)
    return row.item.status === 'failed' ? {...plain, icon: 'failed', title: TX_FAILED} : plain;
  }
  const p = a.primary;
  const more = a.extraAssets > 0 ? txMoreAssets(a.extraAssets) : '';
  const figure = p === null ? TX_AMOUNT_UNKNOWN : `${signedAmount(p)}${more}`;
  const tone: RowView['amountTone'] = p !== null && p.raw > 0n ? 'success' : 'default';
  const note = a.incomplete && p !== null ? ` · ${TX_INCOMPLETE}` : null;
  const cp = a.counterparty === null ? null : labelOf(a.counterparty);
  switch (a.kind) {
    case 'sent':
      return {...plain, icon: 'sent', title: txSentTitle(p?.symbol ?? ''), secondary: joined(cp === null ? null : txTo(cp), time), amount: figure, amountTone: tone, note};
    case 'received':
      return {...plain, icon: 'received', title: txReceivedTitle(p?.symbol ?? ''), secondary: joined(cp === null ? null : txFrom(cp), time), amount: figure, amountTone: tone, note};
    case 'swap': {
      const s = a.secondary;
      return {
        ...plain,
        icon: 'swap',
        title: txSwapTitle(p?.symbol ?? '', s?.symbol ?? ''),
        secondary: joined(a.via === 'Jupiter' ? TX_VIA_JUPITER : null, time),
        amount: figure,
        note,
        sub: s === null ? null : `${signedAmount(s)} ${s.symbol}`,
      };
    }
    // final review 4: every incomplete row that shows a figure carries the mark, as its #27 does
    case 'made-private':
      return {...plain, icon: 'private', badge: true, title: txMadePrivateTitle(p?.symbol ?? null), amount: figure, amountTone: tone, note};
    case 'made-public':
      return {...plain, icon: 'private', badge: true, title: txMadePublicTitle(p?.symbol ?? null), amount: figure, amountTone: tone, note};
    case 'wrap':
      return {...plain, icon: 'swap', title: TX_WRAPPED_SOL, amount: figure, amountTone: tone, note};
    case 'unwrap':
      return {...plain, icon: 'swap', title: TX_UNWRAPPED_SOL, amount: figure, amountTone: tone, note};
    case 'account-setup':
      return {...plain, icon: 'setup', secondary: joined(TX_ACCOUNT_SETUP, time), amount: p === null ? TX_AMOUNT_UNKNOWN : `${signedAmount(p)} ${p.symbol}`, amountTone: tone};
    case 'failed':
      return {
        ...plain,
        icon: 'failed',
        title: TX_FAILED,
        sub: a.feePaidByAccount === null || a.feePaidByAccount <= 0n ? null : txFeeLine(formatTokenAmount(a.feePaidByAccount, 9)),
      };
    case 'no-funds-moved':
      return {...plain, amount: TX_NO_FUNDS_MOVED, amountTone: 'tertiary'};
    case 'unknown':
      return plain;
  }
}

// ── #27 (§4.6) ───────────────────────────────────────────────────────────────────────────────────────

/** The eyebrow and the Type row: what the transaction was for the account it was opened from. */
export function activityWord(row: ActivityRow | null): string {
  switch (row?.kind) {
    case 'sent':
      return TX_SENT;
    case 'received':
      return TX_RECEIVED;
    case 'swap':
      return TX_SWAPPED;
    case 'made-private':
      return TX_MADE_PRIVATE;
    case 'made-public':
      return TX_MADE_PUBLIC;
    case 'wrap':
      return TX_WRAPPED_SOL;
    case 'unwrap':
      return TX_UNWRAPPED_SOL;
    case 'failed':
      return TX_FAILED;
    default:
      return TX_NEUTRAL; // account setup, no funds moved, unknown, and no account (a deep link)
  }
}

/** An unsigned, EXACT figure (the detail shows every digit; the rows use the shared 4-place formatter). */
export function exactAmount(d: Delta): string {
  const [whole, frac] = formatTokenAmount(d.raw < 0n ? -d.raw : d.raw, d.decimals).split('.');
  // thousands grouped as the rows are (Hermes-safe `groupInteger`); every decimal kept (Task 8 review)
  return frac ? `${groupInteger(whole ?? '0')}.${frac}` : groupInteger(whole ?? '0');
}

/** #27's Date row: "8 May 2026 · 09:14" (24-hour, day first, as #26) in the zone given; "—" with no block time. */
export function detailTime(blockTime: number | null, tz: string): string {
  if (!knownTime(blockTime)) {
    return TX_AMOUNT_UNKNOWN;
  }
  const z = zonedDate(blockTime * 1000, tz);
  return `${z.day} ${MONTH_SHORT[z.month - 1]} ${z.year} · ${String(z.hour).padStart(2, '0')}:${String(z.minute).padStart(2, '0')}`;
}

/** The hero: `primary` without a sign, with its symbol; a swap as "{out} {sym} → {in} {sym}"; null = no amount line. */
export function heroAmount(row: ActivityRow | null): string | null {
  const p = row?.primary ?? null;
  if (row === null || p === null) {
    return null;
  }
  const out = `${exactAmount(p)} ${p.symbol}`;
  return row.secondary === null ? out : `${out} → ${exactAmount(row.secondary)} ${row.secondary.symbol}`;
}

/**
 * §4.6: From / To / Authorized by are shown only when the transfer the parser read IS the row — the
 * same asset, this account on the right side of it, the row's counter-party on the other, and a
 * recipient WALLET. Anything else (a swap, a pool move, two recipients, a null sender) shows the fee
 * payer and the balance changes instead: two readings that disagree are never both shown.
 */
export function partiesAgree(transfer: TxTransfer | null, row: ActivityRow | null, account: string | null): boolean {
  if (transfer === null || row === null || account === null || row.primary === null || row.counterparty === null) {
    return false;
  }
  if (transfer.mint !== row.primary.mint || transfer.toIsTokenAccount) {
    return false;
  }
  if (row.kind === 'sent') {
    return transfer.from === account && transfer.to === row.counterparty;
  }
  if (row.kind === 'received') {
    return transfer.to === account && transfer.from === row.counterparty;
  }
  return false;
}

const ROLE_LABEL: Record<Delta['role'], string | null> = {moved: null, markup: TX_ROLE_MARKUP, grant: TX_ROLE_GRANT, rent: TX_ROLE_RENT};

/** One line of "Balance changes": "−0.0001 TEST", "−0.00204 SOL · account rent"; hidden: "•••", "••• · account rent". */
export function changeLine(d: Delta, hidden = false): string {
  return joined(hidden ? VALUE_HIDDEN : `${d.raw < 0n ? MINUS : '+'}${exactAmount(d)} ${d.symbol}`, ROLE_LABEL[d.role]);
}

/**
 * H7: today's value of `primary`, for the "≈ $x at today's price" line; null with no price. Display float.
 * Null for a swap (owner, Q4, 2026-11-27): its primary is only the leg sold, so a figure would read as the swap's value.
 */
export function primaryUsdToday(row: ActivityRow | null, usdOf: (mint: string) => number | null): number | null {
  const p = row?.primary ?? null;
  if (p === null || row?.kind === 'swap') {
    return null;
  }
  const usd = usdOf(p.mint);
  if (usd === null || !Number.isFinite(usd) || usd <= 0) {
    return null;
  }
  const abs = p.raw < 0n ? -p.raw : p.raw;
  return (Number(abs) / Math.pow(10, p.decimals)) * usd;
}
