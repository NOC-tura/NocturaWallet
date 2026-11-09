/**
 * The installs' fail-closed rules (install.mjs; the controller's ruling for the checkpoint,
 * Fable review 1 R1-I1 / R1-I2, Task 6 review I1–I3) over a MOCKED adb — no test touches a
 * device. Each STOP row asserts the exact adb calls made: nothing after the call that stopped
 * it, and no install. Run with the desk tests: `node --test scripts/m1a-checkpoint/*.test.mjs`.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import * as I from './install.mjs';

const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);
const PKG = 'com.nocturawallet';
const DIR = `/data/app/~~x/${PKG}-y`;
const BASE = `${DIR}/base.apk`;
const SPLITS = [
  `${DIR}/split_config.arm64_v8a.apk`,
  `${DIR}/split_config.xxhdpi.apk`,
];
const root = mkdtempSync(join(tmpdir(), 'm1a-install-test-'));
after(() => rmSync(root, { recursive: true, force: true }));
let n = 0;
const freshOut = () => mkdtempSync(join(root, `out${n++}-`));
const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex');
const STOP = I.CheckpointStop;

/**
 * A scripted phone. `installed` maps a package to its `pm path` list (and the bytes each pull
 * writes); `list` / `path` / `pullFails` / `install` override an answer. Every call is logged.
 */
function phone({
  installed = {},
  list,
  path,
  pullFails = [],
  install = { status: 0, out: 'Performing Streamed Install\nSuccess\n' },
  bytes = r => `the installed ${r}`,
} = {}) {
  const calls = [];
  const adb = args => {
    const c = args.join(' ');
    calls.push(c);
    if (c === 'shell pm list packages') {
      return (
        list ?? {
          status: 0,
          out:
            [
              'package:android',
              'package:com.android.systemui',
              ...Object.keys(installed).map(p => `package:${p}`),
            ].join('\n') + '\n',
        }
      );
    }
    if (c.startsWith('shell pm path ')) {
      const p = args[3];
      if (path) {
        return path;
      }
      return installed[p]
        ? {
            status: 0,
            out: installed[p].map(r => `package:${r}`).join('\n') + '\n',
          }
        : { status: 1, out: '' };
    }
    if (args[0] === 'pull') {
      if (pullFails.includes(args[1])) {
        return { status: 1, out: 'adb: error: failed to stat remote object' };
      }
      writeFileSync(args[2], bytes(args[1]));
      return { status: 0, out: '1 file pulled' };
    }
    if (args[0] === 'install') {
      return install;
    }
    throw new Error(`unscripted adb call: ${c}`);
  };
  return { adb, calls };
}
/** signers: the new APK's, and the installed copies' (by file name, or all). */
const io = (
  adb,
  outDir,
  { fresh = [KEY_A], old = [KEY_A], byName = {} } = {},
) => ({
  adb,
  outDir,
  sha256File: sha,
  apkSigners: p =>
    p.startsWith(outDir) ? (byName[p.split('/').at(-1)] ?? old) : fresh,
});
const pre = (adb, outDir, signers, pkg = PKG) =>
  I.preflightInstall({
    ...io(adb, outDir, signers),
    pkg,
    apk: 'production.apk',
  });

test('a TRULY absent package (both readings agree) is a first install: allowed, and installs', () => {
  const { adb, calls } = phone();
  const r = pre(adb, freshOut());
  assert.equal(r.installed, false);
  I.installApk({ adb, pkg: PKG, apk: 'production.apk' });
  assert.deepEqual(calls, [
    'shell pm list packages',
    `shell pm path ${PKG}`,
    'install -r production.apk',
  ]);
});

test('I2: absence is never inferred — an empty / garbled answer or two disagreeing readings → STOP, no pull, no install', () => {
  const cases = [
    ['empty list', { list: { status: 0, out: '' } }, /unrecognised answer/],
    [
      'list without the framework package',
      { list: { status: 0, out: 'package:com.example\n' } },
      /unrecognised answer/,
    ],
    [
      'garbled list',
      {
        list: {
          status: 0,
          out: 'package:android\nError: could not access the Package Manager\n',
        },
      },
      /unrecognised answer/,
    ],
    [
      'list fails',
      { list: { status: 255, out: 'error: closed' } },
      /unrecognised answer/,
    ],
    [
      'list absent, pm path present',
      {
        list: { status: 0, out: 'package:android\n' },
        path: { status: 0, out: `package:${BASE}\n` },
      },
      /readings disagree.*list packages says absent, pm path says installed/,
    ],
    [
      'list present, pm path absent',
      { installed: { [PKG]: [BASE] }, path: { status: 1, out: '' } },
      /readings disagree.*says installed, pm path says absent/,
    ],
    [
      'pm path garbled (exit 0)',
      { path: { status: 0, out: 'Exception occurred while executing' } },
      /pm path gave an unrecognised answer/,
    ],
    [
      'pm path empty with exit 0',
      { path: { status: 0, out: '' } },
      /pm path gave an unrecognised answer/,
    ],
    [
      'pm path fails but prints a path',
      { path: { status: 1, out: `package:${BASE}\n` } },
      /pm path gave an unrecognised answer/,
    ],
  ];
  for (const [label, opts, re] of cases) {
    const { adb, calls } = phone(opts);
    assert.throws(
      () => pre(adb, freshOut()),
      e => e instanceof STOP && re.test(e.message),
      label,
    );
    assert.ok(
      calls.every(c => !/^(pull|install)/.test(c)),
      `${label}: ${calls.join(' | ')}`,
    );
  }
});

test('the same signer, ONE APK: it is pulled first into a content-named rollback dir, the restore command is install -r', () => {
  const out = freshOut();
  const { adb, calls } = phone({ installed: { [PKG]: [BASE] } });
  const r = pre(adb, out);
  assert.equal(r.installed, true);
  const want = join(
    out,
    `rollback-${PKG}-${r.rollback.files[0].sha256.slice(0, 16)}`,
  );
  assert.equal(r.rollback.dir, want);
  assert.deepEqual(
    r.rollback.files.map(f => f.path),
    [join(want, 'base.apk')],
  );
  assert.equal(r.rollback.files[0].sha256, sha(join(want, 'base.apk')));
  assert.equal(r.rollback.command, `adb install -r ${join(want, 'base.apk')}`);
  assert.deepEqual(readdirSync(out), [
    `rollback-${PKG}-${r.rollback.files[0].sha256.slice(0, 16)}`,
  ]);
  I.installApk({ adb, pkg: PKG, apk: 'production.apk' });
  assert.deepEqual(calls, [
    'shell pm list packages',
    `shell pm path ${PKG}`,
    calls[2],
    'install -r production.apk',
  ]);
  // pulled into a temporary dir first, which became the rollback dir only once complete
  assert.match(
    calls[2],
    new RegExp(
      `^pull ${BASE.replace(/[.~]/g, '\\$&')} ${out}/\\.pulling-${PKG.replace(/\./g, '\\.')}-\\d+-\\d+/base\\.apk$`,
    ),
  );
});

test('I1: a SPLIT install — every APK is pulled and signer-checked; the restore command is install-multiple with base first', () => {
  const out = freshOut();
  const { adb, calls } = phone({ installed: { [PKG]: [...SPLITS, BASE] } });
  const r = pre(adb, out);
  const files = r.rollback.files.map(f => f.path.split('/').at(-1));
  assert.deepEqual(files, [
    'base.apk',
    'split_config.arm64_v8a.apk',
    'split_config.xxhdpi.apk',
  ]);
  assert.equal(
    r.rollback.command,
    `adb install-multiple -r ${r.rollback.files.map(f => f.path).join(' ')}`,
  );
  for (const f of r.rollback.files) {
    assert.equal(f.sha256, sha(f.path));
  }
  assert.equal(calls.filter(c => c.startsWith('pull ')).length, 3);
  // a split signed by another key → STOP
  const m = phone({ installed: { [PKG]: [BASE, ...SPLITS] } });
  assert.throws(
    () =>
      pre(m.adb, freshOut(), {
        byName: { 'split_config.xxhdpi.apk': [KEY_B] },
      }),
    e => e instanceof STOP && /ANOTHER signing key/.test(e.message),
  );
  // splits but no base.apk, or two of the same name → STOP before any pull
  for (const paths of [SPLITS, [BASE, `/data/app/other/base.apk`]]) {
    const p = phone({ installed: { [PKG]: paths } });
    assert.throws(
      () => pre(p.adb, freshOut()),
      e => e instanceof STOP && /no single base\.apk/.test(e.message),
    );
    assert.ok(p.calls.every(c => !c.startsWith('pull')));
  }
});

test('a DIFFERENT signer → STOP before installing, naming the package and both fingerprints; no further adb call', () => {
  const out = freshOut();
  const { adb, calls } = phone({ installed: { [PKG]: [BASE] } });
  assert.throws(
    () => pre(adb, out, { old: [KEY_B] }),
    e =>
      e instanceof STOP &&
      e.message.includes(PKG) &&
      e.message.includes(`installed ${KEY_B}`) &&
      e.message.includes(`new ${KEY_A}`),
  );
  assert.equal(calls.length, 3);
  assert.match(calls[2], /^pull /);
});

test('an UNREADABLE signer → STOP: the installed one (after the pull), the new APK (before any adb call)', () => {
  let m = phone({ installed: { [PKG]: [BASE] } });
  assert.throws(
    () => pre(m.adb, freshOut(), { old: [] }),
    e =>
      e instanceof STOP &&
      /installed app's signer is UNREADABLE/.test(e.message),
  );
  assert.equal(m.calls.length, 3);
  m = phone({ installed: { [PKG]: [BASE] } });
  assert.throws(
    () => pre(m.adb, freshOut(), { fresh: [] }),
    e =>
      e instanceof STOP &&
      /signer of production\.apk is unreadable/.test(e.message),
  );
  assert.deepEqual(m.calls, []);
});

test('a FAILED pull (of any of the APKs) → STOP: no rollback dir is left, no install, no further adb call', () => {
  for (const failing of [BASE, SPLITS[0]]) {
    const out = freshOut();
    const { adb, calls } = phone({
      installed: { [PKG]: [BASE, ...SPLITS] },
      pullFails: [failing],
    });
    assert.throws(
      () => pre(adb, out),
      e =>
        e instanceof STOP &&
        /adb pull of the installed .* failed/.test(e.message),
    );
    assert.match(
      calls.at(-1),
      new RegExp(`^pull ${failing.replace(/[.~]/g, '\\$&')} `),
    );
    assert.deepEqual(readdirSync(out), []);
  }
});

test('I3: a rollback is never overwritten — a second run keeps the FIRST copy untouched', () => {
  const out = freshOut();
  // run 1: the wallet the owner had
  const first = pre(
    phone({ installed: { [PKG]: [BASE] }, bytes: () => 'wallet v-old' }).adb,
    out,
  );
  const f1 = first.rollback.files[0].path;
  const t1 = statSync(f1).mtimeMs;
  // run 2, after the branch APK was installed: another dir, the first untouched
  const second = pre(
    phone({ installed: { [PKG]: [BASE] }, bytes: () => 'wallet v-branch' }).adb,
    out,
  );
  assert.notEqual(second.rollback.dir, first.rollback.dir);
  assert.equal(readFileSync(f1, 'utf8'), 'wallet v-old');
  assert.equal(statSync(f1).mtimeMs, t1);
  assert.equal(second.rollback.keptExisting, false);
  // run 3, the same installed bytes as run 2: the existing dir is reused, not rewritten
  const f2 = second.rollback.files[0].path;
  const t2 = statSync(f2).mtimeMs;
  const third = pre(
    phone({ installed: { [PKG]: [BASE] }, bytes: () => 'wallet v-branch' }).adb,
    out,
  );
  assert.equal(third.rollback.dir, second.rollback.dir);
  assert.equal(third.rollback.keptExisting, true);
  assert.equal(statSync(f2).mtimeMs, t2);
  assert.equal(readdirSync(out).length, 2);
  // an existing dir whose contents differ from the pull (same base, another split) → STOP,
  // and it is not overwritten
  const out2 = freshOut();
  const a = pre(
    phone({ installed: { [PKG]: [BASE, SPLITS[0]] }, bytes: r => r }).adb,
    out2,
  );
  writeFileSync(a.rollback.files[1].path, 'changed split');
  assert.throws(
    () =>
      pre(
        phone({ installed: { [PKG]: [BASE, SPLITS[0]] }, bytes: r => r }).adb,
        out2,
      ),
    e =>
      e instanceof STOP && /already exists with other contents/.test(e.message),
  );
  assert.equal(readFileSync(a.rollback.files[1].path, 'utf8'), 'changed split');
  assert.ok(existsSync(a.rollback.dir));
});

test('an install answering INSTALL_FAILED_UPDATE_INCOMPATIBLE → STOP; anything but Success → STOP', () => {
  const { adb, calls } = phone({
    install: {
      status: 1,
      out: 'Performing Streamed Install\nadb: failed to install production.apk: Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE: Existing package com.nocturawallet signatures do not match newer version; ignoring!]\n',
    },
  });
  assert.throws(
    () => I.installApk({ adb, pkg: PKG, apk: 'production.apk' }),
    e =>
      e instanceof STOP &&
      e.message.includes('INSTALL_FAILED_UPDATE_INCOMPATIBLE') &&
      e.message.includes(PKG),
  );
  assert.deepEqual(calls, ['install -r production.apk']);
  for (const answer of [
    { status: 0, out: 'Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]\n' },
    { status: 0, out: 'Performing Streamed Install\n' },
    { status: 1, out: 'Success\n' },
  ]) {
    const m = phone({ install: answer });
    assert.throws(
      () => I.installApk({ adb: m.adb, pkg: PKG, apk: 'x.apk' }),
      STOP,
      JSON.stringify(answer),
    );
  }
});

test('preflightAll: a STOP on the production wallet leaves the phone untouched (no install of anything)', () => {
  const out = freshOut();
  const { adb, calls } = phone({ installed: { [PKG]: [BASE] } });
  assert.throws(
    () =>
      I.preflightAll({
        ...io(adb, out, { old: [KEY_B] }),
        targets: [
          { pkg: `${PKG}.devnet`, apk: 'devnet.apk' },
          { pkg: `${PKG}.devnet.test`, apk: 'devnet-androidTest.apk' },
          { pkg: PKG, apk: 'production.apk' },
        ],
      }),
    STOP,
  );
  assert.ok(calls.some(c => c === `shell pm path ${PKG}`));
  assert.ok(
    calls.every(c => !c.startsWith('install')),
    calls.join('\n'),
  );
});

test('adbRefusal: never uninstall, never clear data (also inside one shell string); the calls the checkpoint makes pass', () => {
  for (const bad of [
    ['uninstall', PKG],
    ['uninstall', 'com.nocturawallet.devnet.test'],
    ['shell', 'pm', 'uninstall', PKG],
    ['shell', 'pm', 'clear', PKG],
    ['shell', `pm clear ${PKG}`],
    ['shell', 'cmd', 'package', 'clear', PKG],
    ['shell', 'rm', '-rf', '/sdcard'],
  ]) {
    assert.ok(I.adbRefusal(bad), bad.join(' '));
    // the guard stands in front of adb: the refused call never reaches it
    const { adb, calls } = phone();
    assert.throws(() => I.guarded(adb)(bad), STOP);
    assert.deepEqual(calls, []);
  }
  for (const good of [
    ['install', '-r', 'devnet.apk'],
    ['install', '-r', '-t', 'devnet-androidTest.apk'],
    ['pull', BASE, '/tmp/x'],
    ['shell', 'pm', 'list', 'packages'],
    ['shell', 'am', 'force-stop', PKG],
    ['logcat', '-b', 'crash', '-c'],
    ['shell', 'am', 'instrument', '-w', '-r', '-e', 'class', 'x', 'y/z'],
  ]) {
    assert.equal(I.adbRefusal(good), null, good.join(' '));
  }
});

test('signerDigests reads apksigner --print-certs, and nothing else', () => {
  const text = `Signer #1 certificate DN: CN=Noctura\nSigner #1 certificate SHA-256 digest: ${KEY_B.toUpperCase()}\nSigner #1 certificate SHA-1 digest: ${'c'.repeat(40)}\nSigner #1 certificate MD5 digest: ${'d'.repeat(32)}\n`;
  assert.deepEqual(I.signerDigests(text), [KEY_B]);
  // build-tools 37's format (measured on the checkpoint's APKs), one cert under two schemes
  const v37 = `V2 Signer: certificate DN: CN=Noctura\nV2 Signer: certificate SHA-256 digest: ${KEY_A}\nV3 Signer: certificate SHA-256 digest: ${KEY_A}\nV2 Signer: certificate SHA-1 digest: ${'c'.repeat(40)}\n`;
  assert.deepEqual(I.signerDigests(v37), [KEY_A]);
  assert.deepEqual(
    I.signerDigests('DOES NOT VERIFY\nERROR: JAR signer CERT.RSA'),
    [],
  );
});
