import {useRef, useState, type ReactNode} from 'react';

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
  wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
}: {
  onPress: () => Promise<unknown> | void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  label?: string;
  wait?: (ms: number) => Promise<void>;
}) {
  const busy = useRef(false);
  const [locked, setLocked] = useState(false);
  const press = () => {
    if (busy.current || disabled) return;
    busy.current = true;
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
      setLocked(false);
    });
  };
  return (
    <button type="button" className={`${className}${locked ? ' is-busy' : ''}`} disabled={disabled || locked} aria-label={label} onClick={press}>
      {children}
    </button>
  );
}
