import {getCoordinatorJson} from '../backend/coordinatorClient';

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

/** Live referral aggregates for `address`. Throws on failure. */
export async function fetchReferralStats(address: string): Promise<ReferralStats> {
  const body = (await getCoordinatorJson(`/referral-stats/${address}`)) as {
    success?: boolean;
    data?: Partial<ReferralStats>;
  };
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
