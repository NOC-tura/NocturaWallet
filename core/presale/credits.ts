/**
 * Where an allocation's non-purchase credits came from, taken from the chain's own logs.
 *
 * `PresaleAllocation.referral_bonus_tokens` is one number with several causes, and the
 * page could say only that it did not come from the holder's purchases. That is true and
 * uncheckable, on a page whose every other number is checkable. On 2026-09-23 a mainnet
 * account appeared holding 188.607594936 NOC with purchase_count 0 — the whole allocation
 * was a credit, and its owner had nothing to check it against.
 *
 * The transactions that touched the allocation carry the answer, so it is read from there.
 */

/** A credit found in a transaction that touched this allocation account. */
export interface Credit {
  kind: 'giveaway' | 'referral';
  base: bigint;
  signature: string;
  blockTime: number | null;
}

export interface CreditLog {
  signature: string;
  blockTime: number | null;
  logs: string[];
}

const GIVEAWAY = /ADMIN_GIVEAWAY: Added (\d+) tokens to user ([1-9A-HJ-NP-Za-km-z]{32,44})/;
const REFERRAL = /One-time referral bonus awarded: (\d+) tokens/;

/**
 * THE ATTRIBUTION TRAP, and why this returns null rather than a best effort.
 *
 * A purchase transaction touches TWO allocation accounts: the buyer's and the referrer's.
 * `ADMIN_GIVEAWAY` names its recipient, so it can always be attributed. The referral line
 * cannot — "One-time referral bonus awarded: N tokens" says nothing about who received it,
 * so walking a BUYER's account finds a line whose tokens went to somebody else. Counting
 * it would show that buyer a credit they never got: the count right, the name wrong.
 *
 * So the itemisation is only ever returned when it reconciles EXACTLY against the field
 * the chain maintains. A wallet that is both a buyer with a referrer and a referrer itself
 * over-counts, fails the check, and gets the unitemised sentence instead — less
 * informative and not wrong, which is the correct direction to fail.
 *
 * Exact, not approximate: these are whole base units the program logs and copies, with no
 * repricing anywhere, unlike the purchase amounts that drift ~0.03% against the backend.
 */
export function attributeCredits(
  transactions: CreditLog[],
  walletAddress: string,
  referralBonusBase: bigint,
): Credit[] | null {
  const credits: Credit[] = [];

  for (const tx of transactions) {
    for (const line of tx.logs) {
      const giveaway = GIVEAWAY.exec(line);
      if (giveaway && giveaway[2] === walletAddress) {
        credits.push({
          kind: 'giveaway',
          base: BigInt(giveaway[1] as string),
          signature: tx.signature,
          blockTime: tx.blockTime,
        });
        continue;
      }
      const referral = REFERRAL.exec(line);
      if (referral) {
        credits.push({
          kind: 'referral',
          base: BigInt(referral[1] as string),
          signature: tx.signature,
          blockTime: tx.blockTime,
        });
      }
    }
  }

  const total = credits.reduce((sum, c) => sum + c.base, 0n);
  if (total !== referralBonusBase) return null;
  return credits.sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));
}
