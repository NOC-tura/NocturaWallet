import type {Ext} from '../../ext';
import type {WalletDeps} from '../deps';
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
  const marker = await queueAccess(ext, deps, (tx, fx) => {
    if (tx.s.window !== null || headOf(tx) === null) return null;
    if (tx.s.opening !== null && tx.now - tx.s.opening < OPENING_STALE_MS) return null;
    if (!budgetLeft(tx.limits, tx.now)) {
      // C14: beyond the budget every request that would need this window is declined with no window; the next one
      // that opens says so (Q24).
      rejectQueued(tx, fx, () => true);
      tx.limits = {...tx.limits, notice: true};
      return null;
    }
    tx.limits = withWindow(tx.limits, tx.now);
    tx.s.opening = tx.now;
    return tx.now;
  });
  if (marker === null) return;
  let id: number | null = null;
  try {
    id = await ext.dappWindows.create({page: APPROVE_PAGE, width: WINDOW_WIDTH, height: WINDOW_HEIGHT});
  } finally {
    const orphan = await queueAccess(ext, deps, tx => {
      // The marker is gone (a lock cleared it, or a stale-marker retry replaced it): this window is nobody's.
      if (tx.s.opening !== marker) return true;
      tx.s.opening = null;
      if (id !== null) tx.s.window = {id, showing: null};
      return false;
    });
    if (orphan && id !== null) await ext.dappWindows.remove(id).catch(() => undefined);
  }
}

/**
 * windows.onRemoved for the approval window (§2.3, C4): closing it rejects only the request it was showing, and only if
 * that is still `queued` (a `deciding` one finishes; an answered one stays answered). Another window id is not ours. A
 * queue that still holds requests gets a window again (the budget applies).
 */
export async function onApprovalWindowRemoved(ext: Ext, deps: Pick<WalletDeps, 'now'>, id: number): Promise<void> {
  const ours = await queueAccess(ext, deps, (tx, fx) => {
    if (tx.s.window?.id !== id) return false;
    const showing = tx.s.window.showing;
    tx.s.window = null;
    const e = tx.s.queue.find(x => x.requestId === showing);
    if (e?.state === 'queued') userRejected(tx, fx, e);
    return true;
  });
  if (ours) await ensureWindow(ext, deps);
}

/**
 * The expiry alarm (§2.3): a queue access that delivers whatever expired (the window learns on its next poll), then a
 * window for a head that has none — so a request whose window failed to open is not left waiting for the next request.
 */
export async function onQueueAlarm(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<void> {
  await queueAccess(ext, deps, () => undefined);
  await ensureWindow(ext, deps);
}
