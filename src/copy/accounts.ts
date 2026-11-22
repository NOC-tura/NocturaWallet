/**
 * M1d (spec docs/superpowers/specs/2026-11-21-shielded-m1d-accounts-design.md §4; M1 spec §10,
 * §11 R11): every user-visible string of the accounts surfaces — the Accounts sheet and the
 * avatar, "From:" on #19/#20, the linking warning on #12, the main-only lines, #21's "Received by",
 * the combined line and #17's "Who sees what". The screens import these.
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

/** The linking warning on #12 (§4.4, M1 spec §10 C2) and its second tap */
export const LINK_WARNING_TITLE = 'Sending between your own accounts links them on chain.';
export const LINK_WARNING_BODY = 'Anyone can see that these two accounts belong to the same person.';
export const LINK_TAP_AGAIN = 'Tap again to send anyway';

/** Swap, presale and referral stay on the main account (§4.3, D1) */
export const USES_MAIN_ACCOUNT = 'Uses your main account';
/** #21 Now public, Details (§4.3) */
export const RECEIVED_BY = 'Received by';

/** The combined line (§4.5): an unknown side, and a hidden one */
export const VALUE_UNKNOWN = '—';
export const VALUE_HIDDEN = '•••';
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

/** "Account 4 · 3YqEpf…JXT94k" / "Account 1 (main) · HAgk14…3DKpqk" — #20's From row, #21's Received by */
export function accountWithAddress(label: string, short: string, isMain: boolean): string {
  return `${label}${isMain ? ' (main)' : ''} · ${short}`;
}

/** #19's caption (§4.2) */
export function fromLine(label: string, short: string, isMain: boolean): string {
  return `From: ${accountWithAddress(label, short, isMain)}`;
}

/** Swap and presale while another account is selected (§4.3; plan A13: the main's own label) */
export function fromMainLine(mainLabel: string): string {
  return `From: ${mainLabel} (main)`;
}

/** "Public X · Private Y" — the two sides already formatted, never summed (§4.5, D4) */
export function combinedLine(pub: string, priv: string): string {
  return `${MODE_PUBLIC} ${pub} · ${MODE_PRIVATE} ${priv}`;
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
