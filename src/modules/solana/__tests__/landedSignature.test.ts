import {findLandedSignature} from '../landedSignature';

const SIG_A = 'sigA';
const SIG_B = 'sigB';

function conn(statuses: Record<string, unknown>) {
  return {
    getSignatureStatus: jest.fn(async (sig: string) => ({value: statuses[sig] ?? null})),
  } as never;
}

describe('findLandedSignature', () => {
  it('returns null when nothing was ever broadcast', async () => {
    expect(await findLandedSignature(conn({}), [])).toBeNull();
  });

  it('returns null when no prior attempt landed', async () => {
    expect(await findLandedSignature(conn({[SIG_A]: null}), [SIG_A])).toBeNull();
  });

  it('finds a confirmed prior attempt so Retry does not double-send', async () => {
    // The user tapped Retry after a timeout, but the first broadcast DID land.
    // Re-broadcasting here would move the money twice.
    const c = conn({[SIG_A]: {confirmationStatus: 'confirmed', err: null, slot: 42}});
    expect(await findLandedSignature(c, [SIG_A])).toEqual({signature: SIG_A, slot: 42});
  });

  it('accepts a finalized attempt', async () => {
    const c = conn({[SIG_A]: {confirmationStatus: 'finalized', err: null, slot: 7}});
    expect(await findLandedSignature(c, [SIG_A])).toEqual({signature: SIG_A, slot: 7});
  });

  it('does NOT treat a landed-but-failed tx as landed', async () => {
    // err set means the tx is on-chain but reverted: no funds moved, so a retry
    // is legitimate and must not be blocked.
    const c = conn({[SIG_A]: {confirmationStatus: 'confirmed', err: {InstructionError: [0, {}]}, slot: 9}});
    expect(await findLandedSignature(c, [SIG_A])).toBeNull();
  });

  it('ignores a merely processed tx (not yet confirmed)', async () => {
    const c = conn({[SIG_A]: {confirmationStatus: 'processed', err: null, slot: 3}});
    expect(await findLandedSignature(c, [SIG_A])).toBeNull();
  });

  it('checks every prior signature, not just the newest', async () => {
    const c = conn({
      [SIG_A]: {confirmationStatus: 'confirmed', err: null, slot: 5},
      [SIG_B]: null,
    });
    expect(await findLandedSignature(c, [SIG_A, SIG_B])).toEqual({signature: SIG_A, slot: 5});
  });

  it('propagates nothing and returns null when the RPC throws', async () => {
    // Fail-safe direction: an RPC failure must not let us claim a tx landed.
    const c = {
      getSignatureStatus: jest.fn(async () => {
        throw new Error('rpc down');
      }),
    } as never;
    expect(await findLandedSignature(c, [SIG_A])).toBeNull();
  });
});
