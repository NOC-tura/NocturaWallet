import {b64, unb64, utf8, assertArrayBufferBacked} from './bytes';

/**
 * The vault on disk: the seed encrypted once with a random data key (AES-256-GCM), and the
 * data key wrapped once per unlock factor — password through Argon2id, passkey through PRF
 * and HKDF (spec §2). Nothing here is ever in the clear; this module is imported only by
 * the vault page (unlock.html) and its worker, enforced by scripts/check-vault-isolation.mjs.
 */
export interface KdfParams {
  m: number;
  t: number;
  p: number;
}
export const PRODUCTION_KDF: KdfParams = {m: 65536, t: 3, p: 1};
/**
 * The most an envelope may declare: m 1 GiB (Argon2's m is in KiB), t 10, p 4. With the
 * production values as the floor, a stored envelope can neither lower the cost of guessing its
 * password nor make the vault page grind through an absurd one. There is no weaker mode for
 * tests: tests pass a KDF that computes a tiny cost while the envelope declares production, so
 * no option that admits weak parameters exists for the vault page to be tricked into.
 */
export const KDF_CAP: KdfParams = {m: 1024 * 1024, t: 10, p: 4};
export type Kdf = (password: string, salt: Uint8Array, params: KdfParams) => Promise<Uint8Array>;

export interface EnvelopeV1 {
  v: 1;
  scheme: 'slip10' | 'cli';
  kdf: {alg: 'argon2id'; m: number; t: number; p: number; salt: string};
  seed: {iv: string; ct: string};
  password: {wrapped: string};
  passkey?: {credentialId: string; prfSalt: string; wrapped: string};
  accounts: {index: number; name: string; publicKey: string}[];
}

export class WrongPassword extends Error {
  constructor() {
    super('wrong password');
  }
}
export class WrongPasskey extends Error {
  constructor() {
    super('this passkey does not unlock this wallet');
  }
}
/**
 * The stored envelope is not one this code could have written: a missing field, a value of the
 * wrong type, base64 that does not decode, a byte string of the wrong length. Distinct from
 * WrongPassword/WrongPasskey, which mean exactly one thing — AES-KW's integrity check refused a
 * WELL-FORMED wrapped key under the key derived from the factor offered.
 */
export class CorruptEnvelope extends Error {
  constructor(what: string) {
    super(`the stored wallet is damaged: ${what}`);
  }
}

/** Argon2id parameters outside [PRODUCTION_KDF, KDF_CAP], declared by a stored envelope or asked for on create. */
export class UnsafeKdfParams extends Error {
  constructor() {
    super('Argon2id parameters outside the allowed range');
  }
}

function checkKdfParams(params: KdfParams): void {
  for (const k of ['m', 't', 'p'] as const) {
    const v = params[k];
    if (!Number.isSafeInteger(v) || v < PRODUCTION_KDF[k] || v > KDF_CAP[k]) throw new UnsafeKdfParams();
  }
}

/**
 * The AES-GCM additionalData of the seed ciphertext: the envelope header, canonically encoded.
 *
 * Canonical form: the UTF-8 bytes of JSON.stringify of an object built here, key by key, in
 * exactly this order —
 *   {"v":1,"scheme":<string>,"kdf":{"alg":"argon2id","m":<int>,"t":<int>,"p":<int>},
 *    "accounts":[{"index":<int>,"publicKey":<string>}, … in stored order]}
 * — with no whitespace (JSON.stringify's default). Every value has been shape-checked first
 * (integers, strings), so the encoding is deterministic. Changing any of these in storage makes
 * the seed undecryptable, so a stored scheme, account list or declared cost cannot be swapped
 * under a valid ciphertext.
 *
 * Left out, deliberately: account names (renaming needs no re-encryption); the salt and the
 * password/passkey wraps (they unwrap the data key — a changed one already fails there, and a
 * passkey is added later without re-encrypting the seed). Adding or removing an account changes
 * the header, so whatever does that must re-encrypt the seed under the same data key
 * (src/vault/reencrypt.ts, which is why this, isIndex and checkEnvelope are exported).
 */
export function headerAad(h: {v: 1; scheme: EnvelopeV1['scheme']; kdf: KdfParams; accounts: EnvelopeV1['accounts']}): Uint8Array<ArrayBuffer> {
  return utf8(
    JSON.stringify({
      v: h.v,
      scheme: h.scheme,
      kdf: {alg: 'argon2id', m: h.kdf.m, t: h.kdf.t, p: h.kdf.p},
      accounts: h.accounts.map(a => ({index: a.index, publicKey: a.publicKey})),
    }),
  );
}

// Byte lengths of a well-formed v1 envelope: 16-byte Argon2id salt, 12-byte GCM IV, a GCM
// ciphertext of at least one byte plus its 16-byte tag, a 32-byte data key wrapped by AES-KW
// (RFC 3394: +8 bytes), a 32-byte PRF salt (spec §2).
const SALT_LEN = 16;
const IV_LEN = 12;
const MIN_CT_LEN = 17;
const WRAPPED_LEN = 40;
const PRF_SALT_LEN = 32;

type Json = Record<string, unknown>;
const isObject = (x: unknown): x is Json => typeof x === 'object' && x !== null && !Array.isArray(x);

function bytesField(value: unknown, what: string, len: {exact: number} | {min: number}): void {
  if (typeof value !== 'string') throw new CorruptEnvelope(`${what} is not a string`);
  let bytes: Uint8Array;
  try {
    bytes = unb64(value);
  } catch {
    throw new CorruptEnvelope(`${what} is not base64`);
  }
  if ('exact' in len ? bytes.length !== len.exact : bytes.length < len.min) throw new CorruptEnvelope(`${what} has the wrong length`);
}

export const isIndex = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;

/**
 * Every field of a stored envelope, checked for shape before any of it is used — the value comes
 * from storage.local, so its static type is a claim, not a fact. Throws CorruptEnvelope, or
 * UnsafeKdfParams for a declared cost outside the bounds (before any KDF runs).
 */
export function checkEnvelope(env: unknown): asserts env is EnvelopeV1 {
  if (!isObject(env)) throw new CorruptEnvelope('not an object');
  if (env.v !== 1) throw new CorruptEnvelope('unknown version');
  if (env.scheme !== 'slip10' && env.scheme !== 'cli') throw new CorruptEnvelope('unknown scheme');
  const kdf = env.kdf;
  if (!isObject(kdf) || kdf.alg !== 'argon2id') throw new CorruptEnvelope('kdf is not argon2id');
  for (const k of ['m', 't', 'p'] as const) {
    if (typeof kdf[k] !== 'number' || !Number.isSafeInteger(kdf[k])) throw new CorruptEnvelope(`kdf.${k} is not an integer`);
  }
  checkKdfParams({m: kdf.m as number, t: kdf.t as number, p: kdf.p as number});
  bytesField(kdf.salt, 'kdf.salt', {exact: SALT_LEN});
  if (!isObject(env.seed)) throw new CorruptEnvelope('no seed');
  bytesField(env.seed.iv, 'seed.iv', {exact: IV_LEN});
  bytesField(env.seed.ct, 'seed.ct', {min: MIN_CT_LEN});
  if (!isObject(env.password)) throw new CorruptEnvelope('no password wrap');
  bytesField(env.password.wrapped, 'password.wrapped', {exact: WRAPPED_LEN});
  if (env.passkey !== undefined) {
    if (!isObject(env.passkey)) throw new CorruptEnvelope('passkey is not an object');
    bytesField(env.passkey.credentialId, 'passkey.credentialId', {min: 1});
    bytesField(env.passkey.prfSalt, 'passkey.prfSalt', {exact: PRF_SALT_LEN});
    bytesField(env.passkey.wrapped, 'passkey.wrapped', {exact: WRAPPED_LEN});
  }
  if (!Array.isArray(env.accounts)) throw new CorruptEnvelope('accounts is not an array');
  if (env.accounts.length === 0) throw new CorruptEnvelope('accounts is empty');
  for (const a of env.accounts as unknown[]) {
    if (!isObject(a) || !isIndex(a.index) || typeof a.name !== 'string' || typeof a.publicKey !== 'string') {
      throw new CorruptEnvelope('an account is malformed');
    }
  }
}

const HKDF_INFO = utf8('noctura-ext-v1/passkey-wrap');
const subtle = () => globalThis.crypto.subtle;
const random = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

async function aesKw(kekBytes: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return subtle().importKey('raw', kekBytes, 'AES-KW', false, ['wrapKey', 'unwrapKey']);
}

async function wrap(dataKey: Uint8Array<ArrayBuffer>, kekBytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const dk = await subtle().importKey('raw', dataKey, 'AES-GCM', true, ['encrypt', 'decrypt']);
  return b64(new Uint8Array(await subtle().wrapKey('raw', dk, await aesKw(kekBytes), 'AES-KW')));
}

async function unwrap(wrapped: string, kekBytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const dk = await subtle().unwrapKey('raw', unb64(wrapped), await aesKw(kekBytes), 'AES-KW', 'AES-GCM', true, ['encrypt', 'decrypt']);
  return new Uint8Array(await subtle().exportKey('raw', dk));
}

async function prfKek(prfOutput: Uint8Array<ArrayBuffer>, prfSalt: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const ikm = await subtle().importKey('raw', prfOutput, 'HKDF', false, ['deriveBits']);
  const bits = await subtle().deriveBits({name: 'HKDF', hash: 'SHA-256', salt: prfSalt, info: HKDF_INFO}, ikm, 256);
  return new Uint8Array(bits);
}

export async function createEnvelope(input: {
  mnemonic: string;
  password: string;
  scheme: 'slip10' | 'cli';
  accounts: EnvelopeV1['accounts'];
  kdf: Kdf;
  params?: KdfParams;
}): Promise<EnvelopeV1> {
  const params = input.params ?? PRODUCTION_KDF;
  checkKdfParams(params);
  if (input.accounts.length === 0) throw new TypeError('createEnvelope requires at least one account');
  for (const a of input.accounts) {
    if (!isIndex(a.index) || typeof a.name !== 'string' || typeof a.publicKey !== 'string') throw new TypeError('malformed account');
  }
  const aad = headerAad({v: 1, scheme: input.scheme, kdf: params, accounts: input.accounts});
  const salt = random(16);
  const dataKey = random(32);
  const iv = random(12);
  // The phrase's UTF-8 bytes are ours to zero (the string itself is not): see `finally`.
  const encoded = utf8(input.mnemonic);
  let kek: Uint8Array | undefined;
  try {
    const key = await subtle().importKey('raw', dataKey, 'AES-GCM', false, ['encrypt']);
    const ct = new Uint8Array(await subtle().encrypt({name: 'AES-GCM', iv, additionalData: aad}, key, encoded));
    kek = await input.kdf(input.password, salt, params);
    assertArrayBufferBacked(kek);
    const env: EnvelopeV1 = {
      v: 1,
      scheme: input.scheme,
      kdf: {alg: 'argon2id', m: params.m, t: params.t, p: params.p, salt: b64(salt)},
      seed: {iv: b64(iv), ct: b64(ct)},
      password: {wrapped: await wrap(dataKey, kek)},
      accounts: input.accounts.map(a => ({index: a.index, name: a.name, publicKey: a.publicKey})),
    };
    return env;
  } finally {
    encoded.fill(0);
    dataKey.fill(0);
    kek?.fill(0);
  }
}

export async function unlockWithPassword(env: EnvelopeV1, password: string, kdf: Kdf): Promise<Uint8Array> {
  checkEnvelope(env);
  const kek = await kdf(password, unb64(env.kdf.salt), {m: env.kdf.m, t: env.kdf.t, p: env.kdf.p});
  assertArrayBufferBacked(kek);
  try {
    return await unwrap(env.password.wrapped, kek);
  } catch {
    throw new WrongPassword();
  } finally {
    kek.fill(0);
  }
}

export async function decryptMnemonic(env: EnvelopeV1, dataKey: Uint8Array): Promise<string> {
  checkEnvelope(env);
  assertArrayBufferBacked(dataKey);
  const key = await subtle().importKey('raw', dataKey, 'AES-GCM', false, ['decrypt']);
  const aad = headerAad({v: env.v, scheme: env.scheme, kdf: env.kdf, accounts: env.accounts});
  const pt = new Uint8Array(await subtle().decrypt({name: 'AES-GCM', iv: unb64(env.seed.iv), additionalData: aad}, key, unb64(env.seed.ct)));
  try {
    return new TextDecoder().decode(pt);
  } finally {
    // The returned string cannot be zeroed; the plaintext bytes it was decoded from can.
    pt.fill(0);
  }
}

export async function addPasskeyWrap(
  env: EnvelopeV1,
  dataKey: Uint8Array,
  prfOutput: Uint8Array,
  credentialId: Uint8Array,
  prfSalt: Uint8Array,
): Promise<EnvelopeV1> {
  assertArrayBufferBacked(dataKey);
  assertArrayBufferBacked(prfOutput);
  assertArrayBufferBacked(prfSalt);
  if (prfOutput.length !== 32) throw new TypeError('PRF output must be exactly 32 bytes');
  if (prfSalt.length !== 32) throw new TypeError('PRF salt must be exactly 32 bytes');
  // Prove dataKey actually decrypts THIS envelope's seed before wrapping it: wrapping the
  // wrong key would silently brick passkey unlock later (the passkey wrap would "succeed" but
  // unlockWithPrf would never recover a usable data key). Use a copy so decryptMnemonic never
  // has the chance to consume or zero the caller's own dataKey.
  const dataKeyCheck = dataKey.slice();
  try {
    await decryptMnemonic(env, dataKeyCheck);
  } finally {
    dataKeyCheck.fill(0);
  }
  const kek = await prfKek(prfOutput, prfSalt);
  try {
    const wrapped = await wrap(dataKey, kek);
    return {...env, passkey: {credentialId: b64(credentialId), prfSalt: b64(prfSalt), wrapped}};
  } finally {
    kek.fill(0);
  }
}

/**
 * B1b-2b E10 (D8): a new password wrap of the SAME data key — the change-password step. A fresh 16-byte salt, Argon2id
 * at the envelope's STORED cost (never a new one: the cost is in the AAD), AES-KW of `dataKey`. Before anything is
 * returned the new wrap is proven: it unwraps (under the same KEK) to `dataKey` byte for byte, and `dataKey` decrypts
 * this envelope's seed — so a wrap of the wrong key, which would brick password unlock, is never handed out (as
 * addPasskeyWrap proves the key first). The seed ciphertext, the IV and the passkey wrap are untouched: the AAD covers
 * none of the salt and the wraps. Every KEK and copy is zeroed; throws on any mismatch.
 *
 * Task 8 fix round 1 (C1): everything after the entry works on a PRIVATE copy taken before the first await — the wrap,
 * the byte comparison and the seed check — never on the caller's buffer, which its owner may zero while Argon2id runs
 * (a wrap of an all-zero key passes both self-checks and bricks the wallet). The copy is zeroed on every path.
 */
export async function rewrapPassword(env: EnvelopeV1, dataKey: Uint8Array, password: string, kdf: Kdf): Promise<{salt: string; wrapped: string}> {
  checkEnvelope(env);
  assertArrayBufferBacked(dataKey);
  const salt = random(16);
  const key = dataKey.slice();
  let kek: Uint8Array | undefined;
  let back: Uint8Array | undefined;
  try {
    kek = await kdf(password, salt, {m: env.kdf.m, t: env.kdf.t, p: env.kdf.p});
    assertArrayBufferBacked(kek);
    const wrapped = await wrap(key, kek);
    back = await unwrap(wrapped, kek);
    if (back.length !== key.length || !back.every((b, i) => b === key[i])) throw new Error('rewrapPassword: the new wrap does not open to the same data key');
    await decryptMnemonic(env, key);
    return {salt: b64(salt), wrapped};
  } finally {
    kek?.fill(0);
    back?.fill(0);
    key.fill(0);
  }
}

export async function unlockWithPrf(env: EnvelopeV1, prfOutput: Uint8Array): Promise<Uint8Array> {
  checkEnvelope(env);
  if (!env.passkey) throw new WrongPasskey();
  assertArrayBufferBacked(prfOutput);
  const kek = await prfKek(prfOutput, unb64(env.passkey.prfSalt));
  try {
    return await unwrap(env.passkey.wrapped, kek);
  } catch {
    throw new WrongPasskey();
  } finally {
    kek.fill(0);
  }
}
