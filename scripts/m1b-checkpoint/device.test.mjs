/**
 * The M1b phone operations (device.mjs) over a MOCKED adb — no test touches a device. The wipe's
 * rules are the point: the ONE clear is `pm clear com.nocturawallet.devnet`, sent only by
 * clearDevnetAppData, only for exactly that package with the typed confirmation, only when the
 * installed app has this checkpoint's signer — and every STOP row asserts the exact adb calls
 * made (no clear among them). Run: `node --test scripts/m1b-checkpoint/*.test.mjs`.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import * as I from '../m1a-checkpoint/install.mjs';
import * as D from './device.mjs';
import { DEVNET_PACKAGE, PRODUCTION_PACKAGE } from './lib.mjs';

const SAMPLE = readFileSync(new URL('./fixtures/readout-sample.txt', import.meta.url), 'utf8');
const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);
const root = mkdtempSync(join(tmpdir(), 'm1b-device-test-'));
after(() => rmSync(root, { recursive: true, force: true }));
let n = 0;
const out = () => mkdtempSync(join(root, `o${n++}-`));
const CLEAR = `shell pm clear ${DEVNET_PACKAGE}`;

/** A scripted phone: `installed` = package → its base.apk's signer; every call logged. */
function phone({ installed = { [DEVNET_PACKAGE]: KEY_A }, clear = { status: 0, out: 'Success\n' }, logcat = '', pid = '4242', start = 'Status: ok\n', crash = '' } = {}) {
  const calls = [];
  const adb = args => {
    const c = args.join(' ');
    calls.push(c);
    if (c === 'shell pm list packages') {
      return { status: 0, out: ['package:android', ...Object.keys(installed).map(p => `package:${p}`)].join('\n') + '\n' };
    }
    if (c.startsWith('shell pm path ')) {
      const p = args[3];
      return installed[p] ? { status: 0, out: `package:/data/app/~~x/${p}-y/base.apk\n` } : { status: 1, out: '' };
    }
    if (args[0] === 'pull') {
      const pkg = Object.keys(installed).find(p => args[1].includes(`/${p}-y/`));
      writeFileSync(args[2], `the installed ${pkg}`);
      return { status: 0, out: '1 file pulled\n' };
    }
    if (c === CLEAR) {
      return clear;
    }
    if (c.startsWith('shell am start')) {
      return { status: 0, out: start };
    }
    if (c.startsWith('shell pidof')) {
      return { status: pid ? 0 : 1, out: pid ? `${pid}\n` : '' };
    }
    if (c === 'logcat -b crash -d') {
      return { status: 0, out: crash };
    }
    if (c === 'logcat -d') {
      return { status: 0, out: logcat };
    }
    return { status: 0, out: '' };
  };
  // the new APK is signed with KEY_A; a pulled copy carries its package's installed signer
  const apkSigners = f => (f === '/apks/devnet.apk' ? [KEY_A] : [installed[readFileSync(f, 'utf8').slice('the installed '.length)]].filter(Boolean));
  const sha256File = f => readFileSync(f).toString('hex').padEnd(64, '0').slice(0, 64);
  return { adb, calls, apkSigners, sha256File };
}
const wipe = (p, over = {}) =>
  D.clearDevnetAppData({ adb: p.adb, pkg: DEVNET_PACKAGE, confirm: DEVNET_PACKAGE, apk: '/apks/devnet.apk', apkSigners: p.apkSigners, sha256File: p.sha256File, outDir: out(), ...over });

describe('the wipe: only com.nocturawallet.devnet, only confirmed, only our signer', () => {
  test('refused before ANY adb call for every other name, and without the exact typed confirmation', () => {
    for (const [pkg, confirm] of [
      [PRODUCTION_PACKAGE, PRODUCTION_PACKAGE],
      [`${DEVNET_PACKAGE}.test`, `${DEVNET_PACKAGE}.test`],
      [` ${DEVNET_PACKAGE}`, ` ${DEVNET_PACKAGE}`],
      [`${DEVNET_PACKAGE} `, DEVNET_PACKAGE],
      ['com.nocturawallet.devnet2', 'com.nocturawallet.devnet2'],
      [DEVNET_PACKAGE, undefined],
      [DEVNET_PACKAGE, PRODUCTION_PACKAGE],
      [DEVNET_PACKAGE, 'yes'],
    ]) {
      const p = phone({ installed: { [DEVNET_PACKAGE]: KEY_A, [PRODUCTION_PACKAGE]: KEY_A } });
      assert.throws(() => wipe(p, { pkg, confirm }), I.CheckpointStop, `${pkg} / ${confirm}`);
      assert.deepEqual(p.calls, [], `${pkg} / ${confirm}`);
    }
    assert.equal(D.wipeRefusal(DEVNET_PACKAGE, DEVNET_PACKAGE), null);
  });
  test('the installed devnet app under ANOTHER signing key → STOP, no clear', () => {
    const p = phone({ installed: { [DEVNET_PACKAGE]: KEY_B } });
    assert.throws(() => wipe(p), /ANOTHER signing key/);
    assert.ok(!p.calls.includes(CLEAR));
  });
  test('the devnet app not installed → STOP, no clear', () => {
    const p = phone({ installed: {} });
    assert.throws(() => wipe(p), /not installed — nothing to wipe/);
    assert.ok(!p.calls.includes(CLEAR));
  });
  test('the clear answering anything but Success → STOP', () => {
    const p = phone({ clear: { status: 1, out: 'Failed\n' } });
    assert.throws(() => wipe(p), /answered Failed/);
  });
  test('a confirmed wipe of our devnet app: the signer read first, then EXACTLY one clear, of exactly that package, last', () => {
    const p = phone({ installed: { [DEVNET_PACKAGE]: KEY_A, [PRODUCTION_PACKAGE]: KEY_A } });
    const r = wipe(p);
    assert.equal(r.answer, 'Success');
    assert.deepEqual(p.calls.filter(c => /\bclear\b/.test(c)), [CLEAR]);
    assert.equal(p.calls.at(-1), CLEAR);
    assert.ok(p.calls.indexOf(`shell pm path ${DEVNET_PACKAGE}`) < p.calls.indexOf(CLEAR));
    assert.ok(!p.calls.some(c => c.includes(`pm clear ${PRODUCTION_PACKAGE}`) && !c.includes(DEVNET_PACKAGE)));
  });
  test('only clearDevnetAppData can send it: the guarded adb refuses the very same arguments, and the list is frozen', () => {
    const p = phone();
    assert.throws(() => I.guarded(p.adb)([...D.CLEAR_ARGS]), I.CheckpointStop);
    assert.deepEqual(p.calls, []);
    assert.throws(() => D.CLEAR_ARGS.push('x'), TypeError);
    assert.deepEqual([...D.CLEAR_ARGS], ['shell', 'pm', 'clear', DEVNET_PACKAGE]);
  });
});

describe('the kill: force-stop of the devnet app, once, at the first "deposit-submitted"', () => {
  const lines = SAMPLE.split('\n').filter(Boolean);
  test('fed the log in pieces cut mid-line: the kill fires once, when the submitted readout completes, before the next line', () => {
    const p = phone();
    let killedAfterCalls = -1;
    const w = new D.KillWatcher({
      killAfterSubmit: true,
      now: () => 'T',
      kill: () => {
        killedAfterCalls = p.calls.length;
        return D.killDevnetApp(p.adb);
      },
    });
    const text = lines.join('\n') + '\n';
    w.push(text.slice(0, 50));
    assert.equal(w.killed, null); // half a line: nothing yet
    w.push(text.slice(50, text.indexOf(lines[2]))); // the two chunks of the submitted readout
    assert.equal(killedAfterCalls, 0);
    assert.deepEqual(p.calls, [`shell am force-stop ${DEVNET_PACKAGE}`]);
    assert.equal(w.killed.signature, '3DR6F7oWXS4D5RSsDJAQMbYtQM4EW5Kp2qkJRVSHH72x2GPB4N4G93JkNK9uGGK9CpFeGuy7vtBVeaDHiVQ7b8sm');
    assert.equal(w.killed.session, 'kz3d9q2a');
    w.push(text.slice(text.indexOf(lines[2])));
    assert.deepEqual(p.calls, [`shell am force-stop ${DEVNET_PACKAGE}`]); // once
    assert.equal(w.readouts.length, 5);
  });
  test('a startup or outcome readout before the submitted one does not kill; the submitted one does', () => {
    const p = phone();
    const w = new D.KillWatcher({ killAfterSubmit: true, kill: () => D.killDevnetApp(p.adb) });
    const of = id => lines.filter(l => l.includes(` kz3d9q2a-${id} `)).join('\n') + '\n';
    w.push(of(4) + of(2)); // a startup (error) and an outcome
    assert.equal(w.readouts.length, 2);
    assert.deepEqual(p.calls, []);
    w.push(of(1));
    assert.deepEqual(p.calls, [`shell am force-stop ${DEVNET_PACKAGE}`]);
  });
  test('a "deposit-submitted" already in the buffer when the watch starts (recorded by its collect) does not kill; the next one does (review I-1)', () => {
    // `adb logcat` replays the ring buffer: step 3's submitted readout is still in it at step 4
    const p = phone();
    const known = D.readoutIdsOf([{ readout: { session: 'kz3d9q2a', seq: 1 } }, { readout: { session: 'kz3d9q2a', seq: 2 } }]);
    const w = new D.KillWatcher({ killAfterSubmit: true, known, kill: () => D.killDevnetApp(p.adb) });
    w.push(SAMPLE); // the buffer's replay: the earlier deposit's submitted + outcome, and more
    assert.deepEqual(p.calls, []);
    assert.equal(w.killed, null);
    assert.equal(w.readouts.length, 3); // the known two are not new readouts either
    const second = JSON.stringify({
      schema: 'noctura.a0.readout/1', event: 'deposit-submitted', session: 'kz3d9q2b', seq: 1, at: '2026-11-15T20:05:00.000Z',
      signature: 'a7wDRKqvnNSkBAGs56ssKby9pqXQtc3eAv6W5sF1HAMWNiGYEkkjUPkeNJ4Ji3E2AjUfseiR3U65Fcr8kQvm5tY',
      depositor: 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd', amount: '500000', commitment: '0'.repeat(63) + '7',
    });
    w.push(`NOCTURA-A0-READOUT kz3d9q2b-1 1/1 ${second}\n`);
    assert.deepEqual(p.calls, [`shell am force-stop ${DEVNET_PACKAGE}`]);
    assert.equal(w.killed.session, 'kz3d9q2b');
    // control: the same replay WITHOUT the recorded ids kills on the stale line (the defect)
    const p2 = phone();
    const stale = new D.KillWatcher({ killAfterSubmit: true, kill: () => D.killDevnetApp(p2.adb) });
    stale.push(SAMPLE);
    assert.equal(stale.killed.session, 'kz3d9q2a');
  });
  test('without --kill-after-submit nothing is killed (positive control of the flag)', () => {
    const p = phone();
    const w = new D.KillWatcher({ killAfterSubmit: false, kill: () => D.killDevnetApp(p.adb) });
    w.push(SAMPLE);
    assert.deepEqual(p.calls, []);
    assert.equal(w.readouts.length, 5);
  });
  test('killDevnetApp stops ONLY the devnet package', () => {
    const p = phone();
    D.killDevnetApp(p.adb);
    assert.deepEqual(p.calls, [`shell am force-stop ${DEVNET_PACKAGE}`]);
  });
  test('mergeReadouts keeps the first sighting of each id', () => {
    const r = D.mergeReadouts([], [{ session: 's', seq: 1 }, { session: 's', seq: 2 }], 'T1');
    const again = D.mergeReadouts(r.all, [{ session: 's', seq: 2 }, { session: 's', seq: 3 }], 'T2');
    assert.deepEqual(again.all.map(x => `${x.readout.seq}@${x.seenAt}`), ['1@T1', '2@T1', '3@T2']);
  });
});

describe('the launches (M1a\'s cold-start rule) and the production app\'s silence', () => {
  const launch = (p, expectNoReadout = false) =>
    D.launchCheck({ adb: p.adb, pkg: PRODUCTION_PACKAGE, id: 'M1b.9', text: 't', wait: () => undefined, expectNoReadout });
  test('started, alive, clean crash buffer, no readout line → pass; force-stop first, log cleared before the start', () => {
    const p = phone();
    const l = launch(p, true);
    assert.equal(l.pass, true, l.detail);
    assert.deepEqual(p.calls.slice(0, 4), [`shell am force-stop ${PRODUCTION_PACKAGE}`, 'logcat -b crash -c', 'logcat -c', `shell am start -W -n ${PRODUCTION_PACKAGE}/com.nocturawallet.MainActivity`]);
  });
  test('a readout line in the production app\'s log → FAIL (the gate leaked)', () => {
    const l = launch(phone({ logcat: `11-15 I ReactNativeJS: ${SAMPLE.split('\n')[0]}\n` }), true);
    assert.equal(l.pass, false);
    assert.match(l.detail, /readout lines: 1/);
  });
  test('a crash, a dead process, or no "Status: ok" → FAIL', () => {
    assert.equal(launch(phone({ crash: `FATAL EXCEPTION: main\nProcess: ${PRODUCTION_PACKAGE}\n` })).pass, false);
    assert.equal(launch(phone({ pid: '' })).pass, false);
    assert.equal(launch(phone({ start: 'Status: timeout\n' })).pass, false);
  });
  test('no call of the launch or the check uninstalls or clears app data', () => {
    const p = phone();
    launch(p, true);
    D.afterCheck({ adb: p.adb, pkg: PRODUCTION_PACKAGE, id: 'M1b.10', text: 't', expectNoReadout: true });
    assert.ok(!p.calls.some(c => /uninstall|pm clear/.test(c)));
  });
});
