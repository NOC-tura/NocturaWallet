import type {Ext} from '../ext';
import {createMutex} from './mutex';
import {ENVELOPE_BYTES, ENVELOPE_KDF_MAX, ENVELOPE_KDF_MIN, MAX_ACCOUNTS, b64Length, cleanName} from '../shared/envelopeRules';
import {envelopeRevision} from '../shared/envelopeRevision';

export {MAX_ACCOUNTS, MAX_NAME_LENGTH, cleanName} from '../shared/envelopeRules';

/**
 * The envelope. The background is its one writer (storage.local has no compare-and-set across
 * contexts): it edits names itself, and stores the envelope the vault page re-encrypts when an
 * account is added or removed (storeEnvelope). Both writes run under the same mutex.
 */
export const VAULT_KEY = 'v1_vault';

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

export type StoreResult = 'stored' | 'malformed' | 'no-wallet' | 'wallet-exists' | 'busy' | 'stored-invalid';
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
const REVISION = /^[0-9a-f]{64}$/;

function kdfInBounds(kdf: Json): boolean {
  return (['m', 't', 'p'] as const).every(k => {
    const v = kdf[k];
    return isInt(v) && v >= ENVELOPE_KDF_MIN[k] && v <= ENVELOPE_KDF_MAX[k];
  });
}

const bytesExactly = (x: unknown, n: number): x is string => b64Length(x) === n;
const bytesAtLeast = (x: unknown, n: number): x is string => (b64Length(x) ?? -1) >= n;

/**
 * The envelope's shape, with the vault's own bounds (checkEnvelope's, copied in
 * src/shared/envelopeRules.ts and pinned to it by src/vault/__tests__/envelopeBounds.test.ts): the
 * Argon2id cost within [PRODUCTION_KDF, KDF_CAP], every byte string strict base64 of its length.
 * Rebuilt field by field, so a stray field — a seed, a key — is never stored. The background holds
 * no vault code and cannot check the ciphertext itself; the vault page proved the factor and
 * re-encrypted. Names are checked in storeEnvelope, against the stored envelope. Null otherwise.
 */
function envelopeShape(x: unknown): StoredEnvelope | null {
  if (!isObj(x) || x.v !== 1 || (x.scheme !== 'slip10' && x.scheme !== 'cli')) return null;
  const {kdf, seed, password, passkey} = x;
  if (!isObj(kdf) || kdf.alg !== 'argon2id' || !kdfInBounds(kdf) || !bytesExactly(kdf.salt, ENVELOPE_BYTES.salt)) return null;
  if (!isObj(seed) || !bytesExactly(seed.iv, ENVELOPE_BYTES.iv) || !bytesAtLeast(seed.ct, ENVELOPE_BYTES.minCt)) return null;
  if (!isObj(password) || !bytesExactly(password.wrapped, ENVELOPE_BYTES.wrapped)) return null;
  let pk: StoredEnvelope['passkey'];
  if (passkey !== undefined) {
    if (!isObj(passkey)) return null;
    const {credentialId, prfSalt, wrapped} = passkey;
    if (!bytesAtLeast(credentialId, ENVELOPE_BYTES.minCredentialId) || !bytesExactly(prfSalt, ENVELOPE_BYTES.prfSalt) || !bytesExactly(wrapped, ENVELOPE_BYTES.wrapped)) return null;
    pk = {credentialId, prfSalt, wrapped};
  }
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
    kdf: {alg: 'argon2id', m: kdf.m as number, t: kdf.t as number, p: kdf.p as number, salt: kdf.salt},
    seed: {iv: seed.iv, ct: seed.ct},
    password: {wrapped: password.wrapped},
    ...(pk === undefined ? {} : {passkey: pk}),
    accounts,
  };
}

/**
 * What an account change or a passkey enrolment may not change: the scheme, the whole KDF (salt and
 * cost), the password wrap, and the public key of any account in both envelopes. Only the seed
 * ciphertext, the account list and the passkey wrap may differ.
 *
 * B1 has no password-change flow. A future one rewrites the password wrap and may choose a new salt
 * or cost: it must revisit this rule (and its tests) rather than route around it.
 */
function sameWallet(current: StoredEnvelope, next: StoredEnvelope): boolean {
  const {kdf: a} = current;
  const {kdf: b} = next;
  if (next.scheme !== current.scheme || b.salt !== a.salt || b.m !== a.m || b.t !== a.t || b.p !== a.p) return false;
  if (next.password.wrapped !== current.password.wrapped) return false;
  const keys = new Map(current.accounts.map(x => [x.index, x.publicKey]));
  return next.accounts.every(x => !keys.has(x.index) || keys.get(x.index) === x.publicKey);
}

/**
 * The vault page re-encrypted the seed for a changed account list and hands the envelope over
 * (`vault.storeEnvelope`); the background is the one writer of v1_vault. Under the mutex renames
 * take, the write lands only if the stored envelope still has the revision the vault page opened
 * (`expectedRevision`, src/shared/envelopeRevision.ts — every field but the names): otherwise
 * something else landed in between — another account change, a passkey enrolment — and the vault
 * page re-opens and retries ('busy'). A rename changes no revision, so it never makes a store busy;
 * instead the current name of every account present in both is kept (names are outside the AAD).
 * A new account's name must be one a rename would accept (cleanName), or nothing is written.
 * Anything sameWallet refuses — a changed scheme, KDF, password wrap or existing account's public
 * key — is 'malformed'. A stored envelope that is itself not well formed is 'stored-invalid' (not
 * 'busy': re-opening it cannot help, so the vault page stops retrying).
 *
 * `expectedRevision: null` is onboarding's FIRST write: accepted only while v1_vault is absent
 * (every name is then new, so every name is cleaned); with anything stored, 'wallet-exists' and
 * nothing is written — onboarding never overwrites a wallet. A revision with no wallet stored is
 * 'no-wallet'.
 */
export async function storeEnvelope(ext: Ext, expectedRevision: unknown, envelope: unknown): Promise<StoreResult> {
  const first = expectedRevision === null;
  if (!first && !(isStr(expectedRevision) && REVISION.test(expectedRevision))) return 'malformed';
  const next = envelopeShape(envelope);
  if (next === null) return 'malformed';
  return serial(async () => {
    const stored = await ext.local.get(VAULT_KEY);
    const names = new Map<number, string>();
    if (first) {
      if (stored !== undefined) return 'wallet-exists';
    } else {
      if (!isObj(stored)) return 'no-wallet';
      const current = envelopeShape(stored);
      if (current === null) return 'stored-invalid';
      if (envelopeRevision(current) !== expectedRevision) return 'busy';
      if (!sameWallet(current, next)) return 'malformed';
      for (const a of current.accounts) names.set(a.index, a.name);
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
