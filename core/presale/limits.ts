/**
 * The presale program's purchase rules in integer units (B1d §2.1, §3.2; cardinal rule 2): cents as bigint, NOC in base
 * units (9 decimals), lamports as bigint, a stage price in the program's own unit (ten-thousandths of a dollar). Every
 * number here is the program's (ICO `programs/solana-ico-enhanced/src/lib.rs` at 75450df); every division floors, as
 * the program's does.
 *
 * The configured limits are NOT here: `min_purchase_usd` and `max_per_user_usd` are read from the config account on
 * every view (`purchaseLimits`); these constants are only the program's fallbacks for a field that is 0.
 */

/** `PRESALE_MIN_PURCHASE_USD` (lib.rs:34): the minimum when `config.min_purchase_usd` is 0. */
export const PRESALE_MIN_PURCHASE_USD = 2_500n;
/** `PRESALE_MAX_PURCHASE_USD` (lib.rs:35): the per-transaction maximum when `config.max_per_user_usd` is 0. */
export const PRESALE_MAX_PURCHASE_USD = 5_000_000n;
/** `PRESALE_MAX_TOTAL_PER_USER_USD` (lib.rs:36, C6): the cap on an allocation's `total_spent_cents`; no config field. */
export const PRESALE_MAX_TOTAL_PER_USER_USD = 20_000_000n;

/** NOC base units per NOC (`TOKEN_DECIMALS`). */
export const NOC_BASE_PER_NOC = 1_000_000_000n;
/** `PRESALE_TOTAL_ALLOCATION × TOKEN_DECIMALS`: the hard cap on `config.tokens_sold`. */
export const PRESALE_HARD_CAP_BASE = 102_400_000n * NOC_BASE_PER_NOC;
/** `TOKENS_PER_STAGE × TOKEN_DECIMALS`: a stage's size; the program advances the stage when `stage_tokens_sold` reaches it. */
export const TOKENS_PER_STAGE_BASE = 10_240_000n * NOC_BASE_PER_NOC;

/** `STAGE_PRICES` (lib.rs:42-53), 0-indexed by `config.current_stage`. */
export const STAGE_PRICE_TICKS: readonly bigint[] = [1501n, 1723n, 1945n, 2167n, 2389n, 2611n, 2833n, 3055n, 3277n, 3499n];

/**
 * UPPER BOUNDS — never the exact rent — of the two PDAs a first purchase creates (`init_if_needed`, lib.rs:2904-2919):
 * `(128 + length) × 6 960` for a UserAccount (58 bytes) and a PresaleAllocation (117), the old rate behind
 * `SYSTEM_ACCOUNT_RENT_LAMPORTS` and `TOKEN_ACCOUNT_RENT_LAMPORTS` (core/solana/transfer.ts). Mainnet charges less today
 * (5 080 lamports per byte: 944 880 and 1 244 600; a test pins that these bounds stay at or above it). Safe for a
 * reserve or a balance line; NOT for an exact outflow check — that takes the rent the simulation shows.
 */
export const PRESALE_USER_ACCOUNT_RENT_LAMPORTS = 1_294_560n;
export const PRESALE_ALLOCATION_RENT_LAMPORTS = 1_705_200n;

export interface PurchaseLimits {
  minCents: bigint;
  maxTxCents: bigint;
  /** What this account may still spend: the per-user cap minus its allocation's `total_spent_cents`, floored at 0. */
  userRemainingCents: bigint;
}

/**
 * The program's limits for one purchase (lib.rs:333-351 SOL, 2414-2430 stablecoin — the same rule for every currency,
 * D7): the config's minimum and per-transaction maximum, each the program's constant when the field is 0, and the
 * per-user cap less what the allocation has already spent.
 */
export function purchaseLimits(config: {minPurchaseUsd: bigint; maxPerUserUsd: bigint}, totalSpentCents: bigint): PurchaseLimits {
  const remaining = PRESALE_MAX_TOTAL_PER_USER_USD - totalSpentCents;
  return {
    minCents: config.minPurchaseUsd > 0n ? config.minPurchaseUsd : PRESALE_MIN_PURCHASE_USD,
    maxTxCents: config.maxPerUserUsd > 0n ? config.maxPerUserUsd : PRESALE_MAX_PURCHASE_USD,
    userRemainingCents: remaining > 0n ? remaining : 0n,
  };
}

export type LimitCode = 'below-min' | 'above-max-tx' | 'above-user-limit';

/** The first limit a purchase of `cents` breaks, in the program's order (minimum, per transaction, per user), or null. */
export function checkLimits(q: {cents: bigint} & PurchaseLimits): LimitCode | null {
  if (q.cents < q.minCents) return 'below-min';
  if (q.cents > q.maxTxCents) return 'above-max-tx';
  if (q.cents > q.userRemainingCents) return 'above-user-limit';
  return null;
}

/** A stablecoin amount (6 decimals, base units) in cents, floored: the program's `amount × 100 / 10⁶`. */
export function usdCentsForStable(amount6: bigint): bigint {
  if (amount6 < 0n) throw new RangeError('usdCentsForStable: negative amount');
  return (amount6 * 100n) / 1_000_000n;
}

/** NOC base units for `cents` at a 0-indexed stage, floored: the program's `calculate_tokens_for_usd` (lib.rs:2793-2818). */
export function tokensFor(cents: bigint, stage: number): bigint {
  const ticks = Number.isInteger(stage) ? STAGE_PRICE_TICKS[stage] : undefined;
  if (ticks === undefined) throw new RangeError(`tokensFor: unknown stage ${stage}`);
  if (cents < 0n) throw new RangeError('tokensFor: negative amount');
  return (cents * NOC_BASE_PER_NOC * 100n) / ticks;
}
