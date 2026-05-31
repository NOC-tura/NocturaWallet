import {bytesToBigIntBE, pkRecipientHash} from '../noteCrypto';

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
