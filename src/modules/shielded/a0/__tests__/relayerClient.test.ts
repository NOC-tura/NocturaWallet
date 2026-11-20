/**
 * The relayer client's rules (spec §6.4 quote, §6.7 submit and re-quote, §6.8 outcomes, R5, R6;
 * contract §1 / §3): the quote's validation bound by bound, the twelve outcomes × every HTTP status
 * the contract uses, and the submit end to end over `pinnedFetchDirect`
 * (Task 1's recorded native callbacks through the fake `NativeModules.RNSslPinning`, which
 * `pinnedFetchDirect` calls directly).
 *
 * The expected table below is written from contract §1, not imported from the module.
 */
import {readFileSync} from 'fs';
import {join} from 'path';

jest.mock('@solana/web3.js', () =>
  jest.requireActual<typeof import('../__testing__/realWeb3')>('../__testing__/realWeb3').loadRealWeb3(),
);

import {API_BASE} from '../../../../constants/programs';
import {__setRNSslPinningNativeForTests} from '../../../sslPinning/pinnedFetch';
import {
  fakeNativeCalls as nativeCalls,
  fakeRNSslPinningNative,
  resetFakeNative as resetNative,
  setFakeNativeCallback as setNativeCallback,
  setFakeNativeResponder as setNativeResponder,
} from '../../../sslPinning/__testing__/fakeRNSslPinningNative';
import {A0_RELAYER_OUTCOMES} from '../pinnedControl';
import {
  A0_RELAYER_OUTCOME_TABLE,
  a0QuoteExpired,
  a0QuoteTermsUnchanged,
  a0SubmitDisposition,
  fetchA0RelayerQuote,
  interpretA0SubmitAnswer,
  isA0TxSignature,
  parseA0RelayerQuote,
  submitA0WithdrawChange,
} from '../relayerClient';
import type {A0QuoteContext, A0RelayerQuote, A0RentRpc, A0SubmitResult, A0WithdrawChangePayload} from '../relayerClient';

const REC = JSON.parse(
  readFileSync(join(__dirname, '../../../sslPinning/__tests__/fixtures/rn-ssl-pinning-callbacks.json'), 'utf8'),
) as {callbacks: Record<string, {args: unknown[]}>};
const cb = (name: string) => REC.callbacks[name]!.args;
/** A native callback with this status and JSON body (the recorded map shape). */
const reply = (status: number, body: unknown) =>
  status >= 200 && status < 300
    ? [null, {status, bodyString: JSON.stringify(body), headers: {}}]
    : [{status, bodyString: JSON.stringify(body), headers: {}}, null];

const GOLDEN = JSON.parse(readFileSync(join(__dirname, 'fixtures/relayer-a0-golden-vectors.json'), 'utf8')) as {
  relayerLandedP1P2: {vectors: {withdraw_change: {landedSignature: string; payload: A0WithdrawChangePayload}}};
};
const SIG = GOLDEN.relayerLandedP1P2.vectors.withdraw_change.landedSignature;
const PAYLOAD = GOLDEN.relayerLandedP1P2.vectors.withdraw_change.payload;

/** The live quote (ICO state file "P1 + P2 LIVE"; maxFee 100,000 from the pool). */
const QUOTE = {
  programId: 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH',
  pool: '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT',
  mint: 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs',
  feePayer: '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe',
  maxFee: '100000',
  minFee: {transfer: '10000', withdraw_change: '10000'},
  gasGrantLamports: '3000000',
  validForSeconds: 60,
};
/** devnet getMinimumBalanceForRentExemption(0), measured 2026-11-17 18:48 UTC → floor 655,240. */
const RENT = 650_240n;
const ctx: A0QuoteContext = {fetchedAtMs: 1_000, rentExemptZeroLamports: RENT};
const GOBAM = 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd'; // a valid key, not the relayer

const parse = (body: unknown, c = ctx) => () => parseA0RelayerQuote(body, c);
const without = (k: string) => Object.fromEntries(Object.entries(QUOTE).filter(([key]) => key !== k));

beforeEach(() => {
  resetNative();
  __setRNSslPinningNativeForTests(fakeRNSslPinningNative);
});
afterEach(() => {
  __setRNSslPinningNativeForTests(undefined);
});

// ------------------------------------------------------------------------------ the quote

describe('the quote (§6.4)', () => {
  it('the live quote: fee = exactly minFee.withdraw_change (R5), the grant held to rent(0) + 5,000, the fetch time kept', () => {
    expect(parseA0RelayerQuote(QUOTE, ctx)).toEqual({
      programId: QUOTE.programId,
      pool: QUOTE.pool,
      mint: QUOTE.mint,
      feePayer: QUOTE.feePayer,
      maxFee: 100_000n,
      minFee: {transfer: 10_000n, withdrawChange: 10_000n},
      gasGrantLamports: 3_000_000n,
      validForSeconds: 60,
      fee: 10_000n,
      grantFloorLamports: 655_240n,
      fetchedAtMs: 1_000,
    });
  });
  it('the fee is minFee.withdraw_change, never minFee.transfer', () => {
    const q = parseA0RelayerQuote({...QUOTE, minFee: {transfer: '20000', withdraw_change: '10000'}}, ctx);
    expect(q.fee).toBe(10_000n);
    expect(q.minFee).toEqual({transfer: 20_000n, withdrawChange: 10_000n});
  });
  it('no gasGrantLamports: a quote without a grant (the fresh option disabled, S11), no rent needed', () => {
    const q = parseA0RelayerQuote(without('gasGrantLamports'), {fetchedAtMs: 0, rentExemptZeroLamports: null});
    expect(q.gasGrantLamports).toBeNull();
    expect(q.grantFloorLamports).toBeNull();
  });
  it.each([
    ['programId', {...QUOTE, programId: 'Stake11111111111111111111111111111111111111'}],
    ['pool', {...QUOTE, pool: QUOTE.mint}],
    ['mint', {...QUOTE, mint: QUOTE.pool}],
  ])('a foreign %s → E_A0_QUOTE_FOREIGN', (_k, body) => {
    expect(parse(body)).toThrow(expect.objectContaining({code: 'E_A0_QUOTE_FOREIGN'}));
  });
  it('a fee payer that is a valid key but not the pinned relayer → E_A0_QUOTE_FEE_PAYER (ruling 9)', () => {
    expect(parse({...QUOTE, feePayer: GOBAM})).toThrow(expect.objectContaining({code: 'E_A0_QUOTE_FEE_PAYER'}));
  });
  it('minFee.withdraw_change above maxFee → E_A0_QUOTE_FEE_ABOVE_MAX with a clear message; equal passes', () => {
    expect(parse({...QUOTE, maxFee: '9999'})).toThrow(
      expect.objectContaining({code: 'E_A0_QUOTE_FEE_ABOVE_MAX', message: expect.stringContaining('above the pool')}),
    );
    expect(parseA0RelayerQuote({...QUOTE, maxFee: '10000'}, ctx).fee).toBe(10_000n);
  });
  it('the grant’s bounds: floor − 1 refused, floor and ceiling pass, ceiling + 1 refused (E_A0_QUOTE_GRANT)', () => {
    const g = (v: string) => parse({...QUOTE, gasGrantLamports: v});
    expect(g('655239')).toThrow(expect.objectContaining({code: 'E_A0_QUOTE_GRANT'}));
    expect(g('655240')).not.toThrow();
    expect(g('50000000')).not.toThrow();
    expect(g('50000001')).toThrow(expect.objectContaining({code: 'E_A0_QUOTE_GRANT'}));
    // the floor follows the chain, not a pinned number: at the contract's old rent (890,880) 895,879 refuses
    expect(parse({...QUOTE, gasGrantLamports: '895879'}, {fetchedAtMs: 0, rentExemptZeroLamports: 890_880n})).toThrow(
      expect.objectContaining({code: 'E_A0_QUOTE_GRANT'}),
    );
  });
  it('a grant without the cluster rent → E_A0_QUOTE_RENT (never checked against nothing)', () => {
    expect(parse(QUOTE, {fetchedAtMs: 0, rentExemptZeroLamports: null})).toThrow(
      expect.objectContaining({code: 'E_A0_QUOTE_RENT'}),
    );
  });
  it.each([
    ['maxFee with a leading zero', {...QUOTE, maxFee: '0100000'}],
    ['maxFee negative', {...QUOTE, maxFee: '-1'}],
    ['maxFee as a number', {...QUOTE, maxFee: 100000}],
    ['maxFee in exponent form', {...QUOTE, maxFee: '1e5'}],
    ['maxFee = 2^64', {...QUOTE, maxFee: '18446744073709551616'}],
    ['minFee.withdraw_change with a plus sign', {...QUOTE, minFee: {transfer: '10000', withdraw_change: '+10000'}}],
    ['minFee without withdraw_change', {...QUOTE, minFee: {transfer: '10000'}}],
    ['minFee with an extra kind', {...QUOTE, minFee: {...QUOTE.minFee, deposit: '1'}}],
    ['gasGrantLamports as a number', {...QUOTE, gasGrantLamports: 3000000}],
    ['validForSeconds 0', {...QUOTE, validForSeconds: 0}],
    ['validForSeconds 61', {...QUOTE, validForSeconds: 61}],
    ['validForSeconds 1.5', {...QUOTE, validForSeconds: 1.5}],
    ['validForSeconds as a string', {...QUOTE, validForSeconds: '60'}],
    ['a key the contract does not list', {...QUOTE, grantOnlyIf: 'x'}],
    ['an array', [QUOTE]],
    ['null', null],
  ])('%s → E_A0_QUOTE_INVALID', (_w, body) => {
    expect(parse(body)).toThrow(expect.objectContaining({code: 'E_A0_QUOTE_INVALID'}));
  });
  it('2^64 − 1 is a u64 (the bound is inclusive)', () => {
    expect(parseA0RelayerQuote({...QUOTE, maxFee: '18446744073709551615'}, ctx).maxFee).toBe(18446744073709551615n);
  });
});

describe('fetchA0RelayerQuote: over the pinned transport, rent read only for a grant', () => {
  const rentRpc = (value: unknown = 650240) => {
    const calls: unknown[][] = [];
    const rpc = {
      getMinimumBalanceForRentExemption: (...a: unknown[]) => {
        calls.push(a);
        return value instanceof Error ? Promise.reject(value) : Promise.resolve(value);
      },
    } as unknown as A0RentRpc;
    return {rpc, calls};
  };
  it('GET …/relayer/quote; one rent(0) request; fetchedAtMs = when the answer arrived', async () => {
    setNativeCallback(reply(200, QUOTE));
    const {rpc, calls} = rentRpc();
    // the clock reads how many requests had gone out when it was asked: 1 = after the answer
    const q = await fetchA0RelayerQuote(rpc, {now: () => nativeCalls().length * 1000 + calls.length});
    expect(nativeCalls().map(c => c.url)).toEqual([`${API_BASE}/relayer/quote`]);
    expect(calls).toEqual([[0]]);
    expect(q.fetchedAtMs).toBe(1000); // after the quote's answer, before the rent request
    expect(q.grantFloorLamports).toBe(655_240n);
  });
  it('a quote without a grant makes no RPC request', async () => {
    setNativeCallback(reply(200, without('gasGrantLamports')));
    const {rpc, calls} = rentRpc();
    expect((await fetchA0RelayerQuote(rpc)).gasGrantLamports).toBeNull();
    expect(calls).toEqual([]);
  });
  it.each([
    ['a 503 with its outcome', reply(503, {success: false, outcome: 'transfer_disabled'}), /503 \(transfer_disabled\)/],
    ['the plain-text 429 (body null)', cb('nonSuccess429Text'), /429 \(no outcome\)/],
    ['a transport failure', cb('transportFailure'), /not reached/],
    ['a pin failure', cb('pinFailure'), /not reached/],
  ])('%s → E_A0_QUOTE_UNAVAILABLE (no fallback, R6)', async (_w, args, msg) => {
    setNativeCallback(args);
    const {rpc, calls} = rentRpc();
    await expect(fetchA0RelayerQuote(rpc)).rejects.toMatchObject({code: 'E_A0_QUOTE_UNAVAILABLE', message: expect.stringMatching(msg)});
    expect(calls).toEqual([]);
  });
  it.each([
    ['the request fails', new Error('429 Too Many Requests')],
    ['it answers zero', 0],
    ['it answers a string', '650240'],
    ['it answers a fraction', 650240.5],
  ])('rent(0): %s → E_A0_QUOTE_RENT', async (_w, value) => {
    setNativeCallback(reply(200, QUOTE));
    await expect(fetchA0RelayerQuote(rentRpc(value).rpc)).rejects.toMatchObject({code: 'E_A0_QUOTE_RENT'});
  });
  it('a refused API base throws E_A0_RELAYER_URL (a build error, not "unavailable")', async () => {
    await expect(fetchA0RelayerQuote(rentRpc().rpc, {transport: {base: 'https://api.noc-tura.io/api'}})).rejects.toMatchObject({
      code: 'E_A0_RELAYER_URL',
    });
  });
});

describe('the re-quote rule (§6.7)', () => {
  const q = parseA0RelayerQuote(QUOTE, ctx); // fetched at 1,000 ms, valid 60 s
  it('expired from validForSeconds on (≥ 60,000 ms), not one ms before', () => {
    expect(a0QuoteExpired(q, 1_000 + 59_999)).toBe(false);
    expect(a0QuoteExpired(q, 1_000 + 60_000)).toBe(true);
  });
  it('the terms the user approved: fee, fee payer, grant (or its absence) — each change counts', () => {
    const same = parseA0RelayerQuote({...QUOTE, maxFee: '90000'}, {...ctx, fetchedAtMs: 99_999});
    expect(a0QuoteTermsUnchanged(q, same)).toBe(true);
    const variants: A0RelayerQuote[] = [
      {...q, fee: 10_001n},
      {...q, feePayer: GOBAM},
      {...q, gasGrantLamports: 3_000_001n},
      {...q, gasGrantLamports: null},
    ];
    for (const v of variants) {
      expect(a0QuoteTermsUnchanged(q, v)).toBe(false);
    }
  });
});

// ------------------------------------------------------------------------------ the outcomes

/** Contract §1, written out: outcome → HTTP status, and whether txSignature is present. */
const CONTRACT: Array<[string, number, 'always' | 'optional' | 'never']> = [
  ['confirmed', 200, 'always'],
  ['already_spent', 409, 'optional'],
  ['unconfirmed', 502, 'always'],
  ['relay_failed', 502, 'optional'],
  ['invalid_request', 400, 'never'],
  ['duplicate_in_flight', 429, 'never'],
  ['budget_exceeded', 429, 'never'],
  ['balance_too_low', 503, 'never'],
  ['unavailable', 503, 'never'],
  ['transfer_disabled', 503, 'never'],
  ['relayer_disabled', 503, 'never'],
  ['misconfigured', 500, 'never'],
];
const STATUSES = [200, 400, 409, 429, 500, 502, 503];
/** The outcomes that can follow a forward (contract §1: signature always / optional). */
const FORWARD_CAPABLE = ['confirmed', 'unconfirmed', 'relay_failed', 'already_spent'];
/**
 * R1-C1 (amended): what an answer that cannot be read (and claims no forward) is. Only a 4xx other
 * than 409 — refused before anything was forwarded — is "not forwarded"; a 409 (`already_spent` is
 * the one 4xx the contract lets follow a forward), a 200 and every 5xx are `unknown`. A parseable
 * body that names a forward-capable outcome is `unknown` at any status that does not match it.
 */
const UNREADABLE = (status: number, named?: string) =>
  status >= 400 && status < 500 && status !== 409 && !(named !== undefined && FORWARD_CAPABLE.includes(named))
    ? {outcome: 'relay_failed', status, forwarded: false, txSignature: null, recognised: false}
    : {outcome: 'unknown', status, forwarded: 'unknown', txSignature: null, cause: 'unreadable'};

describe('the twelve outcomes (contract §1)', () => {
  it('the module’s table is the contract’s, in the order of Task 1’s list', () => {
    expect(Object.keys(A0_RELAYER_OUTCOME_TABLE)).toEqual([...A0_RELAYER_OUTCOMES]);
    expect(Object.entries(A0_RELAYER_OUTCOME_TABLE).map(([o, r]) => [o, r.status, r.signature])).toEqual(CONTRACT);
  });

  describe.each(CONTRACT)('%s (%i, signature %s)', (outcome, status, signature) => {
    const body = (withSig: boolean) => ({success: status === 200, outcome, ...(withSig ? {txSignature: SIG} : {})});
    const allowed = signature === 'never' ? [false] : signature === 'always' ? [true] : [false, true];

    it.each(allowed)('read at its own status (txSignature present: %s)', withSig => {
      const r = interpretA0SubmitAnswer({status, body: body(withSig)});
      expect(r.outcome).toBe(outcome);
      expect(r.txSignature).toBe(withSig ? SIG : null);
      // R2-N1: the generic relay_failed with no signature is NOT "not forwarded" — it is unknown.
      expect(r.forwarded).toBe(outcome === 'relay_failed' && !withSig ? 'unknown' : withSig);
      expect(r.status).toBe(status);
    });

    it.each(STATUSES.filter(s => s !== status))('at %i it is not believed (outcome and status disagree)', other => {
      for (const withSig of [false, true]) {
        const r = interpretA0SubmitAnswer({status: other, body: body(withSig)});
        if (withSig) {
          expect(r).toEqual({outcome: 'unknown', status: other, forwarded: 'unknown', txSignature: SIG, cause: 'unreadable'});
        } else {
          expect(r).toEqual(UNREADABLE(other, outcome));
        }
      }
    });

    if (signature === 'always') {
      it('without its txSignature it is not believed → unreadable at its status (R1-C1: a non-4xx is unknown)', () => {
        expect(interpretA0SubmitAnswer({status, body: body(false)})).toEqual(UNREADABLE(status, outcome));
      });
    }
    if (signature === 'never') {
      it('WITH a txSignature it claims a forward → unknown (reconcile), never "not forwarded"', () => {
        const r = interpretA0SubmitAnswer({status, body: body(true)});
        expect(r).toEqual({outcome: 'unknown', status, forwarded: 'unknown', txSignature: SIG, cause: 'unreadable'});
        expect(a0SubmitDisposition(r)).toBe('reconcile');
      });
    }
  });

  it('dispositions (§6.8): confirmed → verify; unconfirmed / already_spent / any relay_failed (with or without a signature, R2-N1) → reconcile; the eight refusals → not-forwarded', () => {
    const d = (status: number, b: Record<string, unknown>) => a0SubmitDisposition(interpretA0SubmitAnswer({status, body: b}));
    expect(d(200, {outcome: 'confirmed', txSignature: SIG})).toBe('verify');
    expect(d(502, {outcome: 'unconfirmed', txSignature: SIG})).toBe('reconcile');
    expect(d(409, {outcome: 'already_spent', txSignature: SIG})).toBe('reconcile');
    expect(d(409, {outcome: 'already_spent'})).toBe('reconcile');
    expect(d(502, {outcome: 'relay_failed', txSignature: SIG})).toBe('reconcile');
    // R2-N1 / R3-N4: a readable signature-less generic relay_failed is reconciled (Task 7 re-syncs once
    // and reverts only when the tx can provably never land); it is never "not-forwarded" here.
    expect(d(502, {outcome: 'relay_failed'})).toBe('reconcile');
    for (const [o, s, sig] of CONTRACT) {
      if (sig === 'never') {
        expect(d(s, {outcome: o})).toBe('not-forwarded');
      }
    }
  });

  it('already_spent: alreadySpentIndexes [0] when known; absent, [], [1], "0" → null (undetermined, never "none")', () => {
    const idx = (v: unknown) =>
      (interpretA0SubmitAnswer({status: 409, body: {outcome: 'already_spent', alreadySpentIndexes: v}}) as Extract<
        A0SubmitResult,
        {outcome: 'already_spent'}
      >).alreadySpentIndexes;
    expect(idx([0])).toEqual([0]);
    expect(idx(undefined)).toBeNull();
    expect(idx([])).toBeNull();
    expect(idx([1])).toBeNull();
    expect(idx('0')).toBeNull();
  });

  it.each([
    ['body null (not JSON)', null],
    ['an array', [{outcome: 'confirmed', txSignature: SIG}]],
    ['an unknown outcome', {outcome: 'accepted'}],
    ['an outcome that is not a string', {outcome: 200}],
    ['no outcome', {success: true}],
  ])('unreadable without a signature (%s) → by status: a 4xx is relay_failed not forwarded, anything else unknown (R1-C1)', (_w, body) => {
    for (const status of [...STATUSES, 504, 301]) {
      expect(interpretA0SubmitAnswer({status, body})).toEqual(UNREADABLE(status));
    }
  });

  describe('R1-C1 / R2-N1: what the gateway or the relayer says that is not the contract', () => {
    it('HTTP 200 with an unparseable body (null) → unknown, reconcile', () => {
      const r = interpretA0SubmitAnswer({status: 200, body: null});
      expect(r).toEqual({outcome: 'unknown', status: 200, forwarded: 'unknown', txSignature: null, cause: 'unreadable'});
      expect(a0SubmitDisposition(r)).toBe('reconcile');
    });
    it.each([500, 502, 503, 504])('a %i with an unreadable (HTML) body → unknown, reconcile', status => {
      const r = interpretA0SubmitAnswer({status, body: null});
      expect(r).toEqual({outcome: 'unknown', status, forwarded: 'unknown', txSignature: null, cause: 'unreadable'});
      expect(a0SubmitDisposition(r)).toBe('reconcile');
    });
    it.each([400, 404, 413, 429])('a %i with an unreadable (plain text) body → relay_failed, not forwarded', status => {
      const r = interpretA0SubmitAnswer({status, body: null});
      expect(r).toEqual({outcome: 'relay_failed', status, forwarded: false, txSignature: null, recognised: false});
      expect(a0SubmitDisposition(r)).toBe('not-forwarded');
    });
    it('a 409 with an unreadable body → unknown, reconcile (already_spent is the one 4xx that can follow a forward)', () => {
      const r = interpretA0SubmitAnswer({status: 409, body: null});
      expect(r).toEqual({outcome: 'unknown', status: 409, forwarded: 'unknown', txSignature: null, cause: 'unreadable'});
      expect(a0SubmitDisposition(r)).toBe('reconcile');
    });
    it.each(FORWARD_CAPABLE)('a parseable `%s` without a signature at a mismatched 4xx → unknown, never not-forwarded', named => {
      for (const status of [400, 404, 429]) {
        const own = CONTRACT.find(c => c[0] === named)![1];
        if (status === own) {
          continue;
        }
        const r = interpretA0SubmitAnswer({status, body: {success: false, outcome: named}});
        expect(r).toEqual({outcome: 'unknown', status, forwarded: 'unknown', txSignature: null, cause: 'unreadable'});
        expect(a0SubmitDisposition(r)).toBe('reconcile');
      }
    });
    it('a parseable never-signature refusal at a mismatched 4xx stays not forwarded (it cannot follow a forward)', () => {
      const r = interpretA0SubmitAnswer({status: 429, body: {success: false, outcome: 'invalid_request'}});
      expect(r).toEqual({outcome: 'relay_failed', status: 429, forwarded: false, txSignature: null, recognised: false});
    });
    it('a readable generic relay_failed without a signature: unknown to the wallet (forwarded "unknown", recognised), reconcile', () => {
      const r = interpretA0SubmitAnswer({status: 502, body: {success: false, outcome: 'relay_failed'}});
      expect(r).toEqual({outcome: 'relay_failed', status: 502, forwarded: 'unknown', txSignature: null, recognised: true});
      expect(a0SubmitDisposition(r)).toBe('reconcile');
    });
    it('every SPECIFIC pre-forward refusal code stays not-forwarded', () => {
      for (const [o, s, sig] of CONTRACT) {
        if (sig === 'never') {
          const r = interpretA0SubmitAnswer({status: s, body: {success: false, outcome: o}});
          expect(a0SubmitDisposition(r)).toBe('not-forwarded');
          expect(r.forwarded).toBe(false);
        }
      }
    });
  });

  it('a malformed txSignature claims a forward all the same → unknown, its value dropped', () => {
    for (const bad of [GOBAM, 'z'.repeat(88), SIG.replace(/.$/, '0'), null, 7]) {
      // a 32-byte key, 65 bytes, a character outside the alphabet, not a string
      expect(interpretA0SubmitAnswer({status: 200, body: {outcome: 'confirmed', txSignature: bad}})).toEqual({
        outcome: 'unknown',
        status: 200,
        forwarded: 'unknown',
        txSignature: null,
        cause: 'unreadable',
      });
    }
  });

  it('isA0TxSignature: base58 of exactly 64 bytes', () => {
    expect(isA0TxSignature(SIG)).toBe(true);
    expect(isA0TxSignature('1'.repeat(64))).toBe(true); // 64 zero bytes
    expect(isA0TxSignature('1'.repeat(63))).toBe(false);
    expect(isA0TxSignature(GOBAM)).toBe(false); // 32 bytes
    expect(isA0TxSignature(SIG.replace(/^./, 'l'))).toBe(false); // not in the alphabet
    expect(isA0TxSignature('z'.repeat(88))).toBe(false); // 65 bytes
  });
});

// ------------------------------------------------------------------------------ the submit, end to end

describe('submitA0WithdrawChange over pinnedFetchDirect', () => {
  it('POST …/relayer/submit with JSON.stringify(payload), as is; a 200 confirmed is read', async () => {
    setNativeCallback(reply(200, {success: true, outcome: 'confirmed', txSignature: SIG}));
    const r = await submitA0WithdrawChange(PAYLOAD);
    const [call] = nativeCalls();
    expect(call!.url).toBe(`${API_BASE}/relayer/submit`);
    expect(call!.options).toMatchObject({method: 'POST', body: JSON.stringify(PAYLOAD), pkPinning: true});
    expect(r).toEqual({outcome: 'confirmed', status: 200, forwarded: true, txSignature: SIG});
  });
  it('every outcome at its status arrives through pinnedFetch as an answer, never a throw', async () => {
    for (const [outcome, status, sig] of CONTRACT) {
      resetNative();
      setNativeCallback(reply(status, {outcome, ...(sig === 'always' ? {txSignature: SIG} : {})}));
      const r = await submitA0WithdrawChange(PAYLOAD);
      expect([r.outcome, r.status]).toEqual([outcome, status]);
    }
  });
  it('the recorded 400 invalid_request: not forwarded', async () => {
    setNativeCallback(cb('nonSuccess400'));
    const r = await submitA0WithdrawChange(PAYLOAD);
    expect(r).toEqual({outcome: 'invalid_request', status: 400, forwarded: false, txSignature: null});
    expect(a0SubmitDisposition(r)).toBe('not-forwarded');
  });
  it.each([500, 502, 503, 504])('R1-C1 end to end: a %i HTML page from the gateway → unknown, reconcile (the tx may have landed)', async status => {
    setNativeCallback([{status, bodyString: '<html><body>504 Gateway Time-out</body></html>', headers: {}}, null]);
    const r = await submitA0WithdrawChange(PAYLOAD);
    expect(r).toEqual({outcome: 'unknown', status, forwarded: 'unknown', txSignature: null, cause: 'unreadable'});
    expect(a0SubmitDisposition(r)).toBe('reconcile');
  });
  it('R1-C1 end to end: a 200 whose body is not JSON → unknown, reconcile', async () => {
    setNativeCallback([null, {status: 200, bodyString: 'OK', headers: {}}]);
    const r = await submitA0WithdrawChange(PAYLOAD);
    expect(r).toEqual({outcome: 'unknown', status: 200, forwarded: 'unknown', txSignature: null, cause: 'unreadable'});
    expect(a0SubmitDisposition(r)).toBe('reconcile');
  });
  it('R1-C1 end to end: a 400 plain text → not forwarded', async () => {
    setNativeCallback([{status: 400, bodyString: 'Bad Request', headers: {}}, null]);
    const r = await submitA0WithdrawChange(PAYLOAD);
    expect(r).toEqual({outcome: 'relay_failed', status: 400, forwarded: false, txSignature: null, recognised: false});
    expect(a0SubmitDisposition(r)).toBe('not-forwarded');
  });
  it('the recorded plain-text 429 (body null): relay_failed with no signature — never duplicate_in_flight / budget_exceeded by status alone', async () => {
    setNativeCallback(cb('nonSuccess429Text'));
    const r = await submitA0WithdrawChange(PAYLOAD);
    expect(r).toEqual({outcome: 'relay_failed', status: 429, forwarded: false, txSignature: null, recognised: false});
    expect(a0SubmitDisposition(r)).toBe('not-forwarded');
  });
  it.each([
    ['a transport failure', 'transportFailure'],
    ['a pin failure (E004)', 'pinFailure'],
  ])('%s on submit: unknown (the tx may have landed), reconcile — never "not forwarded"', async (_w, name) => {
    setNativeCallback(cb(name));
    const r = await submitA0WithdrawChange(PAYLOAD);
    expect(r).toEqual({outcome: 'unknown', status: null, forwarded: 'unknown', txSignature: null, cause: 'transport'});
    expect(a0SubmitDisposition(r)).toBe('reconcile');
  });
  it('the recorded null-message failure settles at once as a transport error (the direct native call has no hang)', async () => {
    setNativeCallback(cb('failureNullMessage'));
    const r = await submitA0WithdrawChange(PAYLOAD, {deadlineMs: 5_000});
    expect(r).toEqual({outcome: 'unknown', status: null, forwarded: 'unknown', txSignature: null, cause: 'transport'});
    expect(a0SubmitDisposition(r)).toBe('reconcile');
  });
  it('a request that never settles hits the JS deadline: unknown, reconcile — never "not forwarded"', async () => {
    const r = await submitA0WithdrawChange(PAYLOAD, {fetchImpl: () => new Promise(() => undefined), deadlineMs: 50});
    expect(r).toEqual({outcome: 'unknown', status: null, forwarded: 'unknown', txSignature: null, cause: 'deadline'});
    expect(a0SubmitDisposition(r)).toBe('reconcile');
  });
  it('a refused API base throws E_A0_RELAYER_URL, nothing sent', async () => {
    setNativeResponder(() => {
      throw new Error('must not be called');
    });
    await expect(submitA0WithdrawChange(PAYLOAD, {base: 'https://api.noc-tura.io/api/v1/v1'})).rejects.toMatchObject({
      code: 'E_A0_RELAYER_URL',
    });
    expect(nativeCalls()).toHaveLength(0);
  });
});
