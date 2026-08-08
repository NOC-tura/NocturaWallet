import type {Connection} from '@solana/web3.js';

export type PriorityLevel = 'normal' | 'fast' | 'urgent';

/** Percentile of recent network fees per tier. */
const PERCENTILE: Record<PriorityLevel, number> = {normal: 50, fast: 75, urgent: 90};
/** Minimum micro-lamports/CU per tier — guarantees non-zero priority when the
 *  network is quiet (a 0-fee tx can still be dropped). */
const FLOOR: Record<PriorityLevel, number> = {
  normal: 50_000,
  fast: 150_000,
  urgent: 500_000,
};

/**
 * Largest compute-unit limit any transparent send path requests
 * (see sendTransaction.ts: 1_000 SOL / 40_000 SPL / 65_000 SPL+createAta).
 * Used to bound the worst-case priority cost.
 */
export const MAX_COMPUTE_UNITS = 65_000;

/**
 * Absolute ceiling on the priority component of a single transfer (lamports).
 * 0.005 SOL. The priority fee is `price * CU / 1e6`, and `price` comes straight
 * from the RPC — an unbounded value lets a malicious or compromised RPC drain
 * the balance through fees without ever needing the signing key.
 */
export const MAX_PRIORITY_FEE_LAMPORTS = 5_000_000;

/**
 * Maximum micro-lamports/CU per tier. Chosen well above real congestion pricing
 * so legitimate sends are never throttled, and far below the value needed to
 * make the fee itself material. The invariant
 * `CEILING * MAX_COMPUTE_UNITS / 1e6 <= MAX_PRIORITY_FEE_LAMPORTS`
 * is enforced by priorityFee.test.ts.
 */
export const CEILING: Record<PriorityLevel, number> = {
  normal: 20_000_000,
  fast: 40_000_000,
  urgent: 76_000_000,
};

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx]!;
}

/**
 * Compute-unit price (micro-lamports/CU) for a tier: the per-tier percentile of
 * recent prioritization fees, floored to a per-tier minimum and clamped to a
 * per-tier ceiling. Never throws — an RPC failure returns the floor so the send
 * proceeds.
 *
 * The RPC is untrusted: non-finite and negative samples are discarded, and the
 * result is clamped, so no RPC response can inflate the fee without bound.
 */
export async function estimatePriorityFee(
  connection: Connection,
  level: PriorityLevel,
): Promise<number> {
  try {
    const recent = await connection.getRecentPrioritizationFees();
    const fees = recent
      .map(r => r.prioritizationFee)
      .filter(f => Number.isFinite(f) && f >= 0)
      .sort((a, b) => a - b);
    const estimate = Math.max(percentile(fees, PERCENTILE[level]), FLOOR[level]);
    return Math.min(estimate, CEILING[level]);
  } catch {
    return FLOOR[level];
  }
}
