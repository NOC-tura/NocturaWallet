import type {Ext} from '../ext';
import {createMutex} from './mutex';

/** The envelope (written by the vault page). The background reads it and edits names only. */
export const VAULT_KEY = 'v1_vault';
export const MAX_NAME_LENGTH = 32;

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
 * The vault page also writes v1_vault (adding or removing an account re-encrypts the envelope), and
 * storage.local has no transactions. So this is a compare-and-set: immediately before writing, the
 * envelope is read again, and the renamed copy is written only if nothing changed since it was
 * built. Otherwise the rename is redone once on the fresh envelope; if that changes too, 'busy'.
 * What remains is the gap between that last read and the write itself — one storage round-trip,
 * which no API here can close.
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
