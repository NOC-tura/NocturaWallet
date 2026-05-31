import {poseidon3} from 'poseidon-lite';
import {BN254_FIELD_PRIME} from '../merkle/merkleModule';

// ---- Domain separators (first input to each Poseidon) --------------------
// 0x01 = note commitment, 0x02 = nullifier, 0x05 = pk_recipient hash.
// Merkle node hashes are intentionally UNTAGGED (poseidon2) — already shipped.
// DOMAIN_COMMITMENT / DOMAIN_NULLIFIER and poseidon5 are added in Tasks 4–5.
const DOMAIN_PK = 0x05n;

const PK_G1_BYTES = 48;

/**
 * Big-endian byte array -> BigInt. No reduction, no range check.
 * Endianness is fixed and canonical: byte[0] is most significant.
 */
export function bytesToBigIntBE(bytes: Uint8Array): bigint {
  let acc = 0n;
  for (let i = 0; i < bytes.length; i++) {
    acc = acc * 256n + BigInt(bytes[i]!);
  }
  return acc;
}

/** Throw if x is not a canonical BN254 field element (0 <= x < F). */
export function assertField(x: bigint, name: string): bigint {
  if (x < 0n || x >= BN254_FIELD_PRIME) {
    throw new Error(`noteCrypto: ${name} is not a valid BN254 field element`);
  }
  return x;
}

/**
 * Hash a 48-byte BLS12-381 G1 compressed public key to one field element.
 * Split big-endian into 24/24 halves (each < 2^192 < F, no reduction needed),
 * then poseidon3(0x05, pk_hi, pk_lo).
 */
export function pkRecipientHash(pkG1: Uint8Array): bigint {
  if (pkG1.length !== PK_G1_BYTES) {
    throw new Error(`pkRecipientHash: expected 48 bytes, got ${pkG1.length}`);
  }
  const pkHi = bytesToBigIntBE(pkG1.subarray(0, 24));
  const pkLo = bytesToBigIntBE(pkG1.subarray(24, 48));
  return poseidon3([DOMAIN_PK, pkHi, pkLo]);
}

const MINT_BYTES = 32;

/**
 * Hash a 32-byte Solana mint pubkey to a field element.
 * Big-endian -> BigInt -> mod F. Plain modular reduction (no Poseidon):
 * 32 bytes may exceed F, so reduction is mandatory.
 */
export function mintHash(mint: Uint8Array): bigint {
  if (mint.length !== MINT_BYTES) {
    throw new Error(`mintHash: expected 32 bytes, got ${mint.length}`);
  }
  return bytesToBigIntBE(mint) % BN254_FIELD_PRIME;
}
