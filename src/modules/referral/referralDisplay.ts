import {formatUsdString} from '../../utils/formatUsd';
import type {ReferralStats} from './referralModule';

export function referralStatsDisplay(s: ReferralStats): {
  referrals: string;
  earnedNoc: string;
  referredUsd: string;
} {
  return {
    referrals: String(s.totalReferrals),
    earnedNoc: s.totalBonusNoc.toFixed(2),
    referredUsd: formatUsdString(s.totalReferredUsd),
  };
}
