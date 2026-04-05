import {STAKING_TIERS} from '../types';
import {
  getTierById,
  calculateProjectedReward,
  getStakingDiscount,
  formatStakingAmount,
} from '../stakingService';

describe('STAKING_TIERS', () => {
  it('has exactly 3 tiers', () => {
    expect(STAKING_TIERS).toHaveLength(3);
  });

  it('has correct tier IDs', () => {
    expect(STAKING_TIERS.map(t => t.id)).toEqual(['90d', '182d', '365d']);
  });

  it('has correct APY values (34/68/128)', () => {
    expect(STAKING_TIERS[0].apyPercent).toBe(34);
    expect(STAKING_TIERS[1].apyPercent).toBe(68);
    expect(STAKING_TIERS[2].apyPercent).toBe(128);
  });

  it('has correct fee discounts (0.1/0.2/0.3)', () => {
    expect(STAKING_TIERS[0].feeDiscount).toBe(0.1);
    expect(STAKING_TIERS[1].feeDiscount).toBe(0.2);
    expect(STAKING_TIERS[2].feeDiscount).toBe(0.3);
  });

  it('has correct duration days (90/182/365)', () => {
    expect(STAKING_TIERS[0].durationDays).toBe(90);
    expect(STAKING_TIERS[1].durationDays).toBe(182);
    expect(STAKING_TIERS[2].durationDays).toBe(365);
  });
});

describe('getTierById', () => {
  it('returns the correct tier for 90d', () => {
    const tier = getTierById('90d');
    expect(tier).toBeDefined();
    expect(tier?.id).toBe('90d');
    expect(tier?.apyPercent).toBe(34);
  });

  it('returns the correct tier for 182d', () => {
    const tier = getTierById('182d');
    expect(tier).toBeDefined();
    expect(tier?.id).toBe('182d');
  });

  it('returns the correct tier for 365d', () => {
    const tier = getTierById('365d');
    expect(tier).toBeDefined();
    expect(tier?.id).toBe('365d');
  });

  it('returns undefined for an invalid tier id', () => {
    expect(getTierById('999d')).toBeUndefined();
    expect(getTierById('')).toBeUndefined();
  });
});

describe('calculateProjectedReward', () => {
  it('calculates ~83.84 NOC reward for 1000 NOC staked at 90d (34% APY)', () => {
    // 1000 NOC = 1000 * 1e9 lamports
    const amountLamports = (BigInt(1000) * BigInt(1_000_000_000)).toString();
    const rewardLamports = calculateProjectedReward(amountLamports, '90d');
    const rewardNoc = Number(rewardLamports) / 1e9;
    // Expected: 1000 * 0.34 * (90/365) ≈ 83.8356...
    expect(rewardNoc).toBeCloseTo(83.84, 1);
  });

  it('returns "0" for zero amount', () => {
    expect(calculateProjectedReward('0', '90d')).toBe('0');
  });

  it('returns "0" for an invalid tier', () => {
    expect(calculateProjectedReward('1000000000', 'bad' as any)).toBe('0');
  });

  it('returns larger reward for longer tiers', () => {
    const amount = (BigInt(1000) * BigInt(1_000_000_000)).toString();
    const reward90 = BigInt(calculateProjectedReward(amount, '90d'));
    const reward182 = BigInt(calculateProjectedReward(amount, '182d'));
    const reward365 = BigInt(calculateProjectedReward(amount, '365d'));
    expect(reward182).toBeGreaterThan(reward90);
    expect(reward365).toBeGreaterThan(reward182);
  });
});

describe('getStakingDiscount', () => {
  it('returns 0.1 for 90d', () => {
    expect(getStakingDiscount('90d')).toBe(0.1);
  });

  it('returns 0.2 for 182d', () => {
    expect(getStakingDiscount('182d')).toBe(0.2);
  });

  it('returns 0.3 for 365d', () => {
    expect(getStakingDiscount('365d')).toBe(0.3);
  });

  it('returns 0 for null', () => {
    expect(getStakingDiscount(null)).toBe(0);
  });
});

describe('formatStakingAmount', () => {
  it('formats 1000000000 lamports as "1"', () => {
    expect(formatStakingAmount('1000000000')).toBe('1');
  });

  it('formats 1500000000 lamports as "1.5"', () => {
    expect(formatStakingAmount('1500000000')).toBe('1.5');
  });

  it('formats 0 lamports as "0"', () => {
    expect(formatStakingAmount('0')).toBe('0');
  });

  it('trims trailing zeros from decimal portion', () => {
    // 1.500000000 -> "1.5"
    expect(formatStakingAmount('1500000000')).toBe('1.5');
    // 2.100000000 -> "2.1"
    expect(formatStakingAmount('2100000000')).toBe('2.1');
  });

  it('formats large amounts correctly', () => {
    // 1000 NOC = 1_000_000_000_000 lamports
    expect(formatStakingAmount('1000000000000')).toBe('1000');
  });
});
