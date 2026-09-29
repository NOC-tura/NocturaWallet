import type {Ext} from '../ext';
import {createMutex} from './mutex';

/**
 * The envelope. The background is its one writer (storage.local has no compare-and-set across
 * contexts): it edits names itself, and stores the envelope the vault page re-encrypts when an
 * account is added or removed (storeEnvelope). Both writes run under the same mutex.
 */
export const VAULT_KEY = 'v1_vault';
export const MAX_NAME_LENGTH = 32;
/** The most accounts an envelope the vault page hands over may carry. */
export const MAX_ACCOUNTS = 100;

export interface AccountView {
  index: number;
  name: string;
  publicKey: string;
}
export interface WalletView {
  scheme: 'slip10' | 'cli';
  accounts: AccountView[];
}

const serial = createMutex();
type Json = Record<string, unknown>;
const isObj = (x: unknown): x is Json => typeof x === 'object' && x !== null && !Array.isArray(x);

function accountsOf(env: Json): AccountView[] | null {
  if (!Array.isArray(env.accounts) || env.accounts.length === 0) return null;
  const out: AccountView[] = [];
  for (const a of env.accounts as unknown[]) {
    if (!isObj(a) || typeof a.index !== 'number' || !Number.isSafeInteger(a.index) || typeof a.name !== 'string' || typeof a.publicKey !== 'string') return null;
    out.push({index: a.index, name: a.name, publicKey: a.publicKey});
  }
  return out;
}

/** Public data only: the scheme and each account's index, name and address. Null without a wallet. */
export async function readWalletView(ext: Ext): Promise<WalletView | null> {
  const env = await ext.local.get(VAULT_KEY);
  if (!isObj(env) || (env.scheme !== 'slip10' && env.scheme !== 'cli')) return null;
  const accounts = accountsOf(env);
  return accounts === null ? null : {scheme: env.scheme, accounts};
}

// C0 and C1 controls, and the bidi embedding/override/isolate characters that can make an
// account name read as something else.
const FORBIDDEN_IN_NAME = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;

export function cleanName(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const name = x.trim();
  if (name.length === 0 || name.length > MAX_NAME_LENGTH || FORBIDDEN_IN_NAME.test(name)) return null;
  return name;
}

export type RenameResult = 'renamed' | 'malformed' | 'unknown-account' | 'busy';

/**
 * Names are outside the seed's AES-GCM additionalData (spec §2), so renaming needs no key and no
 * re-encryption: every other field of the stored envelope is written back exactly as read. The
 * name is cleaned here (cleanName), whatever the caller did; a name it refuses renames nothing.
 *
 * Every write of v1_vault in this extension runs here, under `serial` (renameAccount, storeEnvelope),
 * so the two cannot interleave. The compare-and-set stays as a second line: immediately before
 * writing, the envelope is read again, and the renamed copy is written only if nothing changed
 * since it was built. Otherwise the rename is redone once on the fresh envelope; if that changes
 * too, 'busy'.
 */
export async function renameAccount(ext: Ext, index: number, name: string): Promise<RenameResult> {
  const clean = cleanName(name);
  if (clean === null) return 'malformed';
  return serial(async () => {
    let env = await ext.local.get(VAULT_KEY);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!isObj(env) || accountsOf(env) === null) return 'unknown-account';
      const accounts = env.accounts as Json[];
      if (!accounts.some(a => a.index === index)) return 'unknown-account';
      const next = {...env, accounts: accounts.map(a => (a.index === index ? {...a, name: clean} : a))};
      const current = await ext.local.get(VAULT_KEY);
      if (JSON.stringify(current) === JSON.stringify(env)) {
        await ext.local.set(VAULT_KEY, next);
        return 'renamed';
      }
      env = current;
    }
    return 'busy';
  });
}

export type StoreResult = 'stored' | 'malformed' | 'no-wallet' | 'wallet-exists' | 'busy';
type StoredEnvelope = {
  v: 1;
  scheme: 'slip10' | 'cli';
  kdf: {alg: 'argon2id'; m: number; t: number; p: number; salt: string};
  seed: {iv: string; ct: string};
  password: {wrapped: string};
  passkey?: {credentialId: string; prfSalt: string; wrapped: string};
  accounts: AccountView[];
};

const isStr = (x: unknown): x is string => typeof x === 'string';
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x);

/**
 * The envelope's shape, checked structurally and rebuilt field by field (a stray field — a seed, a
 * key — is never stored). The background holds no vault code, so it cannot check the ciphertext:
 * the vault page proved the factor and re-encrypted; what is checked here is that the object has
 * the envelope's shape. Names are checked in storeEnvelope, against the stored envelope. Null otherwise.
 */
function envelopeShape(x: unknown): StoredEnvelope | null {
  if (!isObj(x) || x.v !== 1 || (x.scheme !== 'slip10' && x.scheme !== 'cli')) return null;
  const {kdf, seed, password, passkey} = x;
  if (!isObj(kdf) || kdf.alg !== 'argon2id' || !isInt(kdf.m) || !isInt(kdf.t) || !isInt(kdf.p) || !isStr(kdf.salt)) return null;
  if (!isObj(seed) || !isStr(seed.iv) || !isStr(seed.ct)) return null;
  if (!isObj(password) || !isStr(password.wrapped)) return null;
  if (passkey !== undefined && (!isObj(passkey) || !isStr(passkey.credentialId) || !isStr(passkey.prfSalt) || !isStr(passkey.wrapped))) return null;
  if (!Array.isArray(x.accounts) || x.accounts.length === 0 || x.accounts.length > MAX_ACCOUNTS) return null;
  const accounts: AccountView[] = [];
  for (const a of x.accounts as unknown[]) {
    if (!isObj(a) || !isInt(a.index) || a.index < 0 || !isStr(a.publicKey) || a.publicKey === '') return null;
    if (!isStr(a.name) || accounts.some(b => b.index === a.index)) return null;
    accounts.push({index: a.index, name: a.name, publicKey: a.publicKey});
  }
  if (x.scheme === 'cli' && (accounts.length !== 1 || accounts[0]?.index !== 0)) return null;
  return {
    v: 1,
    scheme: x.scheme,
    kdf: {alg: 'argon2id', m: kdf.m, t: kdf.t, p: kdf.p, salt: kdf.salt},
    seed: {iv: seed.iv, ct: seed.ct},
    password: {wrapped: password.wrapped},
    ...(passkey === undefined ? {} : {passkey: {credentialId: passkey.credentialId as string, prfSalt: passkey.prfSalt as string, wrapped: passkey.wrapped as string}}),
    accounts,
  };
}

/**
 * The vault page re-encrypted the seed for a changed account list and hands the envelope over
 * (`vault.storeEnvelope`); the background is the one writer of v1_vault. Under the mutex renames
 * take: the write lands only if the stored seed ciphertext is still the one the vault page
 * re-encrypted (`expectedSeedCt`) — otherwise another change landed in between and the vault page
 * re-opens and retries ('busy'). A rename changes no ciphertext, so it never makes a store busy;
 * instead the current name of every account present in both is kept (names are outside the AAD).
 * A new account's name must be one a rename would accept (cleanName), or nothing is written.
 *
 * `expectedSeedCt: null` is onboarding's FIRST write: accepted only while v1_vault is absent
 * (every name is then new, so every name is cleaned); with a wallet stored, 'wallet-exists' and
 * nothing is written — onboarding never overwrites a wallet. A string `expectedSeedCt` with no
 * wallet stored is 'no-wallet'.
 */
export async function storeEnvelope(ext: Ext, expectedSeedCt: unknown, envelope: unknown): Promise<StoreResult> {
  const first = expectedSeedCt === null;
  const next = first || isStr(expectedSeedCt) ? envelopeShape(envelope) : null;
  if (next === null) return 'malformed';
  return serial(async () => {
    const current = await ext.local.get(VAULT_KEY);
    if (first) {
      if (current !== undefined) return 'wallet-exists';
    } else {
      if (!isObj(current)) return 'no-wallet';
      if (!isObj(current.seed) || current.seed.ct !== expectedSeedCt) return 'busy';
    }
    const names = new Map<number, string>();
    if (isObj(current) && Array.isArray(current.accounts)) {
      for (const a of current.accounts as unknown[]) if (isObj(a) && isInt(a.index) && isStr(a.name)) names.set(a.index, a.name);
    }
    const accounts: AccountView[] = [];
    for (const a of next.accounts) {
      const name = names.get(a.index) ?? cleanName(a.name);
      if (name === null) return 'malformed';
      accounts.push({...a, name});
    }
    await ext.local.set(VAULT_KEY, {...next, accounts});
    return 'stored';
  });
}
