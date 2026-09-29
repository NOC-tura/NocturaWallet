import {MAINNET_SOL_TREASURY} from '../presale/addresses';

/**
 * The Noctura markup on a transparent transfer (owner decision, 2026-09-28; spec "Transparent send
 * fee"): one policy, shared by the app and the extension, so both charge — and disclose — the same
 * thing. Pure: every input is explicit; no store, no clock, no network.
 */
export const TRANSFER_MARKUP_LAMPORTS = 20_000n;

/** The Squads vault that receives the markup — the same vault as the presale SOL treasury. */
export const MAINNET_FEE_TREASURY = MAINNET_SOL_TREASURY;

export type TgeStatus = 'pre_tge' | 'claimable' | 'claimed';

export interface FeePolicyInputs {
  /** 'unknown' when no trustworthy source reports it: then nothing is charged. */
  tgeStatus: TgeStatus | 'unknown';
  /** 'unknown' when no trustworthy source reports it: then nothing is charged. */
  isZeroFeeEligible: boolean | 'unknown';
  /** A fraction in [0, 1] (0.1 = 10 %). Outside is clamped; NaN counts as no discount. */
  stakingDiscount: number;
}

/** Why the fee line reads what it reads — carried to the send screen, never hidden. */
export type FeeReason = 'pre-tge' | 'zero-fee-eligible' | 'status-unknown' | 'charged';

export interface EffectiveFee {
  lamports: bigint;
  reason: FeeReason;
}

/** fee − fee × round(discount × 100) / 100, in BigInt — never a float amount. */
export function applyStakingDiscount(fee: bigint, discount: number): bigint {
  const d = Number.isFinite(discount) ? Math.min(1, Math.max(0, discount)) : 0;
  if (d === 0) return fee;
  const percent = BigInt(Math.round(d * 100));
  return fee - (fee * percent) / 100n;
}

/**
 * 1. pre-TGE → 0. 2. TGE status unknown → 0. 3. zero-fee eligible → 0. 4. eligibility unknown → 0.
 * 5. otherwise the base fee minus the staking discount. Unknown fails in the user's favour.
 */
export function effectiveFee(baseFee: bigint, inputs: FeePolicyInputs): EffectiveFee {
  if (inputs.tgeStatus === 'pre_tge') return {lamports: 0n, reason: 'pre-tge'};
  if (inputs.tgeStatus === 'unknown') return {lamports: 0n, reason: 'status-unknown'};
  if (inputs.isZeroFeeEligible === true) return {lamports: 0n, reason: 'zero-fee-eligible'};
  if (inputs.isZeroFeeEligible === 'unknown') return {lamports: 0n, reason: 'status-unknown'};
  return {lamports: applyStakingDiscount(baseFee, inputs.stakingDiscount), reason: 'charged'};
}
