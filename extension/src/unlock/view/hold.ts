import type {Timers} from '../page';

/** #3's mechanics (spec §3.3): hold 2 s to reveal; 30 ms ticks; the reveal lasts at most 20 s. */
export const HOLD_MS = 2_000;
export const TICK_MS = 30;
export const REVEAL_MS = 20_000;

/**
 * - `blurred`: no full hold yet; the CTA is disabled.
 * - `revealed`: held past 2 s; the words show and the countdown runs.
 * - `still-looking`: the 20 s auto-blur fired while held; the hold is reset and must be released and
 *   pressed again (the auto-blur fires "even while held").
 * - `confirmed`: released after at least one full hold; re-blurred, "Acknowledged".
 */
export type HoldState = 'blurred' | 'revealed' | 'still-looking' | 'confirmed';

export interface HoldEvents {
  /** The state changed. */
  state(s: HoldState): void;
  /** While revealed: whole seconds until the auto-blur (20 … 1), once per change. */
  tick(secondsLeft: number): void;
}

export interface Hold {
  press(): void;
  release(): void;
  /** Clears every timer (leaving the step). */
  dispose(): void;
  state(): HoldState;
  /** At least one full hold happened: the CTA is enabled. */
  revealedOnce(): boolean;
}

/**
 * Press-and-hold to reveal, driven by the injected clock. A release before 2 s goes back to the resting
 * state (`blurred` before any full hold, `confirmed` after one — "Still looking?" included); a release
 * while revealed is `confirmed`; the 20 s auto-blur is `still-looking`, and only a release then a new
 * press starts a hold again.
 */
export function createHold(timers: Timers, on: HoldEvents): Hold {
  let state: HoldState = 'blurred';
  let holding = false;
  let mustRelease = false;
  let everRevealed = false;
  let pressedAt = 0;
  let revealedAt = 0;
  let lastSecond = -1;
  let interval: number | null = null;

  const set = (s: HoldState) => {
    state = s;
    on.state(s);
  };
  const stop = () => {
    if (interval !== null) timers.clearInterval(interval);
    interval = null;
  };
  const rest = (): HoldState => (everRevealed ? 'confirmed' : 'blurred');

  const tick = () => {
    const now = timers.now();
    if (state !== 'revealed') {
      if (now - pressedAt >= HOLD_MS) {
        everRevealed = true;
        revealedAt = now;
        lastSecond = -1;
        set('revealed');
      } else return;
    }
    const left = REVEAL_MS - (now - revealedAt);
    if (left <= 0) {
      stop();
      holding = false;
      mustRelease = true;
      set('still-looking');
      return;
    }
    const seconds = Math.ceil(left / 1000);
    if (seconds !== lastSecond) {
      lastSecond = seconds;
      on.tick(seconds);
    }
  };

  return {
    press() {
      if (holding || mustRelease) return;
      holding = true;
      pressedAt = timers.now();
      stop();
      interval = timers.setInterval(tick, TICK_MS);
    },
    release() {
      if (mustRelease) {
        mustRelease = false;
        return;
      }
      if (!holding) return;
      holding = false;
      stop();
      if (state === 'revealed') set('confirmed');
      else if (state !== rest()) set(rest());
    },
    dispose() {
      stop();
      holding = false;
    },
    state: () => state,
    revealedOnce: () => everRevealed,
  };
}
