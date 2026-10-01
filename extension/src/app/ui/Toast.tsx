import {useEffect, useRef} from 'react';
import {ExtIcon} from './ExtIcon';

/** The design's `.copy-toast` pill: shown for `ms`, then gone. */
export function Toast({text, onDone, ms = 1800}: {text: string; onDone: () => void; ms?: number}) {
  // The latest callback, without restarting the timer on every render of the parent.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), ms);
    return () => clearTimeout(t);
  }, [text, ms]);
  return (
    <div className="copy-toast" role="status">
      <ExtIcon name="check" size={16} />
      <span>{text}</span>
    </div>
  );
}
