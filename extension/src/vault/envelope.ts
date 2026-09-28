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
  let kek: Uint8Array | undefined;
  try {
    const key = await subtle().importKey('raw', dataKey, 'AES-GCM', false, ['encrypt']);
    const ct = new Uint8Array(await subtle().encrypt({name: 'AES-GCM', iv}, key, utf8(input.mnemonic)));
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
    dataKey.fill(0);
    kek?.fill(0);
  }
}

export async function unlockWithPassword(env: EnvelopeV1, password: string, kdf: Kdf): Promise<Uint8Array> {
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
  assertArrayBufferBacked(dataKey);
  const key = await subtle().importKey('raw', dataKey, 'AES-GCM', false, ['decrypt']);
  const pt = await subtle().decrypt({name: 'AES-GCM', iv: unb64(env.seed.iv)}, key, unb64(env.seed.ct));
  return new TextDecoder().decode(pt);
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
