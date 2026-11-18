/**
 * The M1c desk logic (lib.mjs): the pinned-control readouts parsed from the HAND-WRITTEN sample
 * (fixtures/pinned-control-sample.txt — the app's Jest suite `pinnedControl.test.ts` holds its lines
 * to the same file), the §6.0 judge with a FAIL row per field it decides, and the API base read off
 * the APKs' BuildConfig (M1b's recorded dexdump fixtures). No network, no device.
 *
 *   node --test scripts/m1c-checkpoint/*.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as L from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = readFileSync(join(HERE, 'fixtures/pinned-control-sample.txt'), 'utf8');
const DEX = n => readFileSync(join(HERE, `../m1b-checkpoint/fixtures/buildconfig-${n}.dexdump.txt`), 'utf8');
const API_BASE = 'https://api.noc-tura.io/api/v1';

const sample = () => L.readoutsFromLog(SAMPLE).readouts;
/** The sample with one field of one probe changed (a one-field mutation of what the phone said). */
function mutate(probe, patch) {
  return sample().map(r => (r.probe === probe ? { ...r, ...patch } : r));
}
const verdict = (readouts, apiBase = API_BASE) =>
  Object.fromEntries(L.judgePinnedControl({ readouts, apiBase }).map(l => [l.id, l.pass]));
const ALL_PASS = { 'M1c.P0': true, 'M1c.P1': true, 'M1c.P2': true, 'M1c.P3': true };

test('the sample parses: three pinned-control readouts, one complete run, nothing invalid', () => {
  const { readouts, incomplete, invalid } = L.readoutsFromLog(SAMPLE);
  assert.equal(readouts.length, 3);
  assert.deepEqual(incomplete, []);
  assert.deepEqual(invalid, []);
  assert.deepEqual(readouts.map(r => r.probe), ['submit', 'quote', 'submit-prefix']);
  const runs = L.pinnedRuns(readouts);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].complete, true);
  assert.equal(runs[0].key, 'kz3d9q2c#1');
});

test('the sample passes every line, with API_BASE read off the devnet APK', () => {
  const devnet = L.buildConfigFromDexdump(DEX('devnet'));
  assert.equal(devnet.API_BASE, API_BASE);
  assert.deepEqual(verdict(sample(), devnet.API_BASE), ALL_PASS);
});

test('M1c.P1 fails on each field it decides', () => {
  for (const patch of [{ threw: true, status: null }, { status: 502 }, { status: 200 }, { outcome: 'relay_failed' }, { outcome: null }]) {
    assert.equal(verdict(mutate('submit', patch))['M1c.P1'], false, JSON.stringify(patch));
  }
});

test('M1c.P2 fails on each field it decides', () => {
  const q = sample().find(r => r.probe === 'quote').quote;
  for (const patch of [
    { status: 503 },
    { threw: true, status: null, quote: null },
    { quote: null },
    { quote: { ...q, feePayer: '9643JXJm5ZZwv8yaTozQ2qMeVw6xHQWhquGsD87knME9' } },
    { quote: { ...q, programId: '11111111111111111111111111111111' } },
    { quote: { ...q, pool: L.DEVNET.mint } },
    { quote: { ...q, mint: L.DEVNET.pool } },
    { quote: { ...q, minFeeWithdrawChange: '100001' } },
  ]) {
    assert.equal(verdict(mutate('quote', patch))['M1c.P2'], false, JSON.stringify(patch));
  }
  // a quote without the grant (P1 not live) still passes P2: the grant is Task 3's bound, not this line's
  assert.equal(verdict(mutate('quote', { quote: { ...q, gasGrantLamports: null } }))['M1c.P2'], true);
});

test('M1c.P3 (the negative control) fails when the pre-fix variant did not lose the status', () => {
  for (const patch of [
    { threw: false, lostStatus: false, status: 400, outcome: 'invalid_request' }, // the library resolved a non-2xx
    { lostStatus: false }, // threw something else
    { pinFailure: true, lostStatus: false }, // a pin failure is not the control
  ]) {
    assert.equal(verdict(mutate('submit-prefix', patch))['M1c.P3'], false, JSON.stringify(patch));
  }
});

test('M1c.P0 fails on a doubled /v1, a foreign path, or an unread / malformed API base', () => {
  assert.equal(verdict(mutate('submit', { url: `${API_BASE}/v1/relayer/submit` }))['M1c.P0'], false);
  assert.equal(verdict(mutate('quote', { url: 'https://api.noc-tura.io/v1/relayer/quote' }))['M1c.P0'], false);
  assert.equal(verdict(sample(), null)['M1c.P0'], false);
  assert.equal(verdict(sample(), `${API_BASE}/`)['M1c.P0'], false);
  assert.equal(verdict(sample(), `${API_BASE}/v1`)['M1c.P0'], false);
});

test('no run, or only an incomplete one, fails every line', () => {
  assert.deepEqual(Object.values(verdict([])), [false, false, false, false]);
  const noPrefix = sample().filter(r => r.probe !== 'submit-prefix');
  assert.equal(L.pinnedRuns(noPrefix)[0].complete, false);
  assert.deepEqual(Object.values(verdict(noPrefix)), [false, false, false, false]);
  const twice = [...sample(), { ...sample()[0], seq: 4 }];
  assert.equal(L.pinnedRuns(twice)[0].complete, false);
});

test('judgedReadouts: --judge-only judges everything recorded; otherwise only the triggered run', () => {
  const readouts = sample();
  const run = L.pinnedRuns(readouts)[0];
  assert.deepEqual(L.judgedReadouts({ judgeOnly: true, trigger: null, recorded: readouts }), readouts);
  assert.deepEqual(L.judgedReadouts({ judgeOnly: false, trigger: { run }, recorded: readouts }), Object.values(run.probes));
  // a null run (the devnet app never answered with a NEW complete run) judges NOTHING
  assert.deepEqual(L.judgedReadouts({ judgeOnly: false, trigger: { run: null }, recorded: readouts }), []);
  assert.deepEqual(L.judgedReadouts({ judgeOnly: false, trigger: null, recorded: readouts }), []);
});

test('review C1, reproduced and closed: a stale recorded PASS is never judged as the triggered run\'s own answer', () => {
  // the bug the reviewer probed with a fake adb: a complete, PASSING run already on record from an
  // earlier invocation (or an older APK) — judging the record directly, as the code did before the
  // fix, would PASS every line even though THIS invocation's trigger found nothing new.
  const stale = sample();
  assert.deepEqual(Object.values(verdict(stale)), [true, true, true, true]);
  // the fix: judgedReadouts, fed the same stale record but a trigger that found no new run, yields
  // an EMPTY list, and judging that FAILS every line with the "no NEW complete run" detail — never
  // the stale record's PASS.
  const judged = L.judgedReadouts({ judgeOnly: false, trigger: { run: null }, recorded: stale });
  assert.deepEqual(judged, []);
  const lines = L.judgePinnedControl({ readouts: judged, apiBase: API_BASE, noRunDetail: 'no NEW complete run after the trigger' });
  assert.deepEqual(lines.map(l => l.pass), [false, false, false, false]);
  assert.ok(lines.every(l => l.detail === 'no NEW complete run after the trigger'), JSON.stringify(lines));
  // --judge-only is unaffected: it is meant to re-judge exactly the stale record
  assert.deepEqual(Object.values(verdict(L.judgedReadouts({ judgeOnly: true, trigger: { run: null }, recorded: stale }))), [true, true, true, true]);
});

test('the LAST complete run is judged (a later failing run is not hidden by an earlier pass, and vice versa)', () => {
  const later = (rs, patch = {}) => rs.map(r => ({ ...r, run: 2, seq: r.seq + 3, at: '2026-11-17T12:05:00.000Z', ...(r.probe === 'submit' ? patch : {}) }));
  assert.equal(verdict([...sample(), ...later(sample(), { threw: true, status: null })])['M1c.P1'], false);
  assert.equal(verdict([...later(sample(), {}).map(r => ({ ...r, run: 1, at: '2026-11-17T11:00:00.000Z', seq: r.seq - 3 })), ...mutate('submit', {}).map(r => ({ ...r, run: 2 }))])['M1c.P1'], true);
  const failingFirst = mutate('submit', { status: 502 }).map(r => ({ ...r, at: '2026-11-17T11:00:00.000Z' }));
  assert.equal(verdict([...failingFirst, ...later(sample())])['M1c.P1'], true);
});

test('the schema: a pinned-control readout out of shape is invalid, never judged', () => {
  const [line] = SAMPLE.split('\n');
  const base = JSON.parse(line.slice(line.indexOf('{')));
  const id = `${base.session}-${base.seq}`;
  assert.equal(L.readoutRefusal(base, id), null);
  for (const patch of [{ probe: 'other' }, { threw: 'false' }, { run: 0 }, { status: '400' }, { outcome: 'Invalid' }, { url: null }, { quote: { programId: 'x' } }]) {
    assert.notEqual(L.readoutRefusal({ ...base, ...patch }, id), null, JSON.stringify(patch));
  }
  const q = JSON.parse(SAMPLE.split('\n')[1].slice(SAMPLE.split('\n')[1].indexOf('{')));
  assert.equal(L.readoutRefusal(q, `${q.session}-${q.seq}`), null);
  assert.notEqual(L.readoutRefusal({ ...q, quote: { ...q.quote, extra: '1' } }, `${q.session}-${q.seq}`), null);
  assert.notEqual(L.readoutRefusal({ ...q, quote: { ...q.quote, maxFee: 100000 } }, `${q.session}-${q.seq}`), null);
  // M1b's events still parse with this schema (M1b's sample, all valid)
  const m1b = L.readoutsFromLog(readFileSync(join(HERE, '../m1b-checkpoint/fixtures/readout-sample.txt'), 'utf8'));
  assert.equal(m1b.invalid.length, 0);
  assert.equal(m1b.readouts.length, 5);
});

test('the APKs: API_BASE read off both; the devnet base must end in exactly one /v1 (with controls)', () => {
  const devnet = L.buildConfigFromDexdump(DEX('devnet'));
  const production = L.buildConfigFromDexdump(DEX('production'));
  assert.equal(production.API_BASE, API_BASE);
  assert.deepEqual(L.judgeApkConfig({ devnet, production }).map(l => [l.id, l.pass]), [['M1c.A1', true], ['M1c.A2', true], ['M1c.A3', true]]);
  for (const bad of [`${API_BASE}/`, 'https://api.noc-tura.io/api', `${API_BASE}/v1`, 'http://api.noc-tura.io/api/v1', undefined]) {
    assert.equal(L.judgeApkConfig({ devnet: { ...devnet, API_BASE: bad }, production }).find(l => l.id === 'M1c.A3').pass, false, String(bad));
  }
  // the M1b gate lines still hold their control: the devnet APK handed in as "production" is refused
  assert.equal(L.judgeApkConfig({ devnet, production: devnet }).find(l => l.id === 'M1c.A2').pass, false);
});
