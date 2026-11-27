/**
 * M1d (spec docs/superpowers/specs/2026-11-21-shielded-m1d-accounts-design.md §4; M1 spec §10,
 * §11 R11): every user-visible string of the accounts surfaces — the Accounts sheet and the
 * avatar, "From:" on #19/#20, the linking warning on #12, the main-only lines, #21's "Received by",
 * the dashboard's Public | Private split row and #17's "Who sees what". The screens import these.
 *
 * Honesty: nothing here may promise more than the wallet delivers (copyScan FORBIDDEN_NEW; the
 * privacy-claims guard reads this file). The linking warning says what the chain shows; the R11
 * paragraph names everyone who sees a request.
 */
import {MODE_PRIVATE, MODE_PUBLIC} from './modes';

/** The Accounts sheet (§4.1) */
export const ACCOUNTS_TITLE = 'Accounts';
export const TAG_MAIN = 'main';
export const TAG_EXIT = 'exit';
export const TAG_LINKED = 'linked';
/** slip10 wallets only (a cli wallet has one account, S9) */
export const ACCOUNTS_FOOTER = 'New accounts appear here when you make funds public to “A new account”.';
/** §3.1: the registry could not be read — the main account only, and this one line */
export const ACCOUNTS_UNREADABLE = "Other accounts can't be read right now.";
/** §3.4: a row whose balances were not read yet, or failed */
export const ROW_NOT_CHECKED = 'not checked yet';
export const ROW_UNAVAILABLE = 'Balance unavailable';
/** The dashboard's public token list while a non-main account's balances load or failed (Review Focus 4) */
export const PUBLIC_LOADING = 'Loading balances…';
export const PUBLIC_UNAVAILABLE = 'Balance unavailable · pull to refresh';
/** #12: the source's balances could not be read (owner 2A, 2026-11-22) — the tap re-reads */
export const SEND_BALANCE_RETRY = 'Balance unavailable · tap to retry';
/** #12: shown while that re-read runs */
export const SEND_BALANCE_CHECKING = 'Checking balance…';

/**
 * post-M1d §3.3: a balance that failed to refresh is shown as the last known figure, marked with its age.
 * The age (R16) is recomputed on render and every 60 s while the screen is focused.
 */
export function relativeAge(fromMs: number, nowMs: number): string {
  const mins = Math.floor(Math.max(0, nowMs - fromMs) / 60_000); // a clock that moved backwards is "just now"
  if (mins < 1) {
    return 'just now';
  }
  if (mins < 60) {
    return `${mins} min ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours} h ago`;
  }
  return `${Math.floor(hours / 24)} d ago`;
}
/** #11, under the hero */
export function staleLine(age: string): string {
  return `Not updated · ${age} · pull to refresh`;
}
/** A screen that has no pull-to-refresh (the token detail's holding) */
export function staleNote(age: string): string {
  return `Not updated · ${age}`;
}
/** The Accounts sheet: a row whose last figure could not be refreshed */
export const STALE_ROW_SUFFIX = 'not updated';
/** The Public split column's caption while its figures are the last known ones (visible in both modes, also hidden) */
export const SPLIT_STALE_CAPTION = STALE_ROW_SUFFIX;
export function staleRow(figure: string): string {
  return `${figure} · ${STALE_ROW_SUFFIX}`;
}
/** #12: a stale balance is not usable for sending — the tap re-reads */
export const SEND_BALANCE_STALE = 'Not updated · tap to retry';

/** The dashboard header button that opens #26 */
export const HISTORY_A11Y = 'Transaction history';
/** #26: the read is running, failed (the tap re-reads), or finished with nothing */
export const HISTORY_LOADING = 'Loading transactions…';
export const HISTORY_ERROR = "Couldn't load transactions · tap to retry";
export const HISTORY_EMPTY = 'No transactions yet';

/** The linking warning on #12 (§4.4, M1 spec §10 C2) and its second tap */
export const LINK_WARNING_TITLE = 'Sending between your own accounts links them on chain.';
export const LINK_WARNING_BODY = 'Anyone can see that these two accounts belong to the same person.';
export const LINK_TAP_AGAIN = 'Tap again to send anyway';

/** Swap, presale and referral stay on the main account (§4.3, D1) */
export const USES_MAIN_ACCOUNT = 'Uses your main account';
/** #21 Now public, Details (§4.3) */
export const RECEIVED_BY = 'Received by';

/** The split row (§4.5, 2026-11-22 addendum) and the sheet rows: an unknown side, and a hidden one */
export const VALUE_UNKNOWN = '—';
export const VALUE_HIDDEN = '•••';
/** what a screen reader says for a figure shown as VALUE_HIDDEN */
export const VALUE_HIDDEN_SPOKEN = 'Hidden';
/** A shown text read aloud: every run of mask bullets (any length) becomes VALUE_HIDDEN_SPOKEN; text without a mask is unchanged */
export function spokenFigure(text: string): string {
  return text.replace(/•+/g, VALUE_HIDDEN_SPOKEN);
}
/** A held, priced side worth under half a cent (never "$0.00" for a non-empty side) */
export const BELOW_ONE_CENT = '<$0.01';

/** #17 (M1 spec §11 R11; plan A15: "unshield" reworded, nothing widened) */
export const WHO_SEES_WHAT = 'Who sees what';
export const WHO_SEES_RELAYER =
  'When you make tokens public, the relayer that sends them sees the request: the destination, the amount, the time and the network address it came from. The proof does not tell it which deposit is spent, but amounts and timing can hint at it. Otherwise it sees what anyone sees on chain.';
export const WHO_SEES_RPC =
  'The RPC provider the app uses sees every request the app makes, including the balances of all your accounts.';
export const WHO_SEES_CHAIN = 'On chain, amounts and timing are public.';

/** The sheet's backdrop (close) accessibility label */
export const ACCOUNTS_CLOSE_A11Y = 'Close accounts';

/** A row's accessibility label: what a sighted user reads on it (review r1 m3) */
export function rowA11y(label: string, tags: readonly string[], short: string, balance: string): string {
  return `${label}, ${tags.join(', ')}, ${short}, ${balance}`;
}

/** The avatar's accessibility label (plan A19) */
export function avatarA11y(label: string): string {
  return `${label}, switch account`;
}

/** "Account 1 (main)" for the main account, the bare label for any other */
export function mainLabelled(label: string, isMain: boolean): string {
  return `${label}${isMain ? ' (main)' : ''}`;
}

/** "Account 4 · 3YqEpf…JXT94k" / "Account 1 (main) · HAgk14…3DKpqk" — #20's From row, #21's Received by */
export function accountWithAddress(label: string, short: string, isMain: boolean): string {
  return `${mainLabelled(label, isMain)} · ${short}`;
}

/** #19's caption (§4.2) */
export function fromLine(label: string, short: string, isMain: boolean): string {
  return `From: ${accountWithAddress(label, short, isMain)}`;
}

/** Swap and presale while another account is selected (§4.3; plan A13: the main's own label) */
export function fromMainLine(mainLabel: string): string {
  return `From: ${mainLabel} (main)`;
}

/**
 * The dashboard's split row inside the balance card (§4.5, 2026-11-22 addendum: the owner replaced
 * D3's line under the toggle). The column labels are the mode words; the two sides are never summed.
 */
export const SPLIT_PUBLIC = MODE_PUBLIC;
export const SPLIT_PRIVATE = MODE_PRIVATE;

/** A column's third line when it holds more than two assets */
export function moreAssets(n: number): string {
  return `+${n} more`;
}

/** The spoken form of an unknown side */
export const SPLIT_UNKNOWN_A11Y = 'not known yet';

/** A column's accessibility label: what it shows (already "•••" when hidden), and what a tap does */
export function splitA11y(sideName: string, value: string, isActive: boolean, stale = false): string {
  // review Task 5 m8: a screen reader says nothing for "—"; it hears "not known yet"
  const spoken = value === VALUE_UNKNOWN ? SPLIT_UNKNOWN_A11Y : value;
  const said = stale ? `${spoken}, ${STALE_ROW_SUFFIX}` : spoken; // post-M1d §3.2
  return isActive ? `${sideName}, ${said}` : `${sideName}, ${said}, switch to ${sideName}`;
}

/** #21's refusals (M5): nothing was signed. The code leads the line (the screen keys no-Retry on it). */
export function sendSchemeError(scheme: string): string {
  return `E_SEND_SCHEME: ${scheme} is not an account this wallet can sign for; nothing was signed.`;
}
export function sendSignerMismatchError(expected: string): string {
  return `E_SEND_SIGNER_MISMATCH: this account's key does not derive ${expected}; nothing was signed.`;
}

/** Pull-to-refresh while a non-main account is shown and its own read failed (review M2) */
export const REFRESH_FAILED_TITLE = 'Could not refresh balance';
export const REFRESH_ACCOUNT_FAILED = "This account's balance could not be read. Pull down to try again.";
