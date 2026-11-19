/**
 * `pinnedFetchDirect` (pinnedFetch.ts; M1c Task 1 review I1): the native SSL-pinning module called
 * directly — never through `react-native-ssl-pinning`'s `index.js` — so a message-less
 * `IOException` can never throw inside a native→JS callback (on a bridgeless RN 0.84 release build
 * that is most likely a process death, which no JS deadline can catch).
 *
 * Driven by the SAME recorded native argument lists `rnSslPinningLibrary.test.ts` replays through
 * the real npm wrapper (`fixtures/rn-ssl-pinning-callbacks.json`), but through a fake
 * `NativeModules.RNSslPinning` (`__testing__/fakeRNSslPinningNative.ts`) instead — `pinnedFetchDirect`
 * never imports the npm package, so mocking it would prove nothing here.
 *
 * THE CONTROL (review I1's ask: "keep a control showing the old wrapper path does throw"): the
 * SAME message-less argument list, replayed through the OLD npm-wrapped `pinnedFetch` in
 * `rnSslPinningLibrary.test.ts` ("a failure without a message NEVER settles"), still never settles.
 * This file's equivalent case settles at once — the two suites together are the before/after.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {__setRNSslPinningNativeForTests, pinnedFetchDirect, SSL_PINS, SSLPinningError} from '../pinnedFetch';
import {fakeNativeCalls, fakeRNSslPinningNative, resetFakeNative, setFakeNativeCallback} from '../__testing__/fakeRNSslPinningNative';

interface Recorded {
  callbacks: Record<string, {args: unknown[]}>;
}
const REC = JSON.parse(readFileSync(join(__dirname, 'fixtures/rn-ssl-pinning-callbacks.json'), 'utf8')) as Recorded;
const cb = (name: string) => REC.callbacks[name]!.args;
const URL = 'https://api.noc-tura.io/api/v1/relayer/submit';

beforeEach(() => {
  resetFakeNative();
  __setRNSslPinningNativeForTests(fakeRNSslPinningNative);
});
afterEach(() => {
  __setRNSslPinningNativeForTests(undefined);
});

it('a 2xx resolves with the status and body', async () => {
  setFakeNativeCallback(cb('success200'));
  const res = await pinnedFetchDirect(URL.replace('submit', 'quote'));
  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toMatchObject({validForSeconds: 60});
});

it('a non-2xx RESOLVES with its status (never a throw) — the same fix pinnedFetch proves over the wrapper', async () => {
  setFakeNativeCallback(cb('nonSuccess400'));
  const res = await pinnedFetchDirect(URL, {method: 'POST', body: '{"kind":"x"}'});
  expect(res.status).toBe(400);
  await expect(res.json()).resolves.toMatchObject({outcome: 'invalid_request'});
});

it('a pin failure (a string error naming the pin mismatch) throws SSLPinningError E004', async () => {
  setFakeNativeCallback(cb('pinFailure'));
  const err = await pinnedFetchDirect(URL).then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(SSLPinningError);
  expect((err as SSLPinningError).code).toBe('E004');
});

it('a transport failure (a string error, no pin wording) throws the plain Error, not E004', async () => {
  setFakeNativeCallback(cb('transportFailure'));
  const err = await pinnedFetchDirect(URL).then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(Error);
  expect(err).not.toBeInstanceOf(SSLPinningError);
  expect((err as Error).message).toBe('timeout');
});

it(
  'THE FIX: a failure with NO message (the one-argument callback invoke that makes the npm wrapper throw inside ' +
    'itself and never settle) now settles AT ONCE as a plain transport error',
  async () => {
    setFakeNativeCallback(cb('failureNullMessage'));
    const settled = await Promise.race([
      pinnedFetchDirect(URL).then(
        () => ({kind: 'resolved' as const}),
        (e: unknown) => ({kind: 'rejected' as const, error: e}),
      ),
      new Promise<{kind: 'pending'}>(r => setTimeout(() => r({kind: 'pending'}), 300)),
    ]);
    expect(settled.kind).toBe('rejected');
    const error = (settled as {error?: unknown}).error;
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(SSLPinningError);
    expect((error as Error).message).toMatch(/no message/);
  },
);

it('sends the same pins, method, headers (lower-cased) and timeout the native module would see via the wrapper', async () => {
  setFakeNativeCallback(cb('success200'));
  await pinnedFetchDirect(URL, {method: 'POST', body: '{}', timeoutMs: 42_000});
  const [call] = fakeNativeCalls();
  expect(call!.url).toBe(URL);
  expect(call!.options).toMatchObject({method: 'POST', body: '{}', pkPinning: true, timeoutInterval: 42_000});
  expect(call!.options.sslPinning).toEqual({certs: SSL_PINS});
  expect(call!.options.headers).toEqual({'content-type': 'application/json'});
});

it('refuses a non-https / www. URL before the native module is ever called (unchanged from pinnedFetch)', async () => {
  await expect(pinnedFetchDirect('http://api.noc-tura.io/x')).rejects.toBeInstanceOf(SSLPinningError);
  await expect(pinnedFetchDirect('https://www.noc-tura.io/x')).rejects.toBeInstanceOf(SSLPinningError);
  expect(fakeNativeCalls()).toHaveLength(0);
});

it('without an override, and with no real native module under Jest, it rejects rather than hanging', async () => {
  __setRNSslPinningNativeForTests(undefined);
  await expect(pinnedFetchDirect(URL)).rejects.toThrow(/not registered on this device/);
});
