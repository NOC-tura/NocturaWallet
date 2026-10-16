import type {Ext} from '../../ext';
import {BLOCKED_KEY, blockedOf, isBlocked} from './blocked';
import {GRANTS_KEY, MAX_GRANTS, grantsOf} from './grants';
import {deliver, liveOrigins, runtimeFor, sendChange} from './ports';
import {DAPP_SESSION_KEY, EMPTY_SESSION, readDappSession, type Entry} from './store';
import {promised, restartAnswer} from './queue';
import {markDue} from '../pendingStore';

/**
 * The lock hook (spec §2.4, review H3, review 2 M6). autolock.ts's lock() IS the hook: every lock — the auto-lock
 * alarm, vault.lock (and the vault page's lockOnMismatch), onStartup, onWindowRemoved, forgetWallet, vault.setKeys's
 * failure path — runs these steps, the first three in ONE sessionMutex section:
 *  1. read the queue, the recorded window and which open ports' origins hold a grant;
 *  2. clear the session (keys, session grants, queue, undo buffer);
 *  3. write back the answered entries plus every formerly open entry answered `rejected` (a `deciding` one as a
 *     restart, §1.5 — nothing has left the extension; B1c-2: a send with its signed bytes recorded is answered its
 *     signature instead), so a relay's resume still finds them;
 * then, outside it: 4. close the approval window (errors ignored); 5. deliver the answers and send `change []` to the
 * ports of origins that held a grant — and only to those (review M3: an ungranted page learns nothing of lock timing),
 * never a blocked host's (final review m1).
 * `inSection` runs inside the caller's sessionMutex section; it never takes a mutex (sessionMutex is not re-entrant).
 *
 * Fail-closed (fix round 2, Important 1(a) — start.test.ts "the browser-closed lock still fires when the dApp
 * window-removed path throws"): step 1's reads are storage.session / storage.local and so can themselves throw (a
 * quota failure, a corrupted value). The clear below is the one thing a lock must never skip for that reason — a
 * broken dApp queue must never mean the wallet's keys survive a lock — so a failure in step 1 is logged and treated
 * as an empty session: nothing to answer, no window recorded, nobody notified; the clear, the flag reset and the
 * alarm/afterLock steps run exactly as they would for a genuinely empty queue.
 */
export interface LockOutcome {
  windowId: number | null;
  answered: Entry[];
  notify: string[];
}

/** The host of a stored grant's origin ('' if it is not a URL — then it matches no block). Local: decide.ts imports autolock.ts. */
function hostOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return '';
  }
}

export async function lockInSection(ext: Ext, now: number): Promise<LockOutcome> {
  let s = EMPTY_SESSION;
  let notify: string[] = [];
  try {
    s = await readDappSession(ext);
    const persistent = grantsOf(await ext.local.get(GRANTS_KEY), 'persistent', MAX_GRANTS);
    // Final review m1 (D3, symmetric to the unlock hook): a blocked host's lingering grant (a restore keeps both the
    // block and the grant) learns nothing — not even the lock's timing.
    const blocked = blockedOf(await ext.local.get(BLOCKED_KEY));
    const granted = new Set([...s.grants, ...persistent].filter(g => !isBlocked(blocked, hostOf(g.origin))).map(g => g.origin));
    notify = [...liveOrigins(ext)].filter(o => granted.has(o));
  } catch (e) {
    console.warn('dApp lock hook: reading the session before the clear failed; locking anyway, with nothing to answer', e);
  }
  await ext.session.clear();
  // The next unlock runs the unlock hook again (§2.4).
  runtimeFor(ext).hooked = false;
  const answered: Entry[] = [];
  const kept = s.queue.map(e => {
    if (e.state === 'answered') return e;
    // A send whose signed bytes are recorded is answered its signature (B1c-2, C17): the broadcast still runs.
    const done: Entry = {...e, state: 'answered', answer: e.state === 'deciding' ? restartAnswer(e) : {error: 'rejected'}, answeredAt: now};
    answered.push(done);
    return done;
  });
  // Review 1 M1: a send answered its signature here is owed to the route before the answer is written back. A failed
  // write is logged and the answer kept: the effect still running broadcasts it (R15); only a stopped one leaves it unsent.
  await markDue(ext, promised(answered)).catch(e => console.warn('dApp lock hook: a promised send was not marked due', e));
  if (kept.length > 0) await ext.session.set(DAPP_SESSION_KEY, {...EMPTY_SESSION, queue: kept});
  return {windowId: s.window?.id ?? null, answered, notify};
}

export async function afterLock(ext: Ext, o: LockOutcome): Promise<void> {
  if (o.windowId !== null) await ext.dappWindows.remove(o.windowId).catch(() => undefined);
  deliver(ext, o.answered);
  sendChange(ext, new Map(o.notify.map(origin => [origin, []])));
}
