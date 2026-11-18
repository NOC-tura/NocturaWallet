/**
 * The `pinnedFetch` on-device control (pinnedControl.ts; spec §6.0, M1c Task 1) — on the desk, with
 * the network mocked: the REAL `react-native-ssl-pinning` wrapper over the native callbacks recorded
 * from the library's source (`sslPinning/__testing__/realSslPinning.ts`).
 *
 * THE CONTRACT WITH THE DESK. `scripts/m1c-checkpoint/fixtures/pinned-control-sample.txt` was
 * written by hand (the documented field order, the builds' API base). The app's lines for the
 * sample's inputs must equal it byte for byte; the desk's `lib.test.mjs` parses and judges the same
 * file.
 *
 * WHAT ONLY THE PHONE PROVES: the compiled native module, the bridge, our pins against the live
 * host, and the relayer's actual answer — the checkpoint's `pinned-control` line. Here the native
 * half is the recording.
 */
import {readFileSync, readdirSync} from 'fs';
import {join, relative, sep} from 'path';

jest.mock('react-native-ssl-pinning', () =>
  jest
    .requireActual<typeof import('../../../sslPinning/__testing__/realSslPinning')>('../../../sslPinning/__testing__/realSslPinning')
    .loadRealSslPinning(),
);

import {nativeCalls, resetNative, setNativeResponder} from '../../../sslPinning/__testing__/realSslPinning';
import {
  A0_PINNED_CONTROL_SUBMIT_BODY,
  quoteFieldsOf,
  resetA0PinnedControlForTests,
  runA0PinnedControl,
} from '../pinnedControl';
import type {A0PinnedProbeResult} from '../pinnedControl';
import {resetA0ReadoutForTests} from '../checkpointReadout';

type Realssl = typeof import('../../../sslPinning/__testing__/realSslPinning');
type Control = typeof import('../pinnedControl');

const ROOT = join(__dirname, '../../../../..');
const REC = JSON.parse(
  readFileSync(join(ROOT, 'src/modules/sslPinning/__tests__/fixtures/rn-ssl-pinning-callbacks.json'), 'utf8'),
) as {callbacks: Record<string, {args: unknown[]}>};
const cb = (name: string) => REC.callbacks[name]!.args;
const SAMPLE = readFileSync(join(ROOT, 'scripts/m1c-checkpoint/fixtures/pinned-control-sample.txt'), 'utf8')
  .split('\n')
  .filter(Boolean);
const SESSION = 'kz3d9q2c';
const AT = new Date('2026-11-17T12:00:00.000Z');
const DEVNET_APK_CONFIG = {
  NETWORK: 'devnet',
  FEATURES_SHIELDED: 'true',
  LOCAL_PROVING: 'true',
  API_BASE: 'https://api.noc-tura.io/api/v1',
};

/** The relayer as the recording says it answers: submit → 400 invalid_request, quote → 200. */
const RELAYER = (url: string) => (url.endsWith('/relayer/quote') ? cb('success200') : cb('nonSuccess400'));

beforeEach(() => {
  resetNative();
  resetA0PinnedControlForTests();
  resetA0ReadoutForTests();
});

/** Runs the control in a fresh module registry under the devnet APK's config. */
async function underDevnetConfig(
  respond: (url: string) => unknown[],
  deps: Parameters<Control['runA0PinnedControl']>[0] = {},
): Promise<{results: A0PinnedProbeResult[] | null; lines: string[]; calls: ReturnType<Realssl['nativeCalls']>}> {
  const lines: string[] = [];
  let run: Promise<A0PinnedProbeResult[] | null> = Promise.resolve(null);
  let lib: Realssl | undefined;
  jest.isolateModules(() => {
    jest.doMock('react-native-config', () => ({__esModule: true, default: DEVNET_APK_CONFIG}));
    lib = require('../../../sslPinning/__testing__/realSslPinning') as Realssl;
    lib.resetNative();
    lib.setNativeResponder(respond);
    const m = require('../pinnedControl') as Control;
    run = m.runA0PinnedControl({readout: {sink: l => lines.push(l), now: () => AT, session: SESSION}, ...deps});
  });
  jest.dontMock('react-native-config');
  const results = await run;
  return {results, lines, calls: lib!.nativeCalls()};
}

describe('the contract with the desk (the hand-written sample)', () => {
  it('under the devnet APK\'s config the default gate is open and the lines equal the sample byte for byte', async () => {
    const {lines} = await underDevnetConfig(RELAYER);
    expect(SAMPLE).toHaveLength(3);
    expect(lines).toEqual(SAMPLE);
  });
});

describe('the three probes (submit, quote, the pre-fix negative control)', () => {
  it('go out in order through the native module: POST submit (the malformed body), GET quote, POST submit again', async () => {
    const {calls} = await underDevnetConfig(RELAYER);
    expect(calls.map(c => [c.options.method, c.url, c.options.body ?? null])).toEqual([
      ['POST', 'https://api.noc-tura.io/api/v1/relayer/submit', A0_PINNED_CONTROL_SUBMIT_BODY],
      ['GET', 'https://api.noc-tura.io/api/v1/relayer/quote', null],
      ['POST', 'https://api.noc-tura.io/api/v1/relayer/submit', A0_PINNED_CONTROL_SUBMIT_BODY],
    ]);
    expect(calls.every(c => c.options.pkPinning === true)).toBe(true);
  });
  it('the malformed body is valid JSON with an unknown kind and nothing else', () => {
    expect(JSON.parse(A0_PINNED_CONTROL_SUBMIT_BODY)).toEqual({kind: 'noctura-m1c-pinned-control'});
  });
  it('submit RESOLVES 400 invalid_request; quote 200 parsed; the pre-fix variant THROWS with the status lost', async () => {
    const results = await runA0PinnedControl({enabled: true, readout: {sink: () => undefined}, ...withRelayer()});
    expect(results!.map(r => [r.probe, r.status, r.outcome, r.threw, r.lostStatus, r.pinFailure])).toEqual([
      ['submit', 400, 'invalid_request', false, false, false],
      ['quote', 200, null, false, false, false],
      ['submit-prefix', null, null, true, true, false],
    ]);
    expect(results![1]!.quote).toEqual({
      programId: 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH',
      pool: '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT',
      mint: 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs',
      feePayer: '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe',
      maxFee: '100000',
      minFeeTransfer: '10000',
      minFeeWithdrawChange: '10000',
      gasGrantLamports: '3000000',
      validForSeconds: 60,
    });
  });
  it('THE LINE CAN FAIL: a library that resolved non-2xx would leave the pre-fix variant NOT throwing (the desk fails that)', async () => {
    // a native module that reported the 400 through the SUCCESS callback
    setNativeResponder(url => (url.endsWith('/quote') ? cb('success200') : [null, (cb('nonSuccess400')[0] as object)]));
    const results = await runA0PinnedControl({enabled: true, readout: {sink: () => undefined}});
    expect(results![2]).toMatchObject({probe: 'submit-prefix', status: 400, threw: false, lostStatus: false});
  });
  it('a pin failure on every request: each probe threw with pinFailure, never lostStatus', async () => {
    setNativeResponder(() => cb('pinFailure'));
    const results = await runA0PinnedControl({enabled: true, readout: {sink: () => undefined}});
    expect(results!.map(r => [r.threw, r.pinFailure, r.lostStatus, r.status])).toEqual([
      [true, true, false, null],
      [true, true, false, null],
      [true, true, false, null],
    ]);
  });
  it('a transport failure: threw, neither pinFailure nor lostStatus', async () => {
    setNativeResponder(() => cb('transportFailure'));
    const results = await runA0PinnedControl({enabled: true, readout: {sink: () => undefined}});
    expect(results![0]).toMatchObject({threw: true, pinFailure: false, lostStatus: false});
  });
  it('one run at a time: a second call while the first is in flight sends nothing and returns null', async () => {
    setNativeResponder(RELAYER);
    const a = runA0PinnedControl({enabled: true, readout: {sink: () => undefined}});
    const b = await runA0PinnedControl({enabled: true, readout: {sink: () => undefined}});
    expect(b).toBeNull();
    expect((await a)!).toHaveLength(3);
    expect(nativeCalls()).toHaveLength(3);
  });
});

function withRelayer(): Record<string, never> {
  setNativeResponder(RELAYER);
  return {};
}

describe('the gate: nothing is sent outside a shielded devnet build', () => {
  it('under the PRODUCTION config (Jest\'s default) the default gate is closed: null, no request, no line', async () => {
    setNativeResponder(RELAYER);
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    try {
      await expect(runA0PinnedControl()).resolves.toBeNull();
      expect(nativeCalls()).toHaveLength(0);
      expect(info).not.toHaveBeenCalled();
    } finally {
      info.mockRestore();
    }
  });
  it('positive control: the same default call under the devnet APK\'s config sends three requests', async () => {
    const {results, calls} = await underDevnetConfig(RELAYER);
    expect(results).toHaveLength(3);
    expect(calls).toHaveLength(3);
  });
});

describe('only public values reach a line', () => {
  it('no body text, error message, header or unknown field — and an unknown outcome is "unrecognised"', async () => {
    const SENTINEL = 'sentinel-server-text-' + 'ab'.repeat(16);
    setNativeResponder(url =>
      url.endsWith('/quote')
        ? [null, {status: 200, bodyString: JSON.stringify({...JSON.parse((cb('success200')[1] as {bodyString: string}).bodyString), extra: SENTINEL}), headers: {'X-Leak': SENTINEL}}]
        : [{status: 400, bodyString: JSON.stringify({outcome: `x-${SENTINEL}`, error: SENTINEL}), headers: {'X-Leak': SENTINEL}}, null],
    );
    const lines: string[] = [];
    const results = await runA0PinnedControl({enabled: true, readout: {sink: l => lines.push(l)}});
    expect(results![0]!.outcome).toBe('unrecognised');
    expect(lines).toHaveLength(3);
    expect(lines.join('\n')).not.toContain(SENTINEL);
    // positive control: the same search finds what IS public
    expect(lines.join('\n')).toContain('3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe');
  });
  it('a quote with a field out of shape is quote: null (no server string is passed through)', () => {
    const good = JSON.parse((cb('success200')[1] as {bodyString: string}).bodyString) as Record<string, unknown>;
    expect(quoteFieldsOf(good)).not.toBeNull();
    expect(quoteFieldsOf({...good, programId: 'not base58 <script>'})).toBeNull();
    expect(quoteFieldsOf({...good, maxFee: 100000})).toBeNull();
    expect(quoteFieldsOf({...good, maxFee: '0100000'})).toBeNull();
    expect(quoteFieldsOf({...good, minFee: {transfer: '10000'}})).toBeNull();
    expect(quoteFieldsOf({...good, gasGrantLamports: '3e6'})).toBeNull();
    expect(quoteFieldsOf({...good, validForSeconds: '60'})).toBeNull();
    expect(quoteFieldsOf([good])).toBeNull();
    expect(quoteFieldsOf(null)).toBeNull();
  });
  it('a quote without gasGrantLamports (P1 not live) parses with gasGrantLamports: null', () => {
    const noGrant = JSON.parse((cb('success200')[1] as {bodyString: string}).bodyString) as Record<string, unknown>;
    delete noGrant.gasGrantLamports;
    expect(quoteFieldsOf(noGrant)).toMatchObject({gasGrantLamports: null, feePayer: '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe'});
  });
});

describe('the pre-fix variant has exactly one caller', () => {
  /** code files under src/, tests and test helpers excluded; comments blanked */
  function codeFiles(dir: string): string[] {
    return readdirSync(dir, {withFileTypes: true}).flatMap(e => {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        return e.name === '__tests__' || e.name === '__testing__' ? [] : codeFiles(full);
      }
      return /\.(ts|tsx)$/.test(e.name) ? [full] : [];
    });
  }
  const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  it('pinnedFetchPreFixForDevnetControl is named only by pinnedFetch.ts (its definition) and pinnedControl.ts', () => {
    const files = codeFiles(join(ROOT, 'src'));
    expect(files.length).toBeGreaterThanOrEqual(200); // the denominator (227 code files at 1484d5c + this task)
    const naming = files
      .filter(f => codeOnly(readFileSync(f, 'utf8')).includes('pinnedFetchPreFixForDevnetControl'))
      .map(f => relative(ROOT, f).split(sep).join('/'))
      .sort();
    expect(naming).toEqual(['src/modules/shielded/a0/pinnedControl.ts', 'src/modules/sslPinning/pinnedFetch.ts']);
  });
});
