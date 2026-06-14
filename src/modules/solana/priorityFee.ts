import type {Connection} from '@solana/web3.js';

export type PriorityLevel = 'normal' | 'fast' | 'urgent';

/** Percentile of recent network fees per tier. */
const PERCENTILE: Record<PriorityLevel, number> = {normal: 50, fast: 75, urgent: 90};
/** Minimum micro-lamports/CU per tier — guarantees non-zero priority when the
 *  network is quiet (a 0-fee tx can still be dropped). */
const FLOOR: Record<PriorityLevel, number> = {
  normal: 10_000,
  fast: 50_000,
  urgent: 150_000,
};

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx];
}

/**
 * Compute-unit price (micro-lamports/CU) for a tier: the per-tier percentile of
 * recent prioritization fees, floored to a per-tier minimum. Never throws —
 * an RPC failure returns the floor so the send proceeds.
 */
export async function estimatePriorityFee(
  connection: Connection,
  level: PriorityLevel,
): Promise<number> {
  try {
    const recent = await connection.getRecentPrioritizationFees();
    const fees = recent.map(r => r.prioritizationFee).sort((a, b) => a - b);
    return Math.max(percentile(fees, PERCENTILE[level]), FLOOR[level]);
  } catch {
    return FLOOR[level];
  }
}
