import {bls12_381} from '@noble/curves/bls12-381.js';
import {encryptNote, tryDecryptNote} from '../noteEncryption';

const G1 = bls12_381.G1.Point;
function bytesToBigIntBE(b: Uint8Array): bigint {
  let a = 0n;
  for (const x of b) a = (a << 8n) | BigInt(x);
  return a;
}
// Recipient view PUBLIC key (48-B compressed G1) from a raw sk_view byte array.
function pubOf(sk: Uint8Array): Uint8Array {
  return G1.BASE.multiply(bytesToBigIntBE(sk) % G1.Fn.ORDER).toBytes(true);
}

const skA = new Uint8Array(32).fill(7);
const pubA = pubOf(skA);
const skB = new Uint8Array(32).fill(11);

describe('noteEncryption', () => {
  it('round-trips {amount, noteSecret} for the intended recipient; ct is 128 B', () => {
    const ct = encryptNote(pubA, 12345n, 999n);
    expect(ct.length).toBe(128);
    expect(tryDecryptNote(skA, ct)).toEqual({amount: 12345n, noteSecret: 999n});
  });

  it('returns null for a different recipient (trial-decrypt miss)', () => {
    expect(tryDecryptNote(skB, encryptNote(pubA, 5n, 5n))).toBeNull();
  });

  it('returns null on a one-bit tamper of the sealed region', () => {
    const ct = encryptNote(pubA, 5n, 5n);
    ct[100] ^= 1;
    expect(tryDecryptNote(skA, ct)).toBeNull();
  });

  it('returns null on wrong length and on an invalid ephemeral point', () => {
    expect(tryDecryptNote(skA, new Uint8Array(100))).toBeNull();
    const badR = encryptNote(pubA, 5n, 5n);
    badR.fill(0, 0, 48); // zero out R → invalid/degenerate point
    expect(tryDecryptNote(skA, badR)).toBeNull();
  });

  it('throws on a wrong-length recipient view key', () => {
    expect(() => encryptNote(new Uint8Array(47), 1n, 1n)).toThrow();
  });

  it('handles edge amounts 0 and 2^64-1', () => {
    for (const amt of [0n, 18446744073709551615n]) {
      const ct = encryptNote(pubA, amt, 42n);
      expect(tryDecryptNote(skA, ct)?.amount).toBe(amt);
    }
  });

  it('is deterministic when r + nonce are injected (golden-vector seam)', () => {
    const r = new Uint8Array(32).fill(3);
    const nonce = new Uint8Array(24).fill(9);
    const a = encryptNote(pubA, 7n, 8n, {r, nonce});
    const b = encryptNote(pubA, 7n, 8n, {r, nonce});
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    expect(Buffer.from(a.subarray(0, 48))).not.toEqual(Buffer.alloc(48));
    expect(Buffer.from(a.subarray(48, 72))).toEqual(Buffer.from(nonce));
  });
});
