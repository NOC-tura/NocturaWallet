import {useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';

/** Cardinal rule 6: no double submit — 500 ms at least, and never before the action settles. */
export const LOCK_MS = 500;

/**
 * A button that disables itself synchronously in its click handler and comes back no earlier than
 * LOCK_MS after the click AND not before `onPress`'s promise settles (spec §7.6). The ref, not only the
 * state, guards: a second click in the same frame, before React re-renders, is refused too.
 *
 * A rejected `onPress` is logged and swallowed here: the button only re-enables. The caller owns the
 * failure UI — an action that can fail must say so on its own screen.
 */
export function LockedButton({
  onPress,
  children,
  className = 'btn btn-primary',
  disabled = false,
  label,
  keepFocus = false,
  focusElsewhere,
  pressed,
  describedBy,
  wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
}: {
  onPress: () => Promise<unknown> | void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  label?: string;
  /**
   * B1b-2b §4.3 (keyboard reorder): a button that had the focus when pressed takes it back once it is enabled again —
   * the lock disables it, and a disabled (or moved) button loses the focus to the page. Only from the page: a focus the
   * user moved elsewhere meanwhile is left where it is.
   */
  keepFocus?: boolean;
  /**
   * keepFocus, when the button is disabled as the lock ends (a row moved to the end): the flag is dropped — it never takes
   * the focus later — and this is asked to put the focus somewhere sensible instead (only while the page has it).
   */
  focusElsewhere?: () => void;
  /** A toggle's state (aria-pressed): B1b-2b's picker options and the accounts manager's row select. */
  pressed?: boolean;
  /** aria-describedby: lines drawn outside the button that belong to it (the accounts manager's address and balance). */
  describedBy?: string;
  wait?: (ms: number) => Promise<void>;
}) {
  const busy = useRef(false);
  const [locked, setLocked] = useState(false);
  const self = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  useLayoutEffect(() => {
    if (locked || !refocus.current) return;
    refocus.current = false;
    const at = document.activeElement;
    if (at !== null && at !== document.body) return;
    if (disabled) focusElsewhere?.();
    else self.current?.focus();
  }, [locked, disabled]);
  /** False once unmounted: an action that settles after the screen went sets nothing. */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const press = () => {
    if (busy.current || disabled) return;
    busy.current = true;
    refocus.current = keepFocus && document.activeElement === self.current;
    setLocked(true);
    const floor = wait(LOCK_MS);
    let action: Promise<unknown>;
    try {
      action = Promise.resolve(onPress());
    } catch (e) {
      action = Promise.reject(e);
    }
    action = action.catch((e: unknown) => console.warn('action failed', e));
    void Promise.all([floor, action]).then(() => {
      busy.current = false;
      if (alive.current) setLocked(false);
    });
  };
  return (
    <button ref={self} type="button" className={[className, locked ? 'is-busy' : ''].filter(c => c !== '').join(' ') || undefined} disabled={disabled || locked} aria-label={label} aria-pressed={pressed} aria-describedby={describedBy} onClick={press}>
      {children}
    </button>
  );
}
