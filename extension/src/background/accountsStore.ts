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

/**
 * Names are outside the seed's AES-GCM additionalData (spec §2), so renaming needs no key and no
 * re-encryption: every other field of the stored envelope is written back exactly as read.
 */
export async function renameAccount(ext: Ext, index: number, name: string): Promise<boolean> {
  return serial(async () => {
    const env = await ext.local.get(VAULT_KEY);
    if (!isObj(env) || accountsOf(env) === null) return false;
    const accounts = env.accounts as Json[];
    if (!accounts.some(a => a.index === index)) return false;
    await ext.local.set(VAULT_KEY, {...env, accounts: accounts.map(a => (a.index === index ? {...a, name} : a))});
    return true;
  });
}
