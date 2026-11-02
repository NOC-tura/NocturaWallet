import {readFileSync} from 'node:fs';
import {argon2idAsync} from '@noble/hashes/argon2.js';
import {base64} from '@scure/base';
import {KDF_CAP, addPasskeyWrap, createEnvelope, rewrapPassword, unlockWithPassword, type EnvelopeV1, type Kdf} from '../../vault/envelope';
import {reencryptForAccounts} from '../../vault/reencrypt';
import {derivePublicKeys} from '../../vault/accounts';

// B1e §2.6: the controls of the frozen predicate (src/shared/unreadable.ts), shared by its tests and by
// vault.forgetDamaged's. Every F control is JSON.parse of the committed fixture FILE and one edit — never the encoder's
// output, so a change made to the encoder and the predicate together cannot move them. The breadth controls come from
// the real encoder; the first encoder's output (458dfcd) is a committed file too. Each value is what storage.local
// hands back: a JSON round trip.

export type Json = Record<string, unknown>;
export const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
export const PASSWORD = 'correct horse battery staple';
/** Account 0 of MNEMONIC (slip10), the fixture's only account. */
export const FIXTURE_ACCOUNT = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';

const readJson = (name: string): Json => JSON.parse(readFileSync(new URL(`../../vault/__tests__/fixtures/${name}`, import.meta.url), 'utf8')) as Json;
const stored = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const obj = (x: unknown): Json => {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) throw new Error('the fixture changed shape');
  return x as Json;
};

/** F0: envelope-v1.json verbatim, a fresh parse of the file on every call. */
export const fixtureEnvelope = (): Json => readJson('envelope-v1.json');

/** F0 with one edit applied to a fresh parse. */
export function edited(edit: (env: Json) => void): Json {
  const env = fixtureEnvelope();
  edit(env);
  return env;
}
const account = (index: number): Json => ({index, name: `Account ${index + 1}`, publicKey: FIXTURE_ACCOUNT});

/** §2.6 F0–F9: readable — never deletable. F0, F1 and F9 are wallets both openers accept; F2–F8 are refused by both. */
export const F: readonly (readonly [string, Json])[] = [
  ['F0 the fixture verbatim', fixtureEnvelope()],
  ['F1 without passkey', edited(e => delete e.passkey)],
  ['F2 kdf.m = 32768 (below the floor)', edited(e => (obj(e.kdf).m = 32768))],
  ['F3 kdf.m = 2147483648 (above the cap)', edited(e => (obj(e.kdf).m = 2147483648))],
  ['F4 v: 2', edited(e => (e.v = 2))],
  ['F5 101 accounts', edited(e => (e.accounts = Array.from({length: 101}, (_, i) => account(i))))],
  ['F6 cli with two accounts', edited(e => ((e.scheme = 'cli'), (e.accounts = [account(0), account(1)])))],
  ['F7 accounts: []', edited(e => (e.accounts = []))],
  ['F8 scheme: bip44', edited(e => (e.scheme = 'bip44'))],
  ['F9 an unknown field', edited(e => (e.memo = 'kept by a later version'))],
];
export const F_WALLETS = ['F0', 'F1', 'F9'];

const fixtureSalt = (): string => String(obj(fixtureEnvelope().kdf).salt);
const bytes = (n: number): string => base64.encode(new Uint8Array(n).fill(0x5a));
const firstAccount = (e: Json): Json => obj((e.accounts as unknown[])[0]);

/** §2.6 deletable controls: at least one per clause of U1–U3; each U3 control is F0 with that one clause broken. */
export const DELETABLE: readonly (readonly [string, unknown])[] = [
  ['U1 null', null],
  ['U1 []', []],
  ['U1 "x"', 'x'],
  ['U1 a number', 7],
  ['U1 a boolean', true],
  ['U1 the fixture as an array', [fixtureEnvelope()]],
  ['U2 no v', edited(e => delete e.v)],
  ['U2 v: "1"', edited(e => (e.v = '1'))],
  ['U2 v: 0', edited(e => (e.v = 0))],
  ['U2 v: -1', edited(e => (e.v = -1))],
  ['U2 v: 1.5', edited(e => (e.v = 1.5))],
  ['U2 v: null', edited(e => (e.v = null))],
  ['U3 scheme: 1', edited(e => (e.scheme = 1))],
  ['U3 no scheme', edited(e => delete e.scheme)],
  ['U3 kdf a string', edited(e => (e.kdf = 'argon2id'))],
  ["U3 kdf.alg: 'scrypt'", edited(e => (obj(e.kdf).alg = 'scrypt'))],
  ['U3 kdf.m: "65536"', edited(e => (obj(e.kdf).m = '65536'))],
  ['U3 kdf.t: 1.5', edited(e => (obj(e.kdf).t = 1.5))],
  ['U3 no kdf.p', edited(e => delete obj(e.kdf).p)],
  ['U3 kdf.salt unpadded', edited(e => (obj(e.kdf).salt = fixtureSalt().replace(/=+$/, '')))],
  ['U3 kdf.salt of 15 bytes', edited(e => (obj(e.kdf).salt = bytes(15)))],
  ['U3 kdf.salt of 17 bytes', edited(e => (obj(e.kdf).salt = bytes(17)))],
  ['U3 no seed', edited(e => delete e.seed)],
  ['U3 seed.iv of 11 bytes', edited(e => (obj(e.seed).iv = bytes(11)))],
  ['U3 seed.iv of 13 bytes', edited(e => (obj(e.seed).iv = bytes(13)))],
  ['U3 seed.ct of 16 bytes', edited(e => (obj(e.seed).ct = bytes(16)))],
  ['U3 seed.ct not base64', edited(e => (obj(e.seed).ct = 'not base64!'))],
  ['U3 no password', edited(e => delete e.password)],
  ['U3 password.wrapped of 39 bytes', edited(e => (obj(e.password).wrapped = bytes(39)))],
  ['U3 password.wrapped of 41 bytes', edited(e => (obj(e.password).wrapped = bytes(41)))],
  ['U3 passkey: null', edited(e => (e.passkey = null))],
  ['U3 passkey a string', edited(e => (e.passkey = 'passkey'))],
  ['U3 an empty credentialId', edited(e => (obj(e.passkey).credentialId = ''))],
  ['U3 prfSalt of 31 bytes', edited(e => (obj(e.passkey).prfSalt = bytes(31)))],
  ['U3 passkey.wrapped of 39 bytes', edited(e => (obj(e.passkey).wrapped = bytes(39)))],
  ['U3 accounts: {}', edited(e => (e.accounts = {}))],
  ['U3 an account null', edited(e => (e.accounts = [null]))],
  ['U3 index: -1', edited(e => (firstAccount(e).index = -1))],
  ["U3 index: '0'", edited(e => (firstAccount(e).index = '0'))],
  ['U3 index: 0.5', edited(e => (firstAccount(e).index = 0.5))],
  ['U3 name: 1', edited(e => (firstAccount(e).name = 1))],
  ['U3 an account without publicKey', edited(e => delete firstAccount(e).publicKey)],
  ['U3 a broken second account', edited(e => (e.accounts = [account(0), {index: 1, name: 'Account 2'}]))],
];

/** 458dfcd's encoder output (createEnvelope, then addPasskeyWrap of it), committed verbatim. */
export function firstEncoder(): readonly (readonly [string, Json])[] {
  const file = readJson('envelope-v1-458dfcd.json');
  return [
    ['458dfcd createEnvelope', obj(file.created)],
    ['458dfcd addPasskeyWrap', obj(file.withPasskey)],
  ];
}

// The encoder computes a tiny Argon2id cost while the envelope declares the production one (envelopeBounds.test.ts).
const cheapKdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});
const named = async (scheme: 'slip10' | 'cli', names: string[]): Promise<EnvelopeV1['accounts']> => {
  const keys = await derivePublicKeys(MNEMONIC, scheme, names.map((_, i) => i));
  return names.map((name, i) => ({index: i, name, publicKey: keys[i] ?? ''}));
};
const create = async (scheme: 'slip10' | 'cli', names: string[], params?: typeof KDF_CAP): Promise<EnvelopeV1> =>
  createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme, accounts: await named(scheme, names), kdf: cheapKdf, ...(params === undefined ? {} : {params})});

/** Odd account names (review 2's probe): each a string, so readable; storeEnvelope's name policy is not the predicate's. */
export const ODD_NAMES: readonly string[] = [
  '',
  '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466} \u2764\uFE0F',
  '\u05D7\u05E9\u05D1\u05D5\u05DF',
  '\u8D26\u6237',
  'a\u202Eb',
  '\uD800',
  'x'.repeat(5000),
  'a\u0001b',
];

/** §2.6 breadth: what the real encoder writes, each through a storage round trip. */
export async function breadth(): Promise<(readonly [string, Json])[]> {
  const slip10 = await create('slip10', ['Account 1']);
  const dataKey = await unlockWithPassword(slip10, PASSWORD, cheapKdf);
  const prf = Uint8Array.from({length: 32}, (_, i) => 0xa0 + i);
  const prfSalt = (): Uint8Array<ArrayBuffer> => globalThis.crypto.getRandomValues(new Uint8Array(32));
  const {salt, wrapped} = await rewrapPassword(slip10, dataKey, 'a new password', cheapKdf);
  const out: [string, EnvelopeV1][] = [
    ['createEnvelope slip10', slip10],
    ['createEnvelope cli', await create('cli', ['Account 1'])],
    ['createEnvelope 100 accounts', await create('slip10', Array.from({length: 100}, (_, i) => `Account ${i + 1}`))],
    ['createEnvelope declaring KDF_CAP', await create('slip10', ['Account 1'], KDF_CAP)],
    ['createEnvelope odd names', await create('slip10', [...ODD_NAMES])],
    ['after rewrapPassword', {...slip10, kdf: {...slip10.kdf, salt}, password: {wrapped}}],
    ['after reencryptForAccounts (account 7 added)', await reencryptForAccounts(slip10, dataKey.slice(), [{index: 0, name: 'Account 1'}, {index: 7, name: 'Account 8'}])],
    ['addPasskeyWrap, a 1-byte credential ID', await addPasskeyWrap(slip10, dataKey.slice(), prf.slice(), new Uint8Array([9]), prfSalt())],
    ['addPasskeyWrap, a 64-byte credential ID', await addPasskeyWrap(slip10, dataKey.slice(), prf.slice(), new Uint8Array(64).fill(9), prfSalt())],
  ];
  dataKey.fill(0);
  return out.map(([name, env]) => [name, obj(stored(env))] as const);
}
