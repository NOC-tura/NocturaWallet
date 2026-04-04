import {TokenManager} from '../tokenModule';

const NOC_MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const UNKNOWN_MINT = 'UnknownMint1111111111111111111111111111111';

jest.mock('../../sslPinning/pinnedFetch');

import {pinnedFetch} from '../../sslPinning/pinnedFetch';

const mockPinnedFetch = pinnedFetch as jest.MockedFunction<typeof pinnedFetch>;

describe('TokenManager', () => {
  let manager: TokenManager;

  beforeEach(() => {
    manager = new TokenManager();
    jest.clearAllMocks();
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

  it('classifyToken — unknown mint is unknown', () => {
    expect(manager.classifyToken(UNKNOWN_MINT)).toBe('unknown');
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
