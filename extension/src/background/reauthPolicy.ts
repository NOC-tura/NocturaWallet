/** Spec §3 / screen.md §0: above 5 % of the account's balance (of the token being sent). */
export const REAUTH_PERCENT = 5n;
/** "Whole or nearly whole balance". */
export const WHOLE_BALANCE_PERCENT = 99n;

export type SendReauthReason = 'first-send' | 'over-5-percent' | 'over-usd-threshold' | 'whole-balance-to-new';

// The price is scaled to 1e-12 dollars before the BigInt multiply: at a micro-dollar scale a
// $0.0000014 price would round to $0.000001 (-29 %).
const PRICE_SCALE = 1_000_000_000_000;
const MICROS_PER_PRICE_UNIT = 1_000_000n; // 1e12 / 1e6

/**
 * amount × price in micro-dollars, BigInt. Null — unknown, which the policy treats as above the
 * threshold — without a usable price, and for a non-zero price too small to represent (never $0).
 * A negative amount is a caller bug and throws.
 */
export function usdMicros(amount: bigint, decimals: number, unitPriceUsd: number | undefined): bigint | null {
  if (amount < 0n) throw new RangeError('usdMicros: negative amount');
  if (unitPriceUsd === undefined || !Number.isFinite(unitPriceUsd) || unitPriceUsd <= 0) return null;
  const scaled = Math.round(unitPriceUsd * PRICE_SCALE);
  if (!Number.isFinite(scaled) || scaled === 0) return null;
  return (amount * BigInt(scaled)) / (10n ** BigInt(decimals) * MICROS_PER_PRICE_UNIT);
}

/**
 * Which re-authentication triggers a send meets (spec §2, §3). Every rule fails closed: an unknown
 * price is above the threshold, a zero or unknown balance is above 5 %. A negative amount is not
 * judged at all — it throws (RangeError), so the send it belongs to fails instead of proceeding
 * under a re-authentication it should never have been offered.
 */
export function sendReauthReasons(i: {knownRecipient: boolean; amount: bigint; balance: bigint; usdMicros: bigint | null; thresholdCents: number}): SendReauthReason[] {
  if (i.amount < 0n) throw new RangeError('sendReauthReasons: negative amount');
  const out: SendReauthReason[] = [];
  if (!i.knownRecipient) out.push('first-send');
  if (i.balance <= 0n || i.amount * 100n > i.balance * REAUTH_PERCENT) out.push('over-5-percent');
  if (i.usdMicros === null || i.usdMicros > BigInt(i.thresholdCents) * 10_000n) out.push('over-usd-threshold');
  if (!i.knownRecipient && i.balance > 0n && i.amount * 100n >= i.balance * WHOLE_BALANCE_PERCENT) out.push('whole-balance-to-new');
  return out;
}
