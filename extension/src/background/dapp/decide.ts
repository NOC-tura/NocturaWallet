import type {Ext} from '../../ext';
import type {WalletDeps} from '../deps';
import {armAutolock} from '../autolock';
import {getSession} from '../session';
import {readWalletView} from '../accountsStore';
import {readSettings} from '../settings';
import {displayOrder} from '../walletApi';
import {isBlocked, withBlock} from './blocked';
import {classify, siteName, type IdnDetail, type LookalikeRule} from './classify';
import {MAX_GRANTS, type Grant} from './grants';
import {inCooldown, rejectionsOf, REJECTIONS_FOR_COOLDOWN} from './limits';
import {runtimeFor} from './ports';
import {answer, headOf, isOpenEntry, queueAccess, rejectQueued, userRejected, type Effects} from './queue';
import {dropGrant, grantIn, putGrant, type Decision, type Entry, type Tx} from './store';

/**
 * The approval window's two messages (spec §1.4, §2.3, C13, C17): `dapp.pending` — what the window shows — and
 * `dapp.decide` — validated here as if the window were untrusted (C13: "the window decides nothing"). A decision's
 * effect happens once (§1.5 step 2): `deciding` is written in the same queue section that passed the checks, and only
 * then does the effect run; its outcome is written as `answered` in a later section that first confirms the entry is
 * still this instance's `deciding` one (a lock in between answered it `rejected`, §2.4).
 */

/** What the origin card and the banners say about a site (§2.5, C7): never a name the page supplied. */
export interface SiteView {
  kind: 'verified' | 'unknown' | 'lookalike';
  /** C7: the known list's name for a verified host, else the host's second-level label — never the imitated brand. */
  name: string;
  /** The listed domain a lookalike imitates (shown only in the banner), or null. */
  imitates: string | null;
  rule: LookalikeRule | null;
  idn: IdnDetail | null;
  /** An `xn--` label anywhere in the host (47b's Q18 line for an unknown one). */
  international: boolean;
}

export function siteView(host: string): SiteView {
  const c = classify(host);
  return {
    kind: c.kind,
    name: siteName(host, c),
    imitates: c.kind === 'lookalike' ? c.imitates : null,
    rule: c.kind === 'lookalike' ? c.rule : null,
    idn: c.kind === 'lookalike' ? c.idn : null,
    international: c.kind === 'unknown' ? c.international : host.split('.').some(l => l.startsWith('xn--')),
  };
}

export interface AccountChoice {
  index: number;
  name: string;
  publicKey: string;
}

/** #47's details: the account picker (Q01; the wallet's unlocked accounts in display order, the active one chosen) and the cap (Q16). */
export interface ConnectDetail {
  accounts: AccountChoice[];
  selected: number;
  cap: boolean;
}

export interface RequestView {
  requestId: string;
  type: Entry['type'];
  origin: string;
  host: string;
  site: SiteView;
  /** C14: this host or tab already has two rejections in ten minutes — the screen offers [Block this site] (Q17). */
  offerBlock: boolean;
  /** Null while locked: the locked screen shows the origin card only (D11). */
  connect: ConnectDetail | null;
}

export type PendingView =
  | {state: 'none'}
  | {state: 'locked' | 'deciding' | 'request'; request: RequestView; waiting: number; windowNotice: boolean};

/** The wallet's accounts as the popup orders them (E14), only those unlocked, and the active one (C1: only a default). */
async function choices(ext: Ext, tx: Tx): Promise<{accounts: AccountChoice[]; selected: number}> {
  const [view, settings] = await Promise.all([readWalletView(ext), readSettings(ext)]);
  const unlocked = new Set((tx.session ?? []).map(a => a.publicKey));
  const accounts = displayOrder(view?.accounts ?? [], settings.accountOrder).filter(a => unlocked.has(a.publicKey));
  const selected = accounts.some(a => a.index === settings.selectedAccount) ? settings.selectedAccount : (accounts[0]?.index ?? 0);
  return {accounts: accounts.map(a => ({index: a.index, name: a.name, publicKey: a.publicKey})), selected};
}

async function viewOf(ext: Ext, tx: Tx, e: Entry): Promise<RequestView> {
  const unlocked = tx.session !== null;
  let connect: ConnectDetail | null = null;
  if (unlocked && e.type === 'connect') {
    const c = await choices(ext, tx);
    connect = {...c, cap: grantIn(tx, e.origin) === null && tx.grants.length >= MAX_GRANTS};
  }
  return {
    requestId: e.requestId,
    type: e.type,
    origin: e.origin,
    host: e.host,
    site: siteView(e.host),
    offerBlock: rejectionsOf(tx.limits, e.host, e.tabId) >= REJECTIONS_FOR_COOLDOWN - 1,
    connect,
  };
}

/**
 * dapp.pending (§2.3, §4.3): the head as the window shows it — a `deciding` head as `deciding` (never decidable),
 * `locked` while locked (D11), `none` when the queue is empty (the window closes itself) — with how many more wait (Q12)
 * and the budget notice (Q24, once). Records which request the window shows: closing the window rejects that one.
 */
export async function pending(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<PendingView> {
  return queueAccess(ext, deps, async (tx): Promise<PendingView> => {
    const h = headOf(tx);
    if (h === null) return {state: 'none'};
    if (tx.s.window !== null) tx.s.window = {...tx.s.window, showing: h.requestId};
    const windowNotice = tx.limits.notice;
    if (windowNotice) tx.limits = {...tx.limits, notice: false};
    const waiting = tx.s.queue.filter(isOpenEntry).length - 1;
    const state = tx.session === null ? 'locked' : h.state === 'deciding' ? 'deciding' : 'request';
    return {state, request: await viewOf(ext, tx, h), waiting, windowNotice};
  });
}

export type DecideError = 'malformed' | 'not-head' | 'expired' | 'locked' | 'unknown-account' | 'scope' | 'blocked' | 'cap' | 'no-grant' | 'account';
export interface DecideRequest {
  requestId: string;
  decision: Decision;
  account: string | null;
  scope: Grant['scope'] | null;
}

const DECISIONS: readonly string[] = ['approve', 'reject', 'report', 'block'];

/** dapp.decide's shape: a request id, a decision, and — for an approval — the account (and a connect's scope). */
export function decideRequestOf(msg: Record<string, unknown>): DecideRequest | null {
  const {requestId, decision, account, scope} = msg;
  if (typeof requestId !== 'string' || typeof decision !== 'string' || !DECISIONS.includes(decision)) return null;
  if (account !== undefined && typeof account !== 'string') return null;
  if (scope !== undefined && scope !== 'session' && scope !== 'persistent') return null;
  return {requestId, decision: decision as Decision, account: account ?? null, scope: scope ?? null};
}

/** Blocking a host (§2.6): every grant of that host (both scopes, every port and scheme) revoked, its queued requests rejected. */
export function blockHost(tx: Tx, fx: Effects, host: string): void {
  const imitates = siteView(host).imitates;
  tx.blocked = withBlock(tx.blocked, host, imitates, tx.now);
  const origins = new Set([...tx.s.grants, ...tx.grants].filter(g => hostOf(g.origin) === host).map(g => g.origin));
  for (const origin of origins) {
    dropGrant(tx, origin);
    fx.changes.set(origin, []);
  }
  rejectQueued(tx, fx, e => e.host === host);
}

export function hostOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return '';
  }
}

/** §2.3's table, for an approval: each refusal in its row's order. Null: approvable. */
function approvalRefused(tx: Tx, e: Entry, d: DecideRequest): DecideError | null {
  // unlocked — read inside sessionMutex (dappSection), so a grant is never written after a concurrent lock.
  if (tx.session === null) return 'locked';
  if (d.account === null || !tx.session.some(a => a.publicKey === d.account)) return 'unknown-account';
  if (e.type === 'connect') {
    if (d.scope === null) return 'malformed';
    // C12: an unknown or lookalike origin can only get "This session only".
    if (d.scope === 'persistent' && classify(e.host).kind !== 'verified') return 'scope';
  }
  if (isBlocked(tx.blocked, e.host) || inCooldown(tx.limits, e.host, e.tabId, tx.now)) return 'blocked';
  // §2.1: beyond 200 persistent grants a connect has only [Reject] (Q16).
  if (e.type === 'connect' && grantIn(tx, e.origin) === null && tx.grants.length >= MAX_GRANTS) return 'cap';
  if (e.type === 'signMessage') {
    // review 2 M9: the grant must still be held for the request's account.
    if (grantIn(tx, e.origin)?.account !== e.account) return 'no-grant';
    if (d.account !== e.account) return 'account';
  }
  return null;
}

/** The connect effect: the grant written and the request answered — in one section, only if still this instance's `deciding` entry. */
async function finishConnect(ext: Ext, deps: Pick<WalletDeps, 'now'>, requestId: string, instance: string): Promise<void> {
  await queueAccess(ext, deps, (tx, fx) => {
    const e = tx.s.queue.find(x => x.requestId === requestId);
    if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance || e.decision === null) return;
    const {account, scope} = e.decision;
    // The section's own checks again: a block or an account removed since `deciding` was written end it here (each
    // tested, review 1 M4). A lock cannot reach this line — the lock hook answers a `deciding` entry first — so
    // `tx.session === null` is the type's narrowing and a second line of defence.
    if (account === null || scope === null || tx.session === null || !tx.session.some(a => a.publicKey === account) || isBlocked(tx.blocked, e.host)) {
      answer(fx, e, {error: 'rejected'}, tx.now);
      return;
    }
    putGrant(tx, {origin: e.origin, account, scope, connectedAt: tx.now, lastUsedAt: tx.now, recent: [{type: 'connect', at: tx.now, outcome: 'approved'}]});
    answer(fx, e, {result: {accounts: [account]}}, tx.now);
  });
}

/** dapp.decide (§2.3): one refusal per row of the table, else the decision — a reject at once, an approval through `deciding`. */
export async function decide(ext: Ext, deps: WalletDeps, d: DecideRequest): Promise<{ok: true} | {ok: false; error: DecideError}> {
  const instance = runtimeFor(ext).instance;
  const out = await queueAccess(ext, deps, (tx, fx): DecideError | {approved: Entry['type']} | 'done' => {
    const e = tx.s.queue.find(x => x.requestId === d.requestId);
    // expiry: the sweep at the top of this section has answered an expired request `timeout`.
    if (e?.state === 'answered' && e.answer !== null && 'error' in e.answer && e.answer.error === 'timeout') return 'expired';
    // head: only the queue head, and only while `queued` (a `deciding` one is never decided twice).
    if (e === undefined || headOf(tx) !== e || e.state !== 'queued') return 'not-head';
    if (d.decision === 'reject') {
      userRejected(tx, fx, e);
      return 'done';
    }
    if (d.decision === 'report' || d.decision === 'block') {
      // Review 1 L2: a block writes the user's lists (it revokes grants) — refused while locked, as #49's messages are
      // (R8); the locked screen offers only [Reject].
      if (tx.session === null) return 'locked';
      userRejected(tx, fx, e);
      blockHost(tx, fx, e.host);
      return 'done';
    }
    const refused = approvalRefused(tx, e, d);
    if (refused !== null) return refused;
    e.state = 'deciding';
    e.decidedBy = instance;
    e.decidingAt = tx.now;
    e.decision = {kind: 'approve', account: d.account, scope: e.type === 'connect' ? d.scope : null};
    return {approved: e.type};
  });
  if (typeof out === 'string' && out !== 'done') return {ok: false, error: out};
  // §2.2: a decision in the window is a user action — it arms the auto-lock timer (page requests never do).
  if ((await getSession(ext)) !== null) await armAutolock(ext).catch(e => console.warn('dApp decide: the idle timer was not re-armed', e));
  if (typeof out === 'object') await finishConnect(ext, deps, d.requestId, instance);
  return {ok: true};
}
