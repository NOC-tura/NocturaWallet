import {estimatePriorityFee} from '../priorityFee';
import {RpcForbidden} from '../rpc';

describe('estimatePriorityFee and the coordinator', () => {
  it('an ordinary failure still yields the floor (positive control)', async () => {
    expect(await estimatePriorityFee({getRecentPrioritizationFees: async () => Promise.reject(new Error('timeout'))}, 'normal')).toBe(50_000);
  });

  it('a 403 is not swallowed', async () => {
    await expect(estimatePriorityFee({getRecentPrioritizationFees: async () => Promise.reject(new RpcForbidden('getRecentPrioritizationFees'))}, 'normal')).rejects.toBeInstanceOf(RpcForbidden);
  });
});
