import {
  NOC_BASE_PER_NOC,
  PRESALE_ALLOCATION_RENT_LAMPORTS,
  PRESALE_HARD_CAP_BASE,
  PRESALE_MAX_PURCHASE_USD,
  PRESALE_MAX_TOTAL_PER_USER_USD,
  PRESALE_MIN_PURCHASE_USD,
  PRESALE_USER_ACCOUNT_RENT_LAMPORTS,
  STAGE_PRICE_TICKS,
  TOKENS_PER_STAGE_BASE,
  checkLimits,
  purchaseLimits,
  tokensFor,
  usdCentsForStable,
} from '../limits';
import {PRESALE_STAGE_PRICES, TOKENS_PER_STAGE} from '../stagePrices';
import {ALLOCATION_ACCOUNT_LENGTH} from '../allocation';
import {SYSTEM_ACCOUNT_RENT_LAMPORTS, TOKEN_ACCOUNT_RENT_LAMPORTS, TOKEN_ACCOUNT_SIZE} from '../../solana/transfer';

// B1d §2.1 "Derived values", §3.2, §6.1 "Limits (1a)": the program's rules in integer units — cents, NOC base units,
// lamports, price ticks (ICO lib.rs at 75450df).
describe('the program constants', () => {
  it('the fallbacks and the per-user cap are the program’s (lib.rs:34-36, C6)', () => {
    expect(PRESALE_MIN_PURCHASE_USD).toBe(2_500n);
    expect(PRESALE_MAX_PURCHASE_USD).toBe(5_000_000n);
    expect(PRESALE_MAX_TOTAL_PER_USER_USD).toBe(20_000_000n);
  });

  it('STAGE_PRICE_TICKS = core’s float table × 10 000, element by element (two independent copies agree)', () => {
    expect(STAGE_PRICE_TICKS).toHaveLength(PRESALE_STAGE_PRICES.length);
    PRESALE_STAGE_PRICES.forEach((p, i) => expect([i, STAGE_PRICE_TICKS[i]]).toEqual([i, BigInt(Math.round(p * 10_000))]));
    expect(STAGE_PRICE_TICKS[0]).toBe(1501n);
    expect(STAGE_PRICE_TICKS[9]).toBe(3499n);
  });

  it('the hard cap and a stage’s size in NOC base units (TOKENS_PER_STAGE × 10 stages × 10⁹)', () => {
    expect(NOC_BASE_PER_NOC).toBe(10n ** 9n);
    expect(TOKENS_PER_STAGE_BASE).toBe(BigInt(TOKENS_PER_STAGE) * 10n ** 9n);
    expect(PRESALE_HARD_CAP_BASE).toBe(TOKENS_PER_STAGE_BASE * 10n);
    expect(PRESALE_HARD_CAP_BASE).toBe(102_400_000_000_000_000n);
  });

  it('the new-PDA rents are UPPER BOUNDS at the old rate, (128 + length) × 6 960 — the formula of core’s system and token account rents', () => {
    const rent = (length: number) => BigInt((128 + length) * 6_960);
    expect(rent(0)).toBe(SYSTEM_ACCOUNT_RENT_LAMPORTS);
    expect(rent(TOKEN_ACCOUNT_SIZE)).toBe(TOKEN_ACCOUNT_RENT_LAMPORTS);
    expect(PRESALE_USER_ACCOUNT_RENT_LAMPORTS).toBe(rent(58));
    expect(PRESALE_ALLOCATION_RENT_LAMPORTS).toBe(rent(ALLOCATION_ACCOUNT_LENGTH));
    expect([PRESALE_USER_ACCOUNT_RENT_LAMPORTS, PRESALE_ALLOCATION_RENT_LAMPORTS]).toEqual([1_294_560n, 1_705_200n]);
  });

  it('they are NOT the exact rent: each is at least — and here above — what mainnet charges today (5 080 lamports per byte; review I2)', () => {
    // getMinimumBalanceForRentExemption on mainnet: 944 880 (58 bytes), 1 244 600 (117 bytes) = (128 + length) × 5 080.
    const measured = (length: number) => BigInt((128 + length) * 5_080);
    expect([measured(58), measured(ALLOCATION_ACCOUNT_LENGTH)]).toEqual([944_880n, 1_244_600n]);
    expect(PRESALE_USER_ACCOUNT_RENT_LAMPORTS >= measured(58)).toBe(true);
    expect(PRESALE_ALLOCATION_RENT_LAMPORTS >= measured(ALLOCATION_ACCOUNT_LENGTH)).toBe(true);
    expect(PRESALE_USER_ACCOUNT_RENT_LAMPORTS).not.toBe(measured(58));
    expect(PRESALE_ALLOCATION_RENT_LAMPORTS).not.toBe(measured(ALLOCATION_ACCOUNT_LENGTH));
  });
});

describe('purchaseLimits — the config’s fields, the program’s fallback for a 0, the per-user cap less what was spent', () => {
  it('the configured values are taken as they are (mainnet 2026-09-21: min 1 000, max 0)', () => {
    expect(purchaseLimits({minPurchaseUsd: 1_000n, maxPerUserUsd: 0n}, 0n)).toEqual({minCents: 1_000n, maxTxCents: 5_000_000n, userRemainingCents: 20_000_000n});
    expect(purchaseLimits({minPurchaseUsd: 7n, maxPerUserUsd: 99n}, 0n)).toEqual({minCents: 7n, maxTxCents: 99n, userRemainingCents: 20_000_000n});
  });

  it('a field of 0 is the program’s constant, each on its own', () => {
    expect(purchaseLimits({minPurchaseUsd: 0n, maxPerUserUsd: 0n}, 0n)).toEqual({minCents: 2_500n, maxTxCents: 5_000_000n, userRemainingCents: 20_000_000n});
    expect(purchaseLimits({minPurchaseUsd: 0n, maxPerUserUsd: 123n}, 0n).minCents).toBe(2_500n);
    expect(purchaseLimits({minPurchaseUsd: 1_000n, maxPerUserUsd: 0n}, 0n).maxTxCents).toBe(5_000_000n);
  });

  it('the existing allocation is subtracted, floored at 0', () => {
    expect(purchaseLimits({minPurchaseUsd: 1_000n, maxPerUserUsd: 0n}, 300_000n).userRemainingCents).toBe(19_700_000n);
    expect(purchaseLimits({minPurchaseUsd: 1_000n, maxPerUserUsd: 0n}, 19_999_999n).userRemainingCents).toBe(1n);
    expect(purchaseLimits({minPurchaseUsd: 1_000n, maxPerUserUsd: 0n}, 20_000_000n).userRemainingCents).toBe(0n);
    expect(purchaseLimits({minPurchaseUsd: 1_000n, maxPerUserUsd: 0n}, 25_000_000n).userRemainingCents).toBe(0n);
  });
});

describe('checkLimits — the program’s order: minimum, per transaction, per user', () => {
  const limits = {minCents: 1_000n, maxTxCents: 5_000_000n, userRemainingCents: 20_000_000n};

  it('every boundary of the minimum and the per-transaction maximum', () => {
    expect(checkLimits({...limits, cents: 999n})).toBe('below-min');
    expect(checkLimits({...limits, cents: 1_000n})).toBeNull();
    expect(checkLimits({...limits, cents: 5_000_000n})).toBeNull();
    expect(checkLimits({...limits, cents: 5_000_001n})).toBe('above-max-tx');
    expect(checkLimits({...limits, cents: 0n})).toBe('below-min');
  });

  it('the per-user remainder with an existing total_spent_cents, at the remainder and one above', () => {
    const l = purchaseLimits({minPurchaseUsd: 1_000n, maxPerUserUsd: 0n}, 17_000_000n);
    expect(l.userRemainingCents).toBe(3_000_000n);
    expect(checkLimits({...l, cents: 3_000_000n})).toBeNull();
    expect(checkLimits({...l, cents: 3_000_001n})).toBe('above-user-limit');
  });

  it('the order: below the minimum wins over the remainder; the per-transaction maximum before the per-user one', () => {
    expect(checkLimits({minCents: 1_000n, maxTxCents: 5_000_000n, userRemainingCents: 0n, cents: 999n})).toBe('below-min');
    expect(checkLimits({minCents: 1_000n, maxTxCents: 5_000_000n, userRemainingCents: 1_000n, cents: 5_000_001n})).toBe('above-max-tx');
    expect(checkLimits({minCents: 1_000n, maxTxCents: 5_000_000n, userRemainingCents: 999n, cents: 1_000n})).toBe('above-user-limit');
  });

  it('the program’s fallback minimum when the field is 0: 2 499 below, 2 500 ok', () => {
    const l = purchaseLimits({minPurchaseUsd: 0n, maxPerUserUsd: 0n}, 0n);
    expect(checkLimits({...l, cents: 2_499n})).toBe('below-min');
    expect(checkLimits({...l, cents: 2_500n})).toBeNull();
  });
});

describe('usdCentsForStable and tokensFor — the program’s integer arithmetic, flooring', () => {
  it('a stablecoin amount floors to cents (9 999 base units → 0 cents)', () => {
    expect(usdCentsForStable(9_999n)).toBe(0n);
    expect(usdCentsForStable(10_000n)).toBe(1n);
    expect(usdCentsForStable(19_999n)).toBe(1n);
    expect(usdCentsForStable(10_000_000n)).toBe(1_000n);
    expect(() => usdCentsForStable(-1n)).toThrow(RangeError);
  });

  it('tokensFor(10 000, 0) = 666 222 518 321 (10¹⁵ / 1501, floored — review L1) and tokensFor(10 000, 9) = 285 795 941 697', () => {
    expect(tokensFor(10_000n, 0)).toBe(666_222_518_321n);
    expect(tokensFor(10_000n, 9)).toBe(285_795_941_697n);
    expect(tokensFor(1n, 0)).toBe(66_622_251n);
  });

  it('an unknown stage throws (the program answers PresaleEnded): 10, 255, −1, 1.5', () => {
    for (const s of [10, 255, -1, 1.5]) expect(() => tokensFor(10_000n, s)).toThrow(RangeError);
    expect(() => tokensFor(-1n, 0)).toThrow(RangeError);
  });
});
