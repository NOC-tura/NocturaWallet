/**
 * The M1b checkpoint readout (checkpointReadout.ts; spec §16 M1b): the lines the desk script reads
 * off the phone's log.
 *
 * THE CONTRACT. `scripts/m1b-checkpoint/fixtures/readout-sample.txt` was written by hand (JSON
 * objects in the documented field order, cut into 200-character chunks) — neither by this module
 * nor by the desk's parser. This suite holds the app's lines to it byte for byte; the desk's
 * `lib.test.mjs` parses the same file. A change on either side that the other does not follow
 * turns one of the two red.
 *
 * THE GATE. Only a shielded devnet build emits: under Jest's default config (the production one:
 * NETWORK=mainnet-beta, no FEATURES_SHIELDED) nothing reaches console.info — and, as the positive
 * control, the same module loaded under the devnet APK's config does emit.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {
  A0_READOUT_TAG,
  a0ReadoutEnabled,
  a0ReadoutLines,
  readA0DepositOutcome,
  readA0DepositSubmitted,
  readA0Startup,
  resetA0ReadoutForTests,
} from '../checkpointReadout';
import type {A0Note} from '../noteStore';
import type {A0StartupState} from '../startup';

const SAMPLE = readFileSync(join(__dirname, '../../../../../scripts/m1b-checkpoint/fixtures/readout-sample.txt'), 'utf8')
  .split('\n')
  .filter(Boolean);

// The sample's inputs (the values written into the hand-made file).
const SESSION = 'kz3d9q2a';
const AT = new Date('2026-11-15T20:00:00.000Z');
const SIG = '3DR6F7oWXS4D5RSsDJAQMbYtQM4EW5Kp2qkJRVSHH72x2GPB4N4G93JkNK9uGGK9CpFeGuy7vtBVeaDHiVQ7b8sm';
const SIG2 = 'a7wDRKqvnNSkBAGs56ssKby9pqXQtc3eAv6W5sF1HAMWNiGYEkkjUPkeNJ4Ji3E2AjUfseiR3U65Fcr8kQvm5tY';
const DEP = 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd';
const C1 = '040cee88a680ad589527dc07fe1cc7a15e2f3059c367bfac23dfcb3ee56219ad';
const C2 = '0'.repeat(63) + '7';
const ROOT = '1' + '0'.repeat(62) + '2';
// Values that must NEVER reach the log (rho, a depositIndex, an error message): distinct sentinels.
const RHO_A = 'aa'.repeat(32);
const RHO_B = 'bb'.repeat(32);
const RHO_C = 'cc'.repeat(32);
const RHO_D = 'dd'.repeat(32);
const SECRET_MESSAGE = 'E_A0_STORE_LOCKED: sentinel-message-' + 'ee'.repeat(32);

const NOTES: A0Note[] = [
  {commitment: C1, amount: 1_000_000n, rho: RHO_A, depositIndex: 7_777_777n, leafIndex: 0, status: 'unspent'},
  {commitment: C2, amount: 500_000n, rho: RHO_B, depositIndex: 8_888_888n, leafIndex: 17, status: 'unspent'},
  {commitment: '0'.repeat(63) + '9', amount: 3n, rho: RHO_C, depositIndex: 9_999_999n, lastValidBlockHeight: 123_456_789, status: 'pending'},
  {commitment: '0'.repeat(63) + 'a', amount: 4n, rho: RHO_D, leafIndex: 3, status: 'spent', spentTx: 'spentTxSentinel'},
];

const READY: A0StartupState = {
  phase: 'ready',
  result: {
    restoredBecause: 'no-record',
    restore: {
      treeTransactions: 16,
      failedTransactions: 0,
      listedSignatures: 16,
      fetchedTransactions: 16,
      syncDurationMs: 2400,
      durationMs: 3100,
      depositIndicesTried: 21,
      depositsInHistory: 8,
      withdrawNullifiersInHistory: 4_242_424,
      ownNotes: 1,
      spentNotes: 0,
      foreignRhoHits: 0,
      highestHit: 0,
      finishedAt: '2026-11-15T19:59:58.000Z',
      r13TriggerReached: false,
    },
    reconcile: {
      confirmed: [{rho: RHO_C, leafIndex: 17, signature: SIG2}],
      dropped: [{rho: RHO_D, reason: 'expired'}],
      stillPending: [],
      skipped: 0,
    },
  },
};

function emitTheSample(): string[] {
  const lines: string[] = [];
  const o = {sink: (l: string) => lines.push(l), enabled: true, now: () => AT, chunk: 200, session: SESSION};
  readA0DepositSubmitted({signature: SIG, depositor: DEP, amount: 1_000_000n, commitment: C1}, o);
  readA0DepositOutcome({depositor: DEP, amount: 1_000_000n, commitment: C1}, {status: 'unspent', signature: SIG, leafIndex: 0, root: ROOT}, o);
  readA0Startup(READY, () => NOTES, o);
  readA0Startup({phase: 'error', code: 'E_A0_STORE_LOCKED', message: SECRET_MESSAGE}, () => NOTES, o);
  readA0DepositOutcome(
    {depositor: DEP, amount: 500_000n, commitment: C2},
    {status: 'pending', signature: SIG2, reason: 'not-confirmed', detail: SECRET_MESSAGE},
    o,
  );
  return lines;
}

/** The JSON texts of the lines, chunks re-joined (a value can be cut across two lines). */
function payloadTexts(lines: readonly string[]): string[] {
  const byId = new Map<string, string>();
  for (const l of lines) {
    const m = /^NOCTURA-A0-READOUT (\S+) \d+\/\d+ (.*)$/.exec(l)!;
    byId.set(m[1]!, (byId.get(m[1]!) ?? '') + m[2]!);
  }
  return [...byId.values()];
}

beforeEach(() => {
  resetA0ReadoutForTests();
});

describe('the contract with the desk (the hand-written sample)', () => {
  it('the app emits exactly the sample lines for the sample inputs', () => {
    expect(SAMPLE.length).toBe(15);
    expect(emitTheSample()).toEqual(SAMPLE);
  });
  it('each line is "<TAG> <session>-<seq> <i>/<n> <chunk>" and the chunks of one id rebuild its JSON', () => {
    const byId = new Map<string, string[]>();
    for (const l of emitTheSample()) {
      const m = /^NOCTURA-A0-READOUT (\S+) (\d+)\/(\d+) (.*)$/.exec(l);
      expect(m).not.toBeNull();
      byId.set(m![1]!, [...(byId.get(m![1]!) ?? []), m![4]!]);
    }
    expect([...byId.keys()]).toEqual([1, 2, 3, 4, 5].map(i => `${SESSION}-${i}`));
    const startup = JSON.parse(byId.get(`${SESSION}-3`)!.join(''));
    expect(startup.restore.treeTransactions).toBe(16);
    expect(startup.notes.unspentNotes).toEqual([
      {leafIndex: 0, commitment: C1, amount: '1000000'},
      {leafIndex: 17, commitment: C2, amount: '500000'},
    ]);
  });
  it('a line is at most TAG + id + counter + the chunk (the default chunk keeps it under logcat\'s ~4 KB)', () => {
    const lines = a0ReadoutLines('x-1', {k: 'v'.repeat(10_000)});
    expect(lines.length).toBe(4);
    expect(Math.max(...lines.map(l => l.length))).toBeLessThan(4000);
  });
});

describe('only public values', () => {
  it('no rho, no depositIndex, no lastValidBlockHeight, no spentTx, no error message or detail reaches a line', () => {
    // searched in the RE-JOINED payloads: a search over the raw lines misses a value the chunking cut
    const all = payloadTexts(emitTheSample()).join('\n');
    for (const secret of [RHO_A, RHO_B, RHO_C, RHO_D, '7777777', '8888888', '9999999', '123456789', 'spentTxSentinel', 'sentinel-message', '4242424']) {
      expect(all).not.toContain(secret);
    }
    // positive control: the same search finds what IS public
    expect(all).toContain(C1);
    expect(all).toContain(SIG2);
  });
  it('a store that cannot be read is reported by its code only, never as an empty store', () => {
    const lines: string[] = [];
    readA0Startup(READY, () => {
      throw Object.assign(new Error(SECRET_MESSAGE), {code: 'E_A0_STORE_CORRUPT'});
    }, {sink: l => lines.push(l), enabled: true});
    const [text] = payloadTexts(lines);
    const p = JSON.parse(text!);
    expect(p.notesError).toBe('E_A0_STORE_CORRUPT');
    expect(p.notes).toBeUndefined();
    expect(text).not.toContain('sentinel-message');
  });
  it('a sink that throws does not break the flow it reports on', () => {
    expect(() =>
      readA0DepositSubmitted({signature: SIG, depositor: DEP, amount: 1n, commitment: C1}, {
        enabled: true,
        sink: () => {
          throw new Error('logcat gone');
        },
      }),
    ).not.toThrow();
  });
  it('the restore\'s highestHit (R1-m4 / R2-N4) and the reconcile\'s skipped count are read out as given, null included', () => {
    const lines: string[] = [];
    const o = {sink: (l: string) => lines.push(l), enabled: true};
    const r = READY.phase === 'ready' ? READY.result : null;
    readA0Startup({phase: 'ready', result: {...r!, restore: {...r!.restore!, highestHit: 5}, reconcile: {...r!.reconcile, skipped: 2}}}, () => NOTES, o);
    readA0Startup({phase: 'ready', result: {...r!, restore: {...r!.restore!, highestHit: null}}}, () => NOTES, o);
    const [a, b] = payloadTexts(lines).map(t => JSON.parse(t));
    expect(a.restore.highestHit).toBe(5);
    expect(a.reconcile.skipped).toBe(2);
    expect(b.restore).toHaveProperty('highestHit', null);
    expect(b.reconcile.skipped).toBe(0);
  });
  it('running / idle states emit nothing (only a settled startup is read out)', () => {
    const lines: string[] = [];
    readA0Startup({phase: 'running'}, () => NOTES, {sink: l => lines.push(l), enabled: true});
    readA0Startup({phase: 'idle'}, () => NOTES, {sink: l => lines.push(l), enabled: true});
    expect(lines).toEqual([]);
  });
});

describe('the gate: a shielded build on devnet only', () => {
  it('a0ReadoutEnabled is true only for shielded + devnet', () => {
    expect(a0ReadoutEnabled(true, 'devnet')).toBe(true);
    expect(a0ReadoutEnabled(false, 'devnet')).toBe(false);
    expect(a0ReadoutEnabled(true, 'mainnet-beta')).toBe(false);
    expect(a0ReadoutEnabled(false, 'mainnet-beta')).toBe(false);
  });
  it('enabled: false emits nothing', () => {
    const lines: string[] = [];
    readA0DepositSubmitted({signature: SIG, depositor: DEP, amount: 1n, commitment: C1}, {enabled: false, sink: l => lines.push(l)});
    expect(lines).toEqual([]);
  });
  it('under the PRODUCTION config (Jest\'s default: NETWORK=mainnet-beta, no FEATURES_SHIELDED) the default gate and sink write nothing', () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    try {
      expect(a0ReadoutEnabled()).toBe(false);
      readA0DepositSubmitted({signature: SIG, depositor: DEP, amount: 1n, commitment: C1});
      readA0Startup(READY, () => NOTES);
      expect(info).not.toHaveBeenCalled();
    } finally {
      info.mockRestore();
    }
  });
  it('positive control: under the DEVNET APK\'s config the same default gate and sink write the line to console.info', () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    try {
      jest.isolateModules(() => {
        jest.doMock('react-native-config', () => ({
          __esModule: true,
          default: {NETWORK: 'devnet', FEATURES_SHIELDED: 'true', LOCAL_PROVING: 'true'},
        }));
        const m = require('../checkpointReadout') as typeof import('../checkpointReadout');
        expect(m.a0ReadoutEnabled()).toBe(true);
        m.readA0DepositSubmitted({signature: SIG, depositor: DEP, amount: 1n, commitment: C1});
      });
      expect(info).toHaveBeenCalledTimes(1);
      expect(String(info.mock.calls[0]![0])).toMatch(new RegExp(`^${A0_READOUT_TAG} \\S+-1 1/1 \\{`));
    } finally {
      info.mockRestore();
      jest.dontMock('react-native-config');
    }
  });
});
