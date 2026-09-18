// NAMESPACE import — react-native-ssl-pinning exports ONLY named members
// (`export { fetch, ... }`, no default). A default import resolves to `undefined`
// under Metro/Babel's commonjs interop, so `SSLPinning.fetch` threw on-device and
// every pinned call silently fell back. (The test mock's old default export hid this.)
import * as SSLPinning from 'react-native-ssl-pinning';

/**
 * SPKI public-key pins for api.noc-tura.io (SHA-256 of the SubjectPublicKeyInfo,
 * `sha256/<base64>` — OkHttp/AFNetworking format). OkHttp matches ANY certificate
 * in the cleaned chain — leaf, intermediate or root — and the first match ends the
 * check (CertificatePinner.check$okhttp, verified against okhttp 4.12.0).
 *
 * During the api-lineage transition we pin THREE: the leaf being served today, the
 * leaf that will be served after the cutover, and a spare key of our own. Three,
 * because the set matches if ANY pin does — which makes both the cutover and a
 * rollback safe without the release and the server change having to coincide.
 *
 * The spare was the Let's Encrypt
 * intermediate until 2026-09-16 and that was the bug: Let's Encrypt rotates its
 * intermediates, so the backup silently stopped matching at the 19 July renewal and
 * nothing said so for two months. A backup pin is only a backup if we hold the key.
 *
 * The server must renew with `--reuse-key`, or the leaf pin dies with the renewal.
 * If NO pin matches, every pinned call now FAILS LOUDLY (E004) — there is no
 * fallback path and there must not be one: a pin failure is an attack or a
 * misconfiguration, and both have to be seen.
 */
// Verified from the VPS 2026-06-18 (both MATCH the live cert). Server renews
// with reuse_key=True so the LEAF pin survives ~90-day Let's Encrypt renewals;
// the INTERMEDIATE is the backup. A systemd noc-pin-check.timer monitors these
// daily. RULE on rotation: update BOTH this array AND the server's
// scripts/check-ssl-pins.sh, and ship the new app version BEFORE the new cert.
export const SSL_PINS: string[] = [
  // [0] OUTGOING — the shared certificate api.noc-tura.io is served from today:
  // subject CN=noc-tura.io, SANs api./apex/www. One key for three names, which is
  // the problem being fixed: that lineage is renewed for reasons that have nothing
  // to do with the wallet (the website), and any renewal with a fresh key would
  // brick every installed wallet at once. DROP THIS PIN in the release AFTER the
  // server has cut over — not before, or a rollback has nothing to land on.
  'sha256/r6OlpjBVoTMRSS9o9JFTgtzC8KyrVYI6OAmKQGhf9Y8=',

  // [1] INCOMING — leaf of the new api-only certbot lineage (single SAN
  // api.noc-tura.io, ECDSA P-256, reuse_key=True). Issued 2026-09-18 14:36 UTC,
  // sitting on the VPS unused until the cutover. Derived here from the leaf PEM the
  // server side sent, not copied from their message: SPKI, SHA-256 fingerprint
  // DD:CE:40:98…F4:E6 and serial 054F1C10…8B31 all matched, and the certificate
  // carries its own SCTs (log C2:31:7E:57…, 2026-09-18 15:35:01 UTC), so publication
  // is provable from the object itself — crt.sh was two months behind for this domain.
  'sha256/FbxrIC2khOYPbi9JerRRSSxHeP/9JL32xyuszk2nmQ8=',

  // [2] BACKUP — a spare P-256 key we hold and have never deployed. Generated
  // 2026-09-18 inside the offline `vault` qube; it has never existed on a networked
  // machine and must never reach the VPS except during an actual emergency.
  // It replaces the previous spare (AUlTQGY2…uAo=), which spent ~2h on the
  // production VPS during the pin rehearsal. Nothing suggests that window was
  // abused — but a backup pin whose value rests on an assumption is not a backup,
  // and rotating it costs one key and one line.
  //
  // Before this: the pin here was the Let's Encrypt INTERMEDIATE, and it had not
  // matched since the 19 July renewal. Let's Encrypt rotates its intermediates, so
  // pinning one guarantees that outcome. A backup pin is only a backup if we hold
  // the key: if the live key is ever lost, we issue a certificate for THIS one and
  // every installed wallet keeps working with no release at all.
  'sha256/aAsfaKi1QNcO7yRHo8bUJ9ABhJIcSnHZZm766XwBmHM=',
];

interface PinnedFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  /**
   * Per-request timeout (ms). Default 10s suits price/RPC calls, but ZK proving
   * on the hosted prover (depth-20 circuits, cold-start proving-key loading) can
   * take tens of seconds — those callers pass a larger value so the request is
   * not killed mid-proof with a spurious "Network request failed" transport timeout.
   */
  timeoutMs?: number;
}

interface PinnedFetchResponse {
  status: number;
  headers: Record<string, string>;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

/**
 * For use inside a `catch` that degrades gracefully. A pin failure is never one of
 * the things worth degrading past: it means the certificate chain did not match what
 * this build pins, which is either an attack or a misconfiguration, and in both cases
 * the caller must learn about it rather than see an empty list.
 *
 * Added 2026-09-16 after measuring that the narrow-catch fix of 2026-08-09
 * (coordinatorClient.ts, d72ae5c) had been applied to ONE of seventeen call sites.
 * Two months of a stale backup pin went unnoticed because the two most-used screens
 * swallowed the failure and fell back to a third-party host.
 */
export function rethrowIfSSLPinningError(error: unknown): void {
  if (error instanceof SSLPinningError) {
    throw error;
  }
}

export class SSLPinningError extends Error {
  readonly code = 'E004';  // transport family, with NETWORK_OFFLINE / RPC_TIMEOUT.
  // Was E032 until 2026-09-16, which is PROVER_UNAVAILABLE — a pin failure reported
  // itself as a zero-knowledge outage to anything that read the code.
  readonly cause: Error;

  constructor(message: string, cause: Error) {
    super(message);
    this.name = 'SSLPinningError';
    this.cause = cause;
  }
}

/**
 * SSL-pinned fetch wrapper for Noctura API calls.
 * All requests to api.noc-tura.io MUST go through this function.
 * On pin failure → throws SSLPinningError (E004).
 */
/**
 * Recognise the rejected-but-valid HTTP response the pinning library hands back
 * for non-2xx, and normalise it into a PinnedFetchResponse. Returns null for
 * anything that is a genuine failure (pin mismatch, DNS, timeout).
 */
function toRejectedResponse(error: unknown): PinnedFetchResponse | null {
  if (error instanceof Error || typeof error !== 'object' || error === null) return null;
  const candidate = error as {
    status?: unknown;
    headers?: unknown;
    bodyString?: unknown;
  };
  if (typeof candidate.status !== 'number') return null;

  const body = typeof candidate.bodyString === 'string' ? candidate.bodyString : '';
  return {
    status: candidate.status,
    headers: (candidate.headers as Record<string, string>) ?? {},
    json: async () => JSON.parse(body),
    text: async () => body,
  };
}

/**
 * OkHttp's CertificatePinner begins with `findMatchingPins(hostname)` and, when
 * that is empty, RETURNS WITHOUT CHECKING — the call succeeds, unpinned, and looks
 * identical to a pinned one. Two URL shapes land there:
 *
 *  - `www.<host>`: react-native-ssl-pinning registers the pins under the host with
 *    a leading `www.` removed (RNSslPinningModule.getDomainName:125) while OkHttp
 *    looks them up under the full host, so no pattern matches.
 *  - `http://`: no TLS, so there is no chain to pin in the first place.
 *
 * Refused here, before the request leaves, because the failure mode they produce is
 * indistinguishable from success at every layer above.
 */
function assertPinningCanApply(url: string): void {
  const host = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)/i.exec(url);
  const scheme = host?.[1]?.toLowerCase();
  const authority = host?.[2]?.toLowerCase() ?? '';
  if (scheme !== 'https') {
    throw new SSLPinningError(
      `Refusing to send a pinned request over ${scheme ?? 'an unknown scheme'}: ` +
        'without TLS there is no certificate chain to pin.',
      new Error(`non-https URL: ${url}`),
    );
  }
  if (authority.startsWith('www.')) {
    throw new SSLPinningError(
      'Refusing a `www.` host: the pinning library would register the pins under ' +
        'the stripped host and OkHttp would find none, leaving the call unpinned.',
      new Error(`www host: ${url}`),
    );
  }
}

export async function pinnedFetch(
  url: string,
  options: PinnedFetchOptions = {},
): Promise<PinnedFetchResponse> {
  assertPinningCanApply(url);

  const {method = 'GET', headers = {}, body, timeoutMs = 10_000} = options;

  const mergedHeaders: Record<string, string> = {...headers};
  if (body && !mergedHeaders['Content-Type']) {
    mergedHeaders['Content-Type'] = 'application/json';
  }

  try {
    const response = await SSLPinning.fetch(url, {
      method,
      headers: mergedHeaders,
      body,
      pkPinning: true,
      sslPinning: {
        certs: SSL_PINS,
      },
      timeoutInterval: timeoutMs,
    });

    return {
      status: response.status,
      headers: response.headers as Record<string, string>,
      json: async () => response.json(),
      text: async () => response.text(),
    };
  } catch (error) {
    // react-native-ssl-pinning REJECTS on every non-2xx: the native module
    // invokes the callback with the response as the ERROR argument whenever
    // `!okHttpResponse.isSuccessful()` (RNSslPinningModule.java:238-241), and
    // the JS wrapper then does `deferred.reject(data)` with a plain object
    // (index.js:43). Converting that to `new Error(String(error))` stringified
    // it to "[object Object]" and DESTROYED the status code — which made
    // relayerSubmit's entire 409/429/502/503 machine unreachable on device,
    // including the "already landed vs input-spent-elsewhere" disambiguation.
    // A transfer that DID land was reported as a failure, so its input note was
    // never marked spent and the local balance inflated permanently.
    //
    // A rejected RESPONSE is not an error condition for this wrapper — hand it
    // back like any other response and let the caller branch on the status.
    const asResponse = toRejectedResponse(error);
    if (asResponse) return asResponse;

    const cause = error instanceof Error ? error : new Error(String(error));
    const message = cause.message.toLowerCase();
    // Differentiate SSL pin failures from network errors
    if (
      message.includes('ssl') ||
      message.includes('pin') ||
      message.includes('certificate') ||
      message.includes('trust')
    ) {
      throw new SSLPinningError('SSL certificate pinning failed', cause);
    }
    // Re-throw transport errors (timeout, DNS, etc.) without wrapping as E004
    throw cause;
  }
}
