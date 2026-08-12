import {
  fetchAnonymitySet,
  parseNextLeafIndex,
  readAnonymitySet,
} from '../poolState';
import {MERKLE_TREE_DISCRIMINATOR, MERKLE_TREE_SIZE} from '../merkleTreeAccount';

const MINT = 'AtjVK2z561wDYo5EvougJKAo9AJ4KdduxSbiF173aiAe';

const mockGetAccountInfo = jest.fn();
jest.mock('../../solana/connection', () => ({
  getConnection: () => ({getAccountInfo: mockGetAccountInfo}),
}));

/** A faithful MerkleTree account: real discriminator, real size, real u64 LE. */
const treeAccount = (nextLeafIndex: number, extraBytes = 0): Uint8Array => {
  const data = new Uint8Array(MERKLE_TREE_SIZE + extraBytes);
  data.set(MERKLE_TREE_DISCRIMINATOR.match(/../g)!.map(h => parseInt(h, 16)), 0);
  let n = BigInt(nextLeafIndex);
  for (let i = 0; i < 8; i++) { data[8 + i] = Number(n & 0xffn); n >>= 8n; }
  return data;
};

beforeEach(() => { mockGetAccountInfo.mockReset(); });


describe('parseNextLeafIndex', () => {
  it('reads next_leaf_index (u64 LE) after the 8-byte anchor discriminator', () => {
    // A 48-byte buffer with a zero discriminator used to satisfy this. It was
    // not an account, so the guards that catch a program-side layout change were
    // untestable through here — the same "mock that doesn't mirror the real
    // thing" defect found in the merkleSync fixture.
    expect(parseNextLeafIndex(treeAccount(5))).toBe(5);
  });
  it('throws on too-short account data', () => {
    expect(() => parseNextLeafIndex(new Uint8Array(8))).toThrow();
  });
  it('throws when the account is longer than the layout we parse', () => {
    expect(() => parseNextLeafIndex(treeAccount(5, 32))).toThrow(/layout/i);
  });
});
describe('readAnonymitySet — a layout change must not look like an RPC hiccup', () => {
  it('reports ok with the leaf count', async () => {
    mockGetAccountInfo.mockResolvedValue({data: treeAccount(5)});
    await expect(readAnonymitySet(MINT)).resolves.toEqual({status: 'ok', count: 5});
  });

  it('reports unavailable when the RPC fails', async () => {
    mockGetAccountInfo.mockRejectedValue(new Error('503 upstream'));
    await expect(readAnonymitySet(MINT)).resolves.toEqual({status: 'unavailable'});
  });

  it('reports unavailable when the account does not exist', async () => {
    mockGetAccountInfo.mockResolvedValue(null);
    await expect(readAnonymitySet(MINT)).resolves.toEqual({status: 'unavailable'});
  });

  it('reports INCOMPATIBLE — not unavailable — when the layout moved', async () => {
    // The distinction this whole change exists for. Collapsing it into
    // `unavailable` means a program redeploy that moves the layout is
    // indistinguishable from a network blip, and nobody looks.
    mockGetAccountInfo.mockResolvedValue({data: treeAccount(5, 32)});
    const r = await readAnonymitySet(MINT);
    expect(r.status).toBe('incompatible');
    expect((r as {reason: string}).reason).toMatch(/layout/i);
  });

  it('fetchAnonymitySet still returns null for both, so the screen is unchanged', async () => {
    mockGetAccountInfo.mockResolvedValue({data: treeAccount(5, 32)});
    await expect(fetchAnonymitySet(MINT)).resolves.toBeNull();
    mockGetAccountInfo.mockRejectedValue(new Error('503'));
    await expect(fetchAnonymitySet(MINT)).resolves.toBeNull();
  });
});
