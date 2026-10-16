import type {Ext} from '../../ext';
import type {SessionAccount} from '../../vault/accounts';
import {createMutex} from '../mutex';
import {getSession, sessionMutex} from '../session';
import {BLOCKED_KEY, blockedOf, type Blocked} from './blocked';
import {GRANTS_KEY, MAX_GRANTS, grantOf, grantsOf, type Grant} from './grants';
import {LIMITS_KEY, limitsOf, type Limits} from './limits';
import {simStateOf, type SimState} from './simulate';
import {DAPP_TXS_KEY, dappTxsOf, type DappTx} from './dappTxs';

/**
 * The dApp provider's state (spec §1.5, §2). storage.session holds what dies with the session — the request queue,
 * the session grants, the approval window's id and its `opening` marker, the undo buffer — under one key, `v1_dapp_session`;
 * storage.local holds the persistent grants (grants.ts), the blocks (blocked.ts) and the limits (limits.ts).
 *
 * dappSection is THE queue mutex the spec names: every read-modify-write of any of them runs inside one, which takes
 * this module's mutex and then sessionMutex (lock order: dappMutex → sessionMutex; nothing under sessionMutex takes
 * dappMutex — the lock hook, which runs inside sessionMutex, reads and rewrites `v1_dapp_session` itself and never takes it).
 * A section sees the session (locked or not) as of the moment it runs, so a check and the write it guards are never
 * split by a lock (setSessionIf's pattern, §2.3 "unlocked").
 */
export const DAPP_SESSION_KEY = 'v1_dapp_session';

/** Spec §1.6. `send-failed` (B1c-2, rev 3.3): an approved `signAndSendTransaction` whose bytes never reached the network. */
export type ErrorCode = 'rejected' | 'unauthorized' | 'request-pending' | 'busy' | 'timeout' | 'invalid-request' | 'send-failed';
export const ERROR_CODES: readonly ErrorCode[] = ['rejected', 'unauthorized', 'request-pending', 'busy', 'timeout', 'invalid-request', 'send-failed'];
export type Answer = {result: Record<string, unknown>} | {error: ErrorCode};
/**
 * B1c-2: the two transaction requests, and `mismatch` — the window's notice that a site asked to sign with an account
 * granted to another origin (#48 "origin-mismatch · auto-reject"): the page was answered `unauthorized` at once; the
 * entry only shows the user what was refused, and never has a decidable approval.
 */
export type EntryType = 'connect' | 'signMessage' | 'signTransaction' | 'signAndSendTransaction' | 'mismatch';
export const ENTRY_TYPES: readonly EntryType[] = ['connect', 'signMessage', 'signTransaction', 'signAndSendTransaction', 'mismatch'];
export type Decision = 'approve' | 'reject' | 'report' | 'block';

/** One request that needs the user (§1.5 step 1). */
export interface Entry {
  /** 128 random bits, base64url (review 2 M1). */
  requestId: string;
  /** The relay's own id for it: a re-sent request with the same id is the same request (idempotent, C9). */
  pageId: string;
  origin: string;
  host: string;
  tabId: number;
  /** sender.documentId where the browser reports it (Chrome 106+), else null. */
  documentId: string | null;
  type: EntryType;
  /** signMessage: the account it names and the message, base64. */
  account: string | null;
  message: string | null;
  /** signTransaction / signAndSendTransaction (B1c-2): the transactions exactly as the page sent them, base64; else null. */
  transactions: string[] | null;
  /** mismatch (B1c-2): the origin the named account is granted to; else null. */
  granted: string | null;
  /** A transaction request's newest simulation (simulate.ts) — null before the first one answers. */
  sim: SimState | null;
  /** A transaction request's re-authentication challenge (signTx.ts), once Approve asked for one; else null. */
  challengeId: string | null;
  /** signAndSendTransaction: the signed bytes and their signature, recorded BEFORE the broadcast (C17, §1.5 step 2); else null. */
  sent: {wire: string; signature: string} | null;
  arrivedAt: number;
  state: 'queued' | 'deciding' | 'answered';
  /** The worker instance that wrote `deciding` (C17): another instance's `deciding` entry is a restart. */
  decidedBy: string | null;
  /** When `deciding` was written (review 1 M1): an effect that has not answered DECIDING_TTL_MS later is dead. */
  decidingAt: number | null;
  decision: {kind: Decision; account: string | null; scope: Grant['scope'] | null} | null;
  answer: Answer | null;
  answeredAt: number | null;
}

export interface Undo {
  token: string;
  grant: Grant;
  expiresAt: number;
}

export interface DappSession {
  queue: Entry[];
  /** Session grants (scope 'session'). */
  grants: Grant[];
  /** The approval window: its id and the request it last showed (windows.onRemoved rejects only that one). */
  window: {id: number; showing: string | null} | null;
  /** The `opening` marker (§2.3): a windows.create is in flight since this UTC ms. */
  opening: number | null;
  undo: Undo[];
}

/** A fresh, unshared value every call (fix round 1, CRITICAL 1): `readDappSession`'s "nothing stored" branch
 * used to return `{...EMPTY_SESSION}`, a shallow copy whose `queue`/`grants`/`undo` were still this module's own
 * arrays — a section doing `tx.s.queue.push(...)` (the one write pattern this file exists to support) mutated
 * `EMPTY_SESSION.queue` itself, for the worker's life, and a lock clearing storage.session did not undo that: the
 * next "nothing stored" read handed back the same, now-polluted array, unvalidated. `EMPTY_SESSION` below stays one
 * instance for comparisons only; nothing may be handed this reference to mutate. */
function emptySession(): DappSession {
  return {queue: [], grants: [], window: null, opening: null, undo: []};
}

export const EMPTY_SESSION: DappSession = emptySession();

const isTime = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const isStr = (x: unknown): x is string => typeof x === 'string';
const isNullStr = (x: unknown): x is string | null => x === null || typeof x === 'string';
const STATES: readonly string[] = ['queued', 'deciding', 'answered'];
const DECISIONS: readonly string[] = ['approve', 'reject', 'report', 'block'];

function answerOf(x: unknown): Answer | null | undefined {
  if (x === null) return null;
  if (typeof x !== 'object') return undefined;
  const o = x as Record<string, unknown>;
  if (typeof o.error === 'string') return (ERROR_CODES as readonly string[]).includes(o.error) ? {error: o.error as ErrorCode} : undefined;
  return typeof o.result === 'object' && o.result !== null && !Array.isArray(o.result) ? {result: o.result as Record<string, unknown>} : undefined;
}

function decisionOf(x: unknown): Entry['decision'] | undefined {
  if (x === null) return null;
  if (typeof x !== 'object') return undefined;
  const o = x as Record<string, unknown>;
  if (!isStr(o.kind) || !DECISIONS.includes(o.kind) || !isNullStr(o.account)) return undefined;
  if (o.scope !== null && o.scope !== 'session' && o.scope !== 'persistent') return undefined;
  return {kind: o.kind as Decision, account: o.account, scope: o.scope};
}

/** A recorded send: exactly two strings (undefined: anything else — the entry is then dropped, never half-read). */
function sentOf(x: unknown): Entry['sent'] | undefined {
  if (typeof x !== 'object' || x === null) return undefined;
  const {wire, signature} = x as Record<string, unknown>;
  return isStr(wire) && isStr(signature) ? {wire, signature} : undefined;
}

/** A stored entry, rebuilt field by field; null when anything is off (it is dropped, never "repaired"). */
export function entryOf(x: unknown): Entry | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as Record<string, unknown>;
  if (!isStr(o.requestId) || !isStr(o.pageId) || !isStr(o.origin) || !isStr(o.host) || !isTime(o.tabId) || !isNullStr(o.documentId)) return null;
  if (typeof o.type !== 'string' || !(ENTRY_TYPES as readonly string[]).includes(o.type) || !isNullStr(o.account) || !isNullStr(o.message) || !isTime(o.arrivedAt)) return null;
  // B1c-2's fields: absent on an entry an older background wrote (read as null), else exactly their shape.
  const transactions = o.transactions === undefined || o.transactions === null ? null : Array.isArray(o.transactions) && o.transactions.every(isStr) ? (o.transactions as string[]).slice() : undefined;
  const granted = o.granted === undefined ? null : isNullStr(o.granted) ? o.granted : undefined;
  const challengeId = o.challengeId === undefined ? null : isNullStr(o.challengeId) ? o.challengeId : undefined;
  if (transactions === undefined || granted === undefined || challengeId === undefined) return null;
  // A simulation that does not read back is simply simulated again (never trusted half-read).
  const sim = o.sim === undefined || o.sim === null ? null : simStateOf(o.sim);
  const sent = o.sent === undefined || o.sent === null ? null : sentOf(o.sent);
  if (sent === undefined) return null;
  if (!isStr(o.state) || !STATES.includes(o.state) || !isNullStr(o.decidedBy) || (o.answeredAt !== null && !isTime(o.answeredAt))) return null;
  if (o.decidingAt !== null && !isTime(o.decidingAt)) return null;
  const decision = decisionOf(o.decision);
  const answer = answerOf(o.answer);
  if (decision === undefined || answer === undefined) return null;
  return {
    requestId: o.requestId,
    pageId: o.pageId,
    origin: o.origin,
    host: o.host,
    tabId: o.tabId,
    documentId: o.documentId,
    type: o.type as EntryType,
    account: o.account,
    message: o.message,
    transactions,
    granted,
    sim,
    challengeId,
    sent,
    arrivedAt: o.arrivedAt,
    state: o.state as Entry['state'],
    decidedBy: o.decidedBy,
    decidingAt: o.decidingAt,
    decision,
    answer,
    answeredAt: o.answeredAt as number | null,
  };
}

export async function readDappSession(ext: Ext): Promise<DappSession> {
  const v = await ext.session.get(DAPP_SESSION_KEY);
  if (typeof v !== 'object' || v === null) return emptySession();
  const o = v as Record<string, unknown>;
  const queue = Array.isArray(o.queue) ? (o.queue as unknown[]).map(entryOf).filter((e): e is Entry => e !== null) : [];
  const w = o.window as {id?: unknown; showing?: unknown} | null | undefined;
  const window = typeof w === 'object' && w !== null && isTime(w.id) && isNullStr(w.showing) ? {id: w.id, showing: w.showing} : null;
  const undo: Undo[] = [];
  for (const u of Array.isArray(o.undo) ? (o.undo as unknown[]) : []) {
    if (typeof u !== 'object' || u === null) continue;
    const {token, grant, expiresAt} = u as Record<string, unknown>;
    const g = typeof grant === 'object' && grant !== null ? grantOf(grant, (grant as {scope?: unknown}).scope === 'session' ? 'session' : 'persistent') : null;
    if (isStr(token) && g !== null && isTime(expiresAt)) undo.push({token, grant: g, expiresAt});
  }
  return {
    queue,
    grants: grantsOf(o.grants, 'session', MAX_GRANTS),
    window,
    opening: isTime(o.opening) ? o.opening : null,
    undo,
  };
}

/** What a section sees and may change. `s`, `grants`, `blocked` and `limits` are written back when changed. */
export interface Tx {
  s: DappSession;
  /** Persistent grants, newest first. */
  grants: Grant[];
  blocked: Blocked[];
  limits: Limits;
  /** B1c-2: the transactions sites had signed here (dappTxs.ts), newest first. */
  txs: DappTx[];
  /** The unlocked session's accounts, or null while locked — as of this section. */
  session: SessionAccount[] | null;
  now: number;
}

const dappMutex = createMutex();

export async function dappSection<T>(ext: Ext, now: number, fn: (tx: Tx) => Promise<T> | T): Promise<T> {
  return dappMutex(() =>
    sessionMutex(async () => {
      const [s, grants, blocked, limits, txs, session] = await Promise.all([
        readDappSession(ext),
        ext.local.get(GRANTS_KEY),
        ext.local.get(BLOCKED_KEY),
        ext.local.get(LIMITS_KEY),
        ext.local.get(DAPP_TXS_KEY),
        getSession(ext),
      ]);
      const tx: Tx = {s, grants: grantsOf(grants, 'persistent', MAX_GRANTS), blocked: blockedOf(blocked), limits: limitsOf(limits, now), txs: dappTxsOf(txs), session, now};
      const before = {s: JSON.stringify(tx.s), grants: JSON.stringify(tx.grants), blocked: JSON.stringify(tx.blocked), limits: JSON.stringify(tx.limits), txs: JSON.stringify(tx.txs)};
      const out = await fn(tx);
      if (JSON.stringify(tx.s) !== before.s) await ext.session.set(DAPP_SESSION_KEY, tx.s);
      if (JSON.stringify(tx.grants) !== before.grants) await ext.local.set(GRANTS_KEY, tx.grants);
      if (JSON.stringify(tx.blocked) !== before.blocked) await ext.local.set(BLOCKED_KEY, tx.blocked);
      if (JSON.stringify(tx.limits) !== before.limits) await ext.local.set(LIMITS_KEY, tx.limits);
      if (JSON.stringify(tx.txs) !== before.txs) await ext.local.set(DAPP_TXS_KEY, tx.txs);
      return out;
    }),
  );
}

/**
 * Removes the dApp-owned storage.local keys (B1c-2: four — v1_dapp_txs too), under the same lock order a dappSection uses (fix round 1,
 * IMPORTANT 1): accountsStore's removeWalletData (forgetWallet step 7, and storeEnvelope's first-write backstop)
 * used to remove them with a plain `ext.local.remove`, outside dappMutex and sessionMutex — a dappSection already
 * in flight reads the old lists before the remove and writes them back (unchanged, or changed by the caller's own
 * edit) after it, undoing the delete or the first-write's cleanup. Going through dappMutex here queues this call
 * behind any open dappSection (and any open dappSection behind this call), so the two can never interleave: either
 * the section's whole read-modify-write finishes first and this then removes its result, or this finishes first
 * and the next section starts from nothing. Never call this from inside a dappSection's callback — dappMutex is
 * not re-entrant.
 */
export async function wipeDappStores(ext: Ext): Promise<void> {
  return dappMutex(() =>
    sessionMutex(async () => {
      await ext.local.remove(GRANTS_KEY);
      await ext.local.remove(BLOCKED_KEY);
      await ext.local.remove(LIMITS_KEY);
      await ext.local.remove(DAPP_TXS_KEY);
    }),
  );
}

/** The grant an origin holds now (session first — there is at most one per origin across both), or null. */
export function grantIn(tx: Pick<Tx, 's' | 'grants'>, origin: string): Grant | null {
  return tx.s.grants.find(g => g.origin === origin) ?? tx.grants.find(g => g.origin === origin) ?? null;
}

/** Removes an origin's grant, both scopes; the removed grant, or null. */
export function dropGrant(tx: Pick<Tx, 's' | 'grants'>, origin: string): Grant | null {
  const g = grantIn(tx, origin);
  tx.s.grants = tx.s.grants.filter(x => x.origin !== origin);
  tx.grants = tx.grants.filter(x => x.origin !== origin);
  return g;
}

/** Writes a grant in its scope (replacing the origin's grant in either), newest first. */
export function putGrant(tx: Pick<Tx, 's' | 'grants'>, g: Grant): void {
  dropGrant(tx, g.origin);
  if (g.scope === 'session') tx.s.grants = [g, ...tx.s.grants];
  else tx.grants = [g, ...tx.grants];
}
