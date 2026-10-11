import type {Ext} from '../../ext';
import {GRANTS_KEY, MAX_GRANTS, grantsOf} from './grants';
import {deliver, liveOrigins, runtimeFor, sendChange} from './ports';
import {DAPP_SESSION_KEY, EMPTY_SESSION, readDappSession, type Entry} from './store';

/**
 * The lock hook (spec §2.4, review H3, review 2 M6). autolock.ts's lock() IS the hook: every lock — the auto-lock
 * alarm, vault.lock (and the vault page's lockOnMismatch), onStartup, onWindowRemoved, forgetWallet, vault.setKeys's
 * failure path — runs these steps, the first three in ONE sessionMutex section:
 *  1. read the queue, the recorded window and which open ports' origins hold a grant;
 *  2. clear the session (keys, session grants, queue, undo buffer);
 *  3. write back the answered entries plus every formerly open entry answered `rejected` (a `deciding` one as a
 *     restart, §1.5 — nothing has left the extension), so a relay's resume still finds them;
 * then, outside it: 4. close the approval window (errors ignored); 5. deliver the answers and send `change []` to the
 * ports of origins that held a grant — and only to those (review M3: an ungranted page learns nothing of lock timing).
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

export async function lockInSection(ext: Ext, now: number): Promise<LockOutcome> {
  let s = EMPTY_SESSION;
  let notify: string[] = [];
  try {
    s = await readDappSession(ext);
    const persistent = grantsOf(await ext.local.get(GRANTS_KEY), 'persistent', MAX_GRANTS);
    const granted = new Set([...s.grants, ...persistent].map(g => g.origin));
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
    const done: Entry = {...e, state: 'answered', answer: {error: 'rejected'}, answeredAt: now};
    answered.push(done);
    return done;
  });
  if (kept.length > 0) await ext.session.set(DAPP_SESSION_KEY, {...EMPTY_SESSION, queue: kept});
  return {windowId: s.window?.id ?? null, answered, notify};
}

export async function afterLock(ext: Ext, o: LockOutcome): Promise<void> {
  if (o.windowId !== null) await ext.dappWindows.remove(o.windowId).catch(() => undefined);
  deliver(ext, o.answered);
  sendChange(ext, new Map(o.notify.map(origin => [origin, []])));
}
