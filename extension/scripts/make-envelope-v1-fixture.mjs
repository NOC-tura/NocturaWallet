#!/usr/bin/env node
// One-off generator for src/vault/__tests__/fixtures/envelope-v1.json — the envelope-format
// known-answer fixture (spec §5). NOT run by `verify`: the test reads the COMMITTED file, so a
// change to the envelope format that breaks already-stored vaults fails the test instead of
// silently regenerating the fixture. Kept here only so the fixture's provenance is reproducible:
//   node scripts/make-envelope-v1-fixture.mjs > src/vault/__tests__/fixtures/envelope-v1.json
//
// Deliberately written against WebCrypto + @noble/hashes directly, NOT by calling
// src/vault/envelope.ts: the fixture is an independent statement of the v1 format (Argon2id ->
// AES-KW wrap of an AES-256-GCM data key; PRF -> HKDF-SHA-256(salt = PRF salt, info =
// "noctura-ext-v1/passkey-wrap") -> AES-KW wrap of the same data key), so a bug that changes
// envelope.ts symmetrically on both the write and the read side cannot also change the fixture.
// Every "random" input is fixed, so the output is byte-for-byte reproducible.
import {argon2idAsync} from '@noble/hashes/argon2.js';
import {base64} from '@scure/base';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PASSWORD = 'correct horse battery staple';
const KDF = {m: 64, t: 1, p: 1};
const seq = (n, start) => Uint8Array.from({length: n}, (_, i) => (start + i) & 0xff);
const KDF_SALT = seq(16, 0x10);
const DATA_KEY = seq(32, 0x40);
const SEED_IV = seq(12, 0x80);
const PRF_OUTPUT = seq(32, 0xa0);
const PRF_SALT = seq(32, 0xc0);
const CREDENTIAL_ID = seq(16, 0xe0);

const subtle = globalThis.crypto.subtle;
const kw = bytes => subtle.importKey('raw', bytes, 'AES-KW', false, ['wrapKey']);

async function wrap(kek) {
  const dk = await subtle.importKey('raw', DATA_KEY, 'AES-GCM', true, ['encrypt']);
  return base64.encode(new Uint8Array(await subtle.wrapKey('raw', dk, await kw(kek), 'AES-KW')));
}

const seedKey = await subtle.importKey('raw', DATA_KEY, 'AES-GCM', false, ['encrypt']);
const ct = new Uint8Array(await subtle.encrypt({name: 'AES-GCM', iv: SEED_IV}, seedKey, new TextEncoder().encode(MNEMONIC)));
const passwordKek = await argon2idAsync(PASSWORD, KDF_SALT, {...KDF, dkLen: 32});
const ikm = await subtle.importKey('raw', PRF_OUTPUT, 'HKDF', false, ['deriveBits']);
const info = new TextEncoder().encode('noctura-ext-v1/passkey-wrap');
const prfKek = new Uint8Array(await subtle.deriveBits({name: 'HKDF', hash: 'SHA-256', salt: PRF_SALT, info}, ikm, 256));

const envelope = {
  v: 1,
  scheme: 'slip10',
  kdf: {alg: 'argon2id', ...KDF, salt: base64.encode(KDF_SALT)},
  seed: {iv: base64.encode(SEED_IV), ct: base64.encode(ct)},
  password: {wrapped: await wrap(passwordKek)},
  passkey: {credentialId: base64.encode(CREDENTIAL_ID), prfSalt: base64.encode(PRF_SALT), wrapped: await wrap(prfKek)},
  accounts: [{index: 0, name: 'Account 1', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}],
};
process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
