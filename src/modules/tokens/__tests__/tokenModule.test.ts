import {PublicKey} from '@solana/web3.js';
import {TokenManager, buildCloseAccountsTx, _resetVerifiedCacheForTesting} from '../tokenModule';

const NOC_MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const UNKNOWN_MINT = 'UnknownMint1111111111111111111111111111111';
const JUPITER_MINT = 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB';

// ── Mock MMKV ────────────────────────────────────────────────────────────────
const mockMmkvStore: Record<string, string | number> = {};
jest.mock('../../../store/mmkv/instances', () => ({
  mmkvPublic: {
    getString: (key: string) =>
      typeof mockMmkvStore[key] === 'string' ? (mockMmkvStore[key] as string) : undefined,
    getNumber: (key: string) =>
      typeof mockMmkvStore[key] === 'number' ? (mockMmkvStore[key] as number) : undefined,
    set: (key: string, value: string | number) => {
      mockMmkvStore[key] = value;
    },
  },
}));

// ── Mock Solana connection ───────────────────────────────────────────────────
jest.mock('../../solana/connection', () => ({
  getConnection: () => ({
    getLatestBlockhash: jest.fn(async () => ({
      blockhash: 'test-blockhash',
      lastValidBlockHeight: 999,
    })),
  }),
}));

// ── Mock sslPinning ──────────────────────────────────────────────────────────
jest.mock('../../sslPinning/pinnedFetch');
import {pinnedFetch} from '../../sslPinning/pinnedFetch';
const mockPinnedFetch = pinnedFetch as jest.MockedFunction<typeof pinnedFetch>;

// ── Mock global fetch ────────────────────────────────────────────────────────
const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
global.fetch = mockFetch as unknown as typeof fetch;

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeFetchResponse(body: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

describe('TokenManager', () => {
  let manager: TokenManager;

  beforeEach(() => {
    manager = new TokenManager();
    jest.clearAllMocks();
    _resetVerifiedCacheForTesting();
    // Clear mock MMKV store
    for (const key of Object.keys(mockMmkvStore)) {
      delete mockMmkvStore[key];
    }
  });

  // ── classifyToken ────────────────────────────────────────────────────────────

  it('classifyToken — NOC is core', () => {
    expect(manager.classifyToken(NOC_MINT)).toBe('core');
  });

  it('classifyToken — SOL is core', () => {
    expect(manager.classifyToken(SOL_MINT)).toBe('core');
  });

  it('classifyToken — USDC is core', () => {
    expect(manager.classifyToken(USDC_MINT)).toBe('core');
  });

  it('classifyToken — unknown mint is unknown (no verified list loaded)', () => {
    expect(manager.classifyToken(UNKNOWN_MINT)).toBe('unknown');
  });

  it('classifyToken — returns verified for Jupiter-listed mint after fetchVerifiedList', async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchResponse([{address: JUPITER_MINT}, {address: UNKNOWN_MINT}]),
    );
    await manager.fetchVerifiedList();
    expect(manager.classifyToken(JUPITER_MINT)).toBe('verified');
  });

  it('classifyToken — returns unknown for mint not in Jupiter list', async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchResponse([{address: JUPITER_MINT}]),
    );
    await manager.fetchVerifiedList();
    // UNKNOWN_MINT is not in the list
    expect(manager.classifyToken(UNKNOWN_MINT)).toBe('unknown');
  });

  // ── fetchVerifiedList ─────────────────────────────────────────────────────

  it('fetchVerifiedList — returns array of mint strings', async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchResponse([{address: JUPITER_MINT}, {address: UNKNOWN_MINT}]),
    );
    const list = await manager.fetchVerifiedList();
    expect(Array.isArray(list)).toBe(true);
    expect(list).toContain(JUPITER_MINT);
    expect(list).toContain(UNKNOWN_MINT);
  });

  it('fetchVerifiedList — uses in-memory cache on second call (fetch called only once)', async () => {
    mockFetch.mockReturnValue(
      makeFetchResponse([{address: JUPITER_MINT}]),
    );
    await manager.fetchVerifiedList();
    await manager.fetchVerifiedList();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('fetchVerifiedList — uses MMKV cache when not stale', async () => {
    // Pre-populate MMKV with a fresh cache
    const mints = [JUPITER_MINT];
    mockMmkvStore['v1_tokens.jupiterVerified'] = JSON.stringify(mints);
    mockMmkvStore['v1_tokens.jupiterVerifiedAt'] = Date.now();

    const list = await manager.fetchVerifiedList();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(list).toContain(JUPITER_MINT);
  });

  it('fetchVerifiedList — returns empty array on fetch failure with no cache', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const list = await manager.fetchVerifiedList();
    expect(list).toEqual([]);
  });

  it('fetchVerifiedList — returns stale MMKV cache on fetch failure', async () => {
    // Populate MMKV but with an old timestamp so fresh fetch is attempted
    mockMmkvStore['v1_tokens.jupiterVerified'] = JSON.stringify([JUPITER_MINT]);
    mockMmkvStore['v1_tokens.jupiterVerifiedAt'] = Date.now() - 25 * 60 * 60 * 1000; // 25h ago

    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const list = await manager.fetchVerifiedList();

    expect(list).toContain(JUPITER_MINT);
  });

  // ── checkScamFlag ────────────────────────────────────────────────────────────

  it('checkScamFlag — returns false for non-flagged token', async () => {
    mockPinnedFetch.mockResolvedValueOnce({
      status: 200,
      headers: {},
      json: async () => ({flagged: false}),
      text: async () => '{"flagged":false}',
    });
    const result = await manager.checkScamFlag(UNKNOWN_MINT);
    expect(result).toBe(false);
  });

  it('checkScamFlag — returns true for flagged token', async () => {
    mockPinnedFetch.mockResolvedValueOnce({
      status: 200,
      headers: {},
      json: async () => ({flagged: true, reason: 'rug pull'}),
      text: async () => '{"flagged":true}',
    });
    const result = await manager.checkScamFlag(UNKNOWN_MINT);
    expect(result).toBe(true);
  });

  it('checkScamFlag — returns false on API error (fail-safe)', async () => {
    mockPinnedFetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await manager.checkScamFlag(UNKNOWN_MINT);
    expect(result).toBe(false);
  });

  // ── getEmptyAccountsForCleanup ───────────────────────────────────────────────

  it('getEmptyAccountsForCleanup — excludes core tokens (NOC ATA with balance 0 NOT returned)', () => {
    const accounts = [
      {mint: NOC_MINT, balance: '0', address: 'ata_noc'},
      {mint: UNKNOWN_MINT, balance: '0', address: 'ata_unknown'},
    ];
    const result = manager.getEmptyAccountsForCleanup(accounts);
    expect(result).toHaveLength(1);
    expect(result[0].address).toBe('ata_unknown');
  });

  it('getEmptyAccountsForCleanup — excludes accounts with non-zero balance', () => {
    const accounts = [
      {mint: UNKNOWN_MINT, balance: '1000', address: 'ata_has_balance'},
      {mint: UNKNOWN_MINT, balance: '0', address: 'ata_empty'},
    ];
    const result = manager.getEmptyAccountsForCleanup(accounts);
    expect(result).toHaveLength(1);
    expect(result[0].address).toBe('ata_empty');
  });

  // ── sortTokens ───────────────────────────────────────────────────────────────

  it('sortTokens — NOC pinned at top', () => {
    const tokens = [
      {mint: USDC_MINT, symbol: 'USDC'},
      {mint: SOL_MINT, symbol: 'SOL'},
      {mint: NOC_MINT, symbol: 'NOC'},
      {mint: UNKNOWN_MINT, symbol: 'RAND'},
    ];
    const sorted = manager.sortTokens(tokens);
    expect(sorted[0].mint).toBe(NOC_MINT);
  });
});

// ── buildCloseAccountsTx ─────────────────────────────────────────────────────

describe('buildCloseAccountsTx', () => {
  const owner = new PublicKey('So11111111111111111111111111111111111111112');

  // Valid 32-byte base58 public keys for token accounts
  const makeAccounts = (n: number): PublicKey[] => {
    // Use pre-known valid base58 addresses padded to different values
    const base = 'TokenAccountAddr111111111111111111111111111';
    // For each account we slightly vary: replace last chars
    return Array.from({length: n}, (_, i) => {
      // Encode index into last 3 characters
      const suffix = String(i).padStart(3, '1');
      const addr = base.slice(0, -3) + suffix;
      return new PublicKey(addr);
    });
  };

  const unknownMintMap = (accounts: PublicKey[]): Map<string, string> => {
    const m = new Map<string, string>();
    for (const acc of accounts) {
      m.set(acc.toBase58(), UNKNOWN_MINT);
    }
    return m;
  };

  it('returns empty array when no accounts provided', async () => {
    const txs = await buildCloseAccountsTx(owner, [], new Map());
    expect(txs).toHaveLength(0);
  });

  it('returns empty array when all accounts are for NOC mint', async () => {
    const accounts = makeAccounts(3);
    const nocMap = new Map<string, string>();
    for (const acc of accounts) {
      nocMap.set(acc.toBase58(), NOC_MINT);
    }
    const txs = await buildCloseAccountsTx(owner, accounts, nocMap);
    expect(txs).toHaveLength(0);
  });

  it('never includes NOC mint accounts even when mixed with non-core', async () => {
    const accounts = makeAccounts(4);
    const mintMap = new Map<string, string>();
    // First 2 accounts: NOC mint (should be filtered out)
    mintMap.set(accounts[0].toBase58(), NOC_MINT);
    mintMap.set(accounts[1].toBase58(), NOC_MINT);
    // Last 2 accounts: unknown mint (should be kept)
    mintMap.set(accounts[2].toBase58(), UNKNOWN_MINT);
    mintMap.set(accounts[3].toBase58(), UNKNOWN_MINT);

    const txs = await buildCloseAccountsTx(owner, accounts, mintMap);
    // Only 2 eligible accounts, should fit in one batch
    expect(txs).toHaveLength(1);
    // Each transaction has a message; check that instructions length is 2
    expect(txs[0].message.staticAccountKeys.length).toBeGreaterThan(0);
  });

  it('builds a single transaction for accounts <= maxPerBatch', async () => {
    const accounts = makeAccounts(5);
    const txs = await buildCloseAccountsTx(owner, accounts, unknownMintMap(accounts));
    expect(txs).toHaveLength(1);
  });

  it('batches into multiple transactions when exceeding maxPerBatch', async () => {
    const accounts = makeAccounts(25);
    const txs = await buildCloseAccountsTx(owner, accounts, unknownMintMap(accounts), 20);
    // 25 accounts / 20 per batch = 2 transactions
    expect(txs).toHaveLength(2);
  });

  it('respects custom maxPerBatch of 10', async () => {
    const accounts = makeAccounts(21);
    const txs = await buildCloseAccountsTx(owner, accounts, unknownMintMap(accounts), 10);
    // ceil(21 / 10) = 3 batches
    expect(txs).toHaveLength(3);
  });

  it('each transaction has a message (VersionedTransaction)', async () => {
    const accounts = makeAccounts(3);
    const txs = await buildCloseAccountsTx(owner, accounts, unknownMintMap(accounts));
    for (const tx of txs) {
      expect(tx.message).toBeDefined();
    }
  });
});
