import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import type {Ext} from '../ext';
import type {SessionAccount} from '../vault/accounts';
import {getSession, setSession} from './session';
import {armAutolock, lock} from './autolock';

/** What the browser reports about a message's origin (runtime.MessageSender). */
export interface Sender {
  id?: string;
  origin?: string;
  url?: string;
  tab?: unknown;
  frameId?: number;
}

/**
 * Two partitions (spec §1). Privileged types come only from this extension's own pages;
 * page types (none until B1c) only from https top frames. `sender.origin` is what the browser
 * sets — never the URL the message claims, and never "has a tab", which a full-tab
 * extension page also has.
 */
export const PRIVILEGED = ['vault.setKeys', 'vault.lock', 'vault.status', 'activity.ping'] as const;
export const PAGE: readonly string[] = [];

type Result = {ok: true; data?: unknown} | {ok: false; error: string};

function isOwnPage(ext: Ext, s: Sender): boolean {
  return s.id === ext.runtimeId && s.origin === ext.extensionOrigin;
}

/**
 * null on anything that isn't this extension's origin, including a `url` that fails to parse.
 * Built from `protocol` + `host`, not the `.origin` getter: the WHATWG URL spec only computes
 * `.origin` for a fixed list of "special" schemes, and `chrome-extension:` / `moz-extension:`
 * are not on it outside an actual browser — Node's parser (this test environment) returns the
 * literal string "null" for them, which would make every real page path check fail.
 */
function pagePath(ext: Ext, s: Sender): string | null {
  if (!s.url) return null;
  try {
    const u = new URL(s.url);
    return `${u.protocol}//${u.host}` === ext.extensionOrigin ? u.pathname : null;
  } catch {
    return null;
  }
}

/** A signing key's secretKey is a raw Ed25519 keypair encoding: 32-byte seed + 32-byte pubkey. */
const SECRET_KEY_BYTES = 64;

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * The secretKey must be a real keypair FOR the address it is stored under: its embedded public
 * half equals the base58-decoded `publicKey`, and its seed half derives that same key. Anything
 * else would sign as one address while the wallet shows another.
 */
function isValidAccount(a: unknown): a is SessionAccount {
  if (typeof a !== 'object' || a === null) return false;
  const {index, publicKey, secretKey} = a as SessionAccount;
  if (!Number.isInteger(index) || index < 0) return false;
  if (typeof publicKey !== 'string' || publicKey.length === 0) return false;
  if (typeof secretKey !== 'string') return false;
  let sk: Uint8Array | undefined;
  try {
    const pub = base58.decode(publicKey);
    sk = base64.decode(secretKey);
    if (sk.length !== SECRET_KEY_BYTES || pub.length !== 32) return false;
    return sameBytes(sk.subarray(32), pub) && sameBytes(ed25519.getPublicKey(sk.subarray(0, 32)), pub);
  } catch {
    return false;
  } finally {
    sk?.fill(0);
  }
}

function validAccounts(v: unknown): v is SessionAccount[] {
  return Array.isArray(v) && v.length > 0 && v.every(isValidAccount);
}

export async function handleMessage(ext: Ext, msg: unknown, sender: Sender): Promise<Result> {
  if (typeof msg !== 'object' || msg === null || typeof (msg as {type?: unknown}).type !== 'string') {
    return {ok: false, error: 'malformed'};
  }
  const type = (msg as {type: string}).type;
  const privileged = (PRIVILEGED as readonly string[]).includes(type);
  if (!privileged && !PAGE.includes(type)) return {ok: false, error: 'unknown type'};
  if (privileged && !isOwnPage(ext, sender)) return {ok: false, error: 'forbidden'};

  switch (type) {
    case 'vault.setKeys': {
      if (pagePath(ext, sender) !== '/unlock.html') return {ok: false, error: 'forbidden'};
      const accounts = (msg as {accounts?: unknown}).accounts;
      if (!validAccounts(accounts)) return {ok: false, error: 'malformed'};
      // Fail closed: keys in storage.session with no alarm armed would never auto-lock, while
      // the vault page reports "Unlock failed". Anything that throws after the write undoes it.
      try {
        await setSession(ext, accounts);
        await armAutolock(ext);
      } catch (e) {
        await lock(ext);
        throw e;
      }
      return {ok: true};
    }
    case 'vault.lock':
      await lock(ext);
      return {ok: true};
    case 'vault.status': {
      const s = await getSession(ext);
      return {ok: true, data: {unlocked: s !== null, accounts: (s ?? []).map(a => ({index: a.index, publicKey: a.publicKey}))}};
    }
    case 'activity.ping':
      if ((await getSession(ext)) !== null) await armAutolock(ext);
      return {ok: true};
    default:
      return {ok: false, error: 'unknown type'};
  }
}
