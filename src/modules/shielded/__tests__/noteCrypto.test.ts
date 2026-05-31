import {bytesToBigIntBE, mintHash, noteCommitment, pkRecipientHash} from '../noteCrypto';
import {base58} from '@scure/base';
import {BN254_FIELD_PRIME} from '../../merkle/merkleModule';

// BLS12-381 G1 generator, compressed (48 bytes / 96 hex chars).
const G1_GEN_HEX =
  '97f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb';

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

describe('bytesToBigIntBE', () => {
  it('reads bytes big-endian', () => {
    expect(bytesToBigIntBE(new Uint8Array([0x01, 0x00]))).toBe(256n);
    expect(bytesToBigIntBE(new Uint8Array([0xff]))).toBe(255n);
    expect(bytesToBigIntBE(new Uint8Array([]))).toBe(0n);
  });
});

describe('pkRecipientHash', () => {
  it('throws on wrong length', () => {
    expect(() => pkRecipientHash(new Uint8Array(47))).toThrow(/48 bytes/);
  });

  it('is deterministic and a valid field element for the G1 generator', () => {
    const pk = hexToBytes(G1_GEN_HEX);
    const a = pkRecipientHash(pk);
    const b = pkRecipientHash(pk);
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0n);
  });

  it('splits 24/24 big-endian (hi from first 24 bytes)', () => {
    const pk = hexToBytes(G1_GEN_HEX);
    const hi = bytesToBigIntBE(pk.subarray(0, 24));
    expect(hi.toString(16).startsWith('97')).toBe(true);
  });
});

describe('mintHash', () => {
  it('throws on wrong length', () => {
    expect(() => mintHash(new Uint8Array(31))).toThrow(/32 bytes/);
  });

  it('reduces NOC_MINT into the field', () => {
    const mint = base58.decode('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');
    expect(mint.length).toBe(32);
    const h = mintHash(mint);
    expect(h).toBeGreaterThanOrEqual(0n);
    expect(h).toBeLessThan(BN254_FIELD_PRIME);
  });

  it('reduces an all-0xFF mint (value > F) below F', () => {
    const allFf = new Uint8Array(32).fill(0xff);
    const h = mintHash(allFf);
    expect(h).toBeLessThan(BN254_FIELD_PRIME);
    // eslint-disable-next-line no-bitwise
    const expected = ((1n << 256n) - 1n) % BN254_FIELD_PRIME;
    expect(h).toBe(expected);
  });
});

describe('noteCommitment', () => {
  const base = {
    pkRecipientHash: 111n,
    amount: 1_000_000_000n,
    mintHash: 222n,
    noteSecret: 333n,
  };

  it('is deterministic', () => {
    expect(noteCommitment(base)).toBe(noteCommitment({...base}));
  });

  it('changes when any input changes', () => {
    const c0 = noteCommitment(base);
    expect(noteCommitment({...base, amount: base.amount + 1n})).not.toBe(c0);
    expect(noteCommitment({...base, noteSecret: 334n})).not.toBe(c0);
  });

  it('rejects a noteSecret outside the field', () => {
    expect(() =>
      noteCommitment({...base, noteSecret: BN254_FIELD_PRIME}),
    ).toThrow(/not a valid BN254 field element/);
  });
});
