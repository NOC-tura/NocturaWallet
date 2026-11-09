/**
 * The installs' fail-closed rules (install.mjs; the controller's ruling for the checkpoint,
 * Fable review 1 R1-I1 / R1-I2) over a MOCKED adb — no test touches a device. Each STOP row
 * asserts the exact adb calls made: nothing after the call that stopped it, and no install.
 * Run with the desk tests: `node --test scripts/m1a-checkpoint/*.test.mjs`.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import * as I from './install.mjs';

const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);
const PKG = 'com.nocturawallet';
const BASE = `/data/app/~~x/${PKG}-y/base.apk`;
const out = mkdtempSync(join(tmpdir(), 'm1a-install-test-'));
after(() => rmSync(out, { recursive: true, force: true }));

/**
 * A scripted adb: `answers` maps the call's first words to {status, out}; a pull writes the
 * destination file unless told to fail. Every call is logged.
 */
function mockAdb(answers) {
  const calls = [];
  const adb = args => {
    calls.push(args.join(' '));
    if (args[0] === 'pull') {
      const a = answers.pull ?? { status: 0, out: '1 file pulled' };
      if (a.status === 0) {
        writeFileSync(args[2], 'the installed base apk');
      }
      return a;
    }
    const key = Object.keys(answers).find(k => args.join(' ').startsWith(k));
    if (!key) {
      throw new Error(`unscripted adb call: ${args.join(' ')}`);
    }
    return answers[key];
  };
  return { adb, calls };
}
const installedAnswers = {
  'shell pm list packages': {
    status: 0,
    out: `package:${PKG}.devnet\npackage:${PKG}\n`,
  },
  'shell pm path': { status: 0, out: `package:${BASE}\n` },
};
const io = (adb, signers) => ({
  adb,
  outDir: out,
  sha256File: () => 'f'.repeat(64),
  apkSigners: p => signers[p.endsWith('.base.apk') ? 'installed' : 'new'] ?? [],
});
const STOP = I.CheckpointStop;

test('a package that is not installed (a first install) is allowed, and installs', () => {
  const { adb, calls } = mockAdb({
    'shell pm list packages': { status: 0, out: `package:${PKG}.devnet\n` },
    install: { status: 0, out: 'Performing Streamed Install\nSuccess\n' },
  });
  const r = I.preflightInstall({
    ...io(adb, { new: [KEY_A] }),
    pkg: PKG,
    apk: 'production.apk',
  });
  assert.equal(r.installed, false);
  I.installApk({ adb, pkg: PKG, apk: 'production.apk' });
  assert.deepEqual(calls, [
    `shell pm list packages ${PKG}`,
    'install -r production.apk',
  ]);
});

test('the same signer: the base APK is pulled first (the rollback, sha256 recorded), then installed', () => {
  const { adb, calls } = mockAdb({
    ...installedAnswers,
    install: { status: 0, out: 'Success\n' },
  });
  const r = I.preflightInstall({
    ...io(adb, { new: [KEY_A], installed: [KEY_A] }),
    pkg: PKG,
    apk: 'production.apk',
  });
  assert.equal(r.installed, true);
  assert.equal(r.rollback.path, join(out, `installed-${PKG}.base.apk`));
  assert.equal(r.rollback.sha256, 'f'.repeat(64));
  I.installApk({ adb, pkg: PKG, apk: 'production.apk' });
  assert.deepEqual(calls, [
    `shell pm list packages ${PKG}`,
    `shell pm path ${PKG}`,
    `pull ${BASE} ${r.rollback.path}`,
    'install -r production.apk',
  ]);
});

test('a DIFFERENT signer → STOP before installing, naming the package and both fingerprints; no further adb call', () => {
  const { adb, calls } = mockAdb(installedAnswers);
  assert.throws(
    () =>
      I.preflightInstall({
        ...io(adb, { new: [KEY_A], installed: [KEY_B] }),
        pkg: PKG,
        apk: 'production.apk',
      }),
    e =>
      e instanceof STOP &&
      e.message.includes(PKG) &&
      e.message.includes(`installed ${KEY_B}`) &&
      e.message.includes(`new ${KEY_A}`),
  );
  assert.deepEqual(calls, [
    `shell pm list packages ${PKG}`,
    `shell pm path ${PKG}`,
    `pull ${BASE} ${join(out, `installed-${PKG}.base.apk`)}`,
  ]);
});

test('an UNREADABLE signer → STOP: the installed one (after the pull), the new APK (before any adb call), a missing base path', () => {
  let m = mockAdb(installedAnswers);
  assert.throws(
    () =>
      I.preflightInstall({
        ...io(m.adb, { new: [KEY_A], installed: [] }),
        pkg: PKG,
        apk: 'production.apk',
      }),
    e =>
      e instanceof STOP &&
      /installed app's signer is UNREADABLE/.test(e.message),
  );
  assert.equal(m.calls.length, 3);
  assert.match(m.calls[2], /^pull /);

  m = mockAdb(installedAnswers);
  assert.throws(
    () =>
      I.preflightInstall({
        ...io(m.adb, { new: [], installed: [KEY_A] }),
        pkg: PKG,
        apk: 'production.apk',
      }),
    e =>
      e instanceof STOP &&
      /signer of production\.apk is unreadable/.test(e.message),
  );
  assert.deepEqual(m.calls, []);

  m = mockAdb({
    ...installedAnswers,
    'shell pm path': { status: 1, out: '' },
  });
  assert.throws(
    () =>
      I.preflightInstall({
        ...io(m.adb, { new: [KEY_A], installed: [KEY_A] }),
        pkg: PKG,
        apk: 'production.apk',
      }),
    e => e instanceof STOP && /installed signer UNREADABLE/.test(e.message),
  );
  assert.equal(m.calls.length, 2);
});

test('a FAILED pull of the installed base APK → STOP (no rollback copy, no install); no further adb call', () => {
  const { adb, calls } = mockAdb({
    ...installedAnswers,
    pull: { status: 1, out: 'adb: error: failed to stat remote object' },
  });
  assert.throws(
    () =>
      I.preflightInstall({
        ...io(adb, { new: [KEY_A], installed: [KEY_A] }),
        pkg: PKG,
        apk: 'production.apk',
      }),
    e =>
      e instanceof STOP &&
      /pull of the installed base APK failed/.test(e.message),
  );
  assert.equal(calls.length, 3);
  assert.match(calls[2], /^pull /);
});

test('an install answering INSTALL_FAILED_UPDATE_INCOMPATIBLE → STOP; anything but Success → STOP', () => {
  const { adb, calls } = mockAdb({
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
    const m = mockAdb({ install: answer });
    assert.throws(
      () => I.installApk({ adb: m.adb, pkg: PKG, apk: 'x.apk' }),
      STOP,
      JSON.stringify(answer),
    );
  }
});

test('preflightAll: a STOP on the production wallet leaves the phone untouched (no install of anything)', () => {
  const { adb, calls } = mockAdb({
    'shell pm list packages com.nocturawallet.devnet': {
      status: 0,
      out: '',
    },
    ...installedAnswers,
  });
  assert.throws(
    () =>
      I.preflightAll({
        ...io(adb, { new: [KEY_A], installed: [KEY_B] }),
        targets: [
          { pkg: `${PKG}.devnet`, apk: 'devnet.apk' },
          { pkg: `${PKG}.devnet.test`, apk: 'devnet-androidTest.apk' },
          { pkg: PKG, apk: 'production.apk' },
        ],
      }),
    STOP,
  );
  assert.ok(calls.length > 0);
  assert.ok(
    calls.every(c => !c.startsWith('install')),
    calls.join('\n'),
  );
});

test('adbRefusal: never uninstall, never clear data; the calls the checkpoint makes pass', () => {
  for (const bad of [
    ['uninstall', PKG],
    ['uninstall', 'com.nocturawallet.devnet.test'],
    ['shell', 'pm', 'uninstall', PKG],
    ['shell', 'pm', 'clear', PKG],
    ['shell', 'cmd', 'package', 'clear', PKG],
    ['shell', 'rm', '-rf', '/sdcard'],
  ]) {
    assert.ok(I.adbRefusal(bad), bad.join(' '));
    // the guard stands in front of adb: the refused call never reaches it
    const { adb, calls } = mockAdb({});
    assert.throws(() => I.guarded(adb)(bad), STOP);
    assert.deepEqual(calls, []);
  }
  for (const good of [
    ['install', '-r', 'devnet.apk'],
    ['install', '-r', '-t', 'devnet-androidTest.apk'],
    ['pull', BASE, '/tmp/x'],
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
