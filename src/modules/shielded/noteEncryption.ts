import {bls12_381} from '@noble/curves/bls12-381.js';
import {hkdf} from '@noble/hashes/hkdf.js';
import {sha256} from '@noble/hashes/sha2.js';
import {xchacha20poly1305} from '@noble/ciphers/chacha.js';
import {bytesToBigIntBE} from './noteCrypto';

const G1 = bls12_381.G1.Point;
// Domain tag — versions the scheme (a change here invalidates all ciphertexts).
const INFO = new TextEncoder().encode('noctura-note-enc-v1');

const VIEW_KEY_BYTES = 48;
const R_LEN = 48;
const NONCE_LEN = 24;
const SEALED_LEN = 56; // 40 payload + 16 tag
const CT_LEN = R_LEN + NONCE_LEN + SEALED_LEN; // 128
const PAYLOAD_LEN = 40; // amount(8 LE) + noteSecret(32 BE)

// Exported so callers needing a non-recoverable filler of the same length/CSPRNG
// (e.g. withdrawFlow's 0-change memo) reuse this exact source instead of a new one.
export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/**
 * BLS12-381 scalar from arbitrary bytes: big-endian → reduce mod the curve order.
 * NOTE: an EIP-2333 sk_view is already < ORDER, so this reduction is a no-op for
 * real secrets — it only normalises the ephemeral `r` bytes. If a future key path
 * could produce sk ≥ ORDER, revisit (noble's pubkey path rejects such keys).
 */
function scalarFromBytes(bytes: Uint8Array): bigint {
  return bytesToBigIntBE(bytes) % G1.Fn.ORDER;
}

/** u64 little-endian (8 bytes) — matches the pool's amount encoding. */
function u64le(v: bigint): Uint8Array {
  const out = new Uint8Array(8);
  let x = v;
  for (let i = 0; i < 8; i++) { out[i] = Number(x & 0xffn); x >>= 8n; }
  return out;
}
function u64leToBigInt(b: Uint8Array): bigint {
  let acc = 0n;
  for (let i = 7; i >= 0; i--) acc = (acc << 8n) | BigInt(b[i]!);
  return acc;
}
/** 32-byte big-endian from a bigint (the noteSecret field element). */
function be32(v: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let x = v;
  for (let i = 31; i >= 0; i--) { out[i] = Number(x & 0xffn); x >>= 8n; }
  return out;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

export interface DecryptedNote { amount: bigint; noteSecret: bigint; }

/** Test-only seam: inject the ephemeral scalar bytes + nonce for deterministic
 *  golden vectors. PRODUCTION MUST NOT pass these — both default to CSPRNG. */
export interface EncryptOpts { r?: Uint8Array; nonce?: Uint8Array; }

/**
 * ECIES-encrypt a note's {amount, noteSecret} to a recipient's 48-byte compressed
 * BLS12-381 G1 view key (the noc1… address point). Returns exactly 128 bytes:
 * R(48) ‖ nonce(24) ‖ XChaCha20-Poly1305(payload 40 + tag 16). See the design spec.
 */
export function encryptNote(
  recipientViewKeyG1: Uint8Array,
  amount: bigint,
  noteSecret: bigint,
  opts: EncryptOpts = {},
): Uint8Array {
  if (recipientViewKeyG1.length !== VIEW_KEY_BYTES) {
    throw new Error(`recipient view key must be ${VIEW_KEY_BYTES} bytes`);
  }
  // Reject out-of-range sender inputs so we never silently encrypt a truncated
  // value (be32/u64le would wrap). A real note amount is u64 and a noteSecret is a
  // field element (< 2^256), so this only catches caller bugs.
  if (amount < 0n || amount >> 64n) throw new Error('amount out of u64 range');
  if (noteSecret < 0n || noteSecret >> 256n) throw new Error('noteSecret exceeds 32 bytes');
  const P = G1.fromBytes(recipientViewKeyG1); // throws on an invalid point (bad address)
  // Reject the identity point: S = P·r would be the identity for any r, yielding a
  // key an observer can derive (a "no real recipient" address). fromBytes already
  // enforces subgroup membership; only the neutral element needs an explicit reject.
  if (P.is0()) throw new Error('recipient view key is the identity point');
  const r = scalarFromBytes(opts.r ?? randomBytes(32));
  const Rbytes = G1.BASE.multiply(r).toBytes(true);
  const Sbytes = P.multiply(r).toBytes(true);
  const key = hkdf(sha256, Sbytes, Rbytes, INFO, 32);
  const nonce = opts.nonce ?? randomBytes(NONCE_LEN);
  if (nonce.length !== NONCE_LEN) throw new Error(`nonce must be ${NONCE_LEN} bytes`);
  const sealed = xchacha20poly1305(key, nonce).encrypt(concatBytes(u64le(amount), be32(noteSecret)));
  return concatBytes(Rbytes, nonce, sealed);
}

/**
 * Trial-decrypt a 128-byte note ciphertext with the recipient's BLS view secret.
 * Returns the note on success, or null for any foreign/garbage input (wrong length,
 * invalid ephemeral point, or AEAD auth failure) — NEVER throws, so a scanner can
 * call it on every ciphertext it sees.
 */
export function tryDecryptNote(skView: Uint8Array, ct: Uint8Array): DecryptedNote | null {
  if (ct.length !== CT_LEN) return null;
  const Rbytes = ct.subarray(0, R_LEN);
  const nonce = ct.subarray(R_LEN, R_LEN + NONCE_LEN);
  const sealed = ct.subarray(R_LEN + NONCE_LEN, CT_LEN);
  let R: InstanceType<typeof G1>;
  try {
    R = G1.fromBytes(Rbytes);
  } catch {
    return null;
  }
  // Identity R would make S = R·sk the identity for EVERY sk → a key any attacker
  // knows → a crafted ciphertext that "decrypts" for every recipient (forced-note
  // spam). Reject so a successful decrypt is trustworthy for the scanner.
  if (R.is0()) return null;
  const Sbytes = R.multiply(scalarFromBytes(skView)).toBytes(true);
  const key = hkdf(sha256, Sbytes, Rbytes, INFO, 32);
  let payload: Uint8Array;
  try {
    payload = xchacha20poly1305(key, nonce).decrypt(sealed);
  } catch {
    return null;
  }
  if (payload.length !== PAYLOAD_LEN) return null;
  return {
    amount: u64leToBigInt(payload.subarray(0, 8)),
    noteSecret: bytesToBigIntBE(payload.subarray(8, 40)),
  };
}
