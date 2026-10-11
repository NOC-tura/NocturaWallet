import {useEffect, useState} from 'react';

/** C15: a confirming CTA is held this long after the window gains focus and after each state change. */
export const ARM_MS = 500;

/**
 * C15 (review 1 M12, review 2 L8): false for ARM_MS after mount, after every change of `state` (an ack toggled, the
 * scope, the account, the 2-second confirm opening, the head request changing — the caller folds them into one key)
 * and after the window gains focus; then true. Reject never uses it. A page cannot time a click onto a window it
 * caused.
 */
export function useArmed(state: string, ms: number = ARM_MS): boolean {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hold = () => {
      setArmed(false);
      clearTimeout(timer);
      timer = setTimeout(() => setArmed(true), ms);
    };
    hold();
    window.addEventListener('focus', hold);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', hold);
    };
  }, [state, ms]);
  return armed;
}
