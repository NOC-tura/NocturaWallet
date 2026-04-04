/**
 * Key derivation paths — IMMUTABLE. Changing these breaks all existing wallets.
 *
 * Transparent (Ed25519): standard Solana BIP-44 via @scure/bip32
 * Shielded (BLS12-381): Noctura EIP-2333 via micro-key-producer/bls.js
 *   - Coin type 371 is an internal Noctura convention (not registered in SLIP-0044)
 *   - EIP-2333 indices are implicitly hardened (no apostrophes)
 *
 * ⛔ sk_spend (m/12381/371/1/0) is NEVER derived in JavaScript.
 *    It exists only in native code (BLST via iOS CryptoKit / Android KeyStore).
 *    The path constant is exported for documentation only.
 */

// Ed25519 — @scure/bip32
export const TRANSPARENT_PATH = "m/44'/501'/0'/0'" as const;

// BLS12-381 — micro-key-producer/bls.js (EIP-2333)
export const SHIELDED_PATHS = {
  /** ⛔ NATIVE ONLY — never derive in JS. Exported for documentation. */
  spend: 'm/12381/371/1/0',
  /** ✓ JS allowed — read-only view key for note decryption */
  view: 'm/12381/371/2/0',
  /** ✓ JS allowed — ephemeral disclosure keys for proving assets */
  disclosure: (index: number) => `m/12381/371/3/${index}`,
} as const;
