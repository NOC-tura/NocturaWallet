import {useEffect, useRef} from 'react';

/**
 * Esc on a flow screen goes back one step (spec §1.4) — the screen's own step, never the shell's pop: leaving
 * #19 must discard the prepared send first (E7), #20's back keeps it, and #21 has no back while broadcasting.
 * Off while `enabled` is false (a sheet open on top handles its own Esc). The latest handler is used, without
 * re-registering on every render.
 */
export function useEscape(handler: () => void, enabled = true): void {
  const current = useRef(handler);
  current.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') current.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);
}
