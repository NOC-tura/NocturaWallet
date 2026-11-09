/**
 * The checkpoint's installs onto the owner's phone — the one part of the desk script that can
 * touch a real wallet (the controller's ruling for the checkpoint; Fable review 1, R1-I1, R1-I2).
 *
 * The phone may hold an app installed under ANOTHER signing key (the September inventory records
 * a debug-signed devnet build). `adb install -r` over it fails, and the usual "fix" — uninstall,
 * or `pm clear` — destroys that app's data, which for the production wallet is the owner's keys.
 * So, fail closed:
 *   - BEFORE EVERY INSTALL the installed package's signer is read (every APK of it `adb pull`ed
 *     into the checkpoint's output dir, then `apksigner verify --print-certs` on each copy) and
 *     compared with the new APK's. A different or unreadable signer → STOP before installing,
 *     naming the package and both fingerprints. A package that is not installed (a first
 *     install) is allowed — but only when two readings of the phone agree it is absent, and for
 *     the production wallet (com.nocturawallet) only LOUDLY and only with
 *     --allow-fresh-production: an absent wallet is most likely the wrong phone or the wrong
 *     user profile (adb reads user 0; a wallet in a work / secondary profile is invisible to
 *     both readings), so without the flag it is a STOP (final review Minor 5).
 *   - The pulled APKs are also the ROLLBACK (R1-I2): sha256s recorded, a pull that fails → STOP
 *     (no install over a wallet without its complete rollback copy), an existing rollback is
 *     never overwritten. Rollback: `adb install -r <base.apk>` (or `adb install-multiple -r`
 *     for a split install) — the exact command is printed and recorded.
 *   - An install answering `INSTALL_FAILED_*` (or anything but `Success`) → STOP, no further adb
 *     call.
 *   - NEVER `uninstall`, never `pm clear`: every adb call goes through adbRefusal() first. (The
 *     README's optional removal of com.nocturawallet.devnet.test — the instrumentation APK, no
 *     user data — is the owner's own command, not this script's.)
 *
 * Everything is injected (adb, the APK signer reader, sha256), so lib's tests drive it with a
 * mocked adb (install.test.mjs) and no device is ever touched by a test.
 */
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';

/** A STOP: the checkpoint halts and asks the owner. The CLI prints it and exits 3. */
export class CheckpointStop extends Error {
  constructor(message) {
    super(message);
    this.name = 'CheckpointStop';
  }
}

/** Why an adb call is refused, or null: nothing that removes an app or wipes its data. */
export function adbRefusal(args) {
  const words = args
    .flatMap(a => String(a).toLowerCase().split(/\s+/))
    .filter(Boolean);
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

/** The production wallet's package: its absence is never a silent first install. */
export const PRODUCTION_PACKAGE = 'com.nocturawallet';
/** The CLI flag that lets the checkpoint install the production wallet where none is installed. */
export const ALLOW_FRESH_PRODUCTION = '--allow-fresh-production';

/** The loud line printed whenever the production wallet is found absent. */
export function noWalletLine(pkg) {
  return `NO WALLET INSTALLED for ${pkg} — this run installs it fresh; if you expected your wallet here, STOP (Ctrl-C) now`;
}

/** The `package:<path>` lines of a `pm path` answer, or null if any other line is in it. */
function packagePaths(out) {
  const lines = out
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  if (!lines.every(l => /^package:\/\S+\.apk$/.test(l))) {
    return null;
  }
  return lines.map(l => l.slice('package:'.length));
}

/**
 * Whether `pkg` is installed — established POSITIVELY by two independent readings that must
 * agree (review I2), never inferred from a missing line:
 *   - `pm list packages` (unfiltered): every line `package:<name>`, and `package:android` among
 *     them (the framework package always exists — an empty, truncated or garbled list fails it);
 *   - `pm path <pkg>`: installed = exit 0 and only `package:/….apk` lines (≥ 1); absent = a
 *     non-zero exit with no `package:` line.
 * Anything else, or the two disagreeing → STOP.
 */
function installedPaths(call, pkg) {
  const listed = call(['shell', 'pm', 'list', 'packages']);
  const names = listed.out
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  if (
    listed.status !== 0 ||
    !names.every(l => /^package:[A-Za-z0-9_.]+$/.test(l)) ||
    !names.includes('package:android')
  ) {
    throw new CheckpointStop(
      `${pkg}: pm list packages gave an unrecognised answer (exit ${listed.status}, ${names.length} lines${names.length ? `, first: ${names[0]}` : ''}) — cannot establish whether it is installed; not installing`,
    );
  }
  const listedHere = names.includes(`package:${pkg}`);
  const paths = call(['shell', 'pm', 'path', pkg]);
  const found = packagePaths(paths.out);
  const pathSaysInstalled = paths.status === 0 && found && found.length > 0;
  const pathSaysAbsent = paths.status !== 0 && !/package:/.test(paths.out);
  if (!pathSaysInstalled && !pathSaysAbsent) {
    throw new CheckpointStop(
      `${pkg}: pm path gave an unrecognised answer (exit ${paths.status}: ${paths.out.trim() || 'empty'}) — not installing`,
    );
  }
  if (listedHere !== Boolean(pathSaysInstalled)) {
    throw new CheckpointStop(
      `${pkg}: the phone's two readings disagree — pm list packages says ${listedHere ? 'installed' : 'absent'}, pm path says ${pathSaysInstalled ? 'installed' : 'absent'}; not installing`,
    );
  }
  return pathSaysInstalled ? found : null;
}

/**
 * Checks one package before its install; returns what it found. Throws CheckpointStop on a
 * different or unreadable signer, an unestablished install state, a failed pull (R1-I2), or an
 * absent production wallet without allowFreshProduction (printed loudly through warn either way)
 * — before any install.
 *   adb(args) → {status, out}          (the refusal guard is applied here, before the call)
 *   apkSigners(path) → string[]        (SHA-256 digests; [] = unreadable)
 *   sha256File(path) → hex
 *
 * The rollback (review I1, I3): EVERY path `pm path` lists is pulled (base.apk and any
 * split_*.apk), into `rollback-<pkg>-<sha256 of base.apk, 16 hex>/`. A directory of that name
 * that already exists is NEVER overwritten — the copy just pulled is discarded and the existing
 * one is used (same name = same base APK bytes), so a re-run after the branch APK was installed
 * adds a second directory and the first rollback stays untouched. The restore command is
 * `adb install -r <base.apk>` for one APK, `adb install-multiple -r <all of them>` for a split
 * install.
 */
export function preflightInstall({
  adb,
  pkg,
  apk,
  apkSigners,
  sha256File,
  outDir,
  now = () => Date.now(),
  allowFreshProduction = false,
  warn = line => console.error(line),
}) {
  const call = guarded(adb);
  const newSigners = apkSigners(apk);
  if (newSigners.length === 0) {
    throw new CheckpointStop(
      `${pkg}: the signer of ${apk} is unreadable (apksigner) — not installing`,
    );
  }
  const remote = installedPaths(call, pkg);
  if (!remote) {
    if (pkg === PRODUCTION_PACKAGE) {
      const bar = '!'.repeat(100);
      warn(`${bar}\n${noWalletLine(pkg)}\n${bar}`);
      if (!allowFreshProduction) {
        throw new CheckpointStop(
          `${pkg}: no wallet is installed (pm list packages and pm path agree) — most likely the wrong phone or user profile (adb reads user 0). Not installing. ` +
            `If a fresh install of the production app is what you want, re-run with ${ALLOW_FRESH_PRODUCTION}.`,
        );
      }
      return { pkg, installed: false, fresh: true, apkSigners: newSigners };
    }
    return { pkg, installed: false, apkSigners: newSigners };
  }
  const names = remote.map(r => basename(r));
  if (
    names.filter(n => n === 'base.apk').length !== 1 ||
    new Set(names).size !== names.length
  ) {
    throw new CheckpointStop(
      `${pkg}: pm path lists no single base.apk (${remote.join(', ')}) — installed signer UNREADABLE, new ${fp(newSigners)}; not installing`,
    );
  }
  // Pull into a fresh temporary directory first; it becomes the rollback only when complete.
  const tmp = join(outDir, `.pulling-${pkg}-${now()}-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  for (const r of remote) {
    const dest = join(tmp, basename(r));
    const pull = call(['pull', r, dest]);
    if (pull.status !== 0 || !existsSync(dest)) {
      rmSync(tmp, { recursive: true, force: true });
      throw new CheckpointStop(
        `${pkg}: adb pull of the installed ${basename(r)} failed (${pull.out.trim()}) — no complete rollback copy, not installing over it`,
      );
    }
  }
  const baseSha = sha256File(join(tmp, 'base.apk'));
  const dir = join(outDir, `rollback-${pkg}-${baseSha.slice(0, 16)}`);
  const ordered = names
    .slice()
    .sort((a, b) =>
      a === 'base.apk' ? -1 : b === 'base.apk' ? 1 : a < b ? -1 : 1,
    );
  let kept = false;
  if (existsSync(dir)) {
    // NEVER overwrite a rollback. The existing one is used only if it holds exactly the bytes
    // just pulled; otherwise STOP (both copies kept for the owner).
    const same = ordered.every(
      n =>
        existsSync(join(dir, n)) &&
        sha256File(join(dir, n)) === sha256File(join(tmp, n)),
    );
    if (!same) {
      throw new CheckpointStop(
        `${pkg}: a rollback ${dir} already exists with other contents than the APKs just pulled (kept in ${tmp}) — not overwriting it, not installing`,
      );
    }
    rmSync(tmp, { recursive: true, force: true });
    kept = true;
  } else {
    renameSync(tmp, dir);
  }
  const files = ordered.map(n => join(dir, n));
  const rollback = {
    dir,
    files: files.map(f => ({ path: f, sha256: sha256File(f) })),
    keptExisting: kept,
    command:
      files.length === 1
        ? `adb install -r ${files[0]}`
        : `adb install-multiple -r ${files.join(' ')}`,
  };
  for (const f of files) {
    const installedSigners = apkSigners(f);
    if (installedSigners.length === 0) {
      throw new CheckpointStop(
        `${pkg}: the installed app's signer is UNREADABLE (${basename(f)}), new ${fp(newSigners)} — not installing (rollback copy kept: ${dir})`,
      );
    }
    if (fp(installedSigners) !== fp(newSigners)) {
      throw new CheckpointStop(
        `${pkg} is installed under ANOTHER signing key — installed ${fp(installedSigners)} (${basename(f)}), new ${fp(newSigners)}. ` +
          'The checkpoint never uninstalls and never wipes app data: the owner decides (see README "If an install STOPs").',
      );
    }
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
