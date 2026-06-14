import {estimatePriorityFee} from '../priorityFee';

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
});
