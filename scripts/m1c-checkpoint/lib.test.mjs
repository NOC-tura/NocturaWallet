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
import * as B from '../m1b-checkpoint/lib.mjs';
import * as C from './chain.mjs';
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

// ============================================================== M1c Task 9: the unshield lines

const USAMPLE = readFileSync(join(HERE, 'fixtures/unshield-sample.txt'), 'utf8');
const ROOT = join(HERE, '../..');
const recordedTx = sig => JSON.parse(readFileSync(join(ROOT, `src/modules/shielded/a0/__tests__/fixtures/landed-withdraw-${sig}.json`), 'utf8')).result;
const FACTS = JSON.parse(readFileSync(join(HERE, 'fixtures/devnet-chain-facts.json'), 'utf8'));
const PINNED_VK = JSON.parse(readFileSync(join(ROOT, 'native/noctura-prover/tests/fixtures/a0-vk/withdraw_change_vk.json'), 'utf8'));

test('the unshield sample parses: twelve readouts of the five M1c events, nothing invalid; the same text through M1b\'s parser refuses them', () => {
  const { readouts, incomplete, invalid } = L.readoutsFromLog(USAMPLE);
  assert.equal(readouts.length, 12);
  assert.deepEqual(incomplete, []);
  assert.deepEqual(invalid, []);
  assert.deepEqual([...new Set(readouts.map(r => r.event))], ['startup-accounts', 'unshield-submitting', 'unshield-outcome', 'submit-hold', 'unshield-reconcile']);
  // control: M1b's own schema knows none of them
  assert.equal(B.readoutsFromLog(USAMPLE).invalid.length, 12);
});

test('the schema of the M1c events: each field out of shape (or one field more) is refused', () => {
  const rs = L.readoutsFromLog(USAMPLE).readouts;
  const by = (event, status) => rs.find(r => r.event === event && (status === undefined || r.status === status));
  const refused = (r, patch) => L.readoutRefusal({ ...r, ...patch }, `${r.session}-${r.seq}`);
  const cases = [
    [by('unshield-submitting'), { extra: 1 }],
    // R2-N3: the seed set is NOT a field of this line any more (it is on startup-accounts)
    [by('unshield-submitting'), { seedKeys: [by('unshield-submitting').owner] }],
    [by('unshield-submitting'), { registry: [{ address: by('unshield-submitting').owner, role: 'exit', linked: false }] }],
    [by('unshield-submitting'), { registry: [{ address: by('unshield-submitting').owner, role: 'main', linked: false, scheme: 'slip10:0' }] }],
    [by('unshield-submitting'), { heldMs: -1 }],
    [by('unshield-submitting'), { walletKind: 'bip44' }],
    [by('unshield-submitting'), { gasGrantLamports: 3000000 }],
    [by('unshield-submitting'), { destination: 'other' }],
    [by('unshield-submitting'), { amount: '01' }],
    [by('unshield-outcome', 'spent'), { changeLeafIndex: '22' }],
    [by('unshield-outcome', 'spent'), { nullifier: 'ab'.repeat(32) }],
    [by('unshield-outcome', 'spent'), { status: 'done' }],
    [by('unshield-outcome', 'pending'), { reason: 'lost' }],
    [by('unshield-outcome', 'pending'), { signature: 7 }],
    [by('unshield-outcome', 'landed-unverified'), { code: 'E_OTHER' }],
    [by('unshield-outcome', 'not-sent'), { outcome: 'Invalid Request' }],
    [by('unshield-reconcile'), { reverted: -1 }],
    [by('unshield-reconcile'), { stillPending: [{ reason: 'in-window', rho: 'ab' }] }],
    [by('startup-accounts'), { accountsError: 'E_A0_ACCOUNTS_CORRUPT' }], // accounts AND an error
    [by('startup-accounts'), { restore: { changeNotes: 1 } }],
    [by('startup-accounts'), { seedKeys: ['not-a-key'] }],
    [by('startup-accounts'), { seedKeys: [] }],
    [by('startup-accounts'), { seedKeysError: 'E_A0_ACCOUNTS_CORRUPT' }], // keys AND an error
    [by('startup-accounts'), { seedKeys: null, seedKeysError: 'a message' }],
    [by('submit-hold'), { heldMs: 0 }],
    [by('submit-hold'), { state: 'held' }],
  ];
  for (const [r, patch] of cases) {
    assert.notEqual(refused(r, patch), null, `${r.event} ${JSON.stringify(patch)}`);
  }
  // controls: each base readout is accepted as it is; contextError is the one alternative shape
  for (const r of rs) {
    assert.equal(L.readoutRefusal(r, `${r.session}-${r.seq}`), null, `${r.event} ${r.seq}`);
  }
  const s = by('unshield-submitting');
  const ctxError = Object.fromEntries(Object.entries(s).filter(([k]) => !['feePayer', 'gasGrantLamports', 'walletKind', 'registry', 'heldMs'].includes(k)));
  assert.equal(L.readoutRefusal({ ...ctxError, contextError: 'E_A0_ACCOUNTS_CORRUPT' }, `${s.session}-${s.seq}`), null);
  assert.notEqual(L.readoutRefusal({ ...ctxError, contextError: 'a message' }, `${s.session}-${s.seq}`), null);
  // startup-accounts: an underived set (null, no error) and a failed one (null + its code) are the alternatives
  const a = by('startup-accounts');
  assert.equal(L.readoutRefusal({ ...a, seedKeys: null, seedKeysError: null }, `${a.session}-${a.seq}`), null);
  assert.equal(L.readoutRefusal({ ...a, seedKeys: null, seedKeysError: 'E_A0_ACCOUNTS_CORRUPT' }, `${a.session}-${a.seq}`), null);
  // m-4: the three states of the hold, and only those
  assert.deepEqual(rs.filter(r => r.event === 'submit-hold').map(r => r.state), ['armed', 'taken', 'expired']);
});

// ---------------------------------------------------------------- the judge, on a whole recorded run

const FP = L.RELAYER_FEE_PAYER;
const MAIN = 'DaiWcqhB9YpdqXUypDAF97WTAEY9bEdwjfX4eDFp9yNc'; // the slip10 wallet's main (no recorded tx names it)
const CLI = 'AuUTDTY6ge45h1Z61eCJYiX4VYb3JvuGvnTevNvHq4BA';
const HELD = '5pHpWLNFQz89brhH6h5Lbqy2zT1jdjh6hjKT7fFMeEkb';
const HELD_ATA = 'D7e1jdGHeomw2dT6n5DXJASSABZC6dgyPH6WJ326uqb6';
const EXT = 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd'; // 5sKiWZTv's owner (it holds SOL; its ATA existed)
const EXT_ATA = '9hZSf8jMxBdqcvnYzj6EkQ2gPoZCoX2GcF8f1dgkyLsn';
const FRESH = 'AgPYn4odQNKwWBjvCtgG8G1supmLKaFHtbDVHmMT2KtP'; // 5F8Ks5qa's owner (0 lamports before, the grant)
const FRESH_ATA = '2ot2kwhs7gFFPHAYNwkuNsUsfZp8hWAgzHpNQLx9pASu';
const SIG_EXT = '5sKiWZTvwSzNiKzFsK6DFrQGoksbv2enc1NffvxoPGJNdusd6fZa585GSxnG6om7c4JrsA7uDovQKaSc8SnQVwMr';
const SIG_FRESH = '5F8Ks5qawFYWdhjPVogs8S7cx3fY68QC4qzpJ6VcfLEyHT4UCH7oty6i5cHRwma1FDLwpeF8PaWdQVHqhJGmVcZM';
const reg = (...e) => e.map(([address, role]) => ({ address, role, linked: false }));
const CHANGE_EXT = { commitment: '15bca11de36cb63abb898e8ed26db888b1058453c5ef8bae21ce06dcaea4411f', leafIndex: 22, amount: '580000' };
const CHANGE_FRESH = { commitment: '0a579975eb2367144af135283e87e330ff775606bfac3a73c60ce08e7c60247c', leafIndex: 20, amount: '590000' };
const OTHER_NOTE = { commitment: '0'.repeat(63) + '5', leafIndex: 30, amount: '500000' };

/** A whole checkpoint run as the desk records it ({seenAt, readout}); each test mutates one thing. */
function run() {
  // just before the two recorded landings (blockTime 17:38:21 / 17:38:27), so both fall in the
  // fee payer's window (the first submitting line − 2 min)
  let t = Date.parse('2026-11-17T17:37:00.000Z');
  let seq = { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 };
  const rows = [];
  const add = (session, event, fields) => {
    seq[session] += 1;
    t += 1000;
    const at = new Date(t).toISOString();
    rows.push({ seenAt: at, readout: { schema: 'noctura.a0.readout/1', event, session, seq: seq[session], at, ...fields } });
    return at;
  };
  const u = (owner, ata, destination, amount = '400000') => ({ owner, ata, amount, fee: '10000', destination });
  const sub = (owner, ata, destination, registry, extra = {}) => ({ ...u(owner, ata, destination, extra.amount), feePayer: FP, gasGrantLamports: '3000000', walletKind: 'slip10', registry, heldMs: 0, ...extra });
  const accounts = (accounts, seedKeys, restoredBecause = null, restore = null) => ({ restoredBecause, restore, accounts, accountsError: null, seedKeys, seedKeysError: null });
  const REG0 = reg([MAIN, 'main']);
  // the unlock's start: the registry and the seed set (R2-N3: registry ∪ cli ∪ slip10:0)
  add('s1', 'startup-accounts', accounts(REG0, [MAIN, CLI]));
  // CP1a: "Another address"
  add('s1', 'unshield-submitting', sub(EXT, EXT_ATA, 'external', REG0));
  add('s1', 'unshield-outcome', { ...u(EXT, EXT_ATA, 'external'), status: 'spent', signature: SIG_EXT, changeLeafIndex: 22, grantLamports: null, destinationWithoutSol: false });
  // CP1b: "My main account" — the same recorded tx read as an unshield to the main (EXT as this wallet's main)
  add('s1', 'unshield-submitting', sub(EXT, EXT_ATA, 'main', reg([EXT, 'main'])));
  add('s1', 'unshield-outcome', { ...u(EXT, EXT_ATA, 'main'), status: 'spent', signature: SIG_EXT, changeLeafIndex: 22, grantLamports: null, destinationWithoutSol: false });
  // CP2b: the hold, the held fresh unshield, the kill
  add('s1', 'submit-hold', { state: 'armed', heldMs: 30000 });
  add('s1', 'submit-hold', { state: 'taken', heldMs: 30000 });
  add('s1', 'unshield-submitting', sub(HELD, HELD_ATA, 'fresh', reg([MAIN, 'main'], [HELD, 'fresh-pending']), { heldMs: 30000, amount: '10000' }));
  t += 1000;
  const kill = { at: new Date(t).toISOString(), session: 's1', seq: 8, owner: HELD, heldMs: 30000, answer: '' };
  // the next start: pending in its window
  add('s2', 'startup', { phase: 'ready', restoredBecause: null, restore: null, reconcile: { confirmed: [], dropped: [], stillPending: [], skipped: 0 }, notes: { pending: 1, unspent: 1, spent: 2, unspentBalance: '590000', unspentNotes: [CHANGE_FRESH] } });
  add('s2', 'unshield-reconcile', { settled: [], reverted: 0, stillPending: [{ reason: 'in-window' }], skipped: 0, released: 0, promoted: 0 });
  add('s2', 'startup-accounts', accounts(reg([MAIN, 'main'], [HELD, 'fresh-pending']), [MAIN, HELD, CLI]));
  // CP2a + CP2b: the second fresh unshield while the first is pending: the next index (FRESH)
  add('s2', 'unshield-submitting', sub(FRESH, FRESH_ATA, 'fresh', reg([MAIN, 'main'], [HELD, 'fresh-pending'], [FRESH, 'fresh-pending'])));
  add('s2', 'unshield-outcome', { ...u(FRESH, FRESH_ATA, 'fresh'), status: 'spent', signature: SIG_FRESH, changeLeafIndex: 20, grantLamports: '3000000', destinationWithoutSol: false });
  // ≥ 5 min later: "Check again" reverts the held one and releases its reservation
  add('s2', 'unshield-reconcile', { settled: [], reverted: 1, stillPending: [], skipped: 0, released: 1, promoted: 0 });
  // the restart before the wipe (its notes read out)
  const notes = { pending: 0, unspent: 3, spent: 3, unspentBalance: '1670000', unspentNotes: [CHANGE_FRESH, CHANGE_EXT, OTHER_NOTE] };
  add('s3', 'startup', { phase: 'ready', restoredBecause: null, restore: null, reconcile: { confirmed: [], dropped: [], stillPending: [], skipped: 0 }, notes });
  add('s3', 'startup-accounts', accounts(reg([MAIN, 'main'], [FRESH, 'fresh-exit']), [MAIN, FRESH, CLI]));
  t += 1000;
  const wipe = { at: new Date(t).toISOString(), pkg: L.DEVNET_PACKAGE, answer: 'manual: clear-data' };
  // the restore
  add('s4', 'startup', { phase: 'ready', restoredBecause: 'no-record', restore: { treeTransactions: 40, durationMs: 5000, highestHit: 1 }, reconcile: { confirmed: [], dropped: [], stillPending: [], skipped: 0 }, notes: { ...notes, unspentNotes: [OTHER_NOTE, CHANGE_EXT, CHANGE_FRESH] } });
  add('s4', 'startup-accounts', accounts(reg([MAIN, 'main'], [FRESH, 'fresh-exit']), [MAIN, FRESH, CLI], 'no-record', { changeNotes: 2, unmatchedChangeLeaves: 0, attributionCalls: 3, accountIndicesTried: 22, exitAccounts: 1 }));
  // CP1c: the cli wallet (a second phrase; its own labelled wipe and import), to "Another address"
  add('s5', 'startup-accounts', accounts(reg([CLI, 'main']), [CLI], 'no-record', { changeNotes: 0, unmatchedChangeLeaves: 0, attributionCalls: 0, accountIndicesTried: 21, exitAccounts: 0 }));
  add('s5', 'unshield-submitting', sub(EXT, EXT_ATA, 'external', reg([CLI, 'main']), { walletKind: 'cli' }));
  add('s5', 'unshield-outcome', { ...u(EXT, EXT_ATA, 'external'), status: 'spent', signature: SIG_EXT, changeLeafIndex: 22, grantLamports: null, destinationWithoutSol: false });
  const devnet = L.buildConfigFromDexdump(DEX('devnet'));
  const production = L.buildConfigFromDexdump(DEX('production'));
  return {
    readouts: rows,
    // feePayerTxs: the relayer fee payer's signatures in the session's window, read by `verify` (R1-I1)
    chain: {
      txs: { [SIG_EXT]: recordedTx('5sKiWZTv'), [SIG_FRESH]: recordedTx('5F8Ks5qa') },
      histories: { [HELD]: [] },
      feePayerTxs: { [SIG_EXT]: recordedTx('5sKiWZTv'), [SIG_FRESH]: recordedTx('5F8Ks5qa') },
    },
    facts: {
      binaryAddress: FACTS.programData.address,
      // the program side's report of the upgrade (facts file, 2026-11-17), written out
      binary: { sha256: 'b0054981ab0019ff5af81ed46d5443a6e6467f23aff5b506fc661b73d5d65d1b', elfBytes: 446592, paddingBytes: 15712, authority: EXT },
      vk: C.judgeWchangeVk({ address: FACTS.wchangeVk.address, account: FACTS.wchangeVk.answer.value, pinnedVk: PINNED_VK }),
    },
    wipe,
    kill,
    launches: ['M1c.L1', 'M1c.L2', 'M1c.L3'].map(id => ({ id, text: id, pass: true, detail: 'ok' })),
    apkLines: L.judgeApkConfig({ devnet, production }),
    commit: { head: 'abc', apks: 'abc' },
    phone: { model: 'LE2123', sdk: 34, instrument: { pass: true, detail: 'OK (6 tests)' } },
  };
}
const verdictOf = input => Object.fromEntries(L.judgeM1c(input).lines.map(l => [l.id, l.pass]));
const IDS = ['M1c.V', 'M1c.C1', 'M1c.C2', 'M1c.C3', 'M1c.F1', 'M1c.F2', 'M1c.F3', 'M1c.R1', 'M1c.R2', 'M1c.R3', 'M1c.K1', 'M1c.K2', 'M1c.A1', 'M1c.A2', 'M1c.A3', 'M1c.A4', 'M1c.L1', 'M1c.L2', 'M1c.L3', 'M1c.N1', 'M1c.N2'];
/** The run with one change; returns the ids that FAIL. */
const failsWith = f => {
  const r = run();
  f(r);
  return Object.entries(verdictOf(r)).filter(([, p]) => !p).map(([id]) => id);
};
const rowOf = (r, pred) => r.readouts.find(x => pred(x.readout)).readout;

test('positive control: the whole recorded run passes every M1c line, in this order', () => {
  const lines = L.judgeM1c(run()).lines;
  assert.deepEqual(lines.map(l => l.id), IDS);
  assert.deepEqual(lines.filter(l => !l.pass).map(l => `${l.id}: ${l.detail}`), []);
});

test('M1c.V / C1 / C2 / C3: a tx that is not what the phone said, a seed key, a grant, an owner that is not the main', () => {
  // (R2 still passes: the fresh unshield's change leaf is back — R2 asks for at least one)
  assert.deepEqual(failsWith(r => { r.chain.txs[SIG_EXT] = null; }), ['M1c.V', 'M1c.C1', 'M1c.C2', 'M1c.C3']);
  // R2-N3: the seed set is the session's startup-accounts line (∪ the line's registry): the relayer's
  // key in it makes its signature a seed signer — every unshield of that session fails V
  assert.deepEqual(failsWith(r => { rowOf(r, x => x.event === 'startup-accounts' && x.session === 's1').seedKeys.push(FP); }), ['M1c.V', 'M1c.C1', 'M1c.C2']);
  // "Another address" that IS a key of this seed (the startup's seed keys name it): not C1 (and the
  // main-account reading of the same tx in that session is no longer "only the destination")
  assert.deepEqual(failsWith(r => { rowOf(r, x => x.event === 'startup-accounts' && x.session === 's1').seedKeys.push(EXT); }), ['M1c.C1']);
  assert.deepEqual(failsWith(r => { rowOf(r, x => x.event === 'unshield-submitting' && x.destination === 'main').registry[0].address = MAIN; }), ['M1c.C2']);
  // "Another address" that held no SOL got the relayer's grant (a valid §6.8 shape, but not CP1's no-grant one):
  // the fresh-owner tx read as the external unshield
  assert.deepEqual(failsWith(r => {
    const s = rowOf(r, x => x.event === 'unshield-submitting' && x.destination === 'external');
    const o = rowOf(r, x => x.event === 'unshield-outcome' && x.destination === 'external');
    Object.assign(s, { owner: FRESH, ata: FRESH_ATA });
    Object.assign(o, { owner: FRESH, ata: FRESH_ATA, signature: SIG_FRESH, changeLeafIndex: 20, grantLamports: '3000000' });
  }), ['M1c.C1']);
  assert.deepEqual(failsWith(r => { rowOf(r, x => x.event === 'unshield-submitting' && x.walletKind === 'cli').registry.push({ address: FRESH, role: 'fresh-exit', linked: false }); }), ['M1c.C3']);
  // the landed-unverified outcome of the app is loud: V fails and an info line names it
  const r = run();
  const o = rowOf(r, x => x.event === 'unshield-outcome' && x.destination === 'main');
  Object.assign(o, { status: 'landed-unverified', code: 'E_A0_VERIFY_FEE', note: 'spent', changeRecorded: true, linked: false });
  const j = L.judgeM1c(r);
  assert.equal(j.lines.find(l => l.id === 'M1c.V').pass, false);
  assert.match(j.info.join('\n'), /VERIFIER REFUSED 1 landed unshield/);
});

test('M1c.F1: the grant, the owner\'s 0 pre-balance, the token account, the fresh-pending → fresh-exit roles each decide', () => {
  const fresh = r => rowOf(r, x => x.event === 'unshield-submitting' && x.owner === FRESH);
  assert.deepEqual(failsWith(r => { fresh(r).gasGrantLamports = '2000000'; }), ['M1c.V', 'M1c.F1', 'M1c.F2', 'M1c.R3']);
  assert.deepEqual(failsWith(r => { fresh(r).registry.find(e => e.address === FRESH).role = 'fresh-exit'; }), ['M1c.F1']);
  assert.deepEqual(failsWith(r => {
    for (const x of r.readouts) {
      for (const e of x.readout.accounts ?? []) {
        if (e.address === FRESH) {
          e.role = 'fresh-pending';
        }
      }
    }
  }), ['M1c.F1', 'M1c.R3']);
  // the same tx read as if the owner had held SOL: the transfer is no longer a grant to a 0-lamport owner
  assert.deepEqual(failsWith(r => {
    const t = r.chain.txs[SIG_FRESH];
    t.meta.preBalances[5] = 5000;
  }).slice(0, 2), ['M1c.V', 'M1c.F1']);
});

test('M1c.F2 / F3: no kill, an outcome before the kill, no pending at the next start, the second not new, not reverted, a history', () => {
  assert.deepEqual(failsWith(r => { r.kill = null; }), ['M1c.F2', 'M1c.F3']);
  assert.deepEqual(failsWith(r => { r.kill.owner = FRESH; }), ['M1c.F2', 'M1c.F3']);
  assert.deepEqual(failsWith(r => {
    const s = rowOf(r, x => x.event === 'unshield-submitting' && x.owner === HELD);
    r.readouts.splice(8, 0, { seenAt: r.readouts[7].seenAt, readout: { ...s, event: 'unshield-outcome', seq: 9, status: 'not-sent', outcome: 'invalid_request', feePayer: undefined } });
  }), ['M1c.F2', 'M1c.F3']);
  assert.deepEqual(failsWith(r => { rowOf(r, x => x.event === 'unshield-reconcile' && x.stillPending.length).stillPending = []; }), ['M1c.F2']);
  // the second unshield's registry no longer holds the first's reservation (it was released first)
  assert.deepEqual(failsWith(r => {
    const s = rowOf(r, x => x.event === 'unshield-submitting' && x.owner === FRESH);
    s.registry = s.registry.filter(e => e.address !== HELD);
  }), ['M1c.F2', 'M1c.F3']);
  // the second picked an address the first already knew (not a new index)
  assert.deepEqual(failsWith(r => { rowOf(r, x => x.event === 'startup-accounts' && x.session === 's1').seedKeys.push(FRESH); }), ['M1c.F2']);
  assert.deepEqual(failsWith(r => { rowOf(r, x => x.event === 'unshield-reconcile' && x.reverted === 1).released = 0; }), ['M1c.F3']);
  assert.deepEqual(failsWith(r => { r.chain.histories[HELD] = ['5sKiWZTv']; }), ['M1c.F3']);
  assert.deepEqual(failsWith(r => { delete r.chain.histories[HELD]; }), ['M1c.F3']);
});

test('M1c.R1–R3: the wipe record, no-record at the first start, the same notes with a change leaf, the fresh account back', () => {
  assert.deepEqual(failsWith(r => { r.wipe = null; }), ['M1c.R1', 'M1c.R2', 'M1c.R3']);
  assert.deepEqual(failsWith(r => { r.wipe.answer = 'Failed'; }), ['M1c.R1']);
  assert.deepEqual(failsWith(r => { r.wipe.answer = 'manual:'; }), ['M1c.R1']);
  assert.deepEqual(failsWith(r => { r.wipe.pkg = L.PRODUCTION_PACKAGE; }), ['M1c.R1']);
  assert.deepEqual(failsWith(r => { r.wipe.answer = 'Success'; }), []); // pm clear's answer is the other admitted record
  assert.deepEqual(failsWith(r => { rowOf(r, x => x.event === 'startup' && x.restoredBecause === 'no-record').restoredBecause = null; }), ['M1c.R1']);
  assert.deepEqual(failsWith(r => { rowOf(r, x => x.event === 'startup' && x.restoredBecause === 'no-record').notes.unspentNotes.pop(); }), ['M1c.R2']);
  // a restore that brought back only notes that are no change leaf of this checkpoint
  assert.deepEqual(failsWith(r => {
    for (const x of r.readouts.filter(y => y.readout.event === 'startup' && y.readout.notes?.unspent === 3)) {
      x.readout.notes.unspentNotes = [OTHER_NOTE];
    }
  }), ['M1c.R2']);
  // the restart before the wipe is older than the last unshield event: refused, not compared
  assert.deepEqual(failsWith(r => {
    const i = r.readouts.findIndex(x => x.readout.event === 'unshield-reconcile' && x.readout.reverted === 1);
    r.readouts[i].seenAt = new Date(Date.parse(r.wipe.at) - 500).toISOString();
  }), ['M1c.R2']);
  assert.deepEqual(failsWith(r => { rowOf(r, x => x.event === 'startup-accounts' && x.restoredBecause === 'no-record').accounts.pop(); }), ['M1c.R3']);
  // (and F3: a registry after the revert still names the released reservation)
  assert.deepEqual(failsWith(r => { rowOf(r, x => x.event === 'startup-accounts' && x.restoredBecause === 'no-record').accounts.push({ address: HELD, role: 'fresh-pending', linked: false }); }), ['M1c.F3', 'M1c.R3']);
});

test('M1c.K1 / K2 / A4 / L / N: the binary digest, the VK, the commit, the launches, the API level and the window test', () => {
  assert.deepEqual(failsWith(r => { r.facts.binary.sha256 = '24775d75' + r.facts.binary.sha256.slice(8); }), ['M1c.K1']);
  assert.deepEqual(failsWith(r => { r.facts.binary = { error: 'x' }; }), ['M1c.K1']);
  assert.deepEqual(failsWith(r => { r.facts.vk = r.facts.vk.slice(0, 5); }), ['M1c.K2']);
  assert.deepEqual(failsWith(r => { r.facts.vk[5] = { ...r.facts.vk[5], pass: false }; }), ['M1c.K2']);
  assert.deepEqual(failsWith(r => { r.commit = { head: 'abc (dirty)', apks: 'abc (dirty)' }; }), ['M1c.A4']);
  assert.deepEqual(failsWith(r => { r.launches = r.launches.filter(l => l.id !== 'M1c.L3'); }), ['M1c.L3']);
  assert.deepEqual(failsWith(r => { r.phone.sdk = 23; }), ['M1c.N1']);
  assert.deepEqual(failsWith(r => { r.phone = null; }), ['M1c.N1', 'M1c.N2']);
  assert.deepEqual(failsWith(r => { r.phone.instrument = { pass: false, detail: 'FAILURES!!!' }; }), ['M1c.N2']);
  assert.equal(L.authenticatorRow(30), 'API 30+: BIOMETRIC_STRONG | DEVICE_CREDENTIAL');
  assert.equal(L.authenticatorRow(29), 'API 29 (24–29): BIOMETRIC_STRONG only');
  assert.equal(L.authenticatorRow(24), 'API 24 (24–29): BIOMETRIC_STRONG only');
  assert.equal(L.authenticatorRow(23), null);
});

// ------------------------------------------------ R1-I1 / R2-I1 / R3: every landed signature is judged and accounted for

const lineOf = (r, id) => L.judgeM1c(r).lines.find(l => l.id === id);
/** CP2a's fresh unshield read out as a signature-less relay_failed (R3-N4 unproven) — the app kept it pending. */
const freshPendingWithoutSig = r => {
  const o = rowOf(r, x => x.event === 'unshield-outcome' && x.owner === FRESH);
  for (const k of ['changeLeafIndex', 'grantLamports', 'destinationWithoutSol']) {
    delete o[k];
  }
  Object.assign(o, { status: 'pending', signature: null, reason: 'relay_failed' });
};
/** …and the "Check again" after it settled that unshield: its reconcile line names the signature. */
const settledByCheckAgain = r => {
  rowOf(r, x => x.event === 'unshield-reconcile' && x.reverted === 1).settled = [{ signature: SIG_FRESH, verified: true, code: null, changeRecorded: true }];
};

test('R2-I1: a landing after a PENDING outcome is judged from the reconcile\'s settled[] — joined by the decoded (ATA, amount, fee); R3 counts its exit (m-10)', () => {
  const r = run();
  freshPendingWithoutSig(r);
  settledByCheckAgain(r);
  const v = lineOf(r, 'M1c.V');
  assert.equal(v.pass, true, v.detail);
  assert.ok(v.detail.includes(`${SIG_FRESH.slice(0, 10)}… fresh (settled by a reconcile): all 12 §6.8 checks pass`), v.detail);
  // the fresh exit is counted from the judged landing, though its outcome line was pending
  assert.equal(lineOf(r, 'M1c.R3').pass, true, lineOf(r, 'M1c.R3').detail);
  // the lines that need the phone's spent outcome itself (F1's grant as the phone saw it, F2's second) say so
  assert.deepEqual(failsWith(x => { freshPendingWithoutSig(x); settledByCheckAgain(x); }), ['M1c.F1', 'M1c.F2']);
});

test('R1-I1: a relayed withdraw to a submitted (ATA, amount, fee) that NO readout names → V FAILS — whatever the pending line\'s reason (carry 8)', () => {
  for (const reason of ['relay_failed', 'unknown', 'unconfirmed', 'not-in-sync']) {
    const r = run();
    freshPendingWithoutSig(r);
    rowOf(r, x => x.event === 'unshield-outcome' && x.owner === FRESH).reason = reason;
    const v = lineOf(r, 'M1c.V');
    assert.equal(v.pass, false, reason);
    assert.match(v.detail, new RegExp(`UNACCOUNTED landing ${SIG_FRESH}`), reason);
  }
  // control: the same run with the reconcile naming it passes V (above); and a sig-less pending line
  // whose (ATA, amount, fee) never landed accounts for nothing and fails nothing
  const r = run();
  freshPendingWithoutSig(r);
  delete r.chain.feePayerTxs[SIG_FRESH];
  assert.equal(lineOf(r, 'M1c.V').pass, true, lineOf(r, 'M1c.V').detail);
});

test('R3: a settled[] signature with NO submitting line before it to join → V FAILS', () => {
  const r = run();
  freshPendingWithoutSig(r); // so that only the reconcile names it
  // a reconcile naming SIG_FRESH BEFORE any line submitted (FRESH_ATA, 400000, 10000)
  const first = rowOf(r, x => x.event === 'unshield-reconcile' && x.stillPending.length === 1);
  first.settled = [{ signature: SIG_FRESH, verified: true, code: null, changeRecorded: true }];
  const v = lineOf(r, 'M1c.V');
  assert.equal(v.pass, false);
  assert.ok(v.detail.includes(`${SIG_FRESH.slice(0, 10)}… named by a reconcile: no unshield-submitting line before it`), v.detail);
  // a settled signature whose tx is not on devnet cannot be joined either
  const r2 = run();
  settledByCheckAgain(r2);
  rowOf(r2, x => x.event === 'unshield-reconcile' && x.reverted === 1).settled[0].signature = '4'.repeat(88);
  assert.equal(lineOf(r2, 'M1c.V').pass, false);
});

test('the app\'s verifier refused a settled landing (verified false) → V FAILS loudly', () => {
  const r = run();
  freshPendingWithoutSig(r);
  settledByCheckAgain(r);
  Object.assign(rowOf(r, x => x.event === 'unshield-reconcile' && x.reverted === 1).settled[0], { verified: false, code: 'E_A0_VERIFY_GRANT' });
  const j = L.judgeM1c(r);
  assert.equal(j.lines.find(l => l.id === 'M1c.V').pass, false);
  assert.match(j.info.join('\n'), /VERIFIER REFUSED 1 landed unshield/);
});

test('the fee payer\'s window: other programs\', other testers\' and earlier txs are skipped without throwing; an unread listing fails V', () => {
  // a landing before the window (the first submitting line − 2 min) is not this session's
  const r = run();
  freshPendingWithoutSig(r);
  const early = structuredClone(r.chain.feePayerTxs[SIG_FRESH]);
  early.blockTime = Math.floor(Date.parse(r.readouts.find(x => x.readout.event === 'unshield-submitting').readout.at) / 1000) - 121;
  r.chain.feePayerTxs[SIG_FRESH] = early;
  assert.equal(lineOf(r, 'M1c.V').pass, true, lineOf(r, 'M1c.V').detail);
  // …and one at exactly − 2 min is (control)
  early.blockTime += 1;
  assert.equal(lineOf(r, 'M1c.V').pass, false);
  // garbage, a failed tx, a tx of another program, another tester's withdraw: no throw, no FAIL
  // (fix round 1, I-2: a listed signature whose READ is null is no longer "skipped" — probe D's row)
  const r2 = run();
  const other = structuredClone(r2.chain.txs[SIG_EXT]);
  other.transaction[0] = other.transaction[0].slice(0, 40); // a truncated wire
  const failed = structuredClone(r2.chain.txs[SIG_FRESH]);
  failed.meta.err = { InstructionError: [3, { Custom: 6001 }] };
  Object.assign(r2.chain.feePayerTxs, { ['2'.repeat(88)]: other, ['3'.repeat(88)]: failed });
  rowOf(r2, x => x.event === 'unshield-submitting' && x.owner === FRESH).fee = '10000';
  assert.equal(lineOf(r2, 'M1c.V').pass, true, lineOf(r2, 'M1c.V').detail);
  // the listing not read at all: V cannot say nothing went unaccounted
  const r3 = run();
  delete r3.chain.feePayerTxs;
  assert.equal(lineOf(r3, 'M1c.V').pass, false);
  assert.match(lineOf(r3, 'M1c.V').detail, /the relayer fee payer's signatures were not read/);
});

test('a pending outcome naming a signature that never landed is listed, not judged and not a failure', () => {
  const r = run();
  const o = rowOf(r, x => x.event === 'unshield-outcome' && x.destination === 'external' && x.session === 's1');
  r.readouts.splice(r.readouts.findIndex(x => x.readout === o) + 1, 0, {
    seenAt: o.at,
    readout: { ...o, seq: o.seq + 100, status: 'pending', signature: '6'.repeat(88), reason: 'unconfirmed', changeLeafIndex: undefined, grantLamports: undefined, destinationWithoutSol: undefined },
  });
  const v = lineOf(r, 'M1c.V');
  assert.equal(v.pass, true, v.detail);
  assert.match(v.detail, /named, not on devnet: 666666/);
});

test('R2-N3: the seed set is the SESSION\'s startup-accounts line — missing, unreadable or another session\'s → no-seed-signer fails', () => {
  // the cli session's startup line gone: its unshield has no seed set (the primary's is NOT used)
  assert.deepEqual(failsWith(r => { r.readouts = r.readouts.filter(x => !(x.readout.event === 'startup-accounts' && x.readout.session === 's5')); }), ['M1c.V', 'M1c.C3']);
  assert.deepEqual(failsWith(r => { Object.assign(rowOf(r, x => x.event === 'startup-accounts' && x.session === 's5'), { seedKeys: null, seedKeysError: 'E_A0_ACCOUNTS_CORRUPT' }); }), ['M1c.V', 'M1c.C3']);
  // the line's own registry joins the set: a registry address that signed is a seed signer
  assert.deepEqual(failsWith(r => { rowOf(r, x => x.event === 'unshield-submitting' && x.walletKind === 'cli').registry.push({ address: FP, role: 'fresh-exit', linked: false }); }), ['M1c.V', 'M1c.C3']);
});

// ------------------------------------------------ fix round 1 (review I-1 / I-2): a pending outcome that NAMES its signature

/** CP2a's fresh unshield read out `pending / unconfirmed` WITH its signature (the ordinary not-in-sync / unconfirmed path). */
const freshPendingWithSig = r => {
  const o = rowOf(r, x => x.event === 'unshield-outcome' && x.owner === FRESH);
  for (const k of ['changeLeafIndex', 'grantLamports', 'destinationWithoutSol']) {
    delete o[k];
  }
  Object.assign(o, { status: 'pending', signature: SIG_FRESH, reason: 'unconfirmed' });
};

test('I-1 (probe A): pending WITH its signature, then the reconcile settles it verified:false → V FAILS and the banner names it', () => {
  const r = run();
  freshPendingWithSig(r);
  settledByCheckAgain(r);
  Object.assign(rowOf(r, x => x.event === 'unshield-reconcile' && x.reverted === 1).settled[0], { verified: false, code: 'E_A0_VERIFY_GRANT' });
  const j = L.judgeM1c(r);
  assert.equal(j.lines.find(l => l.id === 'M1c.V').pass, false);
  assert.match(j.info.join('\n'), new RegExp(`VERIFIER REFUSED 1 landed unshield\\(s\\): ${SIG_FRESH} E_A0_VERIFY_GRANT`));
  // control: settled verified:true → V passes, and the detail says the app settled it
  const r2 = run();
  freshPendingWithSig(r2);
  settledByCheckAgain(r2);
  const v2 = lineOf(r2, 'M1c.V');
  assert.equal(v2.pass, true, v2.detail);
  assert.ok(v2.detail.includes(`${SIG_FRESH.slice(0, 10)}… fresh (the app said pending; settled by a reconcile): all 12 §6.8 checks pass`), v2.detail);
  // and with no reconcile naming it yet: judged on the chain, said so
  const r3 = run();
  freshPendingWithSig(r3);
  assert.ok(lineOf(r3, 'M1c.V').detail.includes('(the app said pending; not yet settled by the app)'), lineOf(r3, 'M1c.V').detail);
});

test('I-2 (probe B): pending WITH its signature, the app settled it, the desk\'s read is null → V FAILS (a null read is not "never landed")', () => {
  const r = run();
  freshPendingWithSig(r);
  settledByCheckAgain(r);
  r.chain.txs[SIG_FRESH] = null;
  const v = lineOf(r, 'M1c.V');
  assert.equal(v.pass, false);
  assert.ok(v.detail.includes(`${SIG_FRESH.slice(0, 10)}… the app settled it, but devnet answered null`), v.detail);
});

test('I-2 (probe C): pending WITH its signature, the read is null, the fee payer listing holds it → V FAILS (not read — run verify again)', () => {
  const r = run();
  freshPendingWithSig(r);
  r.chain.txs[SIG_FRESH] = null;
  const v = lineOf(r, 'M1c.V');
  assert.equal(v.pass, false);
  assert.ok(v.detail.includes(`${SIG_FRESH.slice(0, 10)}… named by an unshield-outcome (pending) and listed by the relayer fee payer, but its read is null`), v.detail);
});

test('I-2 (probe D): a fee payer signature whose own read came back null → V FAILS (not read, never "not ours")', () => {
  const r = run();
  r.chain.feePayerTxs['7'.repeat(88)] = null;
  const v = lineOf(r, 'M1c.V');
  assert.equal(v.pass, false);
  assert.match(v.detail, /NOT READ 7777777777…: the relayer fee payer listed it, devnet answered null to its read — run `verify` again/);
});

test('I-2: "never landed" is positive evidence only — the listing was read and lacks it, or the tx failed on chain; otherwise V FAILS', () => {
  // the read is null AND the fee payer's listing (read) does not hold it → listed, not judged, no failure
  const r = run();
  freshPendingWithSig(r);
  r.chain.txs[SIG_FRESH] = null;
  delete r.chain.feePayerTxs[SIG_FRESH];
  const v = lineOf(r, 'M1c.V');
  assert.equal(v.pass, true, v.detail);
  assert.match(v.detail, /named, not on devnet: 5F8Ks5…/);
  // the tx is on chain but FAILED (err): not a landing either
  const r2 = run();
  freshPendingWithSig(r2);
  const failed = structuredClone(r2.chain.txs[SIG_FRESH]);
  failed.meta.err = { InstructionError: [3, { Custom: 6001 }] };
  r2.chain.txs[SIG_FRESH] = failed;
  delete r2.chain.feePayerTxs[SIG_FRESH];
  assert.equal(lineOf(r2, 'M1c.V').pass, true, lineOf(r2, 'M1c.V').detail);
  // …but the listing NOT read: a null read proves nothing → FAIL
  const r3 = run();
  freshPendingWithSig(r3);
  r3.chain.txs[SIG_FRESH] = null;
  delete r3.chain.feePayerTxs;
  assert.equal(lineOf(r3, 'M1c.V').pass, false);
});

// ------------------------------------------------ fix round 2 (re-review R-1 / R-2 / R-3)

const failedCopy = t => {
  const f = structuredClone(t);
  f.meta.err = { InstructionError: [3, { Custom: 6001 }] };
  return f;
};

test('R-1 (probe E): pending WITH its signature, the chain says FAILED, the app later settled it → V FAILS', () => {
  const r = run();
  freshPendingWithSig(r);
  settledByCheckAgain(r);
  r.chain.txs[SIG_FRESH] = failedCopy(r.chain.txs[SIG_FRESH]);
  delete r.chain.feePayerTxs[SIG_FRESH];
  const v = lineOf(r, 'M1c.V');
  assert.equal(v.pass, false);
  assert.ok(v.detail.includes(`${SIG_FRESH.slice(0, 10)}… the app settled it, but the chain says its tx FAILED`), v.detail);
});

test('R-1 (probe E2): the same with the app\'s settled verdict verified:false → V FAILS and the banner names it', () => {
  const r = run();
  freshPendingWithSig(r);
  settledByCheckAgain(r);
  Object.assign(rowOf(r, x => x.event === 'unshield-reconcile' && x.reverted === 1).settled[0], { verified: false, code: 'E_A0_VERIFY_GRANT' });
  r.chain.txs[SIG_FRESH] = failedCopy(r.chain.txs[SIG_FRESH]);
  delete r.chain.feePayerTxs[SIG_FRESH];
  const j = L.judgeM1c(r);
  assert.equal(j.lines.find(l => l.id === 'M1c.V').pass, false);
  assert.match(j.info.join('\n'), new RegExp(`VERIFIER REFUSED 1 landed unshield\\(s\\): ${SIG_FRESH} E_A0_VERIFY_GRANT`));
});

test('R-2 (probe F): a read with meta null is "not read", never "failed on chain" — with the listing holding it → V FAILS', () => {
  const r = run();
  freshPendingWithSig(r);
  r.chain.txs[SIG_FRESH] = { ...r.chain.txs[SIG_FRESH], meta: null };
  const v = lineOf(r, 'M1c.V');
  assert.equal(v.pass, false);
  assert.ok(v.detail.includes(`${SIG_FRESH.slice(0, 10)}… its status was not read (no meta)`), v.detail);
  // and without the listing holding it: still not evidence of anything → FAIL
  delete r.chain.feePayerTxs[SIG_FRESH];
  assert.equal(lineOf(r, 'M1c.V').pass, false);
  // the decoder: meta null is neither ok nor failed
  const d = C.decodeAnyTx({ ...recordedTx('5F8Ks5qa'), meta: null });
  assert.deepEqual([d.ok, d.failed], [false, false]);
  assert.deepEqual([C.decodeAnyTx(recordedTx('5F8Ks5qa')).ok, C.decodeAnyTx(failedCopy(recordedTx('5F8Ks5qa'))).failed], [true, true]); // controls
});

test('R-2 (probe F2): a FAILED read whose signature the fee payer listing holds (the listing has only err-free entries) → contradiction, V FAILS', () => {
  const r = run();
  freshPendingWithSig(r);
  r.chain.txs[SIG_FRESH] = failedCopy(r.chain.txs[SIG_FRESH]);
  const v = lineOf(r, 'M1c.V');
  assert.equal(v.pass, false);
  assert.ok(v.detail.includes(`${SIG_FRESH.slice(0, 10)}… the chain says its tx FAILED, but the relayer fee payer listed it as landed`), v.detail);
});

test('R-3 (probes G, K): an empty or array listing is no evidence of absence — a listing missing a landing judged in the same run is incomplete → V FAILS', () => {
  for (const listing of [{}, []]) {
    const r = run();
    freshPendingWithSig(r);
    r.chain.txs[SIG_FRESH] = null;
    r.chain.feePayerTxs = listing;
    const v = lineOf(r, 'M1c.V');
    assert.equal(v.pass, false, JSON.stringify(listing));
    // the pending signature itself is never "never landed" on such a listing
    const why = Array.isArray(listing)
      ? 'named by an unshield-outcome (pending), its read is null and the fee payer listing was not read'
      : 'named by an unshield-outcome (pending), its read is null, and the fee payer listing is incomplete';
    assert.ok(v.detail.includes(`${SIG_FRESH.slice(0, 10)}… ${why}`), v.detail);
    assert.doesNotMatch(v.detail, /named, not on devnet/);
  }
  // the completeness control on its own: a full run whose listing lacks one judged landing
  const r = run();
  delete r.chain.feePayerTxs[SIG_EXT];
  const v = lineOf(r, 'M1c.V');
  assert.equal(v.pass, false);
  assert.match(v.detail, new RegExp(`the relayer fee payer listing is INCOMPLETE: it lacks ${SIG_EXT.slice(0, 10)}…`));
  // an array listing is refused as unread
  const r2 = run();
  r2.chain.feePayerTxs = Object.values(r2.chain.feePayerTxs);
  assert.match(lineOf(r2, 'M1c.V').detail, /the relayer fee payer's signatures were not read/);
});

/** Every judged landing's blockTime moved to `seconds` before the fee payer window's start (the phone's clock ahead of devnet). */
const skewed = (r, seconds) => {
  const start = L.feePayerWindowStart(r.readouts);
  for (const m of [r.chain.txs, r.chain.feePayerTxs]) {
    for (const sig of Object.keys(m)) {
      m[sig] = { ...structuredClone(m[sig]), blockTime: start - seconds };
    }
  }
};

test('final review M-1 (probe P2), half 1: a listing that holds NO landing of this run proves no absence — a null-read pending signature stays unjoined', () => {
  const r = run();
  skewed(r, 10);
  r.chain.feePayerTxs = {};
  const LOST = '6'.repeat(88);
  const o = rowOf(r, x => x.event === 'unshield-outcome' && x.owner === FRESH);
  r.readouts.push({ seenAt: o.at, readout: { ...o, seq: 99, status: 'pending', signature: LOST, reason: 'unconfirmed' } });
  const { unjoined, notLanded } = L.landingsOf(r.readouts, { ...r.chain.txs, [LOST]: null }, r.chain.feePayerTxs);
  assert.deepEqual(notLanded, []);
  assert.ok(unjoined.some(u => u.signature === LOST && /the fee payer listing is incomplete/.test(u.why)), JSON.stringify(unjoined));
  const v = lineOf({ ...r, chain: { ...r.chain, txs: { ...r.chain.txs, [LOST]: null } } }, 'M1c.V');
  assert.equal(v.pass, false);
  assert.doesNotMatch(v.detail, /named, not on devnet/);
});

test('final review M-1, half 2: a judged landing whose blockTime is BEFORE the fee payer window → V FAILS with the clock-skew text (the UNACCOUNTED check is blind there)', () => {
  const r = run();
  skewed(r, 10);
  const v = lineOf(r, 'M1c.V');
  assert.equal(v.pass, false, v.detail);
  assert.match(v.detail, /the phone's clock is ahead of devnet by more than the 2-minute margin — the fee payer window does not cover this run/);
  // control: at the window's start exactly, the run passes as before
  const r2 = run();
  skewed(r2, 0);
  assert.equal(lineOf(r2, 'M1c.V').pass, true, lineOf(r2, 'M1c.V').detail);
});

test('R-2: a LISTED fee payer signature whose read has meta null is not read → V FAILS (never skipped as failed)', () => {
  const r = run();
  r.chain.feePayerTxs['8'.repeat(88)] = { ...r.chain.txs[SIG_FRESH], meta: null };
  const v = lineOf(r, 'M1c.V');
  assert.equal(v.pass, false);
  assert.match(v.detail, /NOT READ 8888888888…/);
});

test('a read that does not decode is "read, not decodable" → V FAILS (minor H)', () => {
  const r = run();
  freshPendingWithSig(r);
  const t = structuredClone(r.chain.txs[SIG_FRESH]);
  t.transaction[0] = t.transaction[0].slice(0, 40);
  r.chain.txs[SIG_FRESH] = t;
  delete r.chain.feePayerTxs[SIG_FRESH];
  const v = lineOf(r, 'M1c.V');
  assert.equal(v.pass, false);
  assert.ok(v.detail.includes(`${SIG_FRESH.slice(0, 10)}… read, but not decodable`), v.detail);
});

test('no false FAIL on the scripted run: the held/killed CP2 unshield (no outcome) and an R3-N4 sig-less pending stay out of the rule', () => {
  const r = run(); // the run already carries the held, killed unshield with no outcome line
  freshPendingWithoutSig(r);
  settledByCheckAgain(r);
  assert.equal(lineOf(r, 'M1c.V').pass, true, lineOf(r, 'M1c.V').detail);
  assert.equal(lineOf(run(), 'M1c.V').pass, true);
});

test('a fee payer tx with an unknown blockTime counts as inside the window (minor)', () => {
  const r = run();
  freshPendingWithoutSig(r);
  const t = structuredClone(r.chain.feePayerTxs[SIG_FRESH]);
  t.blockTime = null;
  r.chain.feePayerTxs[SIG_FRESH] = t;
  assert.match(lineOf(r, 'M1c.V').detail, new RegExp(`UNACCOUNTED landing ${SIG_FRESH}`));
});

test('no recorded run fails every judged line (no vacuous PASS)', () => {
  const v = verdictOf({ readouts: [], chain: { txs: {}, histories: {} }, facts: null, wipe: null, kill: null, launches: [], apkLines: [], commit: null, phone: null });
  assert.deepEqual(Object.entries(v).filter(([, p]) => p), []);
});

test('the desk\'s pinned relayer fee payer is the chain module\'s (one value, two copies)', () => {
  assert.equal(L.RELAYER_FEE_PAYER, C.RELAYER_FEE_PAYER);
});
