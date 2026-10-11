import {base64urlnopad} from '@scure/base';
import type {Ext} from '../../ext';
import type {WalletDeps} from '../deps';
import {deliver, runtimeFor, sendChange, type PageOrigin, type Runtime} from './ports';
import {withRecent} from './grants';
import {withRejection} from './limits';
import {dappSection, grantIn, putGrant, type Answer, type Entry, type Tx} from './store';
import {unlockWork} from './unlockHook';

/**
 * The request queue (spec §1.5, §2.3; C3, C4, C9, C17): one FIFO queue across origins in storage.session, decided one
 * at a time in the approval window. Every access runs `queueAccess`: one dappSection that first sweeps (expiry, a dead
 * instance's `deciding` entry, unacked answers past ten minutes, expired undo records), then the caller's change;
 * after the section commits, the answers are delivered on the ports, the `change` events sent and the expiry alarm
 * re-armed. Nothing is delivered before it is stored, so a resume always finds what a port missed.
 */
export const REQUEST_TTL_MS = 5 * 60_000;
/**
 * Review 1 M1: a `deciding` entry of this instance is an effect in flight (a grant write, a signature: milliseconds).
 * One still `deciding` this long after it was written died between its sections (a thrown storage call) — it is
 * answered `rejected` (nothing left the extension), so the queue, the window and the page move on.
 */
export const DECIDING_TTL_MS = 30_000;
export const ANSWER_TTL_MS = 10 * 60_000;
/** "Open" = queued or deciding (C3); at most this many in total — the next gets `busy`. */
export const MAX_OPEN = 5;
export const QUEUE_ALARM = 'dapp-queue';
/** Expiry is checked on every queue access and by this alarm (§2.3: every 30 s). */
export const QUEUE_TICK_MINUTES = 0.5;

export const isOpenEntry = (e: Entry): boolean => e.state === 'queued' || e.state === 'deciding';

/** The queue head: the first open entry (FIFO across origins). */
export function headOf(tx: Pick<Tx, 's'>): Entry | null {
  return tx.s.queue.find(isOpenEntry) ?? null;
}

/** 128 random bits, base64url (review 2 M1). */
export const newRequestId = (deps: Pick<WalletDeps, 'randomBytes'>): string => base64urlnopad.encode(deps.randomBytes(16));

/** What an access does besides storage: answers to deliver and `change` events to send, after the commit. */
export interface Effects {
  answered: Entry[];
  changes: Map<string, string[]>;
}

export function answer(fx: Effects, e: Entry, a: Answer, now: number): void {
  e.state = 'answered';
  e.answer = a;
  e.answeredAt = now;
  fx.answered.push(e);
}

/**
 * The user said no (Reject, the window's ✕, closing the window — C4): answered `rejected`, counted for C14 per host and
 * per tab, and recorded on the origin's grant when it holds one (§2.1: a rejected first connect has no grant, so it is
 * not recorded).
 */
export function userRejected(tx: Tx, fx: Effects, e: Entry): void {
  answer(fx, e, {error: 'rejected'}, tx.now);
  tx.limits = withRejection(tx.limits, e.host, e.tabId, tx.now);
  const g = grantIn(tx, e.origin);
  if (g !== null) putGrant(tx, withRecent(g, e.type, tx.now, 'rejected'));
}

/** Answers an origin's `queued` entries (never a `deciding` one: its effect is running) with this error. */
export function rejectQueued(tx: Tx, fx: Effects, match: (e: Entry) => boolean, code: 'rejected' = 'rejected'): void {
  for (const e of tx.s.queue) if (e.state === 'queued' && match(e)) answer(fx, e, {error: code}, tx.now);
}

/**
 * The housekeeping of every access: a `queued` or `deciding` entry older than five minutes is answered `timeout` (C4,
 * counted from arrivedAt by the background's clock); a `deciding` entry another instance wrote is a restart (C17,
 * §1.5 step 2 — nothing left the extension: answered `rejected`), and so is one of this instance still `deciding`
 * DECIDING_TTL_MS after it was written (review 1 M1); THEN the unlock hook, when it has not run for this session in
 * this instance (unlockHook.ts; true when it ran — the caller marks it done inside the section, and clears it again
 * if the commit fails) — fix round 1 item 4 (C4): the hook must run AFTER the TTL/restart sweep above, never before,
 * so a `queued` connect already past REQUEST_TTL_MS is answered `timeout` by the sweep and is no longer `queued` by
 * the time the hook looks for one to grant; an answered entry nobody acked is dropped ten minutes after its answer;
 * an expired undo record is dropped.
 */
export function sweep(tx: Tx, fx: Effects, rt: Pick<Runtime, 'instance' | 'hooked'>): boolean {
  const hook = tx.session !== null && !rt.hooked;
  const instance = rt.instance;
  for (const e of tx.s.queue) {
    // C4 "queued or shown": five minutes from arrivedAt, whatever the open state (review 1 M1).
    if (isOpenEntry(e) && tx.now - e.arrivedAt >= REQUEST_TTL_MS) answer(fx, e, {error: 'timeout'}, tx.now);
    // C17: another instance's `deciding` is a restart; this instance's, DECIDING_TTL_MS after it was written, a dead effect.
    else if (e.state === 'deciding' && (e.decidedBy !== instance || e.decidingAt === null || tx.now - e.decidingAt >= DECIDING_TTL_MS)) answer(fx, e, {error: 'rejected'}, tx.now);
  }
  // §2.4: the unlock hook, on the first access of an unlocked session (again if it threw last time) — after expiry
  // above, so it never grants a connect the sweep just timed out.
  if (hook) unlockWork(tx, fx.changes, (e, a) => answer(fx, e, a, tx.now));
  tx.s.queue = tx.s.queue.filter(e => e.state !== 'answered' || e.answeredAt === null || tx.now - e.answeredAt < ANSWER_TTL_MS);
  tx.s.undo = tx.s.undo.filter(u => u.expiresAt > tx.now);
  return hook;
}

/**
 * §2.3 (review 2 H2): a port or request from a tab whose document changed (Chrome's documentId) — the old document's
 * `queued` requests are answered `rejected`. Without a documentId (Firefox) nothing happens here; C3's per-tab cap and
 * C14's per-tab cooldown bound the effect.
 */
export function documentChanged(tx: Tx, fx: Effects, p: PageOrigin): void {
  if (p.documentId === null) return;
  rejectQueued(tx, fx, e => e.tabId === p.tabId && e.documentId !== null && e.documentId !== p.documentId);
}

/** Arms the expiry tick while anything is in the queue; clears it otherwise. */
async function tick(ext: Ext, queued: boolean): Promise<void> {
  if (queued) await ext.alarms.create(QUEUE_ALARM, {delayInMinutes: QUEUE_TICK_MINUTES});
  else await ext.alarms.clear(QUEUE_ALARM);
}

/** One queue access (see the header). `fn` runs inside the section, after the sweep. */
export async function queueAccess<T>(ext: Ext, deps: Pick<WalletDeps, 'now'>, fn: (tx: Tx, fx: Effects) => T | Promise<T>): Promise<T> {
  const fx: Effects = {answered: [], changes: new Map()};
  const rt = runtimeFor(ext);
  let queued = false;
  let hooked = false;
  let out: T;
  try {
    out = await dappSection(ext, deps.now(), async tx => {
      hooked = sweep(tx, fx, rt);
      const r = await fn(tx, fx);
      queued = tx.s.queue.length > 0;
      // Review 1 L6: inside the section (under sessionMutex), so a lock — which clears the flag in its own section —
      // can never run between the hook's commit and this write.
      if (hooked) rt.hooked = true;
      return r;
    });
  } catch (err) {
    // The commit failed (or fn threw): the hook did not happen — run it again at the next access. Clearing is the
    // safe direction even if a lock ran meanwhile (a locked session never runs the hook).
    if (hooked) rt.hooked = false;
    throw err;
  }
  deliver(ext, fx.answered);
  sendChange(ext, fx.changes);
  await tick(ext, queued).catch(e => console.warn('dApp queue: the expiry tick was not armed', e));
  return out;
}

/**
 * The unlock hook's call from vault.setKeys (§2.4): one queue access — its sweep runs the hook (unlockHook.ts), then the
 * answers are delivered and the `change` events sent.
 */
export async function runUnlockHook(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<void> {
  await queueAccess(ext, deps, () => undefined);
}
