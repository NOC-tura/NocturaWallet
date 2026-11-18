/**
 * The `pinnedFetch` on-device positive control (spec 2026-11-08 shielded A0 M1 §6.0, I5; M1c's
 * first task — no outcome logic is written before its phone line passes). DEVNET BUILD ONLY.
 *
 * WHY ON THE PHONE. `pinnedFetch`'s non-2xx handling (`toRejectedResponse`) was fixed in JS
 * against the library's source, and Jest can only replay that source: whether the NATIVE module of
 * the installed `react-native-ssl-pinning` really hands a 400 back as a rejected object with its
 * `status` — and whether our pins match the live relayer host — only the phone shows. The relayer
 * client (Task 3) reads its twelve outcomes from exactly that object.
 *
 * WHAT IT DOES. On a desk-triggered action (the deep link `noctura://a0-pinned-control`, sent by
 * `scripts/m1c-checkpoint/m1c-checkpoint.mjs pinned-control`; see `useA0PinnedControlLink`), three
 * requests go out through the relayer transport, in this order, and each emits ONE readout line
 * (`checkpointReadout.ts` `readA0PinnedControl`):
 *   1. `submit`        — a deliberately malformed `POST ${API_BASE}/relayer/submit` (a JSON object
 *                        with an unknown `kind`) through `pinnedFetch`. PASS on the desk: it
 *                        RESOLVED (`threw: false`) with HTTP 400 and body `outcome: invalid_request`.
 *   2. `quote`         — `GET ${API_BASE}/relayer/quote` through `pinnedFetch`. PASS: 200 and a quote
 *                        whose shape parses (the desk judges its values against the pinned A0 facts).
 *   3. `submit-prefix` — the NEGATIVE control: request 1 again through the variant that maps the
 *                        rejection the PRE-FIX way (`pinnedFetchPreFixForDevnetControl`). It must
 *                        THROW with the status lost (`threw: true, lostStatus: true`); if it does
 *                        not, line 1 proves nothing.
 *
 * WHAT IT COSTS THE RELAYER. Nothing: the coordinator (their `relayerA0.js` `validatePayload`, at
 * their f3f8eff) refuses an unknown `kind` before it reads its key, Redis or the chain; the two
 * submits count against its rate limit (5 per minute per IP), the quote against its own (60).
 *
 * THE GATE. `a0ReadoutEnabled()` (FEATURES_SHIELDED=true + NETWORK=devnet, the devnet APK's
 * BuildConfig). The code is in both bundles; in the production build the gate is closed and NOTHING
 * is sent — not even a request whose answer is never read out.
 *
 * ONLY PUBLIC VALUES. The readout carries the URL (the public API base + a bare path), the status,
 * the outcome (one of the contract's twelve, else `unrecognised`), whether it threw, whether the
 * thrown message was exactly the pre-fix "[object Object]", whether it was a pin failure, and the
 * quote's public fields when each has its shape. Never a body text, an error message or a header.
 */
import {SSLPinningError, pinnedFetch, pinnedFetchPreFixForDevnetControl} from '../../sslPinning/pinnedFetch';
import {a0ReadoutEnabled, readA0PinnedControl} from './checkpointReadout';
import type {A0ReadoutOptions, A0ReadoutPinnedProbe} from './checkpointReadout';
import {relayerGetQuote, relayerPostSubmit, relayerUrl} from './relayerTransport';
import type {RelayerFetch, RelayerHttpResult, RelayerPath} from './relayerTransport';

/** The deep link the desk sends to the devnet app (no route: React Navigation ignores it). */
export const A0_PINNED_CONTROL_LINK = 'noctura://a0-pinned-control';

/**
 * The malformed submit: valid JSON (so the coordinator's JSON parser accepts it and its own
 * validation answers), an object, with a `kind` the contract does not have — the first check
 * after "is an object" in `validatePayload`. Carries nothing about this wallet.
 */
export const A0_PINNED_CONTROL_SUBMIT_BODY = '{"kind":"noctura-m1c-pinned-control"}';

/** The contract's twelve outcomes (relayer-a0-contract.md §1). */
export const A0_RELAYER_OUTCOMES = [
  'confirmed',
  'already_spent',
  'unconfirmed',
  'relay_failed',
  'invalid_request',
  'duplicate_in_flight',
  'budget_exceeded',
  'balance_too_low',
  'unavailable',
  'transfer_disabled',
  'relayer_disabled',
  'misconfigured',
] as const;

/** One probe's result — the readout's own type (`checkpointReadout.ts`), field by field. */
export type A0PinnedProbeResult = A0ReadoutPinnedProbe;
export type A0PinnedProbe = A0ReadoutPinnedProbe['probe'];
/** The quote's public fields, each present only in its shape (else the whole quote is null). */
export type A0PinnedQuoteFields = NonNullable<A0ReadoutPinnedProbe['quote']>;

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const U64_DEC = /^(0|[1-9][0-9]{0,19})$/;

function outcomeOf(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }
  const o = (body as {outcome?: unknown}).outcome;
  if (typeof o !== 'string') {
    return null;
  }
  return (A0_RELAYER_OUTCOMES as readonly string[]).includes(o) ? o : 'unrecognised';
}

/** The quote's shape (contract §3) — field by field; any field out of shape → null. */
export function quoteFieldsOf(body: unknown): A0PinnedQuoteFields | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }
  const b = body as Record<string, unknown>;
  const minFee = b.minFee as Record<string, unknown> | undefined;
  const key = (v: unknown) => (typeof v === 'string' && BASE58.test(v) ? v : null);
  const u64 = (v: unknown) => (typeof v === 'string' && U64_DEC.test(v) ? v : null);
  const programId = key(b.programId);
  const pool = key(b.pool);
  const mint = key(b.mint);
  const feePayer = key(b.feePayer);
  const maxFee = u64(b.maxFee);
  const minFeeTransfer = minFee && typeof minFee === 'object' ? u64(minFee.transfer) : null;
  const minFeeWithdrawChange = minFee && typeof minFee === 'object' ? u64(minFee.withdraw_change) : null;
  const grantGiven = b.gasGrantLamports !== undefined;
  const gasGrantLamports = grantGiven ? u64(b.gasGrantLamports) : null;
  const validForSeconds = Number.isInteger(b.validForSeconds) ? (b.validForSeconds as number) : null;
  if (
    !programId ||
    !pool ||
    !mint ||
    !feePayer ||
    !maxFee ||
    !minFeeTransfer ||
    !minFeeWithdrawChange ||
    (grantGiven && !gasGrantLamports) ||
    validForSeconds === null
  ) {
    return null;
  }
  return {programId, pool, mint, feePayer, maxFee, minFeeTransfer, minFeeWithdrawChange, gasGrantLamports, validForSeconds};
}

async function probe(
  name: A0PinnedProbe,
  url: string,
  send: () => Promise<RelayerHttpResult>,
): Promise<A0PinnedProbeResult> {
  try {
    const r = await send();
    return {
      probe: name,
      url,
      status: r.status,
      outcome: outcomeOf(r.body),
      threw: false,
      lostStatus: false,
      pinFailure: false,
      quote: name === 'quote' ? quoteFieldsOf(r.body) : null,
    };
  } catch (e) {
    // Reported, never swallowed: a pin failure (SSLPinningError) is its own field, and any throw
    // FAILS the positive lines on the desk.
    return {
      probe: name,
      url,
      status: null,
      outcome: null,
      threw: true,
      lostStatus: e instanceof Error && !(e instanceof SSLPinningError) && e.message === '[object Object]',
      pinFailure: e instanceof SSLPinningError,
      quote: null,
    };
  }
}

export interface A0PinnedControlDeps {
  /** default a0ReadoutEnabled() */
  enabled?: boolean;
  /** default pinnedFetch */
  fetchFixed?: RelayerFetch;
  /** default pinnedFetchPreFixForDevnetControl */
  fetchPreFix?: RelayerFetch;
  readout?: A0ReadoutOptions;
}

let inFlight = false;
let runs = 0;

/** TEST-ONLY */
export function resetA0PinnedControlForTests(): void {
  inFlight = false;
  runs = 0;
}

/**
 * Runs the three probes once and reads each out. Returns the results, or null when the gate is
 * closed (nothing sent) or a run is already in flight (one at a time).
 */
export async function runA0PinnedControl(deps: A0PinnedControlDeps = {}): Promise<A0PinnedProbeResult[] | null> {
  if (!(deps.enabled ?? a0ReadoutEnabled())) {
    return null;
  }
  if (inFlight) {
    return null;
  }
  inFlight = true;
  runs += 1;
  const run = runs;
  const fixed = deps.fetchFixed ?? pinnedFetch;
  const preFix = deps.fetchPreFix ?? pinnedFetchPreFixForDevnetControl;
  const readout = {enabled: true, ...deps.readout};
  try {
    const results: A0PinnedProbeResult[] = [];
    const steps: Array<[A0PinnedProbe, RelayerPath, () => Promise<RelayerHttpResult>]> = [
      ['submit', 'submit', () => relayerPostSubmit(A0_PINNED_CONTROL_SUBMIT_BODY, {fetchImpl: fixed})],
      ['quote', 'quote', () => relayerGetQuote({fetchImpl: fixed})],
      ['submit-prefix', 'submit', () => relayerPostSubmit(A0_PINNED_CONTROL_SUBMIT_BODY, {fetchImpl: preFix})],
    ];
    for (const [name, path, send] of steps) {
      let url = '';
      try {
        url = relayerUrl(path);
      } catch {
        // a refused base: `send` refuses it too and the line reads `threw: true`
      }
      // in order, one at a time (the relayer's rate limit)
      const r = await probe(name, url, send);
      results.push(r);
      readA0PinnedControl(run, r, readout);
    }
    return results;
  } finally {
    inFlight = false;
  }
}
