import {useEffect, useRef} from 'react';
import {ExtIcon} from './ExtIcon';

/** #44's user-cancelled toast (spec §4.7, E7): the design's `.s9-toast-cancelled` pill with its ✕, for 1.8 s. */
export const CANCELLED_TEXT = 'Transaction cancelled. No fees charged.';
export const CANCELLED_MS = 1_800;

export function CancelledToast({onDone}: {onDone: () => void}) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), CANCELLED_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="s9-toast-cancelled" role="status">
      <ExtIcon name="close" size={18} />
      <div className="body">{CANCELLED_TEXT}</div>
    </div>
  );
}
