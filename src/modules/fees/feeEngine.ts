import {SystemProgram, PublicKey} from '@solana/web3.js';
import {SHIELDED_FEES, TRANSPARENT_FEES, NOCTURA_FEE_TREASURY, NOC_MINT} from '../../constants/programs';
import {usePresaleStore} from '../../store/zustand/presaleStore';
import {useWalletStore} from '../../store/zustand/walletStore';
import {FeeDisplayInfo, FEE_DISTRIBUTION, FeeType} from './types';
import {effectiveFee} from '../../../core/fees/transferMarkup';

// NOC has 9 decimals; 1 NOC = 1_000_000_000 lamports
const NOC_DECIMALS = 9;
const LAMPORTS_PER_NOC = BigInt(10 ** NOC_DECIMALS);

// ---- NOC USD price (Jupiter Price API v2) --------------------------------

const JUPITER_PRICE_URL = `https://api.jup.ag/price/v2?ids=${NOC_MINT}`;
const PRICE_CACHE_TTL_MS = 60_000; // 60 seconds

let _cachedPrice: number = 0;
let _cachedPriceAt: number = 0;

/**
 * Fetch NOC/USD price from Jupiter Price API. Cached for 60 seconds.
 * Returns 0 on failure (never throws — fee display degrades gracefully).
 */
export async function getNocUsdPrice(): Promise<number> {
  const now = Date.now();
  if (_cachedPrice > 0 && now - _cachedPriceAt < PRICE_CACHE_TTL_MS) {
    return _cachedPrice;
  }

  try {
    const resp = await fetch(JUPITER_PRICE_URL);
    if (resp.ok) {
      const data = await resp.json();
      const price = data?.data?.[NOC_MINT]?.price;
      if (typeof price === 'number' && price > 0) {
        _cachedPrice = price;
        _cachedPriceAt = now;
        useWalletStore.getState().setNocUsdPrice(price);
        return price;
      }
    }
  } catch {
    // Non-critical — return cached or 0
  }

  return _cachedPrice;
}

/**
 * Convert a NOC lamport amount to a formatted USD string.
 * Uses BigInt division for the integer part to avoid precision loss
 * on amounts above ~9M NOC (Number.MAX_SAFE_INTEGER / 10^9).
 * Returns null if price is unavailable.
 */
export function feeToUsd(nocLamports: bigint, nocUsdPrice: number): string | null {
  if (nocUsdPrice <= 0) return null;
  const whole = Number(nocLamports / LAMPORTS_PER_NOC);
  const frac = Number(nocLamports % LAMPORTS_PER_NOC) / 1e9;
  const usd = (whole + frac) * nocUsdPrice;
  return `$${usd.toFixed(usd < 0.01 ? 4 : 2)}`;
}

/** Reset price cache (for testing). */
export function _resetPriceCache(): void {
  _cachedPrice = 0;
  _cachedPriceAt = 0;
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
   * The rules live in core/fees/transferMarkup.ts (shared with the browser extension):
   * pre-TGE or an unknown TGE status → 0; zero-fee eligible or unknown eligibility → 0;
   * otherwise the base fee minus a staking discount, clamped to [0, 1].
   */
  getEffectiveFee(feeType: FeeType, stakingDiscount: number = 0): bigint {
    // The policy lives in core/fees/transferMarkup.ts, shared with the browser extension.
    const {tgeStatus, isZeroFeeEligible} = usePresaleStore.getState();
    const inputs = {tgeStatus, isZeroFeeEligible, stakingDiscount};
    // Decide free-or-charged before touching the base fee, as the app always did: a free
    // fee must not depend on the fee constants being readable.
    if (effectiveFee(0n, inputs).reason !== 'charged') return 0n;
    return effectiveFee(this._baseFee(feeType), inputs).lamports;
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

    const nocUsdPrice = useWalletStore.getState().nocUsdPrice;
    const usdLabel = amount > 0n ? feeToUsd(amount, nocUsdPrice) : null;

    return {amount, label, usdLabel, discountFraction: stakingDiscount, discountLabel};
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _exhaustive: never = feeType;
        return 0n;
      }
    }
  }
}

export const feeEngine = new FeeEngineManager();

export {FEE_DISTRIBUTION, SHIELDED_FEES, TRANSPARENT_FEES};
export type {FeeDisplayInfo, FeeType};
