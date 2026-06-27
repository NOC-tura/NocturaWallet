import {poseidon3, poseidon5} from 'poseidon-lite';
import {BN254_FIELD_PRIME} from '../merkle/field';

// ---- Domain separators (first input to each Poseidon) --------------------
// 0x01 = note commitment (poseidon5), 0x02 = nullifier (poseidon3),
// 0x05 = pk_recipient hash (poseidon3).
// Merkle node hashes are intentionally UNTAGGED (poseidon2) — already shipped.
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

const RECIPIENT_BYTES = 32;

/**
 * Bind a withdraw's recipient TOKEN ACCOUNT to a field element.
 * `recipientField = be(recipient_token_account[0:32]) mod F` — same plain
 * reduction as `mintHash`. The withdraw circuit takes this as a constrained
 * public input; the program rechecks `be(actual_destination) mod F` against it,
 * so a relayer cannot redirect funds (a controlled colliding address needs the
 * Ed25519 private key of a specific 256-bit value → ~2^254, infeasible).
 */
export function recipientField(recipient: Uint8Array): bigint {
  if (recipient.length !== RECIPIENT_BYTES) {
    throw new Error(`recipientField: expected 32 bytes, got ${recipient.length}`);
  }
  return bytesToBigIntBE(recipient) % BN254_FIELD_PRIME;
}

const DOMAIN_COMMITMENT = 0x01n;

export interface NoteCommitmentInput {
  /** Output of pkRecipientHash (already a field element). */
  pkRecipientHash: bigint;
  /** Amount in lamports (field element, < 2^64 << F). */
  amount: bigint;
  /** Output of mintHash (already reduced into the field). */
  mintHash: bigint;
  /** Blinding secret derived from sk_view (native); field element. */
  noteSecret: bigint;
}

/**
 * Note commitment: poseidon5(0x01, pkRecipientHash, amount, mintHash, noteSecret).
 * All inputs are validated as canonical field elements first.
 */
export function noteCommitment(input: NoteCommitmentInput): bigint {
  return poseidon5([
    DOMAIN_COMMITMENT,
    assertField(input.pkRecipientHash, 'pkRecipientHash'),
    assertField(input.amount, 'amount'),
    assertField(input.mintHash, 'mintHash'),
    assertField(input.noteSecret, 'noteSecret'),
  ]);
}

const DOMAIN_NULLIFIER = 0x02n;

export interface NullifierInput {
  /** Blinding secret derived from sk_view (native); field element. */
  noteSecret: bigint;
  /** Position of the note's commitment leaf in the Merkle tree. */
  leafIndex: number | bigint;
}

/**
 * Nullifier: poseidon3(0x02, noteSecret, leafIndex).
 * JS-computable from view material, enabling spent-note detection during scan.
 * Spend AUTHORIZATION is separate (ZK proof + native BLS sk_spend signature);
 * the nullifier is only the uniqueness tag bound to the note's tree position.
 */
export function nullifier(input: NullifierInput): bigint {
  return poseidon3([
    DOMAIN_NULLIFIER,
    assertField(input.noteSecret, 'noteSecret'),
    assertField(BigInt(input.leafIndex), 'leafIndex'),
  ]);
}
