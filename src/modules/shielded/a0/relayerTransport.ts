/**
 * The A0 relayer's transport (spec 2026-11-08 shielded A0 M1 §6.0, §1 "Relayer"): the two
 * endpoints of the frozen contract (`relayer-a0-contract.md`), reached through `pinnedFetch`
 * and handed back as `{status, body}` FOR EVERY STATUS — the contract puts the outcome in the
 * body as well as the HTTP status, so a 400 / 409 / 429 / 502 / 503 / 500 is an answer to read,
 * never an exception. Only what is not an HTTP answer throws: a pin failure (`SSLPinningError`,
 * E004), DNS, a timeout, a refused URL (`E_A0_RELAYER_URL`), the JS deadline (`E_A0_RELAYER_DEADLINE`).
 *
 * WHAT THIS IS NOT. It does not interpret a body: the quote's validation, the submit payload and
 * the twelve outcomes are the relayer client's (M1c Task 3), built on this. A body that is not
 * JSON (a proxy's HTML page, the rate limiter's plain-text 429) is `body: null` — never guessed.
 *
 * THE URL (§6.0). `API_BASE` already ends in `/v1` (`https://api.noc-tura.io/api/v1` in the
 * builds' env files), so the paths are appended bare: `${API_BASE}/relayer/quote`, never
 * `${API_BASE}/v1/relayer/…` (memory: eleven call sites once doubled it to `/v1/v1/`). The base is
 * checked on every call, so a base that does not end in `/v1` — or that does, twice — refuses
 * before anything is sent.
 *
 * PROVEN ON THE PHONE before any outcome logic is written: `pinnedControl.ts` (devnet build only)
 * sends a deliberately malformed submit and a quote through exactly this code and reads the
 * answers out for the M1c checkpoint (`scripts/m1c-checkpoint/`).
 */
import {API_BASE} from '../../../constants/programs';
import {pinnedFetch} from '../../sslPinning/pinnedFetch';
import type {PinnedFetchOptions, PinnedFetchResponse} from '../../sslPinning/pinnedFetch';

export type RelayerPath = 'quote' | 'submit';

/** The answer of one relayer request: its HTTP status and its body as JSON (null: not JSON). */
export interface RelayerHttpResult {
  status: number;
  body: unknown;
}

/** The request function under the transport (default `pinnedFetch`; the devnet control swaps it). */
export type RelayerFetch = (url: string, options?: PinnedFetchOptions) => Promise<PinnedFetchResponse>;

/** `GET /relayer/quote` answers at once; the default 10 s of `pinnedFetch`. */
export const RELAYER_QUOTE_TIMEOUT_MS = 10_000;
/**
 * `POST /relayer/submit` answers after the relayer's `confirmTransaction` (contract §1: `confirmed`
 * means landed), which waits up to the blockhash's expiry (~60–90 s on devnet). 120 s keeps a
 * forwarded tx's answer from being cut off; a timeout here is NOT a "not forwarded" (Task 3/7
 * treat it as `unconfirmed` without a signature and reconcile through the sync).
 */
export const RELAYER_SUBMIT_TIMEOUT_MS = 120_000;

export class A0RelayerUrlError extends Error {
  readonly code = 'E_A0_RELAYER_URL';
  constructor(message: string) {
    super(message);
    this.name = 'A0RelayerUrlError';
  }
}

/**
 * `${base}/relayer/${path}` — the base must be an https URL ending in exactly one `/v1` with no
 * trailing slash (`…/api/v1` in the builds, `…/v1` in Jest's config mock).
 */
export function relayerUrl(path: RelayerPath, base: string = API_BASE): string {
  if (path !== 'quote' && path !== 'submit') {
    throw new A0RelayerUrlError(`unknown relayer path ${String(path)}`);
  }
  if (typeof base !== 'string' || !/^https:\/\/[^/?#\s]+(\/[^?#\s]*)?$/.test(base)) {
    throw new A0RelayerUrlError('the API base is not an https URL');
  }
  if (!base.endsWith('/v1') || /\/v1\/v1$/.test(base)) {
    throw new A0RelayerUrlError('the API base must end in exactly one /v1 (paths are appended bare)');
  }
  return `${base}/relayer/${path}`;
}

/**
 * A JS-side deadline over the whole request, beyond the native per-phase timeouts. Measured in the
 * library's source (`react-native-ssl-pinning` 1.6.0): a transport failure is passed to JS as
 * `callback.invoke(e.getMessage())`, and an `IOException` without a message makes that `null` —
 * `index.js` then throws a TypeError inside the native callback and its promise NEVER settles
 * (`rnSslPinningLibrary.test.ts` replays it). OkHttp's connect / read / write timeouts do not bound
 * a slow trickle either. So every relayer request races this deadline: the native timeout + 15 s.
 */
export const RELAYER_DEADLINE_MARGIN_MS = 15_000;

export class A0RelayerDeadlineError extends Error {
  readonly code = 'E_A0_RELAYER_DEADLINE';
  constructor(ms: number) {
    super(`the relayer request did not settle within ${ms} ms`);
    this.name = 'A0RelayerDeadlineError';
  }
}

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new A0RelayerDeadlineError(ms)), ms);
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

/** Per call: the request function, the API base, the deadline (all defaulted for the app). */
export interface RelayerRequestOptions {
  /** default `pinnedFetch` (the devnet control passes the pre-fix variant) */
  fetchImpl?: RelayerFetch;
  /** default `API_BASE` */
  base?: string;
  /** default: the request's native timeout + RELAYER_DEADLINE_MARGIN_MS */
  deadlineMs?: number;
}

async function bodyOf(response: PinnedFetchResponse): Promise<unknown> {
  const text = await response.text();
  if (typeof text !== 'string' || text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function request(
  path: RelayerPath,
  init: PinnedFetchOptions & {timeoutMs: number},
  o: RelayerRequestOptions,
): Promise<RelayerHttpResult> {
  const url = relayerUrl(path, o.base ?? API_BASE);
  const fetchImpl = o.fetchImpl ?? pinnedFetch;
  const deadlineMs = o.deadlineMs ?? init.timeoutMs + RELAYER_DEADLINE_MARGIN_MS;
  return withDeadline(
    (async () => {
      const response = await fetchImpl(url, init);
      return {status: response.status, body: await bodyOf(response)};
    })(),
    deadlineMs,
  );
}

/** `GET ${API_BASE}/relayer/quote` → `{status, body}` for every status. */
export function relayerGetQuote(o: RelayerRequestOptions = {}): Promise<RelayerHttpResult> {
  return request('quote', {method: 'GET', headers: {Accept: 'application/json'}, timeoutMs: RELAYER_QUOTE_TIMEOUT_MS}, o);
}

/** `POST ${API_BASE}/relayer/submit` with a JSON text → `{status, body}` for every status. */
export function relayerPostSubmit(jsonBody: string, o: RelayerRequestOptions = {}): Promise<RelayerHttpResult> {
  return request(
    'submit',
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Accept: 'application/json'},
      body: jsonBody,
      timeoutMs: RELAYER_SUBMIT_TIMEOUT_MS,
    },
    o,
  );
}
