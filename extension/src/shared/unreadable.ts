import {base64} from '@scure/base';

/**
 * B1e §2.1: whether a stored `v1_vault` value is UNREADABLE — a value no version of Noctura can open. A vault this
 * version refuses (a newer `v`, a KDF cost or an account list outside today's policy) is readable here.
 *
 * Frozen at B1e rev 2; never edited — a later envelope format gets its own rule in a new module; tightening the
 * opener's policy never touches this file. It imports only @scure/base (a source test pins the list), so it can never
 * reach the opener's bounds (src/shared/envelopeRules.ts, src/vault/envelope.ts). Its constants are v1's algorithms:
 * the Argon2id salt, the AES-GCM IV and tag, AES-KW of a 32-byte key, the PRF salt.
 */
const FROZEN_VERSION = 1;
const FROZEN_KDF_ALG = 'argon2id';
const FROZEN_SALT_BYTES = 16;
const FROZEN_IV_BYTES = 12;
const FROZEN_MIN_CT_BYTES = 17;
const FROZEN_WRAPPED_BYTES = 40;
const FROZEN_MIN_CREDENTIAL_ID_BYTES = 1;
const FROZEN_PRF_SALT_BYTES = 32;

type Json = Record<string, unknown>;
const isObject = (x: unknown): x is Json => typeof x === 'object' && x !== null && !Array.isArray(x);
const isSafeInt = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x);

/** The decoded length of strict (padded, RFC 4648) base64 — the codec every v1 writer used; null for anything else. */
function decodedLength(x: unknown): number | null {
  if (typeof x !== 'string') return null;
  try {
    return base64.decode(x).length;
  } catch {
    return null;
  }
}
const bytesExactly = (x: unknown, n: number): boolean => decodedLength(x) === n;
const bytesAtLeast = (x: unknown, n: number): boolean => (decodedLength(x) ?? -1) >= n;

/** U3: a v1 value whose structure no v1 writer could have produced. Bounds and policy are not structure. */
function brokenV1(raw: Json): boolean {
  if (typeof raw.scheme !== 'string') return true;
  const {kdf, seed, password, passkey, accounts} = raw;
  if (!isObject(kdf) || kdf.alg !== FROZEN_KDF_ALG || !isSafeInt(kdf.m) || !isSafeInt(kdf.t) || !isSafeInt(kdf.p)) return true;
  if (!bytesExactly(kdf.salt, FROZEN_SALT_BYTES)) return true;
  if (!isObject(seed) || !bytesExactly(seed.iv, FROZEN_IV_BYTES) || !bytesAtLeast(seed.ct, FROZEN_MIN_CT_BYTES)) return true;
  if (!isObject(password) || !bytesExactly(password.wrapped, FROZEN_WRAPPED_BYTES)) return true;
  if (passkey !== undefined) {
    if (!isObject(passkey)) return true;
    if (!bytesAtLeast(passkey.credentialId, FROZEN_MIN_CREDENTIAL_ID_BYTES)) return true;
    if (!bytesExactly(passkey.prfSalt, FROZEN_PRF_SALT_BYTES) || !bytesExactly(passkey.wrapped, FROZEN_WRAPPED_BYTES)) return true;
  }
  if (!Array.isArray(accounts)) return true;
  return accounts.some((a: unknown) => !isObject(a) || !isSafeInt(a.index) || a.index < 0 || typeof a.name !== 'string' || typeof a.publicKey !== 'string');
}

/**
 * False for `undefined` (no wallet). True exactly when U1 (not an object), U2 (no safe integer version ≥ 1) or U3 (a
 * broken v1 structure; only for `v === 1` — this version cannot judge the structure of a later one) holds.
 */
export function unreadableV1(raw: unknown): boolean {
  if (raw === undefined) return false;
  if (!isObject(raw)) return true;
  if (!isSafeInt(raw.v) || raw.v < 1) return true;
  return raw.v === FROZEN_VERSION && brokenV1(raw);
}
