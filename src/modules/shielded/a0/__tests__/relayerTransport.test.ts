/**
 * The A0 relayer transport (relayerTransport.ts; spec §6.0, §1 "Relayer"): the URL rule
 * (`${API_BASE}/relayer/{quote,submit}`, API_BASE already ends in /v1) and `{status, body}` for
 * every status — over the default fetch, `pinnedFetchDirect`, which calls the native SSL-pinning
 * module directly (M1c Task 1 review I1: never through the npm package's `index.js`). The fake
 * native module is driven by the SAME recorded argument lists `rnSslPinningLibrary.test.ts` and
 * `pinnedControl.test.ts`'s negative control replay through the real library wrapper
 * (`sslPinning/__testing__/fakeRNSslPinningNative.ts` / `realSslPinning.ts`).
 */
import {readFileSync} from 'fs';
import {join} from 'path';

import {API_BASE} from '../../../../constants/programs';
import {__setRNSslPinningNativeForTests, SSLPinningError} from '../../../sslPinning/pinnedFetch';
import {fakeNativeCalls, fakeRNSslPinningNative, resetFakeNative, setFakeNativeCallback} from '../../../sslPinning/__testing__/fakeRNSslPinningNative';
import {
  A0RelayerDeadlineError,
  RELAYER_DEADLINE_MARGIN_MS,
  RELAYER_QUOTE_TIMEOUT_MS,
  RELAYER_SUBMIT_TIMEOUT_MS,
  relayerGetQuote,
  relayerPostSubmit,
  relayerUrl,
} from '../relayerTransport';
import type {RelayerFetch} from '../relayerTransport';

const REC = JSON.parse(
  readFileSync(join(__dirname, '../../../sslPinning/__tests__/fixtures/rn-ssl-pinning-callbacks.json'), 'utf8'),
) as {callbacks: Record<string, {args: unknown[]}>};
const cb = (name: string) => REC.callbacks[name]!.args;
const PRODUCTION_BASE = 'https://api.noc-tura.io/api/v1'; // the builds' API_BASE (both APKs' BuildConfig)

/** A recorded non-2xx callback with another status and JSON body (the same map shape). */
const reply = (status: number, body: unknown) =>
  status >= 200 && status < 300
    ? [null, {status, bodyString: JSON.stringify(body), headers: {}}]
    : [{status, bodyString: JSON.stringify(body), headers: {}}, null];

beforeEach(() => {
  resetFakeNative();
  __setRNSslPinningNativeForTests(fakeRNSslPinningNative);
});
afterEach(() => {
  __setRNSslPinningNativeForTests(undefined);
});

describe('the URL: bare paths appended to API_BASE, which already ends in /v1', () => {
  it('Jest\'s config base: …/v1/relayer/quote and …/v1/relayer/submit', () => {
    expect(API_BASE).toBe('https://api.noc-tura.io/v1');
    expect(relayerUrl('quote')).toBe('https://api.noc-tura.io/v1/relayer/quote');
    expect(relayerUrl('submit')).toBe('https://api.noc-tura.io/v1/relayer/submit');
  });
  it('the builds\' base: …/api/v1/relayer/{quote,submit} — never /v1/v1/', () => {
    expect(relayerUrl('quote', PRODUCTION_BASE)).toBe('https://api.noc-tura.io/api/v1/relayer/quote');
    expect(relayerUrl('submit', PRODUCTION_BASE)).toBe('https://api.noc-tura.io/api/v1/relayer/submit');
    for (const p of ['quote', 'submit'] as const) {
      expect(relayerUrl(p, PRODUCTION_BASE)).not.toContain('/v1/v1');
      expect(relayerUrl(p, PRODUCTION_BASE)).not.toContain('/v1/relayer/v1');
    }
  });
  it('the builds carry that base: both APKs\' recorded BuildConfig (M1b checkpoint dexdump) and .env.example', () => {
    // the env files with the real values are gitignored; the APKs' BuildConfig, read off the built
    // files at the M1b checkpoint, is the tracked record of what the builds hold
    const ROOT = join(__dirname, '../../../../..');
    for (const apk of ['devnet', 'production']) {
      const dex = readFileSync(join(ROOT, `scripts/m1b-checkpoint/fixtures/buildconfig-${apk}.dexdump.txt`), 'utf8');
      expect(/name\s+: 'API_BASE'[\s\S]*?value\s+: "([^"]*)"/.exec(dex)?.[1]).toBe(PRODUCTION_BASE);
    }
    expect(/^API_BASE=(.*)$/m.exec(readFileSync(join(ROOT, '.env.example'), 'utf8'))?.[1]).toMatch(/\/api\/v1$/);
  });
  it.each([
    ['a trailing slash', 'https://api.noc-tura.io/api/v1/'],
    ['no /v1', 'https://api.noc-tura.io/api'],
    ['/v1 twice', 'https://api.noc-tura.io/api/v1/v1'],
    ['plain http', 'http://api.noc-tura.io/api/v1'],
    ['empty', ''],
    ['a query string', 'https://api.noc-tura.io/api/v1?x=1'],
  ])('refuses a base with %s (E_A0_RELAYER_URL), before anything is sent', async (_why, base) => {
    expect(() => relayerUrl('quote', base)).toThrow(expect.objectContaining({code: 'E_A0_RELAYER_URL'}));
    await expect(relayerGetQuote({base})).rejects.toMatchObject({code: 'E_A0_RELAYER_URL'});
    expect(fakeNativeCalls()).toHaveLength(0);
  });
  it('refuses an unknown path', () => {
    expect(() => relayerUrl('withdraw' as 'quote')).toThrow(expect.objectContaining({code: 'E_A0_RELAYER_URL'}));
  });
});

describe('the requests through pinnedFetchDirect (the native module sees them)', () => {
  it('quote: GET …/relayer/quote, pinned, 10 s', async () => {
    setFakeNativeCallback(cb('success200'));
    const r = await relayerGetQuote();
    const [call] = fakeNativeCalls();
    expect(call!.url).toBe(`${API_BASE}/relayer/quote`);
    expect(call!.options).toMatchObject({method: 'GET', pkPinning: true, timeoutInterval: RELAYER_QUOTE_TIMEOUT_MS});
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({programId: 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH', validForSeconds: 60});
  });
  it('submit: POST …/relayer/submit with the JSON text as given, pinned, 120 s', async () => {
    setFakeNativeCallback(cb('nonSuccess400'));
    const r = await relayerPostSubmit('{"kind":"k"}');
    const [call] = fakeNativeCalls();
    expect(call!.url).toBe(`${API_BASE}/relayer/submit`);
    expect(call!.options).toMatchObject({method: 'POST', body: '{"kind":"k"}', pkPinning: true, timeoutInterval: RELAYER_SUBMIT_TIMEOUT_MS});
    expect((call!.options.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(r).toEqual({
      status: 400,
      body: {success: false, outcome: 'invalid_request', error: 'kind must be "transfer" or "withdraw_change"'},
    });
  });
});

describe('{status, body} for every status the contract uses (never a throw)', () => {
  // relayer-a0-contract.md §1: outcome → HTTP
  const TABLE: Array<[string, number]> = [
    ['confirmed', 200],
    ['already_spent', 409],
    ['unconfirmed', 502],
    ['relay_failed', 502],
    ['invalid_request', 400],
    ['duplicate_in_flight', 429],
    ['budget_exceeded', 429],
    ['balance_too_low', 503],
    ['unavailable', 503],
    ['transfer_disabled', 503],
    ['relayer_disabled', 503],
    ['misconfigured', 500],
  ];
  it.each(TABLE)('%s / HTTP %i resolves with that status and body', async (outcome, status) => {
    setFakeNativeCallback(reply(status, {success: status === 200, outcome}));
    await expect(relayerPostSubmit('{}')).resolves.toEqual({status, body: {success: status === 200, outcome}});
  });
  it('a body that is not JSON (the rate limiter\'s text 429) is body: null, the status kept', async () => {
    setFakeNativeCallback(cb('nonSuccess429Text'));
    await expect(relayerPostSubmit('{}')).resolves.toEqual({status: 429, body: null});
  });
  it('an empty body is body: null', async () => {
    setFakeNativeCallback([{status: 502, bodyString: '', headers: {}}, null]);
    await expect(relayerGetQuote()).resolves.toEqual({status: 502, body: null});
  });
});

describe('what is not an HTTP answer throws', () => {
  it('a pin failure: SSLPinningError (E004)', async () => {
    setFakeNativeCallback(cb('pinFailure'));
    await expect(relayerGetQuote()).rejects.toBeInstanceOf(SSLPinningError);
  });
  it('a transport failure: the plain error', async () => {
    setFakeNativeCallback(cb('transportFailure'));
    await expect(relayerPostSubmit('{}')).rejects.toThrow(/^timeout$/);
  });
  it(
    'review I1, FIXED: a message-less failure (the npm wrapper\'s "never settles" case) now settles AT ONCE ' +
      'as a plain transport error — never a throw inside the native callback, never the deadline',
    async () => {
      setFakeNativeCallback(cb('failureNullMessage'));
      const settled = await Promise.race([
        relayerGetQuote({deadlineMs: 5_000}).then(
          () => ({kind: 'resolved'}),
          (e: unknown) => ({kind: 'rejected', error: e}),
        ),
        new Promise(r => setTimeout(() => r({kind: 'pending'}), 300)),
      ]);
      expect(settled).toMatchObject({kind: 'rejected'});
      const error = (settled as {error: unknown}).error;
      expect(error).not.toBeInstanceOf(A0RelayerDeadlineError);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/no message/);
    },
  );
  it('the default deadline is the native timeout + 15 s (quote 25 s, submit 135 s) — still races an actually hanging fetchImpl', async () => {
    jest.useFakeTimers();
    try {
      const never: RelayerFetch = () => new Promise(() => undefined);
      const outcome = {quote: 'pending', submit: 'pending'};
      relayerGetQuote({fetchImpl: never}).catch(() => (outcome.quote = 'deadline'));
      relayerPostSubmit('{}', {fetchImpl: never}).catch(() => (outcome.submit = 'deadline'));
      // literals, not the module's constants: a test computed from them would follow any change
      expect([RELAYER_QUOTE_TIMEOUT_MS, RELAYER_SUBMIT_TIMEOUT_MS, RELAYER_DEADLINE_MARGIN_MS]).toEqual([10_000, 120_000, 15_000]);
      await jest.advanceTimersByTimeAsync(24_999);
      expect(outcome).toEqual({quote: 'pending', submit: 'pending'});
      await jest.advanceTimersByTimeAsync(1);
      expect(outcome.quote).toBe('deadline');
      await jest.advanceTimersByTimeAsync(134_999 - 25_000);
      expect(outcome.submit).toBe('pending');
      await jest.advanceTimersByTimeAsync(1);
      expect(outcome.submit).toBe('deadline');
    } finally {
      jest.useRealTimers();
    }
  });
});
