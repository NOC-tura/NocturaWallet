/**
 * Whether a purchase may be submitted, and why not when it may not.
 *
 * Moved here from the Android app's PresaleScreen on 2026-09-21, unchanged, because the web
 * had no equivalent at all: it would let a $5 purchase be signed and the PROGRAM would reject
 * it, so the user paid a signature and a fee to be told something the page already knew.
 *
 * THE LIMITS ARE NOT CONSTANTS IN THE PROGRAM — they are fields in its config account, and
 * the program falls back to a constant only when the field is zero. Read from mainnet
 * 2026-09-21 (config PDA 8MwasPrRzsCDuH78PJSDdWhdjFXT15MX7pHs3iE4b7Gx), with the known
 * tge_timestamp offset used as a control that the decoding was right:
 *
 *   min_purchase_usd  = 1000 cents  → $10   (an admin set this; the program's own
 *                                            PRESALE_MIN_PURCHASE_USD constant is $25)
 *   max_per_user_usd  = 0           → falls back to PRESALE_MAX_PURCHASE_USD = $50,000
 *
 * So $10 is right today because someone changed it on chain, not because the program says so.
 * If a purchase inside these bounds ever fails with BelowMinimumPurchase, re-read the config
 * before touching anything here — the number moved, this file did not.
 */

/**
 * SOL held back for the network fee. Without it the "spend everything" path builds a
 * transaction that cannot pay for itself, which fails after the user has already signed.
 */
export const FEE_HEADROOM_SOL = 0.001;

export const MIN_PURCHASE_USD = 10;
export const MAX_PURCHASE_USD = 50_000;

export type PaymentToken = 'SOL' | 'USDC' | 'USDT';

export interface PurchaseGateInput {
  paymentToken: PaymentToken;
  amount: string;
  solUsd: number;
  solBalance: number;
  /** Display units of the selected stablecoin. Ignored for SOL. */
  tokenBalance: number;
}

export interface PurchaseGate {
  enabled: boolean;
  /**
   * null when there is simply nothing to say yet — an empty or zero amount is not an error,
   * and telling someone their empty field is wrong before they have typed is nagging.
   */
  reason: string | null;
}

export function canBuy({
  paymentToken,
  amount,
  solUsd,
  solBalance,
  tokenBalance,
}: PurchaseGateInput): PurchaseGate {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return {enabled: false, reason: null};
  }
  // Stablecoins are 1:1 USD; SOL converts via the live price.
  const usdValue = paymentToken === 'SOL' ? amt * solUsd : amt;
  if (usdValue < MIN_PURCHASE_USD) {
    return {enabled: false, reason: `Minimum $${MIN_PURCHASE_USD}`};
  }
  if (usdValue > MAX_PURCHASE_USD) {
    return {enabled: false, reason: `Maximum $${MAX_PURCHASE_USD.toLocaleString('en-US')} per transaction`};
  }
  if (paymentToken === 'SOL') {
    if (amt + FEE_HEADROOM_SOL > solBalance) {
      return {enabled: false, reason: 'Insufficient SOL balance'};
    }
  } else {
    if (amt > tokenBalance) {
      return {enabled: false, reason: `Insufficient ${paymentToken} balance`};
    }
    if (solBalance < FEE_HEADROOM_SOL) {
      return {enabled: false, reason: 'Need a little SOL for the network fee'};
    }
  }
  return {enabled: true, reason: null};
}
