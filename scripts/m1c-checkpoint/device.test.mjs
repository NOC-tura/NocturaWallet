/**
 * The M1c desk's phone steps over a MOCKED adb (device.mjs): the control's trigger is exactly the
 * deep link to the devnet package, the wait ends on a NEW complete run (an old run in the log does
 * not end it), and it gives up after its timeout. No device, no network.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as I from '../m1a-checkpoint/install.mjs';
import * as D from './device.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = readFileSync(join(HERE, 'fixtures/pinned-control-sample.txt'), 'utf8');
const PREFIX = '11-17 12:00:00.123  4242  4301 I ReactNativeJS: ';
const logOf = text => text.split('\n').filter(Boolean).map(l => PREFIX + l).join('\n');

function mockAdb(logAfterPolls) {
  const calls = [];
  let logcats = 0;
  const adb = args => {
    calls.push(args);
    if (args[0] === 'shell' && args[1] === 'am') {
      return { status: 0, out: 'Starting: Intent { act=android.intent.action.VIEW dat=noctura://a0-pinned-control/... }\nStatus: ok\nLaunchState: WARM\n' };
    }
    if (args[0] === 'logcat') {
      logcats += 1;
      return { status: 0, out: logAfterPolls(logcats) };
    }
    throw new Error(`unexpected adb ${args.join(' ')}`);
  };
  return { adb, calls };
}

test('the trigger is exactly `am start -W -a VIEW -d noctura://a0-pinned-control com.nocturawallet.devnet`, and the guard allows it', () => {
  assert.deepEqual([...D.TRIGGER_ARGS], ['shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', 'noctura://a0-pinned-control', 'com.nocturawallet.devnet']);
  assert.equal(I.adbRefusal([...D.TRIGGER_ARGS]), null);
});

test('the wait ends on the first poll that shows a new complete run', () => {
  const { adb, calls } = mockAdb(n => (n < 3 ? '' : logOf(SAMPLE)));
  const slept = [];
  const r = D.triggerPinnedControl({ adb, sleep: s => slept.push(s), pollSeconds: 3, timeoutSeconds: 30 });
  assert.equal(r.started, true);
  assert.equal(r.run.key, 'kz3d9q2c#1');
  assert.equal(r.polls, 3);
  assert.deepEqual(calls[0], [...D.TRIGGER_ARGS]);
  assert.deepEqual(calls.slice(1), [['logcat', '-d'], ['logcat', '-d'], ['logcat', '-d']]);
  assert.deepEqual(slept, [3, 3, 3]);
});

test('a run recorded BEFORE the trigger does not end the wait (control), and the wait gives up at its timeout', () => {
  const { adb } = mockAdb(() => logOf(SAMPLE));
  const r = D.triggerPinnedControl({ adb, sleep: () => undefined, knownRunKeys: ['kz3d9q2c#1'], pollSeconds: 5, timeoutSeconds: 20 });
  assert.equal(r.run, null);
  assert.equal(r.polls, 5);
});

test('an incomplete run (the pre-fix probe not yet logged) does not end the wait', () => {
  const two = SAMPLE.split('\n').slice(0, 2).join('\n');
  const { adb } = mockAdb(n => (n < 4 ? logOf(two) : logOf(SAMPLE)));
  const r = D.triggerPinnedControl({ adb, sleep: () => undefined, pollSeconds: 1, timeoutSeconds: 10 });
  assert.equal(r.polls, 4);
  assert.equal(r.run.complete, true);
});

test('an app that did not start is reported (started: false), never assumed', () => {
  const { adb } = mockAdb(() => '');
  const failing = args => (args[1] === 'am' ? { status: 1, out: 'Error: Activity not started, unable to resolve Intent' } : adb(args));
  const r = D.triggerPinnedControl({ adb: failing, sleep: () => undefined, pollSeconds: 1, timeoutSeconds: 1 });
  assert.equal(r.started, false);
  assert.equal(r.run, null);
});

// ============================================================== M1c Task 9

const USAMPLE = readFileSync(join(HERE, 'fixtures/unshield-sample.txt'), 'utf8');
const ulines = USAMPLE.split('\n').filter(Boolean);
const IDS = ulines.map(l => l.split(' ')[1]);

test('the hold link is exactly `am start -W -a VIEW -d noctura://a0-hold-next-submit com.nocturawallet.devnet`, and the guard allows it', () => {
  assert.deepEqual([...D.HOLD_ARGS], ['shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', 'noctura://a0-hold-next-submit', 'com.nocturawallet.devnet']);
  assert.equal(I.adbRefusal([...D.HOLD_ARGS]), null);
  assert.deepEqual([...D.INSTRUMENT_ARGS], ['shell', 'am', 'instrument', '-w', '-r', '-e', 'class', 'com.nocturawallet.prover.A0ConfirmWindowTest', 'com.nocturawallet.devnet.test/androidx.test.runner.AndroidJUnitRunner']);
  assert.equal(I.adbRefusal([...D.INSTRUMENT_ARGS]), null);
});

test('arming waits for a NEW "submit-hold armed" line; one recorded before does not count (control)', () => {
  const { adb, calls } = mockAdb(n => (n < 2 ? '' : logOf(USAMPLE)));
  const r = D.armSubmitHold({ adb, sleep: () => undefined, pollSeconds: 1, timeoutSeconds: 10 });
  assert.equal(r.started, true);
  assert.equal(r.armed.state, 'armed');
  assert.deepEqual(calls[0], [...D.HOLD_ARGS]);
  const { adb: again } = mockAdb(() => logOf(USAMPLE));
  assert.equal(D.armSubmitHold({ adb: again, sleep: () => undefined, knownIds: IDS, pollSeconds: 1, timeoutSeconds: 3 }).armed, null);
});

test('the kill: only a NEW held "unshield-submitting" line kills, once; an unheld one never does', () => {
  const kills = [];
  const k = new D.HeldSubmitKiller({ kill: () => (kills.push(1), { out: '' }), now: () => '2026-11-18T09:00:07.000Z' });
  // the first five lines: an UNHELD unshield (line 2), its outcome, the hold armed and taken — no kill
  const fed = k.push(logOf(ulines.slice(0, 5).join('\n')) + '\n');
  assert.equal(fed.length, 5);
  assert.equal(kills.length, 0);
  assert.equal(k.killed, null);
  // line 6: the held unshield (heldMs 30000) → the kill, at once
  k.push(logOf(ulines[5]) + '\n');
  assert.equal(kills.length, 1);
  assert.deepEqual(k.killed, { at: '2026-11-18T09:00:07.000Z', session: 'kz4u7m1c', seq: 6, owner: 'AuUTDTY6ge45h1Z61eCJYiX4VYb3JvuGvnTevNvHq4BA', heldMs: 30000, answer: '' });
  // the rest, and the same text replayed: no second kill
  k.push(logOf(ulines.slice(6).join('\n')) + '\n');
  k.push(logOf(USAMPLE) + '\n');
  assert.equal(kills.length, 1);
  // control: the held line already recorded before the stream (logcat replays its buffer) never kills
  const k2 = new D.HeldSubmitKiller({ kill: () => (kills.push(2), { out: '' }), known: IDS });
  k2.push(logOf(USAMPLE) + '\n');
  assert.equal(k2.killed, null);
  // a chunk cut mid-line waits for its end
  const k3 = new D.HeldSubmitKiller({ kill: () => ({ out: '' }) });
  const line = logOf(ulines[5]);
  assert.deepEqual(k3.push(line.slice(0, 100)), []);
  assert.equal(k3.push(line.slice(100) + '\n').length, 1);
  assert.notEqual(k3.killed, null);
});

test('m-4: a lapsed arm ("submit-hold expired") is reported, never a kill — the unshield after it is ordinary', () => {
  const kills = [];
  const k = new D.HeldSubmitKiller({ kill: () => (kills.push(1), { out: '' }), now: () => '2026-11-18T09:16:01.000Z' });
  const expired = ulines.find(l => l.includes('"state":"expired"'));
  assert.ok(expired); // the sample carries one (non-vacuous)
  k.push(logOf(expired) + '\n');
  assert.deepEqual(k.expired, { at: '2026-11-18T09:16:01.000Z', session: 'kz4u9x2d', seq: 6 });
  assert.equal(k.killed, null);
  assert.equal(kills.length, 0);
  // control: before it, nothing is reported expired
  const k2 = new D.HeldSubmitKiller({ kill: () => ({ out: '' }) });
  k2.push(logOf(ulines.slice(0, 5).join('\n')) + '\n');
  assert.equal(k2.expired, null);
});

test('the killer keeps only the readout lines of the stream (no quadratic re-parse of a chatty log; fix round 1, minor)', () => {
  const k = new D.HeldSubmitKiller({ kill: () => ({ out: '' }) });
  const noise = Array.from({ length: 2000 }, (_, i) => `11-19 10:00:00.000  1234  1234 I SomeApp: line ${i}`).join('\n') + '\n';
  k.push(noise);
  assert.equal(k.text, '');
  // control: a readout among the noise is kept and still kills
  k.push(noise + logOf(ulines[5]) + '\n' + noise);
  assert.notEqual(k.killed, null);
  assert.equal(k.text.split('\n').filter(Boolean).length, 1);
});

test('the kill is a force-stop of the DEVNET app only (the guard allows it; no data touched)', () => {
  const calls = [];
  D.killDevnetApp(args => (calls.push(args), { status: 0, out: '' }));
  assert.deepEqual(calls, [['shell', 'am', 'force-stop', 'com.nocturawallet.devnet']]);
});

test('the manual wipe: three ways, each with its steps; another word is refused; the record says "manual: <how>"', () => {
  assert.deepEqual(Object.keys(D.MANUAL_WIPES), ['clear-data', 'in-app', 'reinstall']);
  for (const how of Object.keys(D.MANUAL_WIPES)) {
    assert.equal(D.manualWipeRefusal(how), null);
    const w = D.manualWipeRecord(how, '2026-11-18T10:00:00.000Z');
    assert.deepEqual([w.at, w.pkg, w.answer], ['2026-11-18T10:00:00.000Z', 'com.nocturawallet.devnet', `manual: ${how}`]);
    assert.ok(D.MANUAL_WIPES[how].join(' ').includes('devnet'), how);
  }
  // every step names the DEVNET app and none tells the owner to touch the production wallet
  assert.match(D.MANUAL_WIPES['clear-data'][0], /NOT "Noctura", the production wallet/);
  assert.match(D.MANUAL_WIPES.reinstall[0], /NEVER "Noctura"/);
  for (const bad of [undefined, '', 'pm-clear', 'clear-data ', 'CLEAR-DATA', 'toString', '__proto__']) {
    assert.notEqual(D.manualWipeRefusal(bad), null, String(bad));
    assert.throws(() => D.manualWipeRecord(bad, 'x'), I.CheckpointStop);
  }
});

test('pm clear refused by the phone (the OnePlus SecurityException) → the hint to wipe by hand; other answers → no hint', () => {
  const oneplus = 'pm clear com.nocturawallet.devnet answered Exception occurred while executing \'clear\':\njava.lang.SecurityException: PID 12345 does not have permission android.permission.CLEAR_APP_USER_DATA to clear data of package com.nocturawallet.devnet — stopped';
  assert.match(D.wipeRefusedHint(oneplus), /wipe --manual clear-data/);
  assert.equal(D.wipeRefusedHint('pm clear com.nocturawallet.devnet answered Failed — stopped'), null);
  assert.equal(D.wipeRefusedHint('com.nocturawallet.devnet is not installed — nothing to wipe'), null);
});

test('the phone\'s facts: model, release, API level as an integer (or null)', () => {
  const props = { 'ro.product.model': 'LE2123\n', 'ro.build.version.release': '14\n', 'ro.build.version.sdk': '34\n' };
  const adb = args => ({ status: 0, out: props[args[2]] ?? '' });
  assert.deepEqual(D.readPhone(adb), { model: 'LE2123', release: '14', sdk: 34 });
  assert.equal(D.readPhone(() => ({ status: 1, out: 'error: device offline' })).sdk, null);
});

test('the instrumented run: exactly "OK (6 tests)" with the runner\'s success code passes; anything else fails', () => {
  const ok = 'INSTRUMENTATION_STATUS_CODE: 0\n\nTime: 12.3\n\nOK (6 tests)\n\n\nINSTRUMENTATION_CODE: -1\n';
  assert.deepEqual(D.instrumentVerdict(ok), { pass: true, detail: 'OK (6 tests)' });
  assert.equal(D.instrumentVerdict(ok.replace('OK (6 tests)', 'OK (5 tests)')).pass, false);
  assert.equal(D.instrumentVerdict(ok.replace('INSTRUMENTATION_CODE: -1', 'INSTRUMENTATION_CODE: 0')).pass, false);
  const failed = 'There was 1 failure:\n1) dialogWindowIsSecure(...)\nFAILURES!!!\nTests run: 6,  Failures: 1\n\nINSTRUMENTATION_CODE: -1\n';
  assert.deepEqual(D.instrumentVerdict(failed), { pass: false, detail: 'FAILURES!!!' });
  assert.equal(D.instrumentVerdict('INSTRUMENTATION_FAILED: com.nocturawallet.devnet.test/androidx.test.runner.AndroidJUnitRunner\n').pass, false);
});
