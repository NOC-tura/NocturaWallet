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
