import {parseTokenAmount} from '../../utils/parseTokenAmount';
import type {TransferIntent} from '../../types/transfer';

const SOL_HIGH_VALUE_LAMPORTS = 5_000_000_000n; // 5 SOL
const HIGH_VALUE_PERCENT = 5n; // > 5% of the sent token's balance

export const TYPED_CONFIRM_SENTINEL = 'CONFIRM';

export interface HighValueResult {
  highValue: boolean;
  percentOfBalance: number; // floored integer for display; 0 when balance is zero/unknown
}

/**
 * A transfer is high-value when it moves > 5% of the sent token's balance, or
 * (for SOL) more than 5 SOL outright. SPL balances are keyed by mint.
 */
export function isHighValueTransfer(
  intent: TransferIntent,
  balances: {solBalance: bigint; tokenBalances: Record<string, bigint>},
): HighValueResult {
  const amount = parseTokenAmount(intent.amount, intent.decimals);
  const isSol = intent.tokenMint === 'native';
  const balance = isSol
    ? balances.solBalance
    : balances.tokenBalances[intent.tokenMint] ?? 0n;
  const overPercent = balance > 0n && amount * 100n > balance * HIGH_VALUE_PERCENT;
  const overAbsolute = isSol && amount > SOL_HIGH_VALUE_LAMPORTS;
  const percentOfBalance = balance > 0n ? Number((amount * 100n) / balance) : 0;
  return {highValue: overPercent || overAbsolute, percentOfBalance};
}

/** First-6 / last-6 of a base58 address for accent (`.ck`) highlighting. */
export function formatChecksumParts(address: string): {head: string; tail: string} {
  if (address.length <= 12) return {head: address, tail: ''};
  return {head: address.slice(0, 6), tail: address.slice(-6)};
}
