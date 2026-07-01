import {sha256} from '@noble/hashes/sha2.js';
import {deriveSecureStorageKey} from '../secureStorageKey';

describe('deriveSecureStorageKey', () => {
  const seed = new Uint8Array(64).map((_v, i) => (i * 7 + 1) & 0xff);
  it('is the first 16 bytes of sha256(seed || domain) as hex (32 chars)', () => {
    const domain = new TextEncoder().encode('noctura-secure-mmkv-v1');
    const material = new Uint8Array(seed.length + domain.length);
    material.set(seed); material.set(domain, seed.length);
    const h = sha256(material);
    let expected = '';
    for (let i = 0; i < 16; i++) expected += h[i]!.toString(16).padStart(2, '0');
    expect(deriveSecureStorageKey(seed)).toBe(expected);
    expect(deriveSecureStorageKey(seed)).toHaveLength(32);
  });
  it('is deterministic + differs for a different seed', () => {
    expect(deriveSecureStorageKey(seed)).toBe(deriveSecureStorageKey(seed));
    const other = new Uint8Array(64).fill(9);
    expect(deriveSecureStorageKey(other)).not.toBe(deriveSecureStorageKey(seed));
  });
});
