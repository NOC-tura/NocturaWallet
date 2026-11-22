/** M1d spec §3.4: a non-main account's public data — read by address, never written into walletStore. */
const mockGetBalance = jest.fn<Promise<bigint>, [unknown, {toBase58(): string}]>();
const mockGetTokenAccounts = jest.fn();
jest.mock('../../solana/connection', () => ({getConnection: () => ({})}));
jest.mock('../../solana/queries', () => ({
  getBalance: (c: unknown, pk: {toBase58(): string}) => mockGetBalance(c, pk),
  getTokenAccounts: (c: unknown, pk: unknown) => mockGetTokenAccounts(c, pk),
}));
jest.mock('../../tokens/tokenModule', () => ({
  TokenManager: jest.fn().mockImplementation(() => ({
    fetchVerifiedList: jest.fn().mockResolvedValue([]),
    // the real rule: core + verified only — a pool token (an unknown mint) is NOT listed by it
    buildDisplayTokens: (accs: {mint: string; amount: string; decimals: number}[]) =>
      accs
        .filter(a => a.amount !== '0' && a.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
        .map(a => ({mint: a.mint, symbol: 'USDC', name: 'USD Coin', decimals: a.decimals, trust: 'core'})),
  })),
}));
const mockFetchMeta = jest.fn().mockResolvedValue({});
const mockSaveMeta = jest.fn();
jest.mock('../../tokens/tokenMetadata', () => ({
  fetchTokenMetadata: (m: string[]) => mockFetchMeta(m),
  fetchTokenMetadataDirect: (m: string[]) => mockFetchMeta(m),
  loadCachedMetadata: () => ({}),
  saveCachedMetadata: (m: unknown) => mockSaveMeta(m),
}));
const mockFeatures = {shielded: true};
jest.mock('../../../constants/features', () => ({isShieldedEnabled: () => mockFeatures.shielded}));

import {fetchAccountSnapshot} from '../accountSnapshot';
import {withPoolToken} from '../poolToken';
import {useWalletStore} from '../../../store/zustand/walletStore';
import {NOC_MINT} from '../../../constants/programs';
import {A0_TOKEN} from '../../shielded/a0/screenSupport';

const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

beforeEach(() => {
  mockFeatures.shielded = true;
  mockFetchMeta.mockClear();
  mockSaveMeta.mockClear();
  mockGetBalance.mockReset().mockResolvedValue(3_000_000n);
  mockGetTokenAccounts.mockReset().mockResolvedValue([
    {mint: USDC, owner: A3, amount: '1000000', decimals: 6, address: 'x1'},
    {mint: USDC, owner: A3, amount: '2500000', decimals: 6, address: 'x2'},
  ]);
});

it('reads the named address; sums a mint across token accounts; no NOC → "0"', async () => {
  const s = await fetchAccountSnapshot(A3);
  expect(mockGetBalance.mock.calls[0]![1].toBase58()).toBe(A3);
  expect(s.solBalance).toBe('3000000');
  expect(s.tokenBalances).toEqual({[USDC]: '3500000'});
  expect(s.nocBalance).toBe('0');
  // M1d: pre-existing, parked — buildDisplayTokens (shared with the main path's forceSync) emits one
  // entry per token ACCOUNT, so a mint held in two accounts lists twice. Not enshrined: only the set is asserted.
  expect(new Set(s.tokens.map(t => t.mint))).toEqual(new Set([USDC]));
});

it('NOC held → nocBalance is its sum', async () => {
  mockGetTokenAccounts.mockResolvedValue([{mint: NOC_MINT, owner: A3, amount: '5', decimals: 9, address: 'n'}]);
  expect((await fetchAccountSnapshot(A3)).nocBalance).toBe('5');
});

it('Review Focus 4: a failed read rejects — never a snapshot of zeros', async () => {
  mockGetBalance.mockRejectedValue(new Error('429'));
  await expect(fetchAccountSnapshot(A3)).rejects.toThrow('429');
  mockGetBalance.mockResolvedValue(1n);
  mockGetTokenAccounts.mockRejectedValue(new Error('timeout'));
  await expect(fetchAccountSnapshot(A3)).rejects.toThrow('timeout');
});

it('never writes walletStore (the main account\'s slot)', async () => {
  useWalletStore.setState({solBalance: '42', tokenBalances: {}, lastSyncedAt: null});
  await fetchAccountSnapshot(A3);
  expect(useWalletStore.getState().solBalance).toBe('42');
  expect(useWalletStore.getState().lastSyncedAt).toBeNull();
});

it('review r1 I1: never the Noctura backend\'s metadata proxy, never a metadata write (cached metadata only)', async () => {
  await fetchAccountSnapshot(A3);
  expect(mockFetchMeta).not.toHaveBeenCalled();
  expect(mockSaveMeta).not.toHaveBeenCalled();
  // the mmkvPublic side runs against the REAL TokenManager in accountSnapshotStorage.test.ts (review I3)
});

it('plan A11 (ruling C1): a held pool token is listed where private balances exist; not in a build without them', async () => {
  mockGetTokenAccounts.mockResolvedValue([{mint: A0_TOKEN.mint, owner: A3, amount: '8990000000', decimals: 9, address: 't'}]);
  const on = await fetchAccountSnapshot(A3);
  expect(on.tokens).toEqual([expect.objectContaining({mint: A0_TOKEN.mint, symbol: 'TEST', decimals: 9})]);
  expect(on.tokenBalances[A0_TOKEN.mint]).toBe('8990000000');
  mockFeatures.shielded = false;
  expect((await fetchAccountSnapshot(A3)).tokens).toEqual([]);
});

it('withPoolToken: only a non-zero pool balance, once, never twice', () => {
  const pool = {mint: A0_TOKEN.mint, symbol: 'TEST', name: 'x', decimals: 9, trust: 'unknown' as const};
  expect(withPoolToken({tokenBalances: {[A0_TOKEN.mint]: '0'}, tokens: []}, true).tokens).toEqual([]);
  expect(withPoolToken({tokenBalances: {}, tokens: []}, true).tokens).toEqual([]);
  expect(withPoolToken({tokenBalances: {[A0_TOKEN.mint]: '5'}, tokens: [pool]}, true).tokens).toEqual([pool]);
  expect(withPoolToken({tokenBalances: {[A0_TOKEN.mint]: '5'}, tokens: []}, false).tokens).toEqual([]);
  expect(withPoolToken({tokenBalances: {[A0_TOKEN.mint]: '5'}, tokens: []}, true).tokens).toHaveLength(1);
});
