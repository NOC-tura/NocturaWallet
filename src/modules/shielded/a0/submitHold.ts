/**
 * The M1c checkpoint's one-shot SUBMIT HOLD (spec §16 M1c, second checkpoint: "a second unshield
 * started while the first was pending picked the next index"). DEVNET BUILD ONLY.
 *
 * WHY IT EXISTS. On the phone an unshield is pending only between the pending write and the
 * relayer's answer (one unshield runs per process, `E_A0_UNSHIELD_BUSY`), and the relayer request
 * leaves within milliseconds of the `unshield-submitting` readout line — faster than the desk can
 * read the log and force-stop the app. A kill that comes after the request leaves the relayer to
 * land the tx, and the next start's reconciliation settles it before a second unshield can be
 * started: the checkpoint line could not be observed. So the desk ARMS a hold first (the deep link
 * `noctura://a0-hold-next-submit`, sent by `m1c-checkpoint.mjs hold-kill`); the NEXT unshield
 * waits `A0_SUBMIT_HOLD_MS` after its pending write and its `unshield-submitting` line (`heldMs`
 * on that line), and the desk kills the app inside that wait. Nothing was sent: the next start
 * finds the unshield pending in its window, its fresh account still `fresh-pending`; a second
 * unshield then reserves the next index; once the chain's clock is 300 s past the submit the
 * reconciliation reverts the note and releases the reservation (§6 step 8) — all of it on the real
 * flow, nothing simulated.
 *
 * HOW IT REACHES THE FLOW (the Task 7 ruling). ONLY through `unshieldA0`'s `options.holdMs`: the
 * run screen (`UnshieldRunScreen`) passes `holdMs: () => takeA0SubmitHold()`. The flow asks it once
 * per submit, right after the pending write, and after a hold re-reads the chain clock and keeps
 * the later time as `pendingSince` (m-1 / R2-N2). This module never sleeps and never touches the
 * flow's state.
 *
 * WHAT IT CAN DO. Delay ONE unshield's submit by 30 s, after the human approved it and after the
 * pending write — the window a kill, a crash or a lost network already opens in every build. It
 * changes no value, skips no check and sends nothing; an unkilled held unshield submits as usual.
 * Any app on a devnet phone can arm it (the cost: one delayed devnet unshield), as with the pinned
 * control's link.
 *
 * THE ARM LAPSES (m-4). An arm not taken within `A0_SUBMIT_HOLD_ARM_TTL_MS` (10 minutes, from
 * `armedAt`) is not taken: the next take finds it expired, reads out `submit-hold expired`,
 * disarms and answers 0 — a forgotten arm never holds an unshield made long after the checkpoint
 * step. A second arm restarts the ten minutes.
 *
 * THE GATE. The readout's (`a0ReadoutActive()` = `a0ReadoutEnabled()`: FEATURES_SHIELDED=true +
 * NETWORK=devnet; a test's readout defaults may open it): in the production build
 * `armA0SubmitHold` arms nothing and `takeA0SubmitHold` always answers 0 — checked at BOTH ends,
 * so a hold armed while the gate was open is never taken under a closed one.
 */
import {a0ReadoutActive, readA0SubmitHold} from './checkpointReadout';
import type {A0ReadoutOptions} from './checkpointReadout';

/** The deep link the desk sends to the devnet app (no route: React Navigation ignores it). */
export const A0_SUBMIT_HOLD_LINK = 'noctura://a0-hold-next-submit';
/** The hold: long enough for the desk's log read + `am force-stop` over wireless adb. */
export const A0_SUBMIT_HOLD_MS = 30_000;
/** m-4: an arm not taken within this lapses (counted from the last arm). */
export const A0_SUBMIT_HOLD_ARM_TTL_MS = 10 * 60_000;

/** epoch ms of the live arm; null = not armed */
let armedAt: number | null = null;

const nowMs = (o: A0ReadoutOptions): number => (o.now ?? (() => new Date()))().getTime();

/** Arms the hold for the next unshield (devnet gate only); reads out `submit-hold armed`. */
export function armA0SubmitHold(enabled: boolean = a0ReadoutActive(), o: A0ReadoutOptions = {}): boolean {
  if (!enabled) {
    return false;
  }
  armedAt = nowMs(o);
  readA0SubmitHold('armed', A0_SUBMIT_HOLD_MS, {...o, enabled});
  return true;
}

/**
 * The hold for THIS unshield in ms (0 = none) — taken once: the next call answers 0. An arm older
 * than ten minutes answers 0 and reads out `expired`; a closed gate answers 0 and spends the arm.
 */
export function takeA0SubmitHold(enabled: boolean = a0ReadoutActive(), o: A0ReadoutOptions = {}): number {
  if (armedAt === null) {
    return 0;
  }
  const since = armedAt;
  armedAt = null;
  if (!enabled) {
    return 0;
  }
  if (nowMs(o) - since > A0_SUBMIT_HOLD_ARM_TTL_MS) {
    readA0SubmitHold('expired', A0_SUBMIT_HOLD_MS, {...o, enabled});
    return 0;
  }
  readA0SubmitHold('taken', A0_SUBMIT_HOLD_MS, {...o, enabled});
  return A0_SUBMIT_HOLD_MS;
}

/** TEST-ONLY: disarm. */
export function resetA0SubmitHoldForTests(): void {
  armedAt = null;
}
