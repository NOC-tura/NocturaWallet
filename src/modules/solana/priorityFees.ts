import type {Connection} from '@solana/web3.js';
import type {PriorityLevel} from './types';
import {PRIORITY_PERCENTILES} from './types';

/**
 * Get priority fee in microlamports for a given priority level.
 * Fallback: getRecentPrioritizationFees → compute percentile locally.
 * Normal (50th): ~5-15s. Fast (75th): ~2-5s. Urgent (90th): near-instant.
 */
export async function getPriorityFee(
  connection: Connection,
  level: PriorityLevel = 'normal',
): Promise<number> {
  const percentile = PRIORITY_PERCENTILES[level];
  try {
    const recentFees = await connection.getRecentPrioritizationFees();
    if (recentFees.length === 0) return 0;
    const sorted = recentFees.map(f => f.prioritizationFee).sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * (sorted.length - 1));
    return sorted[index];
  } catch {
    const defaults: Record<PriorityLevel, number> = {normal: 1_000, fast: 10_000, urgent: 100_000};
    return defaults[level];
  }
}
