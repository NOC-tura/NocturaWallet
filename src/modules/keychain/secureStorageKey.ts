import {sha256} from '@noble/hashes/sha2.js';

/**
 * Deterministic encryption key for the secure (encrypted) MMKV note store,
 * derived from the BIP-39 seed: first 16 bytes of sha256(seed || domain), hex.
 * Same value across sessions → notes persist + decrypt; recoverable from the
 * mnemonic. Shared by the app-wide init (unlock/onboarding) and the deposit-flow
 * safety net so both open the SAME store.
 */
export function deriveSecureStorageKey(seed: Uint8Array): string {
  const domain = new TextEncoder().encode('noctura-secure-mmkv-v1');
  const material = new Uint8Array(seed.length + domain.length);
  material.set(seed);
  material.set(domain, seed.length);
  const hash = sha256(material);
  let keyHex = '';
  for (let i = 0; i < 16; i++) {
    keyHex += hash[i]!.toString(16).padStart(2, '0');
  }
  return keyHex;
}
