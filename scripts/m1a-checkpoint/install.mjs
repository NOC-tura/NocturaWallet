/**
 * The checkpoint's installs onto the owner's phone — the one part of the desk script that can
 * touch a real wallet (the controller's ruling for the checkpoint; Fable review 1, R1-I1, R1-I2).
 *
 * The phone may hold an app installed under ANOTHER signing key (the September inventory records
 * a debug-signed devnet build). `adb install -r` over it fails, and the usual "fix" — uninstall,
 * or `pm clear` — destroys that app's data, which for the production wallet is the owner's keys.
 * So, fail closed:
 *   - BEFORE EVERY INSTALL the installed package's signer is read (its base APK `adb pull`ed into
 *     the checkpoint's output dir, then `apksigner verify --print-certs` on that copy) and
 *     compared with the new APK's. A different or unreadable signer → STOP before installing,
 *     naming the package and both fingerprints. A package that is not installed (a first
 *     install) is allowed.
 *   - The pulled base APK is also the ROLLBACK (R1-I2): its sha256 is recorded, and a pull that
 *     fails → STOP (no install over a wallet without its rollback copy). Rollback:
 *     `adb install -r <the pulled apk>`.
 *   - An install answering `INSTALL_FAILED_*` (or anything but `Success`) → STOP, no further adb
 *     call.
 *   - NEVER `uninstall`, never `pm clear`: every adb call goes through adbRefusal() first. (The
 *     README's optional removal of com.nocturawallet.devnet.test — the instrumentation APK, no
 *     user data — is the owner's own command, not this script's.)
 *
 * Everything is injected (adb, the APK signer reader, sha256), so lib's tests drive it with a
 * mocked adb (install.test.mjs) and no device is ever touched by a test.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** A STOP: the checkpoint halts and asks the owner. The CLI prints it and exits 3. */
export class CheckpointStop extends Error {
  constructor(message) {
    super(message);
    this.name = 'CheckpointStop';
  }
}

/** Why an adb call is refused, or null: nothing that removes an app or wipes its data. */
export function adbRefusal(args) {
  const words = args.map(a => String(a).toLowerCase());
  const has = (...seq) =>
    words.some((_, i) => seq.every((w, j) => words[i + j] === w));
  if (
    words.includes('uninstall') ||
    words.includes('clear') ||
    has('pm', 'clear') ||
    has('pm', 'uninstall') ||
    has('pm', 'uninstall-system-updates') ||
    has('pm', 'reset-permissions') ||
    words.some(w => /^(rm|wipe)$/.test(w))
  ) {
    return `refusing adb ${args.join(' ')}: the checkpoint never uninstalls, clears or deletes anything on the phone`;
  }
  return null;
}

/**
 * The SHA-256 certificate digests in `apksigner verify --print-certs` output (lowercase hex,
 * deduplicated, sorted). Both formats: build-tools ≤ 36 print `Signer #1 certificate SHA-256
 * digest: …`, build-tools 37 print `V2 Signer: certificate SHA-256 digest: …` (measured).
 */
export function signerDigests(apksignerOutput) {
  return [
    ...new Set(
      [
        ...apksignerOutput.matchAll(
          /^(?:Signer #\d+ |V[\d.]+ Signer(?: #\d+)?: )certificate SHA-256 digest: ([0-9a-fA-F]{64})\s*$/gm,
        ),
      ].map(m => m[1].toLowerCase()),
    ),
  ].sort();
}

/** `adb` with the refusal guard in front: a refused call throws a STOP and never reaches adb. */
export function guarded(adb) {
  return args => {
    const why = adbRefusal(args);
    if (why) {
      throw new CheckpointStop(why);
    }
    return adb(args);
  };
}

const fp = d => (d.length ? d.join(',') : 'UNREADABLE');

/**
 * Checks one package before its install; returns what it found. Throws CheckpointStop on a
 * different or unreadable signer, or a failed pull (R1-I2) — before any install.
 *   adb(args) → {status, out}          (the refusal guard is applied here, before the call)
 *   apkSigners(path) → string[]        (SHA-256 digests; [] = unreadable)
 *   sha256File(path) → hex
 */
export function preflightInstall({
  adb,
  pkg,
  apk,
  apkSigners,
  sha256File,
  outDir,
}) {
  const call = guarded(adb);
  const newSigners = apkSigners(apk);
  if (newSigners.length === 0) {
    throw new CheckpointStop(
      `${pkg}: the signer of ${apk} is unreadable (apksigner) — not installing`,
    );
  }
  const listed = call(['shell', 'pm', 'list', 'packages', pkg]);
  if (listed.status !== 0) {
    throw new CheckpointStop(
      `${pkg}: cannot tell whether it is installed (pm list packages: ${listed.out.trim()}) — not installing`,
    );
  }
  const installed = listed.out
    .split('\n')
    .some(l => l.trim() === `package:${pkg}`);
  if (!installed) {
    return { pkg, installed: false, apkSigners: newSigners };
  }
  const paths = call(['shell', 'pm', 'path', pkg]);
  const base = paths.out
    .split('\n')
    .map(l => l.trim())
    .find(l => l.startsWith('package:') && l.endsWith('/base.apk'));
  if (paths.status !== 0 || !base) {
    throw new CheckpointStop(
      `${pkg} is installed but its base APK path is unreadable (pm path: ${paths.out.trim()}) — installed signer UNREADABLE, new ${fp(newSigners)}; not installing`,
    );
  }
  const pulled = join(outDir, `installed-${pkg}.base.apk`);
  const pull = call(['pull', base.slice('package:'.length), pulled]);
  if (pull.status !== 0 || !existsSync(pulled)) {
    throw new CheckpointStop(
      `${pkg}: adb pull of the installed base APK failed (${pull.out.trim()}) — no rollback copy, not installing over it`,
    );
  }
  const rollback = { path: pulled, sha256: sha256File(pulled) };
  const installedSigners = apkSigners(pulled);
  if (installedSigners.length === 0) {
    throw new CheckpointStop(
      `${pkg}: the installed app's signer is UNREADABLE, new ${fp(newSigners)} — not installing (rollback copy kept: ${pulled})`,
    );
  }
  if (fp(installedSigners) !== fp(newSigners)) {
    throw new CheckpointStop(
      `${pkg} is installed under ANOTHER signing key — installed ${fp(installedSigners)}, new ${fp(newSigners)}. ` +
        'The checkpoint never uninstalls and never wipes app data: the owner decides (see README "If an install STOPs").',
    );
  }
  return { pkg, installed: true, apkSigners: newSigners, rollback };
}

/**
 * preflightInstall for EVERY package the checkpoint will install, all of them before the first
 * install: a STOP on any one (the production wallet's signer, say) leaves the phone untouched.
 */
export function preflightAll({ targets, ...io }) {
  return targets.map(({ pkg, apk }) => preflightInstall({ ...io, pkg, apk }));
}

/** `adb install -r [extra] apk`; anything but `Success` (e.g. INSTALL_FAILED_*) → STOP. */
export function installApk({ adb, pkg, apk, extra = [] }) {
  const r = guarded(adb)(['install', '-r', ...extra, apk]);
  const failed = r.out.match(/INSTALL_FAILED_[A-Z_]+|Failure \[[^\]]*\]/)?.[0];
  if (failed || r.status !== 0 || !/^Success\s*$/m.test(r.out)) {
    throw new CheckpointStop(
      `${pkg}: adb install answered ${failed ?? (r.out.trim() || `exit ${r.status}`)} — stopped, no further adb call`,
    );
  }
  return r.out;
}
