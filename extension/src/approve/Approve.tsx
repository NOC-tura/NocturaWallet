import {useCallback, useEffect, useRef, useState} from 'react';
import type {ApproveClient, Decision, PendingView} from './client';
import {Connect} from './Connect';
import {Locked} from './Locked';
import {Sign} from './Sign';

/** §2.3 (review 2 M3, review 1 L1): the window polls this often while it shows anything — so an unlock, an expiry or a new head reaches it. */
export const POLL_MS = 1_000;

/**
 * approve.html's one component (spec §2.3, §4.3; C5, C13, D11). The window holds no state and no listener: it asks
 * `dapp.pending` on mount, on focus and visibilitychange, after each decision, and every POLL_MS unconditionally
 * (review 1 L1, R33: one read a second; fix round 1 I3 — a malformed or momentarily-unreachable first read must not
 * leave the window blank forever, so polling does not wait for a first successful read either) — so an unlock, an
 * expiry or a new head reaches it within a second. `none` closes the window. A decision runs through `dapp.decide`;
 * the background validates it as if this page were untrusted (C13), and the window then asks again. Only the newest
 * answer counts (a slower, older one sets nothing), and nothing is set after the window unmounts.
 */
export function Approve({client, close}: {client: ApproveClient; close: () => void}) {
  const [view, setView] = useState<PendingView | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * Fix round 1, I1 (spec §4.3: "Q24 above the request, once" = shown, not flashed): the background's own notice flag
   * is one-shot — it clears on the very read that first sees it (decide.ts's `pending`), whether or not the window is
   * locked. Latch it here so it survives every later poll and the locked screen too, for as long as this head is up.
   */
  const [noticeSeen, setNoticeSeen] = useState(false);
  const reads = useRef(0);
  const alive = useRef(true);

  const lastRequestId = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    const n = ++reads.current;
    const v = await client.pending();
    if (!alive.current || n !== reads.current || v === null) return;
    if (v.state === 'none') {
      close();
      return;
    }
    setView(v);
    /**
     * Fix round 2 (same defect class as useArmed, found re-checking the budget-notice flake): the latch used to be
     * set by a separate effect keyed on `view`, which runs a tick after this `setView` commits — so a render could
     * paint `waiting` (straight from the new `view`) with the OLD `noticeSeen`. Setting both here, from the same
     * `v`, in the same tick (React batches the two `setState` calls from one callback into one commit) closes the
     * gap the same way the C15 fix did: compare against the fresh value directly, not a state only an effect sets.
     */
    if (v.request.requestId !== lastRequestId.current) {
      lastRequestId.current = v.request.requestId;
      setNoticeSeen(v.windowNotice);
    } else if (v.windowNotice) {
      setNoticeSeen(true);
    }
  }, [client, close]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const again = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', again);
    document.addEventListener('visibilitychange', again);
    return () => {
      alive.current = false;
      window.removeEventListener('focus', again);
      document.removeEventListener('visibilitychange', again);
    };
  }, [refresh]);

  // I3 (fix round 1): poll on this unconditionally, including before the first successful read — the window must
  // recover on its own from a single bad read, not only from the next focus/visibilitychange.
  useEffect(() => {
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const request = view !== null && view.state !== 'none' ? view.request : null;

  const decide = useCallback(
    async (d: Decision) => {
      if (request === null) return;
      setBusy(d.decision === 'approve');
      try {
        await client.decide(request.requestId, d);
      } finally {
        // M2 (fix round 1, C15): the refresh that can promote the next head (or close the window) must land before
        // busy clears — clearing it first re-enables Connect for one tick on the request that was just decided
        // (the arm key does not change, so nothing re-arms it).
        await refresh();
        if (alive.current) setBusy(false);
      }
    },
    [client, request, refresh],
  );

  if (view === null || view.state === 'none' || request === null) return <div className="screen app-approve" aria-busy="true" />;
  if (view.state === 'locked') return <Locked request={request} waiting={view.waiting} notice={noticeSeen} onReject={() => decide({decision: 'reject'})} />;
  const inProgress = busy || view.state === 'deciding';
  // A new head is a new screen: its gates, scope, account and confirm start over (keyed by request).
  if (request.type === 'signMessage') return <Sign key={request.requestId} request={request} waiting={view.waiting} notice={noticeSeen} busy={inProgress} onDecide={decide} />;
  return <Connect key={request.requestId} request={request} waiting={view.waiting} notice={noticeSeen} busy={inProgress} onDecide={decide} />;
}
