import type {JsonGetter} from '../ports';

export interface ReferralStats {
  totalReferrals: number;
  totalBaseBonusNoc: number;
  totalExtraBonusNoc: number;
  totalBonusNoc: number;
  totalReferredNoc: number;
  totalReferredUsd: number;
  tierBonusCount: number;
}

/** Address-based invite link, matching the website (`?ref=<address>`). */
export function buildReferralLink(address: string): string {
  return `https://noc-tura.io?ref=${address}`;
}

/**
 * Live referral aggregates for `address`. Throws on failure.
 *
 * Every field is coerced with a default, because a partial response should render as
 * zeros rather than as `undefined referred` — but a missing envelope is still a
 * failure, not an empty result.
 */
export async function fetchReferralStats(json: JsonGetter, address: string): Promise<ReferralStats> {
  const body = await json.get<{success?: boolean; data?: Partial<ReferralStats>}>(
    `/referral-stats/${address}`,
  );
  if (!body.success || !body.data) {
    throw new Error('referral stats unsuccessful');
  }
  const d = body.data;
  return {
    totalReferrals: Number(d.totalReferrals ?? 0),
    totalBaseBonusNoc: Number(d.totalBaseBonusNoc ?? 0),
    totalExtraBonusNoc: Number(d.totalExtraBonusNoc ?? 0),
    totalBonusNoc: Number(d.totalBonusNoc ?? 0),
    totalReferredNoc: Number(d.totalReferredNoc ?? 0),
    totalReferredUsd: Number(d.totalReferredUsd ?? 0),
    tierBonusCount: Number(d.tierBonusCount ?? 0),
  };
}
