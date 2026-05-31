// ---- BN254 field — side-effect-free crypto constants ----------------------
//
// This module deliberately imports NOTHING. It is the pure home for the BN254
// scalar field prime and field conversion used by both the Merkle tree and the
// shielded note crypto. Keeping it import-free means consumers (e.g.
// noteCrypto.ts) do not transitively pull in MMKV, network, or config side
// effects, so the encoding primitives stay pure and platform-independent.

/**
 * BN254 (alt_bn128) scalar field prime.
 * All Poseidon inputs MUST be valid field elements (< this prime).
 * Inputs >= F would be silently reduced by poseidon-lite, producing
 * a hash that differs from what the on-chain circuit computes with
 * explicit range checking.
 */
export const BN254_FIELD_PRIME = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
);

/**
 * Parse a big-endian hex string into a BN254 field element.
 * Throws if the value is not a canonical field element (>= F).
 */
export function toFieldElement(hex: string): bigint {
  const bn = BigInt('0x' + hex.padStart(64, '0'));
  if (bn >= BN254_FIELD_PRIME) {
    throw new Error(`Merkle: value is not a valid BN254 field element (>= F): 0x${hex.slice(0, 8)}...`);
  }
  return bn;
}
