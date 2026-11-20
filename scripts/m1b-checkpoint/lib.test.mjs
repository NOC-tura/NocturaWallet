/**
 * The M1b desk logic (lib.mjs) over recorded data only — no network, no device.
 *   - the readout parser against the HAND-WRITTEN sample (the app's Jest suite holds its own
 *     lines to the same file: checkpointReadout.test.ts);
 *   - the tx decoder against the recorded devnet tree (src/modules/shielded/a0/__tests__/fixtures/
 *     devnet-tree-5URd.json, Task 2: 15 txs, 17 leaves) and the program side's landed public
 *     inputs of 3DR6F7oW… (devnet-a0-deployed-contract.json `landed.deposit`, their 19e3891);
 *   - the BuildConfig reader against dexdump output of the built APKs (HELIUS key redacted);
 *   - the judge: every line PASSES on a consistent scenario built from the recorded chain, and
 *     each line FAILS on its own negative control.
 * Run: `node --test scripts/m1b-checkpoint/*.test.mjs`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import * as L from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const SAMPLE = readFileSync(join(HERE, 'fixtures/readout-sample.txt'), 'utf8');
const TREE = JSON.parse(readFileSync(join(ROOT, 'src/modules/shielded/a0/__tests__/fixtures/devnet-tree-5URd.json'), 'utf8'));
const dex = name => readFileSync(join(HERE, `fixtures/buildconfig-${name}.dexdump.txt`), 'utf8');

const S1 = '3DR6F7oWXS4D5RSsDJAQMbYtQM4EW5Kp2qkJRVSHH72x2GPB4N4G93JkNK9uGGK9CpFeGuy7vtBVeaDHiVQ7b8sm';
const S2 = 'a7wDRKqvnNSkBAGs56ssKby9pqXQtc3eAv6W5sF1HAMWNiGYEkkjUPkeNJ4Ji3E2AjUfseiR3U65Fcr8kQvm5tY';
const GOBAM = 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd';
// The program side's landed.deposit public inputs [commitment, amount, mintHash, rho] (decimal).
const LANDED = {
  commitment: 1832099858828464171255386012686455982544889024198594493159238616499632609709n,
  amount: 1000000n,
  rho: 2682398932710728289451863586583737043718296808864885766580558010318135811237n,
};
const be = v => v.toString(16).padStart(64, '0');
const clone = o => JSON.parse(JSON.stringify(o));

describe('the readout parser (the hand-written sample)', () => {
  test('5 readouts in order, chunks re-joined; the sample\'s values', () => {
    const { readouts, incomplete, invalid } = L.readoutsFromLog(SAMPLE);
    assert.deepEqual(incomplete, []);
    assert.deepEqual(invalid, []);
    assert.deepEqual(readouts.map(r => `${r.seq} ${r.event}`), ['1 deposit-submitted', '2 deposit-outcome', '3 startup', '4 startup', '5 deposit-outcome']);
    assert.equal(readouts[0].commitment, be(LANDED.commitment));
    assert.equal(readouts[1].leafIndex, 0);
    assert.equal(readouts[2].restore.treeTransactions, 16);
    assert.equal(readouts[2].notes.unspentBalance, '1500000');
    assert.equal(readouts[3].code, 'E_A0_STORE_LOCKED');
    // R1-m4 / R2-N4 and the reconcile's skipped count (Task 7 carry-over b)
    assert.equal(readouts[2].restore.highestHit, 0);
    assert.equal(readouts[2].reconcile.skipped, 0);
  });
  test('a ready startup without the restore\'s highestHit or the reconcile\'s skipped is not the app\'s schema (invalid); highestHit null is', () => {
    const [ready] = L.readoutsFromLog(SAMPLE).readouts.filter(r => r.seq === 3);
    const id = 'kz3d9q2a-3';
    assert.equal(L.readoutRefusal(ready, id), null); // positive control
    const noHit = clone(ready);
    delete noHit.restore.highestHit;
    assert.equal(L.readoutRefusal(noHit, id), 'startup: restore without highestHit');
    assert.equal(L.readoutRefusal({ ...clone(ready), restore: { ...ready.restore, highestHit: '0' } }, id), 'startup: restore without highestHit');
    assert.equal(L.readoutRefusal({ ...clone(ready), restore: { ...ready.restore, highestHit: null } }, id), null);
    assert.equal(L.readoutRefusal({ ...clone(ready), restore: null }, id), null); // no restore ran: nothing to carry
    const noSkipped = clone(ready);
    delete noSkipped.reconcile.skipped;
    assert.equal(L.readoutRefusal(noSkipped, id), 'startup: reconcile without skipped');
  });
  test('logcat prefixes are ignored; the same buffer dumped twice counts once', () => {
    const prefixed = SAMPLE.split('\n').filter(Boolean).map(l => `11-15 20:00:01.123  4242  4300 I ReactNativeJS: ${l}`).join('\n');
    assert.equal(L.readoutsFromLog(`${prefixed}\n${prefixed}\n`).readouts.length, 5);
  });
  test('a missing chunk → incomplete (never parsed from a part)', () => {
    const lines = SAMPLE.split('\n').filter(l => !l.includes(' kz3d9q2a-3 2/6 '));
    const r = L.readoutsFromLog(lines.join('\n'));
    assert.deepEqual(r.incomplete, ['kz3d9q2a-3']);
    assert.equal(r.readouts.length, 4);
  });
  test('one chunk seen with two different texts → invalid (never guessed)', () => {
    const forged = SAMPLE.replace('"amount":"1000000","commitment":', '"amount":"9000000","commitment":');
    const both = `${SAMPLE}\n${forged.split('\n').filter(l => l.includes(' kz3d9q2a-1 2/2 ')).join('\n')}\n`;
    assert.deepEqual(L.readoutsFromLog(both).invalid.map(v => v.id), ['kz3d9q2a-1']);
  });
  test('a payload whose id is not its session-seq, or of another schema, is invalid', () => {
    const wrongId = SAMPLE.replace(/kz3d9q2a-4 1\/1/, 'kz3d9q2a-9 1/1');
    assert.deepEqual(L.readoutsFromLog(wrongId).invalid.map(v => v.id), ['kz3d9q2a-9']);
    const wrongSchema = SAMPLE.replace(/("seq":4,"at":"[^"]+","phase":"error")/, '$1').replace('noctura.a0.readout/1","event":"startup","session":"kz3d9q2a","seq":4', 'noctura.other/1","event":"startup","session":"kz3d9q2a","seq":4');
    assert.deepEqual(L.readoutsFromLog(wrongSchema).invalid.map(v => v.id), ['kz3d9q2a-4']);
  });
});

describe('the devnet tx decoder (the recorded tree; values from the program side)', () => {
  test('3DR6F7oW…: one deposit by GoBAm…, its amount / commitment / rho = the program side\'s landed public inputs, and its LeafInserted', () => {
    const d = L.decodeDevnetTx(TREE.transactions[S1]);
    assert.equal(d.ok, true);
    assert.deepEqual(d.signers, [GOBAM]);
    assert.equal(d.feePayer, GOBAM);
    assert.equal(d.deposits.length, 1);
    const [x] = d.deposits;
    assert.equal(x.amount, LANDED.amount);
    assert.equal(x.commitment, be(LANDED.commitment));
    assert.equal(x.rho, be(LANDED.rho));
    assert.equal(x.depositor, GOBAM);
    assert.equal(x.pool, L.DEVNET.pool);
    assert.equal(x.merkle_tree, L.DEVNET.merkleTree);
    assert.equal(d.leafInserted.length, 1);
    assert.equal(d.leafInserted[0].commitment, be(LANDED.commitment));
  });
  test('the whole recorded history: the LeafInserted indices are exactly 0..16 (17 leaves, Task 2), each once', () => {
    const idx = Object.values(TREE.transactions).flatMap(t => L.decodeDevnetTx(t).leafInserted.map(l => l.leafIndex));
    assert.deepEqual(idx.sort((a, b) => a - b), [...Array(17).keys()]);
    assert.equal(L.decodeDevnetTx(TREE.transactions[S1]).leafInserted[0].leafIndex, 0);
  });
  test('negative control: the same event in an INNER frame (depth 2) is not admitted', () => {
    const tx = clone(TREE.transactions[S1]);
    const logs = tx.meta.logMessages;
    const i = logs.findIndex(l => l.startsWith('Program data: WfPUCNe'));
    const ev = logs.splice(i, 1)[0];
    const inner = logs.findIndex(l => / invoke \[2\]$/.test(l));
    logs.splice(inner + 1, 0, ev);
    assert.equal(L.decodeDevnetTx(tx).leafInserted.length, 0);
  });
  test('a failed tx is not ok; a deposit with short data is malformed, never decoded', () => {
    const failed = clone(TREE.transactions[S1]);
    failed.meta.err = { InstructionError: [1, { Custom: 1 }] };
    assert.equal(L.decodeDevnetTx(failed).ok, false);
    const short = clone(TREE.transactions[S1]);
    const ix = short.transaction.message.instructions.find(x => short.transaction.message.accountKeys[x.programIdIndex] === L.DEVNET.programId);
    ix.data = '233ayazh94ugEFZL'; // base58 of f223c68952e1f2b6 010203 (the discriminator + 3 bytes)
    assert.deepEqual(L.decodeDevnetTx(short).deposits, [{ malformed: true }]);
  });
  test('the signature list counts (the recorded walk: 15, all successful)', () => {
    assert.deepEqual(L.treeSignatureCounts([TREE.signatures]), { listed: 15, successful: 15, failed: 0, successfulUpTo: 15 });
    assert.equal(L.treeSignatureCounts([TREE.signatures], 1794154066).successfulUpTo, 2); // init + 3DR6F7oW…
  });
});

describe('the APKs\' BuildConfig (dexdump of the built APKs)', () => {
  const devnet = L.buildConfigFromDexdump(dex('devnet'));
  const production = L.buildConfigFromDexdump(dex('production'));
  test('read: the devnet and the production fields; never the RPC URLs', () => {
    assert.deepEqual(devnet, { APPLICATION_ID: 'com.nocturawallet.devnet', BUILD_TYPE: 'release', DEBUG: 'false', FEATURES_SHIELDED: 'true', LOCAL_PROVING: 'true', NETWORK: 'devnet' });
    assert.deepEqual(production, { APPLICATION_ID: 'com.nocturawallet', BUILD_TYPE: 'release', DEBUG: 'false', NETWORK: 'mainnet-beta' });
    assert.match(dex('production'), /'HELIUS_RPC_URL'/); // it is in the dump, the reader leaves it out
    assert.ok(!JSON.stringify({ devnet, production }).includes('helius'));
  });
  test('a dump without the app\'s BuildConfig → null', () => {
    assert.equal(L.buildConfigFromDexdump("Class descriptor  : 'Lcom/oblador/keychain/BuildConfig;'"), null);
  });
  test('judged: both pass; negative control — the devnet APK handed as production fails A2, and the reverse fails A1', () => {
    assert.deepEqual(L.judgeApkConfig({ devnet, production }).map(l => l.pass), [true, true]);
    assert.equal(L.judgeApkConfig({ devnet, production: devnet })[1].pass, false);
    assert.equal(L.judgeApkConfig({ devnet: production, production })[0].pass, false);
  });
  test('negative controls of A2 field by field: a production APK with FEATURES_SHIELDED=true, or on devnet, fails', () => {
    assert.equal(L.judgeApkConfig({ devnet, production: { ...production, FEATURES_SHIELDED: 'true' } })[1].pass, false);
    assert.equal(L.judgeApkConfig({ devnet, production: { ...production, NETWORK: 'devnet' } })[1].pass, false);
    assert.equal(L.judgeApkConfig({ devnet: { ...devnet, NETWORK: 'mainnet-beta' }, production })[0].pass, false);
    assert.equal(L.judgeApkConfig({ devnet: { ...devnet, FEATURES_SHIELDED: undefined }, production })[0].pass, false);
  });
});

// ------------------------------------------------------------------------------ the judge

const at = s => `2026-11-15T20:${s}.000Z`;
const leafOf = (sig, c) => L.decodeDevnetTx(TREE.transactions[sig]).leafInserted.find(l => l.commitment === c);
const dep1 = L.decodeDevnetTx(TREE.transactions[S1]).deposits[0];
const dep2 = L.decodeDevnetTx(TREE.transactions[S2]).deposits[0];
const l1 = leafOf(S1, dep1.commitment);
const l2 = leafOf(S2, dep2.commitment);
const head = (event, session, seq) => ({ schema: L.READOUT_SCHEMA, event, session, seq, at: '2026-11-15T19:00:00.000Z' });

/** A consistent run built from the recorded chain: deposit S1, the kill around S2, the wipe, prod. */
function scenario() {
  const readouts = [
    { seenAt: at('01:00'), readout: { ...head('startup', 'aaa', 1), phase: 'ready', restoredBecause: 'no-record', restore: { treeTransactions: 15, durationMs: 4000, syncDurationMs: 3000, depositIndicesTried: 100, ownNotes: 0, highestHit: null, finishedAt: at('00:59'), r13TriggerReached: false }, reconcile: { confirmed: [], dropped: [], stillPending: [], skipped: 0 }, notes: { pending: 0, unspent: 0, spent: 0, unspentBalance: '0', unspentNotes: [] } } },
    { seenAt: at('02:00'), readout: { ...head('deposit-submitted', 'aaa', 2), signature: S1, depositor: GOBAM, amount: dep1.amount.toString(), commitment: dep1.commitment } },
    { seenAt: at('02:10'), readout: { ...head('deposit-outcome', 'aaa', 3), signature: S1, status: 'unspent', depositor: GOBAM, amount: dep1.amount.toString(), commitment: dep1.commitment, leafIndex: l1.leafIndex, root: l1.root } },
    { seenAt: at('03:00'), readout: { ...head('deposit-submitted', 'aaa', 4), signature: S2, depositor: GOBAM, amount: dep2.amount.toString(), commitment: dep2.commitment } },
    { seenAt: at('04:00'), readout: { ...head('startup', 'bbb', 1), phase: 'ready', restoredBecause: null, restore: null, reconcile: { confirmed: [{ leafIndex: l2.leafIndex, signature: S2 }], dropped: [], stillPending: [], skipped: 0 }, notes: { pending: 0, unspent: 2, spent: 0, unspentBalance: (dep1.amount + dep2.amount).toString(), unspentNotes: [{ leafIndex: l1.leafIndex, commitment: dep1.commitment, amount: dep1.amount.toString() }, { leafIndex: l2.leafIndex, commitment: dep2.commitment, amount: dep2.amount.toString() }] } } },
    { seenAt: at('06:00'), readout: { ...head('startup', 'ccc', 1), phase: 'ready', restoredBecause: 'no-record', restore: { treeTransactions: 15, durationMs: 5200, syncDurationMs: 4100, depositIndicesTried: 102, ownNotes: 2, highestHit: 1, finishedAt: at('05:58'), r13TriggerReached: false }, reconcile: { confirmed: [], dropped: [], stillPending: [], skipped: 0 }, notes: { pending: 0, unspent: 2, spent: 0, unspentBalance: (dep1.amount + dep2.amount).toString(), unspentNotes: [{ leafIndex: l1.leafIndex, commitment: dep1.commitment, amount: dep1.amount.toString() }, { leafIndex: l2.leafIndex, commitment: dep2.commitment, amount: dep2.amount.toString() }] } } },
  ];
  return {
    readouts,
    kill: { at: at('03:01'), signature: S2, session: 'aaa' },
    wipe: { at: at('05:00'), pkg: L.DEVNET_PACKAGE, answer: 'Success' },
    main: GOBAM,
    chain: { txs: { [S1]: TREE.transactions[S1], [S2]: TREE.transactions[S2] }, tree: { pages: [TREE.signatures], readAt: at('07:00') } },
    launches: ['M1b.8', 'M1b.9', 'M1b.10'].map(id => ({ id, text: id, pass: true, detail: 'ok' })),
    apkLines: L.judgeApkConfig({ devnet: L.buildConfigFromDexdump(dex('devnet')), production: L.buildConfigFromDexdump(dex('production')) }),
    i3: { ran: true, passed: 5, failed: 0, pending: 0, file: '/x/src/modules/shielded/a0/__tests__/restoreRequests.test.ts', commit: 'c0ffee' },
    commit: { head: 'c0ffee', apks: 'c0ffee' },
  };
}
// The recorded blockTimes are 2026-11-08/09; the scenario's finishedAt is later — every recorded tx counts.
const IDS = ['M1b.1', 'M1b.2', 'M1b.6', 'M1b.3', 'M1b.4', 'M1b.5', 'M1b.7', 'M1b.A1', 'M1b.A2', 'M1b.A3', 'M1b.8', 'M1b.9', 'M1b.10'];
const lineOf = (s, id) => L.judge(s).lines.find(l => l.id === id);

describe('the judge — every line, and a negative control for each', () => {
  test('a consistent run: every line PASSES, no info line', () => {
    const { lines, info } = L.judge(scenario());
    assert.deepEqual(lines.map(l => l.id).sort(), [...IDS].sort());
    for (const l of lines) {
      assert.equal(l.pass, true, `${l.id}: ${l.detail}`);
    }
    assert.deepEqual(info, []);
  });
  const controls = [
    ['M1b.1', 'the readout\'s depositor is not the main account', s => (s.main = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk')],
    ['M1b.1', 'the readout\'s amount is not the chain\'s', s => (s.readouts[2].readout.amount = '999')],
    ['M1b.1', 'the tx needs a second signer', s => {
      const t = clone(TREE.transactions[S1]);
      t.transaction.message.header.numRequiredSignatures = 2;
      s.chain.txs[S1] = t;
    }],
    ['M1b.1', 'the deposit is not on devnet', s => (s.chain.txs[S1] = null)],
    ['M1b.1', 'the deposit failed on chain', s => (s.chain.txs[S1] = { ...clone(TREE.transactions[S1]), meta: { ...clone(TREE.transactions[S1]).meta, err: { Custom: 1 } } })],
    ['M1b.2', 'the phone\'s leaf index is not the LeafInserted\'s', s => (s.readouts[2].readout.leafIndex += 1)],
    ['M1b.2', 'the phone\'s root is not the LeafInserted\'s', s => (s.readouts[2].readout.root = '0'.repeat(64))],
    ['M1b.6', 'no kill recorded', s => (s.kill = null)],
    ['M1b.6', 'the killed session read out an outcome (the kill came too late)', s => s.readouts.splice(4, 0, { seenAt: at('03:30'), readout: { ...head('deposit-outcome', 'aaa', 9), signature: S2, status: 'unspent', depositor: GOBAM, amount: '1', commitment: dep2.commitment, leafIndex: l2.leafIndex, root: l2.root } })],
    ['M1b.6', 'the next start did not confirm the killed signature', s => (s.readouts[4].readout.reconcile.confirmed = [])],
    ['M1b.6', 'the next start confirmed it at another leaf', s => (s.readouts[4].readout.reconcile.confirmed[0].leafIndex += 1)],
    ['M1b.6', 'still pending after the next start', s => (s.readouts[4].readout.notes.pending = 1)],
    ['M1b.3', 'the wipe cleared another package', s => (s.wipe.pkg = L.PRODUCTION_PACKAGE)],
    ['M1b.3', 'the next start after the wipe did not restore (a record was found)', s => (s.readouts[5].readout.restoredBecause = null)],
    ['M1b.3', 'no wipe recorded', s => (s.wipe = null)],
    ['M1b.4', 'the killed (landed) deposit did not come back', s => s.readouts[5].readout.notes.unspentNotes.pop()],
    ['M1b.4', 'a note came back at another leaf', s => (s.readouts[5].readout.notes.unspentNotes[0].leafIndex = 99)],
    ['M1b.4', 'the balance is not the sum of the notes', s => (s.readouts[5].readout.notes.unspentBalance = '1')],
    ['M1b.5', 'the phone counts more tree txs than the chain lists', s => (s.readouts[5].readout.restore.treeTransactions = 16)],
    ['M1b.5', 'the phone counts fewer than the chain listed a minute before its run', s => (s.readouts[5].readout.restore.treeTransactions = 14)],
    ['M1b.5', 'the phone\'s trigger flag disagrees with its numbers', s => (s.readouts[5].readout.restore.r13TriggerReached = true)],
    ['M1b.7', 'the I-3 test failed', s => (s.i3.failed = 1)],
    ['M1b.7', 'the I-3 test ran at another commit', s => (s.i3.commit = 'deadbeef')],
    ['M1b.7', 'the I-3 test did not run', s => (s.i3 = null)],
    ['M1b.A3', 'the APKs are of another commit', s => (s.commit.apks = 'deadbeef')],
    ['M1b.A3', 'the tree is dirty (APKs and HEAD both "(dirty)")', s => (s.commit = { head: 'c0ffee (dirty)', apks: 'c0ffee (dirty)' })],
    ['M1b.7', 'the I-3 test ran on a dirty tree', s => Object.assign(s, { commit: { head: 'c0ffee (dirty)', apks: 'c0ffee' }, i3: { ...s.i3, commit: 'c0ffee (dirty)' } })],
    ['M1b.9', 'the production launch did not run', s => (s.launches = s.launches.filter(l => l.id !== 'M1b.9'))],
    ['M1b.10', 'the production check after the unlock failed', s => (s.launches.find(l => l.id === 'M1b.10').pass = false)],
  ];
  for (const [id, what, edit] of controls) {
    test(`${id} FAILS when ${what} (the other lines unaffected where independent)`, () => {
      const s = scenario();
      edit(s);
      assert.equal(lineOf(s, id).pass, false, lineOf(s, id).detail);
    });
  }
  test('the kill: a deposit that did NOT land, dropped as expired at the next start → PASS (nothing left the account)', () => {
    const s = scenario();
    s.chain.txs[S2] = null;
    s.readouts[4].readout.reconcile = { confirmed: [], dropped: [{ reason: 'expired' }], stillPending: [] };
    s.readouts[4].readout.notes = { pending: 0, unspent: 1, spent: 0, unspentBalance: dep1.amount.toString(), unspentNotes: [s.readouts[4].readout.notes.unspentNotes[0]] };
    s.readouts[5].readout.notes = clone(s.readouts[4].readout.notes);
    s.readouts[5].readout.restore.ownNotes = 1;
    assert.equal(lineOf(s, 'M1b.6').pass, true, lineOf(s, 'M1b.6').detail);
    assert.equal(lineOf(s, 'M1b.4').pass, true, lineOf(s, 'M1b.4').detail);
    s.readouts[4].readout.reconcile = { confirmed: [], dropped: [], stillPending: [{ reason: 'not-expired' }] };
    assert.equal(lineOf(s, 'M1b.6').pass, false);
    assert.match(lineOf(s, 'M1b.6').detail, /wait ~4 min \(the blockhash expiry \+ the 300-block margin\)/);
  });
  test('verify\'s record carries the restore\'s highest counter hit (R1-m4 / R2-N4) and the next start\'s skipped count', () => {
    const s = scenario();
    assert.match(lineOf(s, 'M1b.5').detail, /102 counters tried, highest counter hit 1 \(gap limit 100\)/);
    s.readouts[5].readout.restore.highestHit = null;
    assert.match(lineOf(s, 'M1b.5').detail, /highest counter hit none/);
    assert.match(lineOf(s, 'M1b.6').detail, /skipped 0$/);
  });
  test('R13 over the trigger: the line still PASSES (a measurement) and the loud info line names the pre-mainnet item', () => {
    const s = scenario();
    Object.assign(s.readouts[5].readout.restore, { durationMs: 61000, r13TriggerReached: true });
    assert.equal(lineOf(s, 'M1b.5').pass, true);
    assert.match(L.judge(s).info.join('\n'), /R13 TRIGGER REACHED .* PRE-MAINNET/);
  });
});

describe('the I-3 run\'s evidence (verify → M1b.7; review I-2)', () => {
  const FILE = '/x/src/modules/shielded/a0/__tests__/restoreRequests.test.ts';
  const jestJson = (over = {}) => ({ numPassedTests: 6, numFailedTests: 0, numPendingTests: 0, startTime: 1000, testResults: [{ name: FILE }], ...over });
  const run = (over = {}) => ({
    spawn: { status: 0, error: undefined },
    json: jestJson(),
    startedAt: 900,
    head: { before: 'c0ffee', after: 'c0ffee' },
    dirty: '',
    ...over,
  });
  const m1b7 = i3 => {
    const s = scenario();
    s.i3 = i3;
    return lineOf(s, 'M1b.7');
  };
  test('positive control: a run started now, exit 0, its own file, HEAD unchanged and clean → ran, M1b.7 PASS', () => {
    const i3 = L.readI3(run());
    assert.deepEqual(i3, { ran: true, passed: 6, failed: 0, pending: 0, file: FILE, commit: 'c0ffee', why: null });
    assert.equal(m1b7(i3).pass, true);
  });
  for (const [why, over] of [
    ['the jest process did not start (spawn error)', { spawn: { status: null, error: new Error('spawn npx ENOENT') } }],
    ['the jest process was killed (no exit status)', { spawn: { status: null, error: undefined } }],
    ['jest exited non-zero', { spawn: { status: 1, error: undefined } }],
    ['no result file was written', { json: null }],
    ['the result file is older than this run (a stale i3-jest.json)', { json: jestJson({ startTime: 899 }) }],
    ['HEAD moved during the run', { head: { before: 'c0ffee', after: 'beef00' } }],
    ['the tree is dirty', { dirty: ' M src/x.ts' }],
  ]) {
    test(`not evidence → M1b.7 FAILS: ${why}`, () => {
      const i3 = L.readI3(run(over));
      assert.equal(i3.ran, false, JSON.stringify(i3));
      assert.ok(i3.why);
      const l = m1b7(i3);
      assert.equal(l.pass, false);
      assert.match(l.detail, /not run/);
    });
  }
  test('each refusal names its own reason (a spawn error is "did not start", never folded into another)', () => {
    assert.match(L.readI3(run({ spawn: { status: null, error: new Error('spawn npx ENOENT') } })).why, /^jest did not start: spawn npx ENOENT$/);
    assert.match(L.readI3(run({ spawn: { status: null, error: undefined } })).why, /no exit status/);
    assert.match(L.readI3(run({ json: jestJson({ startTime: 899 }) })).why, /not this run's/);
  });
});

