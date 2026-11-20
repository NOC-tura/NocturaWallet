#!/usr/bin/env node
/**
 * Records how `react-native-ssl-pinning`'s NATIVE Android module calls back into JS, read from the
 * INSTALLED library's own source — not from our code — into a committed test fixture
 * (spec 2026-11-08 shielded A0 M1 §6.0; M1c Task 1: "`toRejectedResponse` against a recorded
 * `react-native-ssl-pinning` rejection object, taken from the library's source path").
 *
 * The three callbacks `RNSslPinningModule.fetch` makes (android/src/main/java/com/toyberman/
 * RNSslPinningModule.java):
 *   - a non-2xx answer: `callback.invoke(response, null)` — the response map as the ERROR argument
 *     (`!okHttpResponse.isSuccessful()`);
 *   - a 2xx answer:     `callback.invoke(null, response)`;
 *   - a transport / TLS failure (OkHttp `onFailure`, a pin mismatch included): `callback.invoke(
 *     e.getMessage())` — a STRING as the error argument, or null for an exception without a
 *     message (recorded too: `index.js` then throws inside the callback and never settles).
 * The response map is built by `response.putInt("status", …)`, `response.putString("bodyString",
 * …)` (no `responseType` option) and `response.putMap("headers", …)`, in that order.
 *
 * This script FINDS each of those statements in the source (each must occur exactly once; else it
 * refuses), records its line number and the sha256 of both library files (Java + the JS wrapper
 * `index.js`), and writes the three callbacks' argument lists for the test to replay. The test
 * checks the digests against node_modules, so an upgraded library turns it red until this is
 * re-run and the new fixture reviewed.
 *
 * The 400 body is the coordinator's answer to the control's malformed submit, from THEIR source
 * (`coordinator/src/services/relayerA0.js` at their f3f8eff: `invalid(error)` =
 * `res(400, 'invalid_request', {error})` → `{success: false, outcome: 'invalid_request', error}`,
 * the error of `validatePayload` for an unknown kind; Express `res.status(400).json(body)`) — a
 * transcription, cited, not a recording of the wire (the wire is the phone's line).
 *
 * No network, no third-party import. Run from the repository root:
 *   node scripts/a0-fixtures/record-ssl-pinning-callbacks.mjs [--force]
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '../..');
const LIB = 'node_modules/react-native-ssl-pinning';
const JAVA = `${LIB}/android/src/main/java/com/toyberman/RNSslPinningModule.java`;
const JS = `${LIB}/index.js`;
const OUT = 'src/modules/sslPinning/__tests__/fixtures/rn-ssl-pinning-callbacks.json';

const read = f => readFileSync(resolve(ROOT, f), 'utf8');
const sha256 = f => createHash('sha256').update(readFileSync(resolve(ROOT, f))).digest('hex');
const die = m => {
  console.error(`record-ssl-pinning-callbacks: ${m}`);
  process.exit(2);
};

/** The 1-based line of the one line containing `needle` (refuses 0 or 2+). */
function lineOf(text, file, needle) {
  const hits = text.split('\n').flatMap((l, i) => (l.includes(needle) ? [i + 1] : []));
  if (hits.length !== 1) {
    die(`${file}: expected exactly one line with ${JSON.stringify(needle)}, found ${hits.length}`);
  }
  return hits[0];
}

const java = read(JAVA);
const js = read(JS);
const version = JSON.parse(read(`${LIB}/package.json`)).version;
const at = {
  putStatus: lineOf(java, JAVA, 'response.putInt("status", okHttpResponse.code());'),
  putBody: lineOf(java, JAVA, 'response.putString("bodyString", stringResponse);'),
  putHeaders: lineOf(java, JAVA, 'response.putMap("headers", headers);'),
  isSuccessful: lineOf(java, JAVA, 'if (okHttpResponse.isSuccessful()) {'),
  success: lineOf(java, JAVA, 'callback.invoke(null, response);'),
  nonSuccess: lineOf(java, JAVA, 'callback.invoke(response, null);'),
  failure: lineOf(java, JAVA, 'callback.invoke(e.getMessage());'),
  jsStringReject: lineOf(js, JS, "if (err && typeof err != 'object') {"),
  jsReject: lineOf(js, JS, 'deferred.reject(data);'),
  jsResolve: lineOf(js, JS, 'deferred.resolve(data);'),
};
if (!(at.putStatus < at.putBody && at.putBody < at.putHeaders && at.putHeaders < at.isSuccessful && at.isSuccessful < at.success && at.success < at.nonSuccess)) {
  die(`the statements are not in the order this recording assumes: ${JSON.stringify(at)}`);
}

const json400 = JSON.stringify({ success: false, outcome: 'invalid_request', error: 'kind must be "transfer" or "withdraw_change"' });
const headers = { 'Content-Type': 'application/json; charset=utf-8' };
const fixture = {
  schema: 'noctura.rn-ssl-pinning-callbacks/1',
  library: 'react-native-ssl-pinning',
  version,
  sources: { [JAVA.slice(LIB.length + 1)]: sha256(JAVA), 'index.js': sha256(JS) },
  lines: at,
  note:
    'Each entry is the argument list RNSslPinningModule.fetch passes to its JS callback; a WritableMap arrives in JS as a plain object with its keys in put order. The 400 body is the coordinator\'s (relayerA0.js invalid(), their f3f8eff), transcribed.',
  callbacks: {
    nonSuccess400: { at: `RNSslPinningModule.java:${at.nonSuccess}`, args: [{ status: 400, bodyString: json400, headers }, null] },
    nonSuccess429Text: {
      at: `RNSslPinningModule.java:${at.nonSuccess}`,
      args: [{ status: 429, bodyString: 'Too many requests, please try again later.', headers: { 'Content-Type': 'text/html; charset=utf-8' } }, null],
    },
    success200: {
      at: `RNSslPinningModule.java:${at.success}`,
      args: [
        null,
        {
          status: 200,
          bodyString: JSON.stringify({
            programId: 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH',
            pool: '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT',
            mint: 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs',
            feePayer: '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe',
            maxFee: '100000',
            minFee: { transfer: '10000', withdraw_change: '10000' },
            gasGrantLamports: '3000000',
            validForSeconds: 60,
          }),
          headers,
        },
      ],
    },
    pinFailure: {
      at: `RNSslPinningModule.java:${at.failure}`,
      args: ['Certificate pinning failure!\n  Peer certificate chain:\n    sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=: CN=api.noc-tura.io'],
    },
    transportFailure: { at: `RNSslPinningModule.java:${at.failure}`, args: ['timeout'] },
    // an IOException whose getMessage() is null: the bridge passes JS a null error argument
    failureNullMessage: { at: `RNSslPinningModule.java:${at.failure}`, args: [null] },
  },
};

const out = resolve(ROOT, OUT);
if (existsSync(out) && !process.argv.includes('--force')) {
  die(`${OUT} exists (pass --force to re-record; a re-recording is reviewed as such)`);
}
writeFileSync(out, JSON.stringify(fixture, null, 2) + '\n');
console.log(`wrote ${OUT}: ${fixture.library} ${version}, ${Object.keys(fixture.callbacks).length} callbacks, lines ${JSON.stringify(at)}`);
