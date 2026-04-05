import {SystemProgram, PublicKey} from '@solana/web3.js';
import {SHIELDED_FEES, TRANSPARENT_FEES, NOCTURA_FEE_TREASURY} from '../../constants/programs';
import {usePresaleStore} from '../../store/zustand/presaleStore';
import {FeeDisplayInfo, FEE_DISTRIBUTION, FeeType} from './types';

// NOC has 9 decimals; 1 NOC = 1_000_000_000 lamports
const NOC_DECIMALS = 9;
const LAMPORTS_PER_NOC = BigInt(10 ** NOC_DECIMALS);

/**
 * Apply a staking discount to a fee.
 * Uses BigInt arithmetic — never floats.
 * discount is a fraction in [0, 1], e.g. 0.1 for 10%.
 */
function applyDiscount(fee: bigint, discount: number): bigint {
  if (discount <= 0) return fee;
  // Convert discount to integer basis points (hundredths of a percent) to avoid float drift
  const discountBps = BigInt(Math.round(discount * 100));
  return fee - (fee * discountBps) / 100n;
}

/**
 * Format a lamport amount as "X.XXXXXXXXX NOC", trimming trailing zeros.
 */
function formatNoc(lamports: bigint): string {
  const whole = lamports / LAMPORTS_PER_NOC;
  const remainder = lamports % LAMPORTS_PER_NOC;
  if (remainder === 0n) {
    return `${whole} NOC`;
  }
  const dec = remainder.toString().padStart(NOC_DECIMALS, '0').replace(/0+$/, '');
  return `${whole}.${dec} NOC`;
}

export class FeeEngineManager {
  /**
   * Returns the effective fee (in lamports, BigInt) for a given fee type.
   *
   * Rules:
   *  1. pre-TGE → always 0n
   *  2. isZeroFeeEligible → 0n
   *  3. Otherwise apply staking discount to the base fee
   */
  getEffectiveFee(feeType: FeeType, stakingDiscount: number = 0): bigint {
    const {tgeStatus, isZeroFeeEligible} = usePresaleStore.getState();

    if (tgeStatus === 'pre_tge') {
      return 0n;
    }

    if (isZeroFeeEligible) {
      return 0n;
    }

    const baseFee = this._baseFee(feeType);
    return applyDiscount(baseFee, stakingDiscount);
  }

  /**
   * Returns FeeDisplayInfo — the fee plus human-readable labels.
   */
  getFeeDisplayInfo(feeType: FeeType, stakingDiscount: number = 0): FeeDisplayInfo {
    const {tgeStatus} = usePresaleStore.getState();
    const amount = this.getEffectiveFee(feeType, stakingDiscount);

    let label: string;
    let discountLabel: string | null = null;

    if (amount === 0n) {
      label = tgeStatus === 'pre_tge' ? 'Free (until TGE)' : 'Free';
    } else {
      label = formatNoc(amount);
    }

    if (stakingDiscount > 0 && amount > 0n) {
      const pct = Math.round(stakingDiscount * 100);
      discountLabel = `${pct}% staking discount`;
    }

    return {amount, label, discountFraction: stakingDiscount, discountLabel};
  }

  /**
   * Build a SystemProgram.transfer instruction that pays the shielded fee
   * to the Noctura fee treasury.
   */
  buildTransparentFeeInstruction(params: {
    fromPubkey: PublicKey;
    feeLamports: bigint;
  }) {
    const {fromPubkey, feeLamports} = params;
    return SystemProgram.transfer({
      fromPubkey,
      toPubkey: new PublicKey(NOCTURA_FEE_TREASURY),
      lamports: feeLamports,
    });
  }

  // ---- private ----

  private _baseFee(feeType: FeeType): bigint {
    switch (feeType) {
      case 'privateTransfer':
        return SHIELDED_FEES.privateTransfer;
      case 'privateSwap':
        return SHIELDED_FEES.privateSwap;
      case 'crossModeDeposit':
        return SHIELDED_FEES.crossModeDeposit;
      case 'crossModeWithdraw':
        return SHIELDED_FEES.crossModeWithdraw;
      case 'transferMarkup':
        return TRANSPARENT_FEES.transferMarkup;
      default: {
        const _exhaustive: never = feeType;
        return 0n;
      }
    }
  }
}

export const feeEngine = new FeeEngineManager();

export {FEE_DISTRIBUTION, SHIELDED_FEES, TRANSPARENT_FEES};
export type {FeeDisplayInfo, FeeType};
