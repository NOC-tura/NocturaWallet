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

const isIndex = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;

/**
 * Every field of a stored envelope, checked for shape before any of it is used — the value comes
 * from storage.local, so its static type is a claim, not a fact. Throws CorruptEnvelope.
 */
function checkEnvelope(env: unknown): asserts env is EnvelopeV1 {
  if (!isObject(env)) throw new CorruptEnvelope('not an object');
  if (env.v !== 1) throw new CorruptEnvelope('unknown version');
  if (env.scheme !== 'slip10' && env.scheme !== 'cli') throw new CorruptEnvelope('unknown scheme');
  const kdf = env.kdf;
  if (!isObject(kdf) || kdf.alg !== 'argon2id') throw new CorruptEnvelope('kdf is not argon2id');
  for (const k of ['m', 't', 'p'] as const) {
    if (typeof kdf[k] !== 'number' || !Number.isSafeInteger(kdf[k])) throw new CorruptEnvelope(`kdf.${k} is not an integer`);
  }
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
  const salt = random(16);
  const dataKey = random(32);
  const iv = random(12);
  // The phrase's UTF-8 bytes are ours to zero (the string itself is not): see `finally`.
  const encoded = utf8(input.mnemonic);
  let kek: Uint8Array | undefined;
  try {
    const key = await subtle().importKey('raw', dataKey, 'AES-GCM', false, ['encrypt']);
    const ct = new Uint8Array(await subtle().encrypt({name: 'AES-GCM', iv}, key, encoded));
    kek = await input.kdf(input.password, salt, params);
    assertArrayBufferBacked(kek);
    const env: EnvelopeV1 = {
      v: 1,
      scheme: input.scheme,
      kdf: {alg: 'argon2id', ...params, salt: b64(salt)},
      seed: {iv: b64(iv), ct: b64(ct)},
      password: {wrapped: await wrap(dataKey, kek)},
      accounts: input.accounts,
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
  const pt = new Uint8Array(await subtle().decrypt({name: 'AES-GCM', iv: unb64(env.seed.iv)}, key, unb64(env.seed.ct)));
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
