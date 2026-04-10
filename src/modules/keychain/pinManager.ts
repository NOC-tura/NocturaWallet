import {pbkdf2Async} from '@noble/hashes/pbkdf2.js';
import {sha512} from '@noble/hashes/sha2.js';

/**
 * PBKDF2-HMAC-SHA512 iteration count.
 * OWASP 2023: minimum 210,000 for SHA-512 (600,000 is for SHA-256).
 * Pure JS on mobile (Hermes) is ~100x slower than native crypto.subtle.
 * 210K SHA-512 on mobile ≈ 5-10s (acceptable for PIN setup, not per-unlock).
 */
export const PIN_ITERATIONS = 210_000;

/** Output key length in bytes (SHA-512 output = 64 bytes) */
const KEY_LENGTH = 64;

/** Salt length in bytes */
const SALT_LENGTH = 32;

/**
 * Generate a cryptographically random salt for PIN hashing.
 * Salt is stored in keychain (NOT MMKV) alongside the PIN hash.
 */
export function generateSalt(): Uint8Array {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Hash a PIN using PBKDF2-HMAC-SHA512 with the given salt.
 * Returns a 64-byte derived key.
 */
export async function hashPin(
  pin: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  return pbkdf2Async(sha512, pin, salt, {
    c: PIN_ITERATIONS,
    dkLen: KEY_LENGTH,
  });
}

/**
 * Verify a PIN against a stored hash.
 * Uses constant-time comparison to prevent timing attacks.
 */
export async function verifyPin(
  pin: string,
  salt: Uint8Array,
  storedHash: Uint8Array,
): Promise<boolean> {
  const computed = await hashPin(pin, salt);

  // Constant-time comparison (XOR-based, no early return)
  if (computed.length !== storedHash.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed[i] ^ storedHash[i];
  }
  return diff === 0;
}
