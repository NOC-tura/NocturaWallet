import {useEffect, useState} from 'react';

/** C15: a confirming CTA is held this long after the window gains focus and after each state change. */
export const ARM_MS = 500;
/** B1 §3 (spec §3.3 rev 3.6 "Holds"): on any screen with a red flag, a confirming CTA is held this long instead. */
export const FLAG_HOLD_MS = 1_500;

/**
 * C15 (review 1 M12, review 2 L8): false for ARM_MS after mount, after every change of `state` (an ack toggled, the
 * scope, the account, the 2-second confirm opening, the head request changing, busy going either way — the caller
 * folds them into one key) and after the window gains focus; then true. Reject never uses it. A page cannot time a
 * click onto a window it caused.
 *
 * Fix round 2 (controller ruling): a boolean `armed` that only an effect resets is wrong — on a key change, the
 * render that already has the new `state` still returns the OLD boolean (effects run after paint), so React can
 * commit one frame with the confirming CTA enabled before the effect's `setArmed(false)` lands; a queued click can
 * land in that gap. Storing the key the hold *finished for* instead, and comparing it to the current `state`
 * argument right here, closes the gap: the comparison itself changes the instant `state` does, in the very same
 * render — no effect has to run first for the CTA to go back to disabled.
 */
export function useArmed(state: string, ms: number = ARM_MS): boolean {
  const [armedFor, setArmedFor] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hold = () => {
      setArmedFor(null);
      clearTimeout(timer);
      timer = setTimeout(() => setArmedFor(state), ms);
    };
    hold();
    window.addEventListener('focus', hold);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', hold);
    };
  }, [state, ms]);
  return armedFor === state;
}
