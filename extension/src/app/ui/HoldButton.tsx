import {useEffect, useRef, useState, type KeyboardEvent, type PointerEvent} from 'react';
import {ExtIcon} from './ExtIcon';

/** A clock the hold reads (injectable: a test holds and releases on its own time). */
export interface HoldClock {
  now(): number;
  /** Calls `f` every `ms` until the returned stop is called. */
  every(ms: number, f: () => void): () => void;
}
export const realClock: HoldClock = {
  now: () => Date.now(),
  every: (ms, f) => {
    const id = setInterval(f, ms);
    return () => clearInterval(id);
  },
};
/** How often the fill and the count move while held. */
export const HOLD_TICK_MS = 30;

/**
 * #37's long-press CTA (index.html #s37c: `.btn-primary.s7-longpress`, `--danger`, an inner `.fill` scaled by the share
 * held). Pointer down (the primary button only), or Space / Enter held on the focused button (repeats ignored), starts
 * it; pointer up, leave or cancel, keyup and blur release it — back to the rest label, the fill reset. `disabled` (the
 * prop, not the DOM attribute) refuses a press and releases a hold in progress. Held for `holdMs` it calls `onHeld` once:
 * the hold itself is rule 6's lock (one call per completed hold, none after, and a second press while held neither
 * restarts nor doubles it). While held the label counts the seconds left with one decimal ("Hold to delete · 0.4 s");
 * `prefers-reduced-motion` hides the fill (app.css), the count still runs.
 */
export function HoldButton({
  label,
  holdMs,
  disabled,
  onHeld,
  onPressing,
  clock = realClock,
}: {
  label: string;
  holdMs: number;
  disabled: boolean;
  onHeld: () => void;
  onPressing?: (pressing: boolean) => void;
  clock?: HoldClock;
}) {
  const [share, setShare] = useState<number | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const done = useRef(false);
  /**
   * The press in progress (0: none). A release clears it first, before it stops the clock: a tick that still runs after
   * the release (queued behind a stall, or a clock whose stop lands late) belongs to a press that ended, and completes
   * nothing — a release that already happened always wins (fix round 1, M4).
   */
  const pressId = useRef(0);
  const presses = useRef(0);
  const latest = useRef({onHeld, onPressing, disabled});
  latest.current = {onHeld, onPressing, disabled};

  const release = () => {
    pressId.current = 0;
    if (stop.current === null) return;
    stop.current();
    stop.current = null;
    setShare(null);
    latest.current.onPressing?.(false);
  };
  const press = () => {
    if (latest.current.disabled || done.current || stop.current !== null) return;
    const started = clock.now();
    presses.current += 1;
    const id = presses.current;
    pressId.current = id;
    setShare(0);
    latest.current.onPressing?.(true);
    stop.current = clock.every(HOLD_TICK_MS, () => {
      if (pressId.current !== id) return;
      const held = clock.now() - started;
      if (held < holdMs) return setShare(held / holdMs);
      pressId.current = 0;
      stop.current?.();
      stop.current = null;
      done.current = true;
      setShare(1);
      latest.current.onPressing?.(false);
      latest.current.onHeld();
    });
  };
  // Unmounted mid-press: the tick stops, and the owner hears the press ended (fix round 1, M3: #37's Cancel is not left
  // disabled when the hold goes while pressed).
  useEffect(
    () => () => {
      pressId.current = 0;
      if (stop.current === null) return;
      stop.current();
      stop.current = null;
      latest.current.onPressing?.(false);
    },
    [],
  );
  useEffect(() => {
    if (disabled) release();
  }, [disabled]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (!e.repeat) press();
  };
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') release();
  };
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    press();
  };
  const left = share === null ? null : Math.max(0, holdMs - share * holdMs) / 1000;
  return (
    <button
      type="button"
      className="btn btn-primary s7-longpress app-hold"
      disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={release}
      onContextMenu={e => e.preventDefault()}
    >
      <span className="fill" aria-hidden="true" style={{transform: `scaleX(${share ?? 0})`}} />
      <span className="label app-hold-label">
        <ExtIcon name="trash" size={18} />
        {left === null ? label : `${label} · `}
        {left === null ? null : <span className="noc-numeral">{`${left.toFixed(1)} s`}</span>}
      </span>
    </button>
  );
}
