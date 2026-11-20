/**
 * The M1c checkpoint's phone-side steps with an injected adb (so device.test.mjs drives them with a
 * mocked one and no device is ever touched by a test). Task 1: the trigger of the `pinnedFetch`
 * on-device control and the wait for its readout lines. Task 9: the submit hold's trigger and the
 * kill inside it, the MANUAL wipe (the owner's phone refuses `pm clear`), the phone's API level and
 * the instrumented confirmation-window run. Every call goes through M1a's guard (`install.mjs`
 * `guarded`): nothing that uninstalls, clears or deletes reaches adb — the one sanctioned clear stays
 * M1b's `clearDevnetAppData` (`../m1b-checkpoint/device.mjs`), and a manual wipe sends no clear at all.
 */
import * as I from '../m1a-checkpoint/install.mjs';
import * as L from './lib.mjs';

/** `am start` of the devnet app on a deep link — the exact adb arguments. */
const viewArgs = link => Object.freeze(['shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', link, L.DEVNET_PACKAGE]);

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

// ------------------------------------------------------------------ M1c Task 9

/** `am start` of the devnet app on the submit-hold link (`submitHold.ts`) — the exact adb arguments. */
export const HOLD_ARGS = viewArgs(L.SUBMIT_HOLD_LINK);

/**
 * Sends the hold link, then reads `logcat -d` every `pollSeconds` until a NEW `submit-hold armed`
 * readout appears (not among `knownIds`, the ids recorded before), or `timeoutSeconds`.
 * Returns `{started, armed, readouts, startOutput}`.
 */
export function armSubmitHold({ adb, sleep, knownIds = [], pollSeconds = 2, timeoutSeconds = 30 }) {
  const call = I.guarded(adb);
  const startOutput = call([...HOLD_ARGS]).out;
  const started = /Status: ok/.test(startOutput);
  const known = new Set(knownIds);
  let readouts = [];
  for (let waited = 0; waited <= timeoutSeconds; waited += pollSeconds) {
    sleep(pollSeconds);
    readouts = L.readoutsFromLog(call(['logcat', '-d']).out).readouts;
    const armed = readouts.find(r => r.event === 'submit-hold' && r.state === 'armed' && !known.has(`${r.session}-${r.seq}`));
    if (armed) {
      return { started, armed, readouts, startOutput };
    }
  }
  return { started, armed: null, readouts, startOutput };
}

/**
 * The kill inside the hold: fed the live log (`adb logcat`), it collects readouts and, the FIRST
 * time a NEW `unshield-submitting` line with `heldMs > 0` appears, force-stops the devnet app at
 * once (once). A line without a hold never kills (an ordinary unshield is never cut); `known` are
 * the ids recorded before the stream started (logcat replays its buffer first).
 */
export class HeldSubmitKiller {
  constructor({ kill, known = [], now = () => new Date().toISOString() }) {
    this.kill = kill;
    this.now = now;
    this.buffer = '';
    this.text = '';
    this.seen = new Set(known);
    this.killed = null;
    /** m-4: the arm lapsed (10 min) before an unshield took it — the next unshield is not held */
    this.expired = null;
  }

  /** Feed a chunk of log output; returns the readouts completed by it ({seenAt, readout}). */
  push(chunk) {
    this.buffer += chunk;
    const cut = this.buffer.lastIndexOf('\n');
    if (cut < 0) {
      return [];
    }
    // only the readout lines are kept (the parser reads nothing else): a chatty log is not re-parsed whole
    for (const line of this.buffer.slice(0, cut + 1).split('\n')) {
      if (line.includes(L.READOUT_TAG)) {
        this.text += `${line}\n`;
      }
    }
    this.buffer = this.buffer.slice(cut + 1);
    const fresh = [];
    for (const r of L.readoutsFromLog(this.text).readouts) {
      const id = `${r.session}-${r.seq}`;
      if (this.seen.has(id)) {
        continue;
      }
      this.seen.add(id);
      fresh.push({ seenAt: this.now(), readout: r });
      if (!this.killed && !this.expired && r.event === 'submit-hold' && r.state === 'expired') {
        this.expired = { at: this.now(), session: r.session, seq: r.seq };
      }
      if (!this.killed && r.event === 'unshield-submitting' && Number.isInteger(r.heldMs) && r.heldMs > 0) {
        const answer = this.kill();
        this.killed = { at: this.now(), session: r.session, seq: r.seq, owner: r.owner, heldMs: r.heldMs, answer: answer?.out ?? '' };
      }
    }
    return fresh;
  }
}

/** The kill: `am force-stop` of the DEVNET app — the process dies, no data is touched. */
export function killDevnetApp(adb) {
  return I.guarded(adb)(['shell', 'am', 'force-stop', L.DEVNET_PACKAGE]);
}

/**
 * The MANUAL wipe (the owner's OnePlus refuses `pm clear` from adb: SecurityException,
 * CLEAR_APP_USER_DATA). The desk sends NO clear; it prints the owner's steps for one of these,
 * waits for the owner, and records `{at, pkg, answer: "manual: <how>"}` — honestly what happened.
 * The restore is judged as after `pm clear`: by the first `startup` readout after `at`, which must
 * say `restoredBecause: no-record` (a record that survived would say null — the line fails).
 */
export const MANUAL_WIPES = Object.freeze({
  'clear-data': [
    `Android Settings → Apps → "Noctura devnet" (${L.DEVNET_PACKAGE} — NOT "Noctura", the production wallet) → Storage → Clear storage / Clear data → OK.`,
    'Do not open the devnet app yet.',
  ],
  'in-app': [
    'Open the DEVNET app ("Noctura devnet") → Settings → Wipe wallet → confirm (its warning names the recovery phrase and the shielded notes).',
    'Stop on the onboarding screen: do not import yet.',
  ],
  reinstall: [
    `Uninstall "Noctura devnet" (${L.DEVNET_PACKAGE}) by hand — long-press its icon → App info → Uninstall. NEVER "Noctura" (the production wallet).`,
    'Then run `install --apks …` again from this desk (M1a\'s rules: a first install of the devnet app), and do not open it yet.',
  ],
});

/** Why a manual wipe is refused, or null. */
export function manualWipeRefusal(how) {
  return Object.hasOwn(MANUAL_WIPES, how) ? null : `--manual needs one of ${Object.keys(MANUAL_WIPES).join(' | ')} (got ${JSON.stringify(how ?? null)})`;
}

/** The record of a manual wipe the owner confirmed. */
export function manualWipeRecord(how, at) {
  const why = manualWipeRefusal(how);
  if (why) {
    throw new I.CheckpointStop(why);
  }
  return { at, pkg: L.DEVNET_PACKAGE, answer: `manual: ${how}`, how, steps: MANUAL_WIPES[how] };
}

/** `pm clear` refused by the phone (the OnePlus): the hint the desk prints with the STOP. */
export function wipeRefusedHint(message) {
  return /SecurityException|CLEAR_APP_USER_DATA|Permission Denial/i.test(String(message))
    ? 'this phone refuses `pm clear` from adb (SecurityException: CLEAR_APP_USER_DATA). Nothing was cleared. Wipe by hand instead: `wipe --manual clear-data` (or in-app | reinstall) — README "The wipe"'
    : null;
}

/** The phone's facts the checkpoint records: model, Android release, API level (an integer or null). */
export function readPhone(adb) {
  const call = I.guarded(adb);
  const prop = k => call(['shell', 'getprop', k]).out.trim();
  const sdk = Number.parseInt(prop('ro.build.version.sdk'), 10);
  return { model: prop('ro.product.model'), release: prop('ro.build.version.release'), sdk: Number.isInteger(sdk) ? sdk : null };
}

/** The instrumented class of Task 6, one class, on the installed devnet app + its test APK. */
export const INSTRUMENT_ARGS = Object.freeze([
  'shell', 'am', 'instrument', '-w', '-r',
  '-e', 'class', 'com.nocturawallet.prover.A0ConfirmWindowTest',
  `${L.TEST_PACKAGE}/androidx.test.runner.AndroidJUnitRunner`,
]);

/** `am instrument -r` output judged: exactly `OK (6 tests)` and the runner's success code. */
export function instrumentVerdict(out) {
  const okLine = /^OK \((\d+) tests?\)/m.exec(out);
  const pass = okLine !== null && Number(okLine[1]) === 6 && /INSTRUMENTATION_CODE: -1/.test(out);
  return {
    pass,
    detail: pass ? 'OK (6 tests)' : (/^(FAILURES!!!.*|Tests run: .*|.*Error.*|INSTRUMENTATION_FAILED.*)$/m.exec(out)?.[1] ?? 'no OK line — see instrument-confirm.txt'),
  };
}
