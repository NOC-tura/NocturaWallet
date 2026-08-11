jest.mock('../poolPdas', () => ({
  poolPda: () => ({toBase58: () => 'PoolPda1111111111111111111111111111111111'}),
  merkleTreePda: () => ({toBase58: () => 'OurTree11111111111111111111111111111111111'}),
}));
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

import {parseRootHistory, densifyLeaves, syncLeaves, mergeLeafEvents, assertLeafSetMatchesChain} from '../merkleSync';
import {EVENT_DISC} from '../eventLogs';

const POOL_PROG = 'NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES';
const OUR_TREE = 'OurTree11111111111111111111111111111111111';
/** A tx whose top-level instruction targets the pool program and lists our tree. */
function poolTx(...lines: string[]) {
  return {
    meta: {
      err: null,
      logMessages: [`Program ${POOL_PROG} invoke [1]`, ...lines, `Program ${POOL_PROG} success`],
      loadedAddresses: null,
    },
    transaction: {
      message: {
        staticAccountKeys: [POOL_PROG, OUR_TREE],
        compiledInstructions: [{programIdIndex: 0, accountKeyIndexes: [1]}],
      },
    },
  };
}



const hex = (n: number) => n.toString(16).padStart(64, '0');
const MINT = 'AtjVK2z561wDYo5EvougJKAo9AJ4KdduxSbiF173aiAe';

// Build a `LeafInserted` Program-data log line: disc(8) + commitment[32] + leaf_index(u64 LE) + root[32].
function leafLog(commitmentHex: string, leafIndex: number): string {
  const buf = Buffer.alloc(8 + 32 + 8 + 32);
  Buffer.from(EVENT_DISC.leafInserted, 'hex').copy(buf, 0);
  Buffer.from(commitmentHex, 'hex').copy(buf, 8);
  buf.writeUInt32LE(leafIndex, 8 + 32);
  return `Program data: ${buf.toString('base64')}`;
}
/**
 * A root_history account whose ring contains `roots`. syncLeaves now asserts the
 * rebuilt root is on chain, so a sync fixture must attest its own leaf set.
 */
const rootHistoryAccount = (...roots: string[]) => {
  // Faithful to a real account: exact size AND the MerkleTree discriminator.
  // Without the discriminator this fixture was not the thing production reads,
  // and the guards that catch a program-side layout change would have been
  // untestable through syncLeaves.
  const data = Buffer.alloc(1296 + 64 * 32 + 8);
  Buffer.from('623333e2a21449d4', 'hex').copy(data, 0);
  roots.forEach((r, i) => Buffer.from(r, 'hex').copy(data, 1296 + i * 32));
  return {data};
};

/** The root the production merkle code derives for `leaves`. */
const rootOf = (leaves: string[]): string =>
  (jest.requireActual('../../merkle/merkleModule') as typeof import('../../merkle/merkleModule'))
    .computeMerklePath(leaves, 0).root;

// ── parseRootHistory ─────────────────────────────────────────────────────────
describe('parseRootHistory', () => {
  // sha256('account:MerkleTree')[0..8], confirmed against the live devnet account
  // 5wUcszpMDY9skjrL85daN9dmhfHwJTcffkX29eZwMwrR (3352 bytes).
  const DISC = '623333e2a21449d4';
  const OFFSET = 8 + 8 + 640 + 640; // = 1296
  const SIZE = OFFSET + 64 * 32 + 2 + 6; // = 3352, head:u16 + 6 pad

  const account = (size = SIZE, disc = DISC): Buffer => {
    const data = Buffer.alloc(size);
    Buffer.from(disc, 'hex').copy(data, 0);
    return data;
  };

  it('reads the 64 roots at offset 1296 (disc+next_leaf_index+zeros+filled_subtrees)', () => {
    const data = account();
    Buffer.from(hex(42), 'hex').copy(data, OFFSET + 2 * 32);
    const roots = parseRootHistory(data);
    expect(roots.length).toBe(64);
    expect(roots[2]).toBe(hex(42));
    expect(roots[0]).toBe('0'.repeat(64));
  });

  it('rejects an account that is LONGER than the known layout', () => {
    // The one that matters. A shorter account already failed; a longer one used
    // to succeed and return 64 plausible 32-byte values read from the wrong
    // offset. The A0 program change is expected to alter this layout, and this
    // must break loudly at that moment rather than mis-parse.
    expect(() => parseRootHistory(account(SIZE + 32))).toThrow(/layout/i);
  });

  it('rejects an account with a different discriminator', () => {
    expect(() => parseRootHistory(account(SIZE, '0011223344556677'))).toThrow(
      /discriminator/i,
    );
  });

  it('rejects an account that is too small', () => {
    expect(() => parseRootHistory(account(100))).toThrow(/layout/i);
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
      return poolTx(map[sig]!);
    });
  });

  it('first sync scans full history and caches leaves + newest signature', async () => {
    // newest-first: sigB (leaf1) then sigA (leaf0)
    mockGetSignatures.mockResolvedValueOnce([
      {signature: 'sigB', err: null},
      {signature: 'sigA', err: null},
    ]);
    mockGetAccountInfo.mockResolvedValue(rootHistoryAccount(rootOf([hex(10), hex(11)])));
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
    mockGetAccountInfo.mockResolvedValue(rootHistoryAccount(rootOf([hex(10), hex(11), hex(12)])));
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
    mockGetAccountInfo.mockResolvedValue(rootHistoryAccount(rootOf([hex(10), hex(11)])));
    const {leaves} = await syncLeaves(MINT);
    expect(leaves).toEqual([hex(10), hex(11)]);
    expect(mockGetTransaction).not.toHaveBeenCalled();
  });
});

describe('mergeLeafEvents — conflict detection', () => {
  it('accepts a repeated index carrying the SAME commitment', () => {
    const byIndex = new Map<number, string>();
    mergeLeafEvents(byIndex, [
      {commitment: 'aa', leafIndex: 0},
      {commitment: 'aa', leafIndex: 0},
    ]);
    expect(byIndex.get(0)).toBe('aa');
  });

  it('THROWS on the same index with a DIFFERENT commitment', () => {
    // Last-write-wins is what made a contaminated tree pass verification by
    // luck: whichever leaf 0 was iterated last silently won. A collision means
    // the leaf set is not ours — fail closed rather than pick one.
    const byIndex = new Map<number, string>();
    expect(() =>
      mergeLeafEvents(byIndex, [
        {commitment: 'aa', leafIndex: 0},
        {commitment: 'bb', leafIndex: 0},
      ]),
    ).toThrow(/conflict/i);
  });

  it('detects a conflict against already-cached leaves', () => {
    const byIndex = new Map<number, string>([[0, 'aa']]);
    expect(() =>
      mergeLeafEvents(byIndex, [{commitment: 'bb', leafIndex: 0}]),
    ).toThrow(/conflict/i);
  });
});

describe('assertLeafSetMatchesChain — the invariant that catches everything', () => {
  it('accepts a leaf set whose root is in the on-chain ring', () => {
    const {computeMerklePath} = jest.requireActual('../../merkle/merkleModule');
    const leaves = [hex(1), hex(2), hex(3)];
    const {root} = computeMerklePath(leaves, 0);
    expect(() => assertLeafSetMatchesChain(leaves, ['deadbeef', root])).not.toThrow();
  });

  it('REJECTS a contaminated leaf set whose root is absent from the ring', () => {
    // This is what catches contamination regardless of HOW it got in: a foreign
    // pool's leaf, a forged event, a dropped legacy leaf, or a variant neither
    // side has thought of. Strictly stronger than any scoping rule.
    const leaves = [hex(1), hex(99), hex(3)]; // leaf 1 swapped
    expect(() => assertLeafSetMatchesChain(leaves, ['deadbeef'])).toThrow(/root/i);
  });

  it('does not fire on an empty pool', () => {
    expect(() => assertLeafSetMatchesChain([], [])).not.toThrow();
  });
});
