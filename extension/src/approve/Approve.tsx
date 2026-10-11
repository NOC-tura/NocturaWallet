import {useCallback, useEffect, useRef, useState} from 'react';
import type {ApproveClient, Decision, PendingView} from './client';
import {Connect} from './Connect';
import {Locked} from './Locked';

/** §2.3 (review 2 M3, review 1 L1): the window polls this often while it shows anything — so an unlock, an expiry or a new head reaches it. */
export const POLL_MS = 1_000;

/**
 * approve.html's one component (spec §2.3, §4.3; C5, C13, D11). The window holds no state and no listener: it asks
 * `dapp.pending` on mount, on focus and visibilitychange, after each decision, and every POLL_MS while it shows a
 * request (review 1 L1, R33: one read a second, and the window exists only while something is pending) — so an unlock,
 * an expiry or a new head reaches it within a second. `none` closes the window. A decision runs through `dapp.decide`; the background validates it as if this page
 * were untrusted (C13), and the window then asks again. Only the newest answer counts (a slower, older one sets
 * nothing), and nothing is set after the window unmounts.
 */
export function Approve({client, close}: {client: ApproveClient; close: () => void}) {
  const [view, setView] = useState<PendingView | null>(null);
  const [busy, setBusy] = useState(false);
  const reads = useRef(0);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    const n = ++reads.current;
    const v = await client.pending();
    if (!alive.current || n !== reads.current || v === null) return;
    if (v.state === 'none') {
      close();
      return;
    }
    setView(v);
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

  const polling = view !== null && view.state !== 'none';
  useEffect(() => {
    if (!polling) return;
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [polling, refresh]);

  const request = view !== null && view.state !== 'none' ? view.request : null;
  const decide = useCallback(
    async (d: Decision) => {
      if (request === null) return;
      setBusy(d.decision === 'approve');
      try {
        await client.decide(request.requestId, d);
      } finally {
        if (alive.current) setBusy(false);
        await refresh();
      }
    },
    [client, request, refresh],
  );

  if (view === null || view.state === 'none' || request === null) return <div className="screen app-approve" aria-busy="true" />;
  if (view.state === 'locked') return <Locked request={request} waiting={view.waiting} onReject={() => decide({decision: 'reject'})} />;
  const inProgress = busy || view.state === 'deciding';
  // A new head is a new screen: its gates, scope and account start over (keyed by request).
  return <Connect key={request.requestId} request={request} waiting={view.waiting} notice={view.windowNotice} busy={inProgress} onDecide={decide} />;
}
