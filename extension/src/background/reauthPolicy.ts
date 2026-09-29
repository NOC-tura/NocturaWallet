/** Spec §3 / screen.md §0: above 5 % of the account's balance (of the token being sent). */
export const REAUTH_PERCENT = 5n;
/** "Whole or nearly whole balance". */
export const WHOLE_BALANCE_PERCENT = 99n;

export type SendReauthReason = 'first-send' | 'over-5-percent' | 'over-usd-threshold' | 'whole-balance-to-new';

/** amount × price in micro-dollars, BigInt. Null — unknown — without a usable price. */
export function usdMicros(amount: bigint, decimals: number, unitPriceUsd: number | undefined): bigint | null {
  if (unitPriceUsd === undefined || !Number.isFinite(unitPriceUsd) || unitPriceUsd <= 0) return null;
  const priceMicros = BigInt(Math.round(unitPriceUsd * 1_000_000));
  return (amount * priceMicros) / 10n ** BigInt(decimals);
}

/**
 * Which re-authentication triggers a send meets (spec §2, §3). Every rule fails closed: an unknown
 * price is above the threshold, a zero or unknown balance is above 5 %.
 */
export function sendReauthReasons(i: {knownRecipient: boolean; amount: bigint; balance: bigint; usdMicros: bigint | null; thresholdCents: number}): SendReauthReason[] {
  const out: SendReauthReason[] = [];
  if (!i.knownRecipient) out.push('first-send');
  if (i.balance <= 0n || i.amount * 100n > i.balance * REAUTH_PERCENT) out.push('over-5-percent');
  if (i.usdMicros === null || i.usdMicros > BigInt(i.thresholdCents) * 10_000n) out.push('over-usd-threshold');
  if (!i.knownRecipient && i.balance > 0n && i.amount * 100n >= i.balance * WHOLE_BALANCE_PERCENT) out.push('whole-balance-to-new');
  return out;
}
