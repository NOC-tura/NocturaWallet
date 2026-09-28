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

function validAccounts(v: unknown): v is SessionAccount[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(
      a =>
        typeof a === 'object' && a !== null &&
        Number.isInteger((a as SessionAccount).index) &&
        typeof (a as SessionAccount).publicKey === 'string' &&
        typeof (a as SessionAccount).secretKey === 'string',
    )
  );
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
      await setSession(ext, accounts);
      await armAutolock(ext);
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
