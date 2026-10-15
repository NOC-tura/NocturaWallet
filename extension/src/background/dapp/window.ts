import type {Ext} from '../../ext';
import type {WalletDeps} from '../deps';
import {lock} from '../autolock';
import {budgetLeft, withWindow} from './limits';
import {headOf, queueAccess, rejectQueued, userRejected} from './queue';
import {readDappSession} from './store';

/**
 * The approval window (spec §2.3, review 1 M7, review 2 M2; C3, C14, D11). One at a time, always `approve.html`,
 * 412 × 720; it asks `dapp.pending` for what to show — no request data in a URL (C5). Opening runs in three steps:
 * under the queue mutex, if a head waits and no window is recorded, the window budget is checked and `{openingAt}` is
 * written; then windows.create; then, in one queue section, its id is recorded and the marker removed. A failed create
 * removes the marker (`finally`); a marker older than OPENING_STALE_MS is stale and the open is retried. A recorded id
 * is checked with windows.get before it counts as open.
 */
export const APPROVE_PAGE = 'approve.html';
export const WINDOW_WIDTH = 412;
export const WINDOW_HEIGHT = 720;
export const OPENING_STALE_MS = 10_000;

export async function ensureWindow(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<void> {
  const recorded = (await readDappSession(ext)).window;
  if (recorded !== null) {
    if (await ext.dappWindows.exists(recorded.id)) return;
    // Closed without our hearing of it (a restart lost the event): treat as closed.
    await queueAccess(ext, deps, tx => {
      if (tx.s.window?.id === recorded.id) tx.s.window = null;
    });
  }
  const decision = await queueAccess(ext, deps, (tx, fx) => {
    if (tx.s.window !== null || headOf(tx) === null) return null;
    if (tx.s.opening !== null && tx.now - tx.s.opening < OPENING_STALE_MS) return null;
    /**
     * Fix round 2, controller ruling channel 1: a window opened because the head is a mismatch notice is `focused:
     * false` — a page that triggered a notice must never learn, from `blur`/`document.hasFocus()` right after its
     * own `unauthorized` reply, that its request was the one that opened a window (which only happens when the
     * named account is this wallet's and granted elsewhere). A window for any real request stays `focused: true`,
     * exactly as before. Channel 2: a notice-caused open never checks or consumes the real WINDOW_BUDGET — its own
     * budget was already reserved when the notice was queued (pageApi.ts mismatchNotice, limits.ts
     * NOTICE_WINDOW_BUDGET); by the time it is head, it always opens.
     */
    const focused = headOf(tx)?.type !== 'mismatch';
    if (focused) {
      if (!budgetLeft(tx.limits, tx.now)) {
        // C14: beyond the budget every request that would need this window is declined with no window; the next one
        // that opens says so (Q24).
        rejectQueued(tx, fx, () => true);
        tx.limits = {...tx.limits, notice: true};
        return null;
      }
      tx.limits = withWindow(tx.limits, tx.now);
    }
    tx.s.opening = tx.now;
    return {marker: tx.now, focused};
  });
  if (decision === null) return;
  let id: number | null = null;
  try {
    id = await ext.dappWindows.create({page: APPROVE_PAGE, width: WINDOW_WIDTH, height: WINDOW_HEIGHT, focused: decision.focused});
  } finally {
    const orphan = await queueAccess(ext, deps, tx => {
      // The marker is gone (a lock cleared it, or a stale-marker retry replaced it): this window is nobody's.
      if (tx.s.opening !== decision.marker) return true;
      tx.s.opening = null;
      if (id !== null) tx.s.window = {id, showing: null};
      return false;
    });
    if (orphan && id !== null) await ext.dappWindows.remove(id).catch(() => undefined);
  }
}

/**
 * windows.onRemoved for the approval window (§2.3, §2.4, C4; fix round 1, review 2 L9/Important 1): closing it
 * rejects only the request it was showing, and only if that is still `queued` (a `deciding` one finishes; an
 * answered one stays answered). Another window id is not ours (returns `false`; nothing else happens here).
 *
 * The reopen-or-lock decision below must read `ext.windowCount()` BEFORE anything here can change it. The previous
 * version called `ensureWindow` unconditionally once a request was still queued — its own `windows.create` could
 * raise the count straight back to 1, so the browser-closed check that runs after it (index.ts's `onWindowRemoved`)
 * would then see a non-zero count and never lock: the approval popup that was the user's only open window got
 * silently replaced by a fresh one, on an unlocked wallet (§2.4: "closing the last browser window while [the popup]
 * is open does not lock; closing the popup then does"). So: zero means no window exists to show anything to — drain
 * the rest of the queue first (a background refusal, not the user's: Scope R11, it does not count toward C14's
 * cooldown), THEN lock; the lock then finds nothing open. (The lock would answer them as well — lockHook.ts answers
 * every open entry `rejected` and writes it back for resume — so the order no longer decides whether they are
 * answered; it makes these answers the drain's, delivered before the keys go.) Otherwise a window still exists, and
 * the approval window reopens for what remains (C14's budget still applies).
 *
 * Fix round 2 (Important 1): the lock must happen whenever the count is zero, whatever the drain did — a storage
 * error, a quota failure or a bad stored shape there must never leave the wallet unlocked after its last window
 * closed. The drain's own failure is only logged; it is not this call's reason to skip the lock.
 */
export async function onApprovalWindowRemoved(ext: Ext, deps: Pick<WalletDeps, 'now'>, id: number): Promise<boolean> {
  const ours = await queueAccess(ext, deps, (tx, fx) => {
    if (tx.s.window?.id !== id) return false;
    const showing = tx.s.window.showing;
    tx.s.window = null;
    const e = tx.s.queue.find(x => x.requestId === showing);
    if (e?.state === 'queued') userRejected(tx, fx, e);
    return true;
  });
  if (!ours) return false;
  if ((await ext.windowCount()) === 0) {
    try {
      await queueAccess(ext, deps, (tx, fx) => rejectQueued(tx, fx, () => true));
    } catch (e) {
      console.warn('dApp: draining the queue before the last-window lock failed', e);
    } finally {
      await lock(ext).catch(e => console.warn('dApp: lock after the last window closed failed', e));
    }
  } else {
    await ensureWindow(ext, deps);
  }
  return true;
}

/**
 * The expiry alarm (§2.3): a queue access that delivers whatever expired (the window learns on its next poll), then a
 * window for a head that has none — so a request whose window failed to open is not left waiting for the next request.
 */
export async function onQueueAlarm(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<void> {
  await queueAccess(ext, deps, () => undefined);
  await ensureWindow(ext, deps);
}
