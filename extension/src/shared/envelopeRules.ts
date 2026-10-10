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

// B1b-2b C19 (review L5, L8): every Unicode control (Cc) and format (Cf) character, by category under the `u` flag \u2014
// the C0/C1 controls, the soft hyphen U+00AD, the zero-width spaces and joiners U+200B\u2013U+200F, U+2060\u2013U+2064, the BOM
// U+FEFF, U+061C, U+180E, the tag characters \u2014 the bidi embeddings, overrides and isolates (Cf too, named for the
// reader), and two invisible marks of category Mn: the combining grapheme joiner U+034F and the variation selectors
// U+FE00\u2013U+FE0F. "Mo\u200bm" renders as "Mom"; a name may not. For contact names and account names alike. Names are not
// otherwise normalised: cross-script look-alikes ("\u0412inance" with a Cyrillic \u0412) pass \u2014 C19's stated limit.
// Task 2 fix round 1: the line and paragraph separators (Zl U+2028, Zp U+2029) too — a name is one line.
const FORBIDDEN_IN_NAME = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u034f\ufe00-\ufe0f\u202a-\u202e\u2066-\u2069]/u;

/** A name as stored (an account's, a contact's): trimmed, 1..MAX_NAME_LENGTH, no control or format character (C19). Null otherwise. */
export function cleanName(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const name = x.trim();
  if (name.length === 0 || name.length > MAX_NAME_LENGTH || FORBIDDEN_IN_NAME.test(name)) return null;
  return name;
}

/**
 * The POLICY rules an envelope's account list must obey, on top of being well-shaped (an index is a
 * safe non-negative integer, a publicKey is a string — each side's own job: the vault's checkEnvelope,
 * the background's envelopeShape). Review fix round 1, item 1: the background's envelopeShape
 * (src/background/accountsStore.ts) checked these and the vault page's checkEnvelope
 * (src/vault/envelope.ts) did not, so the page called a wallet what the background called
 * stored-invalid. One predicate, shared: at least one and at most MAX_ACCOUNTS accounts, no two
 * accounts sharing an index, no empty publicKey, and a cli wallet is exactly account 0 — never more,
 * never a different index. Operates on an account list already validated field-by-field by the
 * caller; this is the one list of extra rules both sides must apply identically on top of that.
 */
export function accountsPolicyOk(scheme: 'slip10' | 'cli', accounts: readonly {index: number; publicKey: string}[]): boolean {
  if (accounts.length === 0 || accounts.length > MAX_ACCOUNTS) return false;
  const seen = new Set<number>();
  for (const a of accounts) {
    if (a.publicKey === '') return false;
    if (seen.has(a.index)) return false;
    seen.add(a.index);
  }
  return scheme !== 'cli' || (accounts.length === 1 && accounts[0]?.index === 0);
}
