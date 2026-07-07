// ── Mocks (hoisted) ──────────────────────────────────────────────────────────
const mockMmkvStore = new Map<string, string>();
jest.mock('../../../store/mmkv/instances', () => ({
  mmkvPublic: {
    getString: (k: string) => mockMmkvStore.get(k),
    set: (k: string, v: string) => { mockMmkvStore.set(k, v); },
    remove: (k: string) => { mockMmkvStore.delete(k); },
  },
}));

const mockGetSignatures = jest.fn();
const mockGetTransaction = jest.fn();
const mockGetAccountInfo = jest.fn();
jest.mock('../../solana/connection', () => ({
  getConnection: () => ({
    getSignaturesForAddress: mockGetSignatures,
    getTransaction: mockGetTransaction,
    getAccountInfo: mockGetAccountInfo,
  }),
}));

import {parseRootHistory, densifyLeaves, syncLeaves} from '../merkleSync';

const hex = (n: number) => n.toString(16).padStart(64, '0');
const MINT = 'AtjVK2z561wDYo5EvougJKAo9AJ4KdduxSbiF173aiAe';

// Build a `LeafInserted` Program-data log line: disc(8) + commitment[32] + leaf_index(u64 LE) + root[32].
function leafLog(commitmentHex: string, leafIndex: number): string {
  const buf = Buffer.alloc(8 + 32 + 8 + 32);
  Buffer.from(commitmentHex, 'hex').copy(buf, 8);
  buf.writeUInt32LE(leafIndex, 8 + 32);
  return `Program data: ${buf.toString('base64')}`;
}
const rootHistoryAccount = () => ({data: Buffer.alloc(1296 + 64 * 32 + 8)});

// ── parseRootHistory ─────────────────────────────────────────────────────────
describe('parseRootHistory', () => {
  it('reads the 64 roots at offset 1296 (disc+next_leaf_index+zeros+filled_subtrees)', () => {
    const OFFSET = 8 + 8 + 640 + 640; // = 1296
    const data = Buffer.alloc(OFFSET + 64 * 32 + 8);
    Buffer.from(hex(42), 'hex').copy(data, OFFSET + 2 * 32);
    const roots = parseRootHistory(data);
    expect(roots.length).toBe(64);
    expect(roots[2]).toBe(hex(42));
    expect(roots[0]).toBe('0'.repeat(64));
  });
  it('throws when the account is too small', () => {
    expect(() => parseRootHistory(Buffer.alloc(100))).toThrow();
  });
});

// ── densifyLeaves ────────────────────────────────────────────────────────────
describe('densifyLeaves', () => {
  it('produces a contiguous [0..max] array', () => {
    const m = new Map([[0, 'a'], [1, 'b'], [2, 'c']]);
    expect(densifyLeaves(m)).toEqual(['a', 'b', 'c']);
  });
  it('returns [] for an empty map', () => {
    expect(densifyLeaves(new Map())).toEqual([]);
  });
  it('throws on a gap, even when a duplicate index inflates the map', () => {
    // indices {0,1,3}: 2 is missing; max=3 catches it (size-based would not).
    const m = new Map([[0, 'a'], [1, 'b'], [3, 'd']]);
    expect(() => densifyLeaves(m)).toThrow(/gap/i);
  });
});

// ── syncLeaves (incremental) ─────────────────────────────────────────────────
describe('syncLeaves incremental cache', () => {
  beforeEach(() => {
    mockMmkvStore.clear();
    jest.clearAllMocks();
    mockGetAccountInfo.mockResolvedValue(rootHistoryAccount());
    mockGetTransaction.mockImplementation(async (sig: string) => {
      const map: Record<string, string> = {
        sigA: leafLog(hex(10), 0),
        sigB: leafLog(hex(11), 1),
        sigC: leafLog(hex(12), 2),
      };
      return {meta: {err: null, logMessages: [map[sig]!]}};
    });
  });

  it('first sync scans full history and caches leaves + newest signature', async () => {
    // newest-first: sigB (leaf1) then sigA (leaf0)
    mockGetSignatures.mockResolvedValueOnce([
      {signature: 'sigB', err: null},
      {signature: 'sigA', err: null},
    ]);
    const {leaves} = await syncLeaves(MINT);
    expect(leaves).toEqual([hex(10), hex(11)]);
    // first call has no `until`
    expect(mockGetSignatures.mock.calls[0]![1].until).toBeUndefined();
    // cache persisted with lastSig = newest = sigB
    const cache = JSON.parse(mockMmkvStore.get('shielded.syncCache.' + MINT)!);
    expect(cache.leaves).toEqual([hex(10), hex(11)]);
    expect(cache.lastSig).toBe('sigB');
  });

  it('second sync fetches only NEW signatures (until=lastSig) and appends', async () => {
    // Seed the cache as if the first sync already ran.
    mockMmkvStore.set('shielded.syncCache.' + MINT, JSON.stringify({leaves: [hex(10), hex(11)], lastSig: 'sigB'}));
    mockGetSignatures.mockResolvedValueOnce([{signature: 'sigC', err: null}]);
    const {leaves} = await syncLeaves(MINT);
    expect(leaves).toEqual([hex(10), hex(11), hex(12)]);
    // incremental: called with until = the cached lastSig
    expect(mockGetSignatures.mock.calls[0]![1].until).toBe('sigB');
    // only the new tx was fetched
    expect(mockGetTransaction).toHaveBeenCalledTimes(1);
    expect(mockGetTransaction).toHaveBeenCalledWith('sigC', expect.anything());
    // cache advanced to sigC
    const cache = JSON.parse(mockMmkvStore.get('shielded.syncCache.' + MINT)!);
    expect(cache.lastSig).toBe('sigC');
  });

  it('no new signatures → returns cached leaves unchanged', async () => {
    mockMmkvStore.set('shielded.syncCache.' + MINT, JSON.stringify({leaves: [hex(10), hex(11)], lastSig: 'sigB'}));
    mockGetSignatures.mockResolvedValueOnce([]);
    const {leaves} = await syncLeaves(MINT);
    expect(leaves).toEqual([hex(10), hex(11)]);
    expect(mockGetTransaction).not.toHaveBeenCalled();
  });
});
