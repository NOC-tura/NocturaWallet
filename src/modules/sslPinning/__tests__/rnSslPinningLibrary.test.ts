/**
 * `pinnedFetch` against the REAL `react-native-ssl-pinning` JS wrapper (spec §6.0; M1c Task 1).
 *
 * THE INDEPENDENT SIDE. The native module's callbacks are replayed from
 * `fixtures/rn-ssl-pinning-callbacks.json`, which `scripts/a0-fixtures/record-ssl-pinning-callbacks.mjs`
 * recorded from the library's own Android source (`RNSslPinningModule.java`) — never from our code
 * or our mock. The wrapper is the installed `index.js`, compiled and run as it is
 * (`__testing__/realSslPinning.ts`). The digests of both library files are pinned here: an upgraded
 * library turns this suite red until the fixture is re-recorded and reviewed.
 *
 * WHAT ONLY THE PHONE PROVES (the M1c checkpoint's `pinned-control` line): that the compiled native
 * module on the device behaves as its source says, that the bridge delivers the map as a plain
 * object, that our pins match the live host, and the relayer's real answer. This suite proves the
 * JS half of the chain against the recorded native half.
 */
import {createHash} from 'crypto';
import {readFileSync} from 'fs';
import {join} from 'path';

jest.mock('react-native-ssl-pinning', () =>
  jest.requireActual<typeof import('../__testing__/realSslPinning')>('../__testing__/realSslPinning').loadRealSslPinning(),
);

import {pinnedFetch, pinnedFetchPreFixForDevnetControl, SSLPinningError} from '../pinnedFetch';
import {nativeCalls, resetNative, setNativeCallback} from '../__testing__/realSslPinning';

interface Recorded {
  version: string;
  sources: Record<string, string>;
  callbacks: Record<string, {at: string; args: unknown[]}>;
}
const REC = JSON.parse(readFileSync(join(__dirname, 'fixtures/rn-ssl-pinning-callbacks.json'), 'utf8')) as Recorded;
const LIB = join(__dirname, '../../../../node_modules/react-native-ssl-pinning');
const sha256 = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex');
const URL = 'https://api.noc-tura.io/api/v1/relayer/submit';

beforeEach(() => resetNative());

describe('the recording is of the installed library', () => {
  it('version 1.6.0, and both source files are the recorded bytes', () => {
    expect(REC.version).toBe('1.6.0');
    expect(JSON.parse(readFileSync(join(LIB, 'package.json'), 'utf8')).version).toBe(REC.version);
    expect(Object.keys(REC.sources).sort()).toEqual(['android/src/main/java/com/toyberman/RNSslPinningModule.java', 'index.js']);
    for (const [file, digest] of Object.entries(REC.sources)) {
      expect(sha256(join(LIB, file))).toBe(digest);
    }
  });
  it('the non-2xx callback passes the response map as the ERROR argument (the recorded source line)', () => {
    const c = REC.callbacks.nonSuccess400!;
    expect(c.at).toBe('RNSslPinningModule.java:241');
    expect(c.args[1]).toBeNull();
    expect(Object.keys(c.args[0] as object)).toEqual(['status', 'bodyString', 'headers']);
  });
});

describe('pinnedFetch over the real wrapper', () => {
  it('a 400 RESOLVES with its status and the body the relayer sent (the fix, positive)', async () => {
    setNativeCallback(REC.callbacks.nonSuccess400!.args);
    const res = await pinnedFetch(URL, {method: 'POST', body: '{"kind":"x"}'});
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      success: false,
      outcome: 'invalid_request',
      error: 'kind must be "transfer" or "withdraw_change"',
    });
  });
  it('the wrapper really REJECTS the 400 (control: without our mapping the status is lost)', async () => {
    setNativeCallback(REC.callbacks.nonSuccess400!.args);
    await expect(pinnedFetchPreFixForDevnetControl(URL, {method: 'POST', body: '{}'})).rejects.toThrow(/^\[object Object\]$/);
  });
  it('the pre-fix variant passes a 2xx through unchanged (it differs only in the rejection mapping)', async () => {
    setNativeCallback(REC.callbacks.success200!.args);
    const res = await pinnedFetchPreFixForDevnetControl(URL.replace('submit', 'quote'));
    expect(res.status).toBe(200);
  });
  it('a 429 with a plain-text body resolves; its text is readable, its JSON is not', async () => {
    setNativeCallback(REC.callbacks.nonSuccess429Text!.args);
    const res = await pinnedFetch(URL, {method: 'POST', body: '{}'});
    expect(res.status).toBe(429);
    await expect(res.text()).resolves.toBe('Too many requests, please try again later.');
    await expect(res.json()).rejects.toThrow(SyntaxError);
  });
  it('a 200 resolves with the quote body', async () => {
    setNativeCallback(REC.callbacks.success200!.args);
    const res = await pinnedFetch(URL.replace('submit', 'quote'));
    expect(res.status).toBe(200);
    expect(((await res.json()) as {feePayer: string}).feePayer).toBe('3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe');
  });
  it('a pin failure (the failure callback, a STRING) throws SSLPinningError E004 — never a response', async () => {
    setNativeCallback(REC.callbacks.pinFailure!.args);
    const err = await pinnedFetch(URL).then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(SSLPinningError);
    expect((err as SSLPinningError).code).toBe('E004');
  });
  it('a transport failure throws the plain Error, not E004', async () => {
    setNativeCallback(REC.callbacks.transportFailure!.args);
    const err = await pinnedFetch(URL).then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(SSLPinningError);
    expect((err as Error).message).toBe('timeout');
  });
  it('a failure without a message NEVER settles (the library throws inside its callback) — why the transport has a deadline', async () => {
    setNativeCallback(REC.callbacks.failureNullMessage!.args);
    const settled = pinnedFetch(URL).then(
      () => 'resolved',
      () => 'rejected',
    );
    const after = await Promise.race([settled, new Promise(r => setTimeout(() => r('pending'), 200))]);
    expect(after).toBe('pending');
  });
  it('the wrapper hands the native module the pins and the timeout pinnedFetch asked for', async () => {
    setNativeCallback(REC.callbacks.success200!.args);
    await pinnedFetch(URL, {method: 'POST', body: '{}', timeoutMs: 120_000});
    const [call] = nativeCalls();
    expect(call!.url).toBe(URL);
    expect(call!.options).toMatchObject({method: 'POST', pkPinning: true, timeoutInterval: 120_000, body: '{}'});
    expect((call!.options.sslPinning as {certs: string[]}).certs).toHaveLength(3);
    // the wrapper lower-cases header names (no caseSensitiveHeaders)
    expect(call!.options.headers).toEqual({'content-type': 'application/json'});
  });
});
