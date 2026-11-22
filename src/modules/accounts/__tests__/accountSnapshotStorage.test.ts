/**
 * M1d review I3: against the REAL TokenManager (only the network and the RPC reads are stubbed), the
 * only mmkvPublic writes of a non-main snapshot are the global Jupiter verified list and its timestamp —
 * nothing about the account (its address, its mints, its balances).
 */
const mockGetBalance = jest.fn();
const mockGetTokenAccounts = jest.fn();
jest.mock('../../solana/connection', () => ({getConnection: () => ({})}));
jest.mock('../../solana/queries', () => ({
  getBalance: (c: unknown, pk: unknown) => mockGetBalance(c, pk),
  getTokenAccounts: (c: unknown, pk: unknown) => mockGetTokenAccounts(c, pk),
}));
const mockFetchMeta = jest.fn();
jest.mock('../../tokens/tokenMetadata', () => ({
  fetchTokenMetadata: (m: string[]) => mockFetchMeta(m),
  loadCachedMetadata: () => ({}),
  saveCachedMetadata: jest.fn(),
}));
jest.mock('../../../constants/features', () => ({isShieldedEnabled: () => true}));

import {fetchAccountSnapshot} from '../accountSnapshot';
import {mmkvPublic} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';
import {A0_TOKEN} from '../../shielded/a0/screenSupport';

const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const HELD = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

it('the Jupiter list is the ONLY mmkvPublic write; no value carries the account or a held mint', async () => {
  mockGetBalance.mockResolvedValue(3_000_000n);
  mockGetTokenAccounts.mockResolvedValue([
    {mint: HELD, owner: A3, amount: '1000000', decimals: 6, address: 'x1'},
    {mint: A0_TOKEN.mint, owner: A3, amount: '5', decimals: 9, address: 'x2'},
  ]);
  const realFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({json: () => Promise.resolve([{address: 'So11111111111111111111111111111111111111112'}])}) as unknown as typeof fetch;
  const before = new Map(mmkvPublic.getAllKeys().map(k => [k, mmkvPublic.getString(k) ?? String(mmkvPublic.getNumber(k))]));
  try {
    await fetchAccountSnapshot(A3);
  } finally {
    global.fetch = realFetch;
  }
  const after = new Map(mmkvPublic.getAllKeys().map(k => [k, mmkvPublic.getString(k) ?? String(mmkvPublic.getNumber(k))]));
  const changed = [...after.keys()].filter(k => before.get(k) !== after.get(k)).sort();
  expect(changed).toEqual([MMKV_KEYS.JUPITER_VERIFIED_AT, MMKV_KEYS.JUPITER_VERIFIED_LIST].sort()); // non-vacuous: the real write happened
  for (const v of after.values()) {
    expect(v).not.toContain(A3);
    expect(v).not.toContain(HELD);
    expect(v).not.toContain(A0_TOKEN.mint);
  }
  expect(mockFetchMeta).not.toHaveBeenCalled();
});
