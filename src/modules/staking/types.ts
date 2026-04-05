export interface StakingTier {
  id: '90d' | '182d' | '365d';
  label: string;
  durationDays: number;
  apyPercent: number;
  feeDiscount: number;
}

export interface StakingPosition {
  stakedAmount: string;
  tier: StakingTier['id'];
  lockedAt: number;
  unlockAt: number;
  accruedRewards: string;
  claimed: boolean;
}

export interface StakeParams {
  amount: string;
  tierId: StakingTier['id'];
}

export const STAKING_TIERS: StakingTier[] = [
  {id: '90d', label: '90 Days', durationDays: 90, apyPercent: 34, feeDiscount: 0.1},
  {id: '182d', label: '182 Days', durationDays: 182, apyPercent: 68, feeDiscount: 0.2},
  {id: '365d', label: '365 Days', durationDays: 365, apyPercent: 128, feeDiscount: 0.3},
];
