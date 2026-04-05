import {SHIELDED_FEES, TRANSPARENT_FEES} from '../../constants/programs';

export type FeeType =
  | 'privateTransfer'
  | 'privateSwap'
  | 'crossModeDeposit'
  | 'crossModeWithdraw'
  | 'transferMarkup';

export interface FeeDisplayInfo {
  /** Raw fee in lamports (BigInt). Zero means free. */
  amount: bigint;
  /** Human-readable string, e.g. "0.0005 NOC" or "Free (until TGE)" */
  label: string;
  /** Applied discount fraction, 0 if none */
  discountFraction: number;
  /** Display text for the discount, e.g. "10% staking discount" or null */
  discountLabel: string | null;
}

/**
 * FEE_DISTRIBUTION defines how collected fees are split across buckets.
 * Each object's values MUST sum to exactly 1.0.
 */
export const FEE_DISTRIBUTION = {
  privateTransfer: {
    treasury: 0.6,
    stakers: 0.3,
    burn: 0.1,
  },
  transparent: {
    treasury: 0.7,
    stakers: 0.2,
    burn: 0.1,
  },
} as const;

// Re-export constants used by feeEngine consumers
export {SHIELDED_FEES, TRANSPARENT_FEES};
