import {STAKING_TIERS, StakingTier} from './types';

export {STAKING_TIERS};

const PRECISION = BigInt(1_000_000);

export function getTierById(id: string): StakingTier | undefined {
  return STAKING_TIERS.find(t => t.id === id);
}

/**
 * Returns projected reward in lamports (as string) for a given amount (lamports) and tier.
 * Formula: amount * (apyPercent / 100) * (durationDays / 365)
 * Uses BigInt with a PRECISION multiplier to avoid truncation.
 */
export function calculateProjectedReward(
  amountLamports: string,
  tierId: StakingTier['id'],
): string {
  const tier = getTierById(tierId);
  if (!tier) {
    return '0';
  }

  const amount = BigInt(amountLamports);
  if (amount === BigInt(0)) {
    return '0';
  }

  // reward = amount * apyPercent * durationDays * PRECISION / (100 * 365) / PRECISION
  const numerator =
    amount * BigInt(tier.apyPercent) * BigInt(tier.durationDays) * PRECISION;
  const denominator = BigInt(100) * BigInt(365) * PRECISION;
  const reward = numerator / denominator;

  return reward.toString();
}

export function getStakingDiscount(tierId: StakingTier['id'] | null): number {
  if (tierId === null) {
    return 0;
  }
  const tier = getTierById(tierId);
  return tier ? tier.feeDiscount : 0;
}

/**
 * Converts lamports (BigInt string) to a display string (divides by 1e9).
 * Trims trailing zeros from the decimal part.
 */
export function formatStakingAmount(lamports: string): string {
  const value = BigInt(lamports);
  const LAMPORTS_PER_NOC = BigInt(1_000_000_000);

  const whole = value / LAMPORTS_PER_NOC;
  const remainder = value % LAMPORTS_PER_NOC;

  if (remainder === BigInt(0)) {
    return whole.toString();
  }

  // Pad remainder to 9 digits, then trim trailing zeros
  const paddedRemainder = remainder.toString().padStart(9, '0');
  const trimmed = paddedRemainder.replace(/0+$/, '');

  return `${whole}.${trimmed}`;
}
