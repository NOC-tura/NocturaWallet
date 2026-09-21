import {PublicKey} from '@solana/web3.js';
import {
  ALLOCATION_TOTAL_TOKENS_OFFSET,
  CONFIG_TGE_TIMESTAMP_OFFSET,
  derivePresalePdas,
  fetchOnChainAllocation,
  fetchTgeTimestamp,
  readU64LE,
} from '../allocation';

const USER = new PublicKey('Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B');
const readerFor = (data: Uint8Array | null) => ({getAccountInfo: async () => (data ? {data} : null)});

function withU64At(value: bigint, at: number, length: number): Uint8Array {
  const buf = new Uint8Array(length);
  let v = value;
  for (let i = 0; i < 8; i++) {
    buf[at + i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

describe('presale allocation readers', () => {
  it('derives four distinct PDAs, deterministically', () => {
    const a = derivePresalePdas(USER);
    const b = derivePresalePdas(USER);
    expect(a.userAllocation.toBase58()).toBe(b.userAllocation.toBase58());
    expect(
      new Set([a.config, a.userAccount, a.userAllocation, a.referrerAllocation].map(k => k.toBase58())).size,
    ).toBe(4);
  });

  it('derives the referrer allocation from the default pubkey, which is what B1 expects', () => {
    const pdas = derivePresalePdas(USER);
    const forDefault = derivePresalePdas(PublicKey.default);
    expect(pdas.referrerAllocation.toBase58()).toBe(forDefault.userAllocation.toBase58());
  });

  it('decodes u64 little-endian by hand, across the whole range', () => {
    // buffer@5.7.1 — what React Native ships — has no readBigUInt64LE. The tidy
    // accessor works in Node and throws on a phone, which is why this is a loop.
    expect(readU64LE(withU64At(0n, 0, 8), 0)).toBe(0n);
    expect(readU64LE(withU64At(1_234_000_000_000n, 0, 8), 0)).toBe(1_234_000_000_000n);
    expect(readU64LE(withU64At(2n ** 64n - 1n, 0, 8), 0)).toBe(2n ** 64n - 1n);
  });

  it('reads total_tokens at offset 40', async () => {
    const data = withU64At(1_234_000_000_000n, ALLOCATION_TOTAL_TOKENS_OFFSET, ALLOCATION_TOTAL_TOKENS_OFFSET + 8);
    expect(await fetchOnChainAllocation(readerFor(data), USER)).toEqual({
      totalTokensBase: '1234000000000',
      exists: true,
    });
  });

  it('reports absence rather than zero when the account is missing', async () => {
    expect(await fetchOnChainAllocation(readerFor(null), USER)).toEqual({
      totalTokensBase: '0',
      exists: false,
    });
  });

  it('reports absence when the account is too short to hold the field', async () => {
    const short = new Uint8Array(ALLOCATION_TOTAL_TOKENS_OFFSET);
    expect((await fetchOnChainAllocation(readerFor(short), USER)).exists).toBe(false);
  });

  it('reads tge_timestamp at offset 201 — the real on-chain value', async () => {
    const data = withU64At(1_893_456_000n, CONFIG_TGE_TIMESTAMP_OFFSET, CONFIG_TGE_TIMESTAMP_OFFSET + 8);
    expect(await fetchTgeTimestamp(readerFor(data))).toBe(1_893_456_000);
  });

  it('returns null when the config account is missing or too short', async () => {
    expect(await fetchTgeTimestamp(readerFor(null))).toBeNull();
    // Separate from the zero case on purpose: with a wrong offset BOTH would return
    // null, and a single test could not tell the two apart.
    expect(await fetchTgeTimestamp(readerFor(new Uint8Array(8)))).toBeNull();
  });

  it('returns null for an unset timestamp — not 0, which would count from 1970', async () => {
    const zeroed = new Uint8Array(CONFIG_TGE_TIMESTAMP_OFFSET + 8);
    expect(await fetchTgeTimestamp(readerFor(zeroed))).toBeNull();
  });

  it('still returns a real timestamp — the null above is not a blanket null', async () => {
    const data = withU64At(1n, CONFIG_TGE_TIMESTAMP_OFFSET, CONFIG_TGE_TIMESTAMP_OFFSET + 8);
    expect(await fetchTgeTimestamp(readerFor(data))).toBe(1);
  });
});
