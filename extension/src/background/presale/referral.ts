import {PublicKey} from '@solana/web3.js';
import type {WalletDeps} from '../deps';
import {allocationFacts} from './state';
import {derivePresalePdas} from '../../../../core/presale/allocation';
import {buildReferralLink} from '../../../../core/referral/index';

/**
 * B1d §3.5 "#24's data", §4.4 (C1, D4): what #24 shows. `link` is the account's invite link as the website and the app
 * build it (core's buildReferralLink), whole. `earnedBase` is the account's allocation's `referral_bonus_tokens`, read
 * from chain — never the coordinator's bonus figures (it reports 0 for a bonus the program credited; memory "referral
 * and backend contract"); no allocation on chain is 0 earned. `referrals` and `referredCents` are GET
 * /referral-stats/<address>'s aggregates, the dollars made whole cents here. A source that fails gives null for its own
 * fields only (#24 shows "—"); nothing stands in for a source that did not answer. Numbers are decimal strings of bigints.
 */
export interface ReferralView {
  link: string;
  earnedBase: string | null;
  referrals: string | null;
  referredCents: string | null;
}

/**
 * The two aggregates #24 shows, read strictly from a /referral-stats body (`{success: true, data}`, the coordinator's
 * postgres.js getReferralStats): `totalReferrals` — the people who bought through the address — a non-negative integer,
 * and `totalReferredUsd` — the dollars they spent — a non-negative finite number, as whole cents. NOT core's
 * fetchReferralStats: that turns a missing or ill-typed field into 0, a figure with no source. Null when either is not
 * said validly — both come from one answer and stand or fall together. The body's other keys are not read.
 */
export function referralStatsFrom(body: unknown): {referrals: bigint; referredCents: bigint} | null {
  if (typeof body !== 'object' || body === null) return null;
  const {success, data} = body as {success?: unknown; data?: unknown};
  if (success !== true || typeof data !== 'object' || data === null) return null;
  const {totalReferrals, totalReferredUsd} = data as {totalReferrals?: unknown; totalReferredUsd?: unknown};
  if (typeof totalReferrals !== 'number' || !Number.isSafeInteger(totalReferrals) || totalReferrals < 0) return null;
  if (typeof totalReferredUsd !== 'number' || !Number.isFinite(totalReferredUsd) || totalReferredUsd < 0) return null;
  // The coordinator sums dollars as a double (0.29 is 0.28999…): rounded to the cent, the one place a float is read.
  const cents = Math.round(totalReferredUsd * 100);
  if (!Number.isSafeInteger(cents)) return null;
  return {referrals: BigInt(totalReferrals), referredCents: BigInt(cents)};
}

/** The account's allocation's referral_bonus_tokens (rule 6: the program's account of this very address), or null. */
async function earnedBase(deps: WalletDeps, account: string): Promise<bigint | null> {
  const address = derivePresalePdas(new PublicKey(account)).userAllocation.toBase58();
  try {
    const read = await deps.reader.getAccountsData([address]);
    const facts = read.length === 1 ? allocationFacts(read[0], account) : null;
    return facts === null ? null : facts.bonusBase;
  } catch {
    return null;
  }
}

/** /referral-stats for the account through the shared latch — a 403 trips it there and is never retried here. */
async function stats(deps: WalletDeps, account: string): Promise<{referrals: bigint; referredCents: bigint} | null> {
  try {
    return referralStatsFrom(await deps.getJson(`/referral-stats/${account}`));
  } catch {
    return null;
  }
}

/** #24's data for `account` (a key of the unlocked session): the two sources read side by side, each failing alone. */
export async function referralView(deps: WalletDeps, account: string): Promise<ReferralView> {
  const [earned, s] = await Promise.all([earnedBase(deps, account), stats(deps, account)]);
  return {
    link: buildReferralLink(account),
    earnedBase: earned === null ? null : earned.toString(),
    referrals: s === null ? null : s.referrals.toString(),
    referredCents: s === null ? null : s.referredCents.toString(),
  };
}
