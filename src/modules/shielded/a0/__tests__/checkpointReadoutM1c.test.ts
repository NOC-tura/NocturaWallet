/**
 * The M1c checkpoint readout (checkpointReadout.ts, M1c Task 9; spec §16 M1c): the unshield lines
 * the desk reads (`unshield-submitting` with its context, `unshield-outcome`, `unshield-reconcile`),
 * the registry line after each startup (`startup-accounts`) and the submit hold's lines
 * (`submit-hold`, submitHold.ts).
 *
 * THE CONTRACT. `scripts/m1c-checkpoint/fixtures/unshield-sample.txt` was written by hand (twelve
 * JSON objects in the documented field order, values taken from the recorded relayed withdraws
 * 5sKiWZTv… / 5F8Ks5qa… and from sha256 of fixed strings) — neither by this module nor by the
 * desk's parser. This suite holds the app's lines to it byte for byte; the desk's
 * `scripts/m1c-checkpoint/lib.test.mjs` parses the same file. A change on either side that the
 * other does not follow turns one of the two red.
 *
 * R2-N3 (plan-front): the seed's public-key set is NOT on `unshield-submitting` (it keeps the
 * registry: no linkage beyond `startup-accounts`); it is on `startup-accounts`, once per start,
 * derived by the startup step with the gate open (startup.ts). THE GATE: the context of
 * `unshield-submitting` reads the registry — it is computed only with the gate open.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {
  readA0StartupAccounts,
  readA0SubmitHold,
  readA0UnshieldOutcome,
  readA0UnshieldReconcile,
  readA0UnshieldSubmitting,
  resetA0ReadoutForTests,
} from '../checkpointReadout';
import type {A0ReadoutUnshield, A0ReadoutUnshieldContext} from '../checkpointReadout';
import type {A0AccountEntry} from '../accountRegistry';
import type {A0StartupResult, A0StartupState} from '../startup';
import type {A0UnshieldReconcileReport} from '../unshieldFlow';
import {
  A0_SUBMIT_HOLD_ARM_TTL_MS,
  A0_SUBMIT_HOLD_LINK,
  A0_SUBMIT_HOLD_MS,
  armA0SubmitHold,
  resetA0SubmitHoldForTests,
  takeA0SubmitHold,
} from '../submitHold';

const SAMPLE = readFileSync(join(__dirname, '../../../../../scripts/m1c-checkpoint/fixtures/unshield-sample.txt'), 'utf8')
  .split('\n')
  .filter(Boolean);

// The sample's inputs (the values written into the hand-made file).
const S1 = 'kz4u7m1c';
const S2 = 'kz4u9x2d';
const MAIN = 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd';
const MAIN_ATA = '9hZSf8jMxBdqcvnYzj6EkQ2gPoZCoX2GcF8f1dgkyLsn';
const F1 = 'AgPYn4odQNKwWBjvCtgG8G1supmLKaFHtbDVHmMT2KtP';
const F1_ATA = '2ot2kwhs7gFFPHAYNwkuNsUsfZp8hWAgzHpNQLx9pASu';
const F2 = 'AuUTDTY6ge45h1Z61eCJYiX4VYb3JvuGvnTevNvHq4BA';
const F2_ATA = '74GmPmHDtij41KMFd2i9giNLDUdRaWAXTTZxtpu7ayGN';
const CLI = 'DaiWcqhB9YpdqXUypDAF97WTAEY9bEdwjfX4eDFp9yNc';
const OTHER = '5pHpWLNFQz89brhH6h5Lbqy2zT1jdjh6hjKT7fFMeEkb';
const OTHER_ATA = 'D7e1jdGHeomw2dT6n5DXJASSABZC6dgyPH6WJ326uqb6';
const FEE_PAYER = '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe';
const SIG_MAIN = '5sKiWZTvwSzNiKzFsK6DFrQGoksbv2enc1NffvxoPGJNdusd6fZa585GSxnG6om7c4JrsA7uDovQKaSc8SnQVwMr';
const SIG_FRESH = '5F8Ks5qawFYWdhjPVogs8S7cx3fY68QC4qzpJ6VcfLEyHT4UCH7oty6i5cHRwma1FDLwpeF8PaWdQVHqhJGmVcZM';
// Values that must NEVER reach a line: the registry's scheme strings (the index), a rho, the nullifier.
const RHO = 'ab'.repeat(32);
const NULLIFIER = '0b2018b2e520bbf9420648d389a76aaad7a34b4c63e9afbf7f1f2e997888762d';

const entry = (scheme: string, address: string, role: A0AccountEntry['role']): A0AccountEntry => ({scheme, address, role});
const REG1 = [entry('slip10:0', MAIN, 'main'), entry('slip10:7', F1, 'fresh-exit')];
const REG2 = [...REG1, entry('slip10:9', F2, 'fresh-pending')];

const ready = (result: Partial<A0StartupResult>): A0StartupState => ({
  phase: 'ready',
  result: {
    restoredBecause: null,
    restore: null,
    reconcile: {confirmed: [], dropped: [], stillPending: [], skipped: 0},
    unshields: {settled: [], reverted: [], stillPending: [], skipped: 0, released: [], promoted: []},
    seedKeys: null,
    ...result,
  },
});
const RESTORED = ready({
  restoredBecause: 'no-record',
  restore: {
    treeTransactions: 40,
    failedTransactions: 0,
    listedSignatures: 40,
    fetchedTransactions: 40,
    syncDurationMs: 3000,
    durationMs: 4000,
    depositIndicesTried: 102,
    depositsInHistory: 20,
    withdrawNullifiersInHistory: 6,
    ownNotes: 3,
    spentNotes: 1,
    foreignRhoHits: 0,
    highestHit: 1,
    changeNotes: 1,
    unmatchedChangeLeaves: 0,
    attributionCalls: 2,
    accountIndicesTried: 22,
    exitAccounts: 1,
    finishedAt: '2026-11-18T09:00:00.500Z',
    r13TriggerReached: false,
  },
  // the seed set: the registry (main, F1) ∪ cli ∪ slip10:0 (= the main) — a0SeedPublicKeys' order
  seedKeys: {keys: [MAIN, F1, CLI], error: null},
});

const U_MAIN: A0ReadoutUnshield = {owner: MAIN, ata: MAIN_ATA, amount: 400_000n, fee: 10_000n, destination: 'main'};
const U_F2: A0ReadoutUnshield = {owner: F2, ata: F2_ATA, amount: 10_000n, fee: 10_000n, destination: 'fresh'};
const U_OTHER: A0ReadoutUnshield = {owner: OTHER, ata: OTHER_ATA, amount: 10_000n, fee: 10_000n, destination: 'external'};
const U_F1: A0ReadoutUnshield = {owner: F1, ata: F1_ATA, amount: 400_000n, fee: 10_000n, destination: 'fresh'};
const ctx = (registry: A0AccountEntry[], heldMs: number): (() => A0ReadoutUnshieldContext) => () => ({
  feePayer: FEE_PAYER,
  gasGrantLamports: 3_000_000n,
  walletKind: 'slip10',
  registry,
  heldMs,
});

function emitTheSample(): string[] {
  const lines: string[] = [];
  let t = 0;
  const times = [
    '09:00:01', '09:00:02', '09:00:03', '09:00:04', '09:00:05', '09:00:06',
    '09:01:00', '09:01:30', '09:01:40', '09:01:50', '09:06:00', '09:16:00',
  ];
  const o = (session: string) => ({sink: (l: string) => lines.push(l), enabled: true, session, now: () => new Date(`2026-11-18T${times[t++]}.000Z`)});
  readA0StartupAccounts(RESTORED, () => REG1, o(S1));
  readA0UnshieldSubmitting(U_MAIN, ctx(REG1, 0), o(S1));
  readA0UnshieldOutcome(U_MAIN, {status: 'spent', signature: SIG_MAIN, changeLeafIndex: 22, changeAmount: 123n, grantLamports: null, destinationWithoutSol: false}, o(S1));
  readA0SubmitHold('armed', 30_000, o(S1));
  readA0SubmitHold('taken', 30_000, o(S1));
  readA0UnshieldSubmitting(U_F2, ctx(REG2, 30_000), o(S1));
  // the next process (after the kill): its sequence starts again at 1
  resetA0ReadoutForTests();
  readA0UnshieldReconcile({settled: [], reverted: [], stillPending: [{rho: RHO, reason: 'in-window'}], skipped: 0, released: [], promoted: []}, o(S2));
  readA0UnshieldOutcome(U_OTHER, {status: 'pending', signature: null, reason: 'unknown', detail: `sentinel ${NULLIFIER}`}, o(S2));
  readA0UnshieldOutcome(U_OTHER, {status: 'not-sent', outcome: 'invalid_request'}, o(S2));
  readA0UnshieldOutcome(
    U_F1,
    {status: 'landed-unverified', signature: SIG_FRESH, code: 'E_A0_VERIFY_SEED_SIGNER', detail: `sentinel ${NULLIFIER}`, note: 'spent', changeRecorded: true, linked: true},
    o(S2),
  );
  readA0UnshieldReconcile(
    {
      settled: [{rho: RHO, signature: SIG_FRESH, verified: true, code: null, changeRecorded: true, detail: `sentinel ${NULLIFIER}`} as A0UnshieldReconcileReport['settled'][number]],
      reverted: [{rho: RHO}],
      stillPending: [],
      skipped: 0,
      released: ['slip10:9'],
      promoted: ['slip10:7'],
    },
    o(S2),
  );
  readA0SubmitHold('expired', 30_000, o(S2));
  return lines;
}

beforeEach(() => {
  resetA0ReadoutForTests();
  resetA0SubmitHoldForTests();
});

describe('the contract with the desk (the hand-written sample)', () => {
  it('the app emits exactly the twelve sample lines for the sample inputs', () => {
    expect(SAMPLE.length).toBe(12);
    expect(emitTheSample()).toEqual(SAMPLE);
  });
  it('no scheme string (the registry index), no rho, no nullifier, no change amount, no verifier detail reaches a line', () => {
    // carry 7: the verifier's `detail` (it names seed keys beside the signature) is given to the
    // readout on a pending, a landed-unverified outcome and a settled entry — and NEVER written
    const all = emitTheSample().join('\n');
    for (const secret of ['slip10:', RHO, NULLIFIER, 'sentinel', '"changeAmount"', '"123"']) {
      expect(all).not.toContain(secret);
    }
    // positive control: the same search finds what IS public
    expect(all).toContain(F2);
    expect(all).toContain(SIG_FRESH);
    expect(all).toContain('"fresh-pending"');
  });
  it('R2-N3: the seed keys are on startup-accounts only — never on unshield-submitting', () => {
    const ps = emitTheSample().map(l => JSON.parse(l.split(' ').slice(3).join(' ')));
    expect(ps.filter(p => 'seedKeys' in p).map(p => p.event)).toEqual(['startup-accounts']);
    expect(ps[0]).toMatchObject({seedKeys: [MAIN, F1, CLI], seedKeysError: null});
    // the submitting line keeps the registry (no linkage beyond startup-accounts)
    expect(ps[1]).toMatchObject({event: 'unshield-submitting', registry: [{address: MAIN}, {address: F1}]});
  });
});

describe('the gate and the context', () => {
  it('closed gate: the context is never computed and nothing is emitted', () => {
    const lines: string[] = [];
    const context = jest.fn(ctx(REG1, 0));
    readA0UnshieldSubmitting(U_MAIN, context, {sink: l => lines.push(l), enabled: false});
    readA0StartupAccounts(RESTORED, () => REG1, {sink: l => lines.push(l), enabled: false});
    readA0SubmitHold('armed', 30_000, {sink: l => lines.push(l), enabled: false});
    expect(context).not.toHaveBeenCalled();
    expect(lines).toEqual([]);
    // control: the same calls with the gate open emit three lines and compute the context once
    readA0UnshieldSubmitting(U_MAIN, context, {sink: l => lines.push(l), enabled: true});
    readA0StartupAccounts(RESTORED, () => REG1, {sink: l => lines.push(l), enabled: true});
    readA0SubmitHold('armed', 30_000, {sink: l => lines.push(l), enabled: true});
    expect(context).toHaveBeenCalledTimes(1);
    expect(lines).toHaveLength(3);
  });
  it('a context that throws is reported by its code only; the line is still written', () => {
    const lines: string[] = [];
    readA0UnshieldSubmitting(
      U_MAIN,
      () => {
        throw Object.assign(new Error(`sentinel ${RHO}`), {code: 'E_A0_ACCOUNTS_CORRUPT'});
      },
      {sink: l => lines.push(l), enabled: true, session: 'x'},
    );
    const p = JSON.parse(lines[0]!.split(' ').slice(3).join(' '));
    expect(p).toMatchObject({event: 'unshield-submitting', owner: MAIN, contextError: 'E_A0_ACCOUNTS_CORRUPT'});
    expect(p.registry).toBeUndefined();
    expect(lines[0]).not.toContain('sentinel');
  });
  it('an unreadable registry after a startup: its code, never an empty list; no registry record: null', () => {
    const lines: string[] = [];
    const o = {sink: (l: string) => lines.push(l), enabled: true, session: 'x'};
    readA0StartupAccounts(ready({}), () => {
      throw Object.assign(new Error('x'), {code: 'E_A0_ACCOUNTS_CORRUPT'});
    }, o);
    readA0StartupAccounts(ready({}), () => null, o);
    readA0StartupAccounts({phase: 'error', code: 'E_X', message: 'm'}, () => REG1, o);
    readA0StartupAccounts({phase: 'running'}, () => REG1, o);
    const ps = lines.map(l => JSON.parse(l.split(' ').slice(3).join(' ')));
    expect(ps).toHaveLength(2); // only `ready` reads out
    expect(ps[0]).toMatchObject({accounts: null, accountsError: 'E_A0_ACCOUNTS_CORRUPT', restore: null});
    expect(ps[1]).toMatchObject({accounts: null, accountsError: null});
  });
  it('the seed keys: an underived set is null (a gate closed at the start), a failed one its code only — never an empty list', () => {
    const lines: string[] = [];
    const o = {sink: (l: string) => lines.push(l), enabled: true, session: 'x'};
    readA0StartupAccounts(ready({}), () => REG1, o);
    readA0StartupAccounts(ready({seedKeys: {keys: null, error: 'E_A0_ACCOUNTS_CORRUPT'}}), () => REG1, o);
    const ps = lines.map(l => JSON.parse(l.split(' ').slice(3).join(' ')));
    expect(ps[0]).toMatchObject({seedKeys: null, seedKeysError: null});
    expect(ps[1]).toMatchObject({seedKeys: null, seedKeysError: 'E_A0_ACCOUNTS_CORRUPT'});
  });
});

describe('the submit hold (submitHold.ts)', () => {
  it('the link and the hold are the stated ones', () => {
    expect(A0_SUBMIT_HOLD_LINK).toBe('noctura://a0-hold-next-submit');
    expect(A0_SUBMIT_HOLD_MS).toBe(30_000);
  });
  it('the arm lapses after ten minutes (m-4)', () => {
    expect(A0_SUBMIT_HOLD_ARM_TTL_MS).toBe(10 * 60_000);
  });
  it('armed with the gate open: the NEXT take answers 30 s once, then 0; each step read out', () => {
    const lines: string[] = [];
    const o = {sink: (l: string) => lines.push(l), session: 'h'};
    expect(takeA0SubmitHold(true, o)).toBe(0);
    expect(armA0SubmitHold(true, o)).toBe(true);
    expect(takeA0SubmitHold(true, o)).toBe(30_000);
    expect(takeA0SubmitHold(true, o)).toBe(0);
    expect(lines.map(l => JSON.parse(l.split(' ').slice(3).join(' ')).state)).toEqual(['armed', 'taken']);
  });
  it('gate closed: arming arms nothing; a hold armed earlier is not taken under a closed gate', () => {
    expect(armA0SubmitHold(false)).toBe(false);
    expect(takeA0SubmitHold(true, {enabled: true, sink: () => undefined})).toBe(0);
    armA0SubmitHold(true, {sink: () => undefined});
    expect(takeA0SubmitHold(false)).toBe(0);
    // and it is spent by that closed take (never held over to a later open one)
    expect(takeA0SubmitHold(true, {sink: () => undefined})).toBe(0);
  });
  it('the default gate under Jest\'s production config is closed: nothing arms', () => {
    expect(armA0SubmitHold()).toBe(false);
    expect(takeA0SubmitHold()).toBe(0);
  });
  it('m-4: an arm older than ten minutes is not taken — it EXPIRES (read out `expired`) and is spent', () => {
    const lines: string[] = [];
    let t = Date.parse('2026-11-18T09:00:00.000Z');
    const o = {sink: (l: string) => lines.push(l), session: 'h', now: () => new Date(t)};
    expect(armA0SubmitHold(true, o)).toBe(true);
    t += A0_SUBMIT_HOLD_ARM_TTL_MS + 1;
    expect(takeA0SubmitHold(true, o)).toBe(0);
    expect(takeA0SubmitHold(true, o)).toBe(0); // spent by the expiry, not held over
    expect(lines.map(l => JSON.parse(l.split(' ').slice(3).join(' ')).state)).toEqual(['armed', 'expired']);
    // control: the same arm taken at exactly ten minutes is still a hold
    lines.length = 0;
    expect(armA0SubmitHold(true, o)).toBe(true);
    t += A0_SUBMIT_HOLD_ARM_TTL_MS;
    expect(takeA0SubmitHold(true, o)).toBe(A0_SUBMIT_HOLD_MS);
    expect(lines.map(l => JSON.parse(l.split(' ').slice(3).join(' ')).state)).toEqual(['armed', 'taken']);
  });
  it('a re-arm restarts the ten minutes', () => {
    let t = 0;
    const o = {sink: () => undefined, now: () => new Date(t)};
    armA0SubmitHold(true, o);
    t += 9 * 60_000;
    armA0SubmitHold(true, o);
    t += 9 * 60_000;
    expect(takeA0SubmitHold(true, o)).toBe(A0_SUBMIT_HOLD_MS);
  });
});
