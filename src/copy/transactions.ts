/**
 * post-M1d spec §5: the words of the transaction detail (#27). The direction is claimed only when it is
 * known for the account the detail was opened from; otherwise the neutral word.
 */
export const TX_SENT = 'Sent';
export const TX_RECEIVED = 'Received';
export const TX_NEUTRAL = 'Transaction';
/** Under an address that is a token account because the response named no owner wallet (R11) */
export const TX_TOKEN_ACCOUNT = 'token account';
/** The row shown instead of "From" when the transaction has no transfer (R12: the fee payer is not the sender) */
export const TX_FEE_PAYER = 'Fee payer';
/** An SPL transfer signed for by a key that is not the funds' owner (a delegate), or whose owner is not known */
export const TX_AUTHORIZED_BY = 'Authorized by';

/**
 * History spec (2026-11-26) §5, §4.6: the words of the history rows (#26) and of the new #27 parts.
 * One vocabulary (`modes.ts`): the pool moves are "Made private" / "Made public" and their chip reads
 * "Private" — the design's older word for them is banned from every user-visible string. Their badge
 * is an icon with no word (owner, Q1): both transactions are public on chain, and a word beside an
 * amount would read as a claim about that transaction.
 */
export const TX_SWAPPED = 'Swapped';
export const TX_MADE_PRIVATE = 'Made private';
export const TX_MADE_PUBLIC = 'Made public';
export const TX_WRAPPED_SOL = 'Wrapped SOL';
export const TX_UNWRAPPED_SOL = 'Unwrapped SOL';
export const TX_FAILED = 'Failed';
/** The secondary line of a row whose only change is an account's rent (an ATA made or closed) */
export const TX_ACCOUNT_SETUP = 'Account setup';
export const TX_NO_FUNDS_MOVED = 'No funds moved';
/** An amount the wallet could not read from chain: never a guess */
export const TX_AMOUNT_UNKNOWN = '—';
export const TX_VIA_JUPITER = 'via Jupiter';
/** After the amount of a row with a balance entry that could not be attributed */
export const TX_INCOMPLETE = 'incomplete';
/** What a screen reader says for the icon-only badge of the two pool rows: what the row is, no claim about it */
export const TX_POOL_BADGE_LABEL = 'Pool transaction';

export function txSentTitle(symbol: string): string {
  return `${TX_SENT} ${symbol}`;
}
export function txReceivedTitle(symbol: string): string {
  return `${TX_RECEIVED} ${symbol}`;
}
/** "Swapped SOL → NOC" */
export function txSwapTitle(out: string, into: string): string {
  return `${TX_SWAPPED} ${out} → ${into}`;
}
export function txMadePrivateTitle(symbol: string | null): string {
  return symbol === null ? TX_MADE_PRIVATE : `${TX_MADE_PRIVATE} ${symbol}`;
}
export function txMadePublicTitle(symbol: string | null): string {
  return symbol === null ? TX_MADE_PUBLIC : `${TX_MADE_PUBLIC} ${symbol}`;
}
export function txTo(counterparty: string): string {
  return `to ${counterparty}`;
}
export function txFrom(counterparty: string): string {
  return `from ${counterparty}`;
}
/** Under a failed row's "—", only when this account paid the fee */
export function txFeeLine(fee: string): string {
  return `fee ${fee} SOL`;
}
/** " +2 more" after an amount: other assets moved in the same transaction */
export function txMoreAssets(n: number): string {
  return ` +${n} more`;
}

export type HistoryChipId = 'all' | 'sent' | 'received' | 'swaps' | 'private';
export const HISTORY_CHIPS: ReadonlyArray<{id: HistoryChipId; label: string}> = [
  {id: 'all', label: 'All'},
  {id: 'sent', label: 'Sent'},
  {id: 'received', label: 'Received'},
  {id: 'swaps', label: 'Swaps'},
  {id: 'private', label: 'Private'},
];
/** What each chip's empty state calls its transactions (reads as English after "No") */
const HISTORY_CHIP_NOUN: Record<HistoryChipId, string> = {
  all: 'transactions',
  sent: 'sent transactions',
  received: 'received transactions',
  swaps: 'swaps',
  private: 'Made private or Made public transactions',
};
/** A chip with no match among the {loaded} transactions read so far, while older ones exist */
export function historyChipNoneLoaded(chip: HistoryChipId, loaded: number): string {
  if (chip === 'all') {
    return historyChipNone(chip);
  }
  const span = loaded === 1 ? 'the last transaction' : `the last ${loaded} transactions`;
  return `No ${HISTORY_CHIP_NOUN[chip]} in ${span}`;
}
/** A chip with no match at the end of history */
export function historyChipNone(chip: HistoryChipId): string {
  return `No ${HISTORY_CHIP_NOUN[chip]} yet`;
}
export const HISTORY_LOAD_OLDER = 'Load older';
/** The list footer of a wallet with more token accounts than the history reads (spec §3.2, §9) */
export function historyCoverage(read: number, total: number): string {
  return `History from ${read} of ${total} token accounts`;
}

/** #26's title and its way back (they lived as literals in the screen) */
export const HISTORY_TITLE = 'Transaction History';
export const HISTORY_BACK = '← Back';
/** The design's dated header ("Today · May 8"; the overline style sets the case): the day's name and its date */
export function sectionWithDate(title: string, monthShort: string, day: number): string {
  return `${title} · ${monthShort} ${day}`;
}

export const SECTION_TODAY = 'Today';
export const SECTION_YESTERDAY = 'Yesterday';
export const SECTION_THIS_WEEK = 'This week';
export const SECTION_THIS_MONTH = 'This month';
export const SECTION_DATE_UNKNOWN = 'Date unknown';
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** #27: the list shown in place of From / To when the transfer and the row do not agree (§4.6) */
export const TX_BALANCE_CHANGES = 'Balance changes';
export const TX_ROLE_MARKUP = 'Noctura fee';
export const TX_ROLE_GRANT = 'gas grant';
export const TX_ROLE_RENT = 'account rent';
/** #27 under the hero (H7): the price is today's, never the transaction day's. `usd` carries its "$" ("$0.15", "<$0.01"). */
export function txAtTodaysPrice(usd: string): string {
  return `≈ ${usd} at today's price`;
}
