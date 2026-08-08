import {
  CEILING,
  MAX_COMPUTE_UNITS,
  MAX_PRIORITY_FEE_LAMPORTS,
  estimatePriorityFee,
} from '../priorityFee';

function conn(fees: number[]) {
  return {
    getRecentPrioritizationFees: jest.fn(async () =>
      fees.map((f, i) => ({slot: i, prioritizationFee: f})),
    ),
  } as never;
}

describe('estimatePriorityFee', () => {
  it('returns the floor when recent fees are all zero', async () => {
    expect(await estimatePriorityFee(conn([0, 0, 0, 0]), 'normal')).toBe(50_000);
    expect(await estimatePriorityFee(conn([0, 0, 0, 0]), 'fast')).toBe(150_000);
    expect(await estimatePriorityFee(conn([0, 0, 0, 0]), 'urgent')).toBe(500_000);
  });

  it('returns the network percentile when it exceeds the floor', async () => {
    const fees = new Array(100).fill(1_000_000);
    expect(await estimatePriorityFee(conn(fees), 'normal')).toBe(1_000_000);
  });

  it('falls back to the floor on RPC error', async () => {
    const c = {getRecentPrioritizationFees: jest.fn(async () => { throw new Error('rpc'); })} as never;
    expect(await estimatePriorityFee(c, 'fast')).toBe(150_000);
  });

  it('clamps a hostile RPC fee to the per-tier ceiling', async () => {
    // A malicious/compromised RPC reports a fee that would drain the balance:
    // 1.6e10 uL/CU x 65_000 CU / 1e6 = ~1 SOL of priority fee.
    const drain = new Array(100).fill(16_000_000_000);
    expect(await estimatePriorityFee(conn(drain), 'normal')).toBe(CEILING.normal);
    expect(await estimatePriorityFee(conn(drain), 'fast')).toBe(CEILING.fast);
    expect(await estimatePriorityFee(conn(drain), 'urgent')).toBe(CEILING.urgent);
  });

  it('falls back to the floor when every reported fee is non-finite', async () => {
    const hostile = [Number.POSITIVE_INFINITY, Number.NaN, Number.POSITIVE_INFINITY];
    expect(await estimatePriorityFee(conn(hostile), 'normal')).toBe(50_000);
  });

  it('ignores negative fees reported by the RPC', async () => {
    // Only the -1 samples are dropped; the real 1_000_000 samples still price it.
    const hostile = [-1, -1, -1, 1_000_000, 1_000_000];
    expect(await estimatePriorityFee(conn(hostile), 'normal')).toBe(1_000_000);
  });

  it('keeps the worst-case priority cost per tier under the absolute cap', async () => {
    // CU limit is at most MAX_COMPUTE_UNITS across every transparent send path.
    for (const level of ['normal', 'fast', 'urgent'] as const) {
      const lamports = (CEILING[level] * MAX_COMPUTE_UNITS) / 1_000_000;
      expect(lamports).toBeLessThanOrEqual(MAX_PRIORITY_FEE_LAMPORTS);
    }
  });
});
