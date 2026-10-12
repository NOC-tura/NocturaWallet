import {base64urlnopad} from '@scure/base';
import type {Ext} from '../../ext';
import type {WalletDeps} from '../deps';
import {readWalletView} from '../accountsStore';
import {isBlocked, withoutBlock, type Blocked} from './blocked';
import {hostOf, siteView} from './decide';
import {MAX_GRANTS, type Grant, type Recent} from './grants';
import {queueAccess, rejectQueued} from './queue';
import {dropGrant, grantIn, putGrant} from './store';

/**
 * #49's messages (spec §1.4, §2.7, §4.4, D3, C2): the grants list, revoke with a single-shot undo, revoke-all, and the
 * blocked sites with unblock — from the popup or the tab only (messages.ts). Every one is refused while locked: the
 * list says which sites the user connects to (a controller ruling, as contacts.* — B1b-2b C12). The popup holds only
 * an undo token; the record stays in the background (review H2: the popup is never a grant writer).
 */
export const UNDO_MS = 5_000;
const TOKEN = /^[A-Za-z0-9_-]{22}$/;

export interface GrantView {
  origin: string;
  host: string;
  /** C7: the list name for a verified host, else the second-level label. */
  name: string;
  /** On the known list (#49's dot, §9). */
  verified: boolean;
  account: string;
  scope: Grant['scope'];
  connectedAt: number;
  lastUsedAt: number;
  recent: Recent[];
}

function viewOf(g: Grant): GrantView {
  const host = hostOf(g.origin);
  const site = siteView(host);
  return {origin: g.origin, host, name: site.name, verified: site.kind === 'verified', account: g.account, scope: g.scope, connectedAt: g.connectedAt, lastUsedAt: g.lastUsedAt, recent: g.recent};
}

export type Locked = {ok: false; error: 'locked'};
const LOCKED: Locked = {ok: false, error: 'locked'};

/** dapp.grants.list: persistent and (unlocked, so always here) session grants. */
export async function listGrants(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<{ok: true; data: {grants: GrantView[]}} | Locked> {
  return queueAccess(ext, deps, tx => (tx.session === null ? LOCKED : {ok: true as const, data: {grants: [...tx.s.grants, ...tx.grants].map(viewOf)}}));
}

/** dapp.grants.revoke {origin} (§2.7): the grant goes at once, `change []`, its queued requests rejected; an undo token for five seconds. */
export async function revokeGrant(ext: Ext, deps: Pick<WalletDeps, 'now' | 'randomBytes'>, origin: unknown) {
  if (typeof origin !== 'string') return {ok: false as const, error: 'malformed' as const};
  return queueAccess(ext, deps, (tx, fx) => {
    if (tx.session === null) return LOCKED;
    const g = dropGrant(tx, origin);
    if (g === null) return {ok: false as const, error: 'unknown-origin' as const};
    fx.changes.set(origin, []);
    rejectQueued(tx, fx, e => e.origin === origin);
    const token = base64urlnopad.encode(deps.randomBytes(16));
    tx.s.undo = [...tx.s.undo, {token, grant: g, expiresAt: tx.now + UNDO_MS}];
    return {ok: true as const, data: {undoToken: token}};
  });
}

export type UndoError = 'malformed' | 'locked' | 'unknown-token' | 'blocked' | 'granted' | 'unknown-account' | 'cap' | 'scope';

/**
 * dapp.grants.undo {undoToken} (§2.7): restores THAT record, single-shot — the token is spent by any attempt. Refused:
 * unknown or expired; locked; the host now blocked; the origin granted again meanwhile (never overwritten, review 2
 * L10); the account no longer in the wallet; the persistent cap reached; a persistent grant whose origin no longer
 * classifies verified (C12 holds on restore too).
 */
export async function undoRevoke(ext: Ext, deps: Pick<WalletDeps, 'now'>, token: unknown): Promise<{ok: true} | {ok: false; error: UndoError}> {
  if (typeof token !== 'string' || !TOKEN.test(token)) return {ok: false, error: 'malformed'};
  const view = await readWalletView(ext);
  const wallet = new Set((view?.accounts ?? []).map(a => a.publicKey));
  return queueAccess(ext, deps, (tx, fx): {ok: true} | {ok: false; error: UndoError} => {
    const record = tx.s.undo.find(u => u.token === token);
    tx.s.undo = tx.s.undo.filter(u => u.token !== token);
    if (record === undefined || record.expiresAt <= tx.now) return {ok: false, error: 'unknown-token'};
    if (tx.session === null) return {ok: false, error: 'locked'};
    const g = record.grant;
    const host = hostOf(g.origin);
    if (isBlocked(tx.blocked, host)) return {ok: false, error: 'blocked'};
    if (grantIn(tx, g.origin) !== null) return {ok: false, error: 'granted'};
    if (!wallet.has(g.account) || !tx.session.some(a => a.publicKey === g.account)) return {ok: false, error: 'unknown-account'};
    if (g.scope === 'persistent' && tx.grants.length >= MAX_GRANTS) return {ok: false, error: 'cap'};
    if (g.scope === 'persistent' && siteView(host).kind !== 'verified') return {ok: false, error: 'scope'};
    putGrant(tx, g);
    fx.changes.set(g.origin, [g.account]);
    return {ok: true};
  });
}

/** dapp.grants.revokeAll (49d): every grant, both scopes; `change []` to each; their queued requests rejected. No undo. */
export async function revokeAll(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<{ok: true} | Locked> {
  return queueAccess(ext, deps, (tx, fx) => {
    if (tx.session === null) return LOCKED;
    const origins = new Set([...tx.s.grants, ...tx.grants].map(g => g.origin));
    tx.s.grants = [];
    tx.grants = [];
    for (const o of origins) fx.changes.set(o, []);
    rejectQueued(tx, fx, e => origins.has(e.origin));
    return {ok: true as const};
  });
}

/** dapp.blocked.list (D3, Q13). */
export async function listBlocked(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<{ok: true; data: {blocked: Blocked[]}} | Locked> {
  return queueAccess(ext, deps, tx => (tx.session === null ? LOCKED : {ok: true as const, data: {blocked: tx.blocked}}));
}

/** dapp.blocked.remove {host} (§2.6): the block only — no grant comes back; the next connect shows #47. */
export async function unblock(ext: Ext, deps: Pick<WalletDeps, 'now'>, host: unknown) {
  if (typeof host !== 'string') return {ok: false as const, error: 'malformed' as const};
  return queueAccess(ext, deps, tx => {
    if (tx.session === null) return LOCKED;
    tx.blocked = withoutBlock(tx.blocked, host);
    return {ok: true as const};
  });
}

/**
 * An account removed from the wallet (B1b E13; spec §2.1, review 2 M9): its grants are deleted (both scopes), those
 * origins' queued requests answered `rejected`, and `change {accounts: []}` sent to them.
 */
export async function dropAccountGrants(ext: Ext, deps: Pick<WalletDeps, 'now'>, publicKeys: readonly string[]): Promise<void> {
  const gone = new Set(publicKeys);
  await queueAccess(ext, deps, (tx, fx) => {
    for (const g of [...tx.s.grants, ...tx.grants]) {
      if (!gone.has(g.account)) continue;
      dropGrant(tx, g.origin);
      fx.changes.set(g.origin, []);
      rejectQueued(tx, fx, e => e.origin === g.origin);
    }
  });
}
