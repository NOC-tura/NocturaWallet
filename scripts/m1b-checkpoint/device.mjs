/**
 * The M1b checkpoint's phone operations beyond the installs — the wipe, the kill, the launches,
 * the readout collection. The installs are M1a's (`../m1a-checkpoint/install.mjs`, reused as they
 * are: the signer check before every install, the rollback pull, never uninstall, STOP on
 * anything unclear).
 *
 * THE ONE SANCTIONED CLEAR. §16 M1b says "wipe the app": that is `adb shell pm clear
 * com.nocturawallet.devnet` — the devnet app's data, which holds a DEVNET wallet only — and
 * nothing else, ever. It is sent by exactly one function, `clearDevnetAppData`, with a frozen
 * argument list built here (never from input), and only when
 *   - the package the caller names is EXACTLY `com.nocturawallet.devnet` (not the production
 *     wallet `com.nocturawallet`, not the test APK `….devnet.test`, no whitespace, no prefix),
 *   - the owner typed that same name as `--confirm-wipe com.nocturawallet.devnet`,
 *   - the installed devnet app is signed by the key of THIS checkpoint's devnet.apk (M1a's
 *     preflight: an app installed under another key — e.g. the September debug-signed build — is
 *     not the app this checkpoint installed, so it is not wiped),
 *   - and the answer is `Success`, else STOP.
 * Every other adb call goes through install.mjs's `guarded`, which refuses `clear` in any form —
 * so even this module cannot send another clear (tested). `am force-stop` (the kill, and each
 * launch's cold start) touches no data.
 *
 * Everything is injected (adb, signer reader, sha256, sleep); device.test.mjs drives it with a
 * mocked adb and no device is ever touched by a test.
 */
import * as I from '../m1a-checkpoint/install.mjs';
import { DEVNET_PACKAGE, readoutsFromLog } from './lib.mjs';

export const CONFIRM_WIPE = '--confirm-wipe';
/** The one clear the checkpoint sends — frozen, built from the constant, never from input. */
export const CLEAR_ARGS = Object.freeze(['shell', 'pm', 'clear', DEVNET_PACKAGE]);

/** Why the wipe is refused, or null. `pkg` and `confirm` must both be exactly the devnet package. */
export function wipeRefusal(pkg, confirm) {
  if (pkg !== DEVNET_PACKAGE) {
    return `refusing to wipe ${JSON.stringify(pkg)}: the checkpoint wipes ONLY ${DEVNET_PACKAGE} (never ${I.PRODUCTION_PACKAGE}, never anything else)`;
  }
  if (confirm !== DEVNET_PACKAGE) {
    return `the wipe needs ${CONFIRM_WIPE} ${DEVNET_PACKAGE} typed exactly (got ${JSON.stringify(confirm ?? null)}) — it destroys the devnet app's wallet: have its recovery phrase`;
  }
  return null;
}

/**
 * The wipe (§16 M1b "wipe the app"). Throws CheckpointStop before any adb call on a refusal, and
 * before the clear when the installed devnet app is absent or signed by another key than `apk`.
 *   adb(args) → {status, out}   (UNGUARDED: the one clear is sent here; every other call is guarded)
 */
export function clearDevnetAppData({ adb, pkg, confirm, apk, apkSigners, sha256File, outDir }) {
  const why = wipeRefusal(pkg, confirm);
  if (why) {
    throw new I.CheckpointStop(why);
  }
  const pre = I.preflightInstall({ adb: I.guarded(adb), pkg: DEVNET_PACKAGE, apk, apkSigners, sha256File, outDir });
  if (!pre.installed) {
    throw new I.CheckpointStop(`${DEVNET_PACKAGE} is not installed — nothing to wipe (run \`install\` first)`);
  }
  const r = adb([...CLEAR_ARGS]);
  if (r.status !== 0 || !/^Success\s*$/m.test(r.out)) {
    throw new I.CheckpointStop(`pm clear ${DEVNET_PACKAGE} answered ${r.out.trim() || `exit ${r.status}`} — stopped`);
  }
  return { pkg: DEVNET_PACKAGE, answer: r.out.trim(), signer: pre.apkSigners, rollback: pre.rollback };
}

/** The kill (§16 M1b): `am force-stop` of the DEVNET app — the process dies, no data is touched. */
export function killDevnetApp(adb) {
  return I.guarded(adb)(['shell', 'am', 'force-stop', DEVNET_PACKAGE]);
}

/** The ids (`<session>-<seq>`) of recorded readouts. */
export function readoutIdsOf(recorded) {
  return recorded.map(x => `${x.readout.session}-${x.readout.seq}`);
}

/**
 * The kill watch: fed the live log (`adb logcat`), it collects readouts and, the FIRST time a
 * complete "deposit-submitted" readout appears, kills the devnet app at once (once).
 *
 * `known` (review I-1): the ids already recorded before the watch started. `adb logcat` replays
 * the ring buffer first, and that replay still holds every earlier deposit's "deposit-submitted";
 * a known id is neither a new readout nor a reason to kill — only a readout first seen on this
 * stream can arm the kill. The CLI collects (records the buffer) right before it starts.
 */
export class KillWatcher {
  constructor({ kill, killAfterSubmit, known = [], now = () => new Date().toISOString() }) {
    this.kill = kill;
    this.killAfterSubmit = killAfterSubmit;
    this.now = now;
    this.buffer = '';
    this.text = '';
    this.seen = new Set(known);
    this.readouts = [];
    this.killed = null;
  }

  /** Feed a chunk of log output; returns the readouts completed by it. */
  push(chunk) {
    this.buffer += chunk;
    const cut = this.buffer.lastIndexOf('\n');
    if (cut < 0) {
      return [];
    }
    this.text += this.buffer.slice(0, cut + 1);
    this.buffer = this.buffer.slice(cut + 1);
    const fresh = [];
    for (const r of readoutsFromLog(this.text).readouts) {
      const id = `${r.session}-${r.seq}`;
      if (this.seen.has(id)) {
        continue;
      }
      this.seen.add(id);
      const entry = { seenAt: this.now(), readout: r };
      this.readouts.push(entry);
      fresh.push(entry);
      if (this.killAfterSubmit && !this.killed && r.event === 'deposit-submitted') {
        const answer = this.kill();
        this.killed = { at: this.now(), signature: r.signature, session: r.session, answer: answer?.out ?? '' };
      }
    }
    return fresh;
  }
}

/** Merge newly read readouts into the recorded ones (by id; first seen wins). */
export function mergeReadouts(recorded, readouts, now) {
  const have = new Set(recorded.map(x => `${x.readout.session}-${x.readout.seq}`));
  const added = [];
  for (const r of readouts) {
    const id = `${r.session}-${r.seq}`;
    if (!have.has(id)) {
      have.add(id);
      added.push({ seenAt: now, readout: r });
    }
  }
  return { all: [...recorded, ...added], added };
}

/**
 * A cold start and its check (M1a's rule): force-stop, clear the crash buffer, `am start -W`,
 * wait, the process alive, the crash buffer clean. With `expectNoReadout` (the production app),
 * the main log is cleared before the start and must hold no readout line after it.
 */
export function launchCheck({ adb, pkg, id, text, wait, expectNoReadout = false }) {
  const call = I.guarded(adb);
  call(['shell', 'am', 'force-stop', pkg]);
  call(['logcat', '-b', 'crash', '-c']);
  if (expectNoReadout) {
    call(['logcat', '-c']);
  }
  const start = call(['shell', 'am', 'start', '-W', '-n', `${pkg}/com.nocturawallet.MainActivity`]).out;
  wait();
  return afterCheck({ adb, pkg, id, text, expectNoReadout, start });
}

/** The process alive, the crash buffer clean, and (optionally) no readout line in the main log. */
export function afterCheck({ adb, pkg, id, text, expectNoReadout = false, start = null }) {
  const call = I.guarded(adb);
  const pid = call(['shell', 'pidof', pkg]).out.trim();
  const crash = call(['logcat', '-b', 'crash', '-d']).out;
  const crashed = crash.includes(pkg) || /UnsatisfiedLinkError|FATAL EXCEPTION/.test(crash);
  let readoutLines = 0;
  if (expectNoReadout) {
    readoutLines = call(['logcat', '-d']).out.split('\n').filter(l => l.includes('NOCTURA-A0-READOUT')).length;
  }
  const started = start === null || /Status: ok/.test(start);
  const pass = started && /^\d+$/.test(pid) && !crashed && readoutLines === 0;
  return {
    id,
    text,
    pass,
    crash: crashed ? crash : null,
    detail: `${start === null ? '' : `am start: ${start.match(/Status: \w+/)?.[0] ?? 'no status'}; `}pid: ${pid || 'none'}; crash buffer: ${crashed ? 'CRASH' : 'clean'}${expectNoReadout ? `; readout lines: ${readoutLines}` : ''}`,
  };
}
