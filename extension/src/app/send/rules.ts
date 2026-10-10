import {base58} from '@scure/base';
import {formatAmount} from '../../shared/amount';
import {sendReauthReasons, usdMicros, type SendReauthReason} from '../../background/reauthPolicy';
import {TOKEN_INFO} from '../format';
import type {FeeReason, Intent, Prepared, Prices, Token} from '../engine';

/**
 * The send flow's rules that are pure arithmetic or text (spec §4.2–§4.5), in one place so #12, #19, #20 and
 * #21 cannot disagree. Amounts are base units, bigint (cardinal rule 2); nothing here reads the network.
 */

/** What #12 holds while the user types: the field texts as typed, so a return from #19 restores them exactly. */
export interface Draft {
  token: Token;
  recipient: string;
  amount: string;
  /**
   * Task 6 fix round 1 (M3): the amount is MAX's text — carried across #15's pick, which mounts #12 again, so MAX's
   * helper stays as it does after a paste. Only `true`, or absent.
   */
  max?: true;
}

const TOKENS: readonly string[] = ['SOL', 'NOC', 'USDC', 'USDT'];
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** #12's recipient check (spec §4.2): the base58 alphabet, 32–44 characters, and exactly 32 bytes once decoded. */
export function isAddressText(text: string): boolean {
  if (!BASE58.test(text)) return false;
  try {
    return base58.decode(text).length === 32;
  } catch {
    return false;
  }
}

/** A route's draft is the user's own text: a known token and two strings of a sane length — never trusted further. */
export function isDraft(x: unknown): x is Draft {
  if (typeof x !== 'object' || x === null) return false;
  const d = x as Record<string, unknown>;
  return typeof d.token === 'string' && TOKENS.includes(d.token) && typeof d.recipient === 'string' && d.recipient.length <= 64 && typeof d.amount === 'string' && d.amount.length <= 40 && (d.max === undefined || d.max === true);
}

/** An intent a route may carry to #19: a known token, an address, a positive amount of at most u64. */
export function isIntent(x: unknown): x is Intent {
  if (typeof x !== 'object' || x === null) return false;
  const i = x as Record<string, unknown>;
  return typeof i.token === 'string' && TOKENS.includes(i.token) && typeof i.recipient === 'string' && isAddressText(i.recipient) && typeof i.amount === 'bigint' && i.amount > 0n && i.amount <= 18_446_744_073_709_551_615n;
}

export const sameIntent = (a: Intent, b: Intent): boolean => a.token === b.token && a.recipient === b.recipient && a.amount === b.amount;

/** Base units as the plain text the amount field takes back ("61.54622"): every digit, no grouping, no trailing zeros. */
export const plainAmount = (base: bigint, decimals: number): string => formatAmount(base, decimals, {min: 0, max: decimals}).replace(/,/g, '');

/** An intent back as #12's draft (#20's loop guard, #44's [Edit transaction], a fresh #19 with #12 under it). */
export const draftOf = (i: Intent): Draft => ({token: i.token, recipient: i.recipient, amount: plainAmount(i.amount, TOKEN_INFO[i.token].decimals)});

/** A confirmation never rounds (spec §3.10, §4.5): every base unit shown, at least the design's places ("2.4800 SOL", "12.00 USDC"). */
export function showExact(token: Token, base: bigint): string {
  const {decimals} = TOKEN_INFO[token];
  return formatAmount(base, decimals, {min: token === 'SOL' || token === 'NOC' ? 4 : 2, max: decimals});
}

/** A fee in SOL, exact and ungrouped, as the #19 and #20 mockups draw it ("0.000005", "0.00012"). */
export const showLamports = (lamports: bigint): string => formatAmount(lamports, 9, {min: 0, max: 9});

// ── MAX (spec §4.2) ───────────────────────────────────────────────────────────────────────────────
// The worst case the engine can charge a SOL send, from core's own constants (a test proves each equals
// core's): 5 000 per signature, the normal tier's priority ceiling over the SOL send's compute-unit limit, and
// the Noctura fee were it charged. The UI does not import core/solana/transfer.ts or priorityFee.ts: the first
// pulls @solana/web3.js into the popup, the second the whole RPC client.
export const BASE_FEE_LAMPORTS = 5_000n;
export const SOL_SEND_COMPUTE_UNITS = 1_000n;
export const PRIORITY_CEILING_MICRO_LAMPORTS = 20_000_000n;
export const MARKUP_CEILING_LAMPORTS = 20_000n;
/** The rent-exempt minimum of a 0-data account: a SOL balance is 0 or at least this (spec §11.5). */
export const RENT_EXEMPT_LAMPORTS = 890_880n;
export const WORST_SOL_FEE_LAMPORTS = BASE_FEE_LAMPORTS + (PRIORITY_CEILING_MICRO_LAMPORTS * SOL_SEND_COMPUTE_UNITS + 999_999n) / 1_000_000n + MARKUP_CEILING_LAMPORTS;

/**
 * MAX (spec §4.2, §11.5): an SPL token's whole balance; for SOL, the balance less the worst-case fee and less
 * the rent-exempt minimum, floored at 0. The remainder after the real fee is then never 1 … 890 879 lamports, so
 * the engine's sender-below-rent rule (and the runtime's InsufficientFundsForRent) can never refuse a MAX send.
 */
export function maxSendable(token: Token, balance: bigint): bigint {
  if (token !== 'SOL') return balance;
  const max = balance - WORST_SOL_FEE_LAMPORTS - RENT_EXEMPT_LAMPORTS;
  return max > 0n ? max : 0n;
}

// ── Re-authentication, predicted (spec §4.2) ─────────────────────────────────────────────────────

/** USD per whole token, as the engine values it for the dollar rule: NOC at the stage price. */
export function unitPrice(token: Token, prices: Prices | null): number | undefined {
  if (prices === null) return undefined;
  const p = token === 'SOL' ? prices.sol : token === 'NOC' ? prices.noc : token === 'USDC' ? prices.usdc : prices.usdt;
  return p ?? undefined;
}

/**
 * #12's hint of which re-authentication triggers this send will meet — the engine's own function
 * (background/reauthPolicy.ts), fed what #12 knows. It fails closed as the engine does: an unknown balance is
 * 0, an unknown price or threshold is above the dollar rule. #19 and #20 show the engine's reasons, which decide.
 */
export function predictReasons(i: {known: boolean; token: Token; amount: bigint; balance: bigint | null; prices: Prices | null; thresholdCents: number | null}): SendReauthReason[] {
  const usd = i.thresholdCents === null ? null : usdMicros(i.amount, TOKEN_INFO[i.token].decimals, unitPrice(i.token, i.prices));
  return sendReauthReasons({knownRecipient: i.known, amount: i.amount, balance: i.balance ?? 0n, usdMicros: usd, thresholdCents: i.thresholdCents ?? 0});
}

/** The amount as a share of the balance, whole percent, truncated; null for an empty or unknown balance. */
export function percentOf(amount: bigint, balance: bigint | null): number | null {
  if (balance === null || balance <= 0n) return null;
  return Number((amount * 100n) / balance);
}

/** A token amount's value in USD for display only (never a decision); null without a price. The float conversion is lossy — never feed it back into an amount or a rule. */
export function usdOf(token: Token, amount: bigint, prices: Prices | null): number | null {
  const p = unitPrice(token, prices);
  if (p === undefined) return null;
  return (Number(amount) / 10 ** TOKEN_INFO[token].decimals) * p;
}

// ── Fee rows (spec §4.5, defined once for #19, #20 and #10) ────────────────────────────────────────

/** The carried rule: a zero Noctura fee always says why. */
export const FEE_REASON_TEXT: Record<Exclude<FeeReason, 'charged'>, string> = {
  'pre-tge': 'No Noctura fee before TGE',
  'zero-fee-eligible': 'No Noctura fee (zero-fee eligible)',
  'status-unknown': 'No Noctura fee (status unknown)',
};

export interface FeeRow {
  label: string;
  /** Lamports; null for the reason line of a zero Noctura fee. */
  lamports: bigint | null;
}

/**
 * "Network fee" = network − priority (the base fee), "Priority", "New token account" when non-zero, then
 * "Noctura fee" when non-zero or its reason line. Their lamports and the amount (for SOL) sum to
 * solRequiredLamports — the engine's own total.
 */
export function feeRows(fees: Prepared['fees']): FeeRow[] {
  const rows: FeeRow[] = [
    {label: 'Network fee', lamports: fees.networkLamports - fees.priorityLamports},
    {label: 'Priority', lamports: fees.priorityLamports},
  ];
  if (fees.rentLamports > 0n) rows.push({label: 'New token account', lamports: fees.rentLamports});
  if (fees.markupLamports > 0n) rows.push({label: 'Noctura fee', lamports: fees.markupLamports});
  // `charged` with a zero markup gets no line, as spec §4.5 / plan-3 carry 1 rules ("not described"), and #10's
  // renderer refuses the combination (src/unlock/challenge.ts fails closed). The extension cannot produce it:
  // EXTENSION_FEE_INPUTS fixes the statuses 'unknown' and the discount 0, so effectiveFee answers a
  // non-charged reason whenever the fee is 0. Core's effectiveFee alone could (a staking discount of 100 % —
  // ≥ 0.995 after its clamp and rounding — returns `charged` with 0n); when a discount is wired in, a 100 %
  // discount must map to a non-charged reason in core/fees/transferMarkup.ts, not to new UI copy here.
  else if (fees.markupReason !== 'charged') rows.push({label: FEE_REASON_TEXT[fees.markupReason], lamports: null});
  return rows;
}

// ── #12's recipient hint ─────────────────────────────────────────────────────────────────────────

const dayStart = (t: number): number => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * "Verified · sent before · last 12 days ago" (#12 design state 3; local calendar days, cardinal rule 3), or
 * "Verified · sent before" with no date. "· today" and "· yesterday" — controller addition — confirmed by the owner 2026-10-02
 * (plan 3; the review rejected "last 1 day ago"): the design gives only the plural form.
 */
export function sentBeforeText(lastSentAt: number | null, now: number): string {
  if (lastSentAt === null) return 'Verified · sent before';
  const days = Math.max(0, Math.round((dayStart(now) - dayStart(lastSentAt)) / 86_400_000));
  if (days === 0) return 'Verified · sent before · today';
  if (days === 1) return 'Verified · sent before · yesterday';
  return `Verified · sent before · last ${days} days ago`;
}
