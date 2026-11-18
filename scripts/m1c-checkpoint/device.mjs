/**
 * The M1c checkpoint's phone-side steps with an injected adb (so device.test.mjs drives them with a
 * mocked one and no device is ever touched by a test). Task 1: the trigger of the `pinnedFetch`
 * on-device control and the wait for its readout lines. Every call goes through M1a's guard
 * (`install.mjs` `guarded`): nothing that uninstalls, clears or deletes reaches adb.
 */
import * as I from '../m1a-checkpoint/install.mjs';
import * as L from './lib.mjs';

/** `am start` of the devnet app on the control's deep link — the exact adb arguments. */
export const TRIGGER_ARGS = Object.freeze([
  'shell', 'am', 'start', '-W',
  '-a', 'android.intent.action.VIEW',
  '-d', L.PINNED_CONTROL_LINK,
  L.DEVNET_PACKAGE,
]);

/**
 * Sends the deep link, then reads `logcat -d` every `pollSeconds` until a complete pinned-control
 * run appears that was not among `knownRunKeys` (the runs recorded before the trigger), or until
 * `timeoutSeconds` (the submit's JS deadline is 135 s; a malformed one answers at once).
 * Returns `{started, run, readouts, polls, startOutput}`; `run` is the new complete run or null.
 */
export function triggerPinnedControl({ adb, sleep, knownRunKeys = [], pollSeconds = 3, timeoutSeconds = 150 }) {
  const call = I.guarded(adb);
  const startOutput = call([...TRIGGER_ARGS]).out;
  const started = /Status: ok/.test(startOutput);
  const known = new Set(knownRunKeys);
  let readouts = [];
  let polls = 0;
  for (let waited = 0; waited <= timeoutSeconds; waited += pollSeconds) {
    sleep(pollSeconds);
    polls += 1;
    readouts = L.readoutsFromLog(call(['logcat', '-d']).out).readouts;
    const fresh = L.pinnedRuns(readouts).filter(r => r.complete && !known.has(r.key));
    if (fresh.length) {
      return { started, run: fresh[fresh.length - 1], readouts, polls, startOutput };
    }
  }
  return { started, run: null, readouts, polls, startOutput };
}
