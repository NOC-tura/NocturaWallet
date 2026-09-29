import {base64} from '@scure/base';

/**
 * What both sides of the envelope need and neither may own alone: the vault page (which writes
 * envelopes) and the background (which stores them, and may not import the vault). Plain data and
 * pure functions only — nothing here touches a key, a seed or storage.
 */

/** The most accounts an envelope may carry. */
export const MAX_ACCOUNTS = 100;
export const MAX_NAME_LENGTH = 32;

/**
 * The vault's Argon2id bounds (src/vault/envelope.ts PRODUCTION_KDF and KDF_CAP), copied for the
 * background; src/vault/__tests__/envelopeBounds.test.ts pins the copies to the originals.
 */
export const ENVELOPE_KDF_MIN = {m: 65536, t: 3, p: 1} as const;
export const ENVELOPE_KDF_MAX = {m: 1024 * 1024, t: 10, p: 4} as const;
/**
 * Decoded byte lengths of a well-formed v1 envelope (the vault's checkEnvelope): 16-byte salt, 12-byte
 * GCM IV, a ciphertext of at least one byte plus its 16-byte tag, a 32-byte key wrapped by AES-KW
 * (+8), a 32-byte PRF salt, a non-empty credential ID. Pinned to checkEnvelope by envelopeBounds.test.
 */
export const ENVELOPE_BYTES = {salt: 16, iv: 12, minCt: 17, wrapped: 40, prfSalt: 32, minCredentialId: 1} as const;

/** The decoded length of a strict (padded, RFC 4648) base64 string; null for anything else. */
export function b64Length(x: unknown): number | null {
  if (typeof x !== 'string') return null;
  try {
    return base64.decode(x).length;
  } catch {
    return null;
  }
}

// C0 and C1 controls, and the bidi embedding/override/isolate characters that can make an
// account name read as something else.
const FORBIDDEN_IN_NAME = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;

/** An account name as stored: trimmed, 1..MAX_NAME_LENGTH, no controls or bidi overrides. Null otherwise. */
export function cleanName(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const name = x.trim();
  if (name.length === 0 || name.length > MAX_NAME_LENGTH || FORBIDDEN_IN_NAME.test(name)) return null;
  return name;
}
