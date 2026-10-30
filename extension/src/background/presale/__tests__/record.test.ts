import {base58, base64} from '@scure/base';
import {registerPresale} from '../api';
import {
  MAX_PRESALE_RECORDS,
  PRESALE_RECORD_ALARM,
  PRESALE_RECORD_PATH,
  PRESALE_RECORD_SLOTS_MS,
  purchasePayload,
  readPresaleRecords,
  reconcilePresaleRecords,
  recordConfirmedPurchase,
  runPresaleRecords,
  slotAfter,
  wakePresaleRecords,
  type PresaleRecordEntry,
  type PresaleRecordPayload,
} from '../record';
import {handleMessage, registerPresaleHandler} from '../../messages';
import {PENDING_KEY, readPending, type PendingRecord} from '../../pendingStore';
import {pollOnce} from '../../pending';
import {VAULT_KEY, forgetWallet, storeEnvelope} from '../../accountsStore';
import {PRESALE_RECORDS_KEY} from '../../presaleRecordsKey';
import {FORBIDDEN_UNTIL_KEY, RequestTimedOut, createJsonPoster, latchStore, type PostAnswer} from '../../deps';
import {envelopeRevision} from '../../../shared/envelopeRevision';
import {fakeDeps, fakeReader} from '../../__tests__/fakeDeps';
import {fakeExt} from '../../__tests__/fakeExt';
import {ACCOUNT as SESSION_ACCOUNT, RECIPIENT, pendingRecord, signedWire, unlocked} from '../../__tests__/fixtures';
import {MAINNET_SOL_TREASURY, MAINNET_VAULT_USDC_ATA} from '../../../../../core/presale/addresses';
import {firstSignature} from '../../../../../core/solana/broadcast';
import {FORBIDDEN_COOLDOWN_MS, RequestUnreachable, RpcCoolingDown, RpcForbidden, createForbiddenLatch, createRpc, type FetchLike} from '../../../../../core/solana/rpc';

// B1d §2.4 (C24, D28–D30): the coordinator record of a confirmed purchase — the payload, written on `confirmed` only,
// the answers, the schedule's slots on a fake clock, a 403 through the shared latch, one POST in flight, the alarm, the
// store's bounds, delete and restore, and presale.unrecorded. Nothing here reaches the network: every POST is a fake.

/** The presale entry's alarm runs, as index.ts would hold them — registered against a host this file can reach. */
const HOST = {ext: fakeExt(), deps: fakeDeps()};
const alarms = new Map<string, () => Promise<void>>();
registerPresale({...HOST, handle: registerPresaleHandler, alarm: (name, run) => void alarms.set(name, run)});

const ACCOUNT = SESSION_ACCOUNT.publicKey;
const SIG = firstSignature(signedWire(11n));
const SIG2 = firstSignature(signedWire(12n));
const T0 = 1_000_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const ENVELOPE = {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: ACCOUNT}]};
/** §2.3: a purchase's `extra.data` as the kind writes it — 2 SOL at stage 0 (the program's index), no referrer. */
const DATA = {currency: 'SOL', amount: '2000000000', stage: '0', priceTicks: '1501', nocBase: '1998667554963357', spentCents: '30000', destination: MAINNET_SOL_TREASURY, referrer: null};
const purchase = (over: Partial<PendingRecord> = {}, data: Record<string, unknown> = {}): PendingRecord =>
  pendingRecord({id: 'buy', account: ACCOUNT, signature: SIG, intent: null, state: 'confirmed', fee: {networkLamports: '5050', markupLamports: '0'}, extra: {kind: 'presale-buy', data: {...DATA, ...data}}, ...over});
const PAYLOAD: PresaleRecordPayload = {txHash: SIG, buyerAddress: ACCOUNT, paymentToken: 'SOL', paymentAmount: '2', nocAmount: 1998667.554963357, usdValue: 300, stage: 1};
const OK: PostAnswer = {status: 200, body: {success: true, verified: true, duplicate: false, data: null}};
const SERVER_ERROR: PostAnswer = {status: 500, body: {success: false, error: 'boom'}};

interface Post {
  at: number;
  path: string;
  body: unknown;
}
/** A world: an ext with `wallet` stored (ACCOUNT's unless given), a clock at T0, and a POST that records each call and answers from `answers` (the last repeated). */
function world(answers: (PostAnswer | Error)[] = [OK], wallet: unknown = ENVELOPE) {
  const ext = fakeExt();
  // The wallet stored now: the worker POSTs only its accounts' entries (review 1 I2). memKV's set writes before it returns.
  if (wallet !== null) void ext.local.set(VAULT_KEY, wallet);
  const posts: Post[] = [];
  const deps = fakeDeps({
    postJson: async (path, body) => {
      posts.push({at: deps.clock.t, path, body});
      const a = answers[Math.min(posts.length - 1, answers.length - 1)] as PostAnswer | Error;
      if (a instanceof Error) throw a;
      return a;
    },
  });
  deps.clock.t = T0;
  return {ext, deps, posts};
}
type World = ReturnType<typeof world>;
/** The kind's hook, as the poller calls it, then the run it starts — awaited. */
async function confirm(w: World, record: PendingRecord = purchase()): Promise<void> {
  await recordConfirmedPurchase({ext: w.ext, deps: w.deps}, record);
  await runPresaleRecords(w.ext, w.deps);
}
async function at(w: World, t: number): Promise<void> {
  w.deps.clock.t = t;
  await runPresaleRecords(w.ext, w.deps);
}
const entries = (w: World) => readPresaleRecords(w.ext);
/** A distinct signature-shaped string (64 bytes, base58) per n — no signing, so a store of 50 is cheap to build. */
const fakeSig = (n: number) => base58.encode(Uint8Array.from({length: 64}, (_, i) => (n * 7 + i + 1) % 256));
const entry = (over: Partial<PresaleRecordEntry> = {}): PresaleRecordEntry => ({signature: SIG, account: ACCOUNT, payload: PAYLOAD, confirmedAt: T0, attempts: 0, nextAt: T0, state: 'due', ...over});

describe('the payload (§2.4, D28): the whole §2.4 body, made from the record’s display data at this edge only', () => {
  it('a SOL purchase without a referrer: the display amount a decimal string, NOC and USD numbers, the stage 1-indexed, no referrerAddress key (positive control)', () => {
    const p = purchasePayload(purchase());
    expect(p).toEqual(PAYLOAD);
    expect(p !== null && Object.hasOwn(p, 'referrerAddress')).toBe(false);
    expect(typeof p?.paymentAmount).toBe('string');
    expect(JSON.stringify(p)).toBe(`{"txHash":"${SIG}","buyerAddress":"${ACCOUNT}","paymentToken":"SOL","paymentAmount":"2","nocAmount":1998667.554963357,"usdValue":300,"stage":1}`);
  });

  it('a stablecoin purchase with its referrer; fractions and the smallest unit as decimal strings; the last stage', () => {
    expect(purchasePayload(purchase({}, {currency: 'USDC', amount: '12345678', stage: '9', nocBase: '1000000001', spentCents: '1234', destination: MAINNET_VAULT_USDC_ATA, referrer: RECIPIENT}))).toEqual({
      txHash: SIG,
      buyerAddress: ACCOUNT,
      paymentToken: 'USDC',
      paymentAmount: '12.345678',
      nocAmount: 1.000000001,
      usdValue: 12.34,
      stage: 10,
      referrerAddress: RECIPIENT,
    });
    expect(purchasePayload(purchase({}, {amount: '1500000000'}))?.paymentAmount).toBe('1.5');
    expect(purchasePayload(purchase({}, {amount: '1'}))?.paymentAmount).toBe('0.000000001');
    expect(purchasePayload(purchase({}, {currency: 'USDT', amount: '25000000'}))).toMatchObject({paymentToken: 'USDT', paymentAmount: '25'});
  });

  it.each([
    ['no extra', {extra: null}, {}],
    ['another kind', {extra: {kind: 'send', data: DATA}}, {}],
    ['a signature that is not one', {signature: 'sig-buy'}, {}],
    ['an account that is not an address', {account: 'A'}, {}],
  ])('the record’s own fields: %s → null', (_name, over, data) => {
    expect(purchasePayload(purchase(over as Partial<PendingRecord>, data))).toBeNull();
  });

  it.each([
    ['a key missing', {destination: undefined}],
    ['an extra key', {extra: '1'}],
    ['currency NOC', {currency: 'NOC'}],
    ['amount 0', {amount: '0'}],
    ['amount with a leading zero', {amount: '01'}],
    ['amount a decimal', {amount: '1.5'}],
    ['amount a number', {amount: 2000000000}],
    ['stage 10', {stage: '10'}],
    ['stage a number', {stage: 0}],
    ['stage negative', {stage: '-1'}],
    ['priceTicks not digits', {priceTicks: 'x'}],
    ['nocBase 0', {nocBase: '0'}],
    ['spentCents empty', {spentCents: ''}],
    ['destination not an address', {destination: 'nope'}],
    ['referrer empty', {referrer: ''}],
    ['referrer a number', {referrer: 5}],
  ])('the display data as stored is a claim: %s → null (nothing recorded)', (_name, data) => {
    const d: Record<string, unknown> = {...DATA, ...data};
    for (const k of Object.keys(d)) if (d[k] === undefined) delete d[k];
    expect(purchasePayload(purchase({extra: {kind: 'presale-buy', data: d}}))).toBeNull();
  });
});

describe('written when the poller sees the purchase confirmed (§1.3, §2.4)', () => {
  const CONFIRMED = {err: null, confirmationStatus: 'confirmed' as const};
  async function polled(status: {err: unknown; confirmationStatus: 'confirmed'} | null, record = purchase({state: 'pending'})) {
    const w = world();
    await w.ext.local.set(VAULT_KEY, ENVELOPE);
    await w.ext.local.set(PENDING_KEY, [record]);
    w.deps.reader = fakeReader({getSignatureStatuses: async sigs => sigs.map(() => status), getBlockHeight: async () => 900});
    await pollOnce(w.ext, w.deps);
    await runPresaleRecords(w.ext, w.deps);
    return w;
  }

  it('confirmed: the entry, POSTed at once with the whole payload to the bare route, done on success (positive control)', async () => {
    const w = await polled(CONFIRMED);
    expect((await readPending(w.ext))[0]?.state).toBe('confirmed');
    expect(w.posts).toEqual([{at: T0, path: PRESALE_RECORD_PATH, body: PAYLOAD}]);
    expect(PRESALE_RECORD_PATH).toBe('/solana/purchase');
    expect(await entries(w)).toEqual([entry({attempts: 1, nextAt: T0 + MINUTE, state: 'done'})]);
  });

  it('not landed, or landed with an error: nothing written, nothing POSTed', async () => {
    for (const s of [null, {err: {InstructionError: [2, {Custom: 6016}]}, confirmationStatus: 'confirmed' as const}]) {
      const w = await polled(s);
      expect([w.posts, await entries(w), await w.ext.local.get(PRESALE_RECORDS_KEY)]).toEqual([[], [], undefined]);
    }
  });

  it('a purchase whose display data does not read back is confirmed but not recorded', async () => {
    const w = await polled(CONFIRMED, purchase({state: 'pending'}, {currency: 'NOC'}));
    expect((await readPending(w.ext))[0]?.state).toBe('confirmed');
    expect([w.posts, await entries(w)]).toEqual([[], []]);
  });

  it('once per signature: the hook again for the same signature adds nothing and POSTs nothing more', async () => {
    const w = world();
    await confirm(w);
    await confirm(w);
    expect(w.posts).toHaveLength(1);
    expect(await entries(w)).toEqual([entry({attempts: 1, nextAt: T0 + MINUTE, state: 'done'})]);
  });
});

describe('the answers (D29, D30)', () => {
  it('200 {success: true} is done whatever verified, duplicate and data say — no further POST at any later slot, the alarm cleared', async () => {
    for (const body of [{success: true, verified: false, duplicate: false, data: {status: 'pending'}}, {success: true, verified: true, duplicate: true, data: null}, {success: true}]) {
      const w = world([{status: 200, body}]);
      await confirm(w);
      for (const s of PRESALE_RECORD_SLOTS_MS) await at(w, T0 + s);
      expect([w.posts.length, (await entries(w))[0]?.state, w.ext.alarmsSet.has(PRESALE_RECORD_ALARM)]).toEqual([1, 'done', false]);
    }
  });

  it.each([['Missing or invalid txHash'], ['Invalid Solana address format'], ['Transaction failed on-chain'], ['not_a_presale_purchase']])('the route’s 400 (%s) is final: refused, never POSTed again, still unrecorded', async error => {
    const w = world([{status: 400, body: {success: false, error, ...(error === 'not_a_presale_purchase' ? {reason: 'no presale instruction'} : {})}}]);
    await confirm(w);
    for (const s of PRESALE_RECORD_SLOTS_MS) await at(w, T0 + s + 1);
    expect([w.posts.length, (await entries(w))[0]?.state, w.ext.alarmsSet.has(PRESALE_RECORD_ALARM)]).toEqual([1, 'refused', false]);
  });

  it.each([
    ['a 400 that is not the route’s (no body)', {status: 400, body: null}],
    ['a 400 without success: false', {status: 400, body: {error: 'Bad Request'}}],
    ['a 400 whose error is not a string', {status: 400, body: {success: false, error: 1}}],
    ['429 (the per-address limit)', {status: 429, body: {error: 'Too many purchase attempts, please wait'}}],
    ['500', SERVER_ERROR],
    ['503', {status: 503, body: null}],
    ['200 with success false', {status: 200, body: {success: false}}],
    ['200 with success "true"', {status: 200, body: {success: 'true'}}],
    ['200 not an object', {status: 200, body: 'ok'}],
    ['200 null', {status: 200, body: null}],
    ['201', {status: 201, body: {success: true}}],
    ['a timeout', new RequestTimedOut('/solana/purchase', 20_000)],
    ['no answer at all', new RequestUnreachable('/solana/purchase', 'offline')],
    ['anything else thrown', new Error('storage')],
  ])('%s is the next slot: due, one attempt made, its alarm armed', async (_name, answer) => {
    const w = world([answer]);
    await confirm(w);
    expect(w.posts).toHaveLength(1);
    expect(await entries(w)).toEqual([entry({attempts: 1, nextAt: T0 + MINUTE})]);
    expect(w.ext.alarmsSet.get(PRESALE_RECORD_ALARM)).toBe(1);
  });
});

describe('the schedule (C24) on a fake clock', () => {
  it('at once, 1 min, 5 min, 30 min, 2 h, 12 h, 24 h, 48 h and 72 h after confirmation — never between — then given up', async () => {
    expect(PRESALE_RECORD_SLOTS_MS).toEqual([0, MINUTE, 5 * MINUTE, 30 * MINUTE, 2 * HOUR, 12 * HOUR, 24 * HOUR, 48 * HOUR, 72 * HOUR]);
    const w = world([SERVER_ERROR]);
    await confirm(w);
    for (const [i, s] of PRESALE_RECORD_SLOTS_MS.entries()) {
      if (i === 0) continue;
      await at(w, T0 + s - 1);
      expect([i, w.posts.length]).toEqual([i, i]);
      await at(w, T0 + s);
      expect([i, w.posts.length]).toEqual([i, i + 1]);
      const next = PRESALE_RECORD_SLOTS_MS[i + 1];
      expect(await entries(w)).toEqual([entry({attempts: i + 1, ...(next === undefined ? {nextAt: T0 + s, state: 'given-up'} : {nextAt: T0 + next})})]);
    }
    expect(w.posts.map(p => p.at - T0)).toEqual(PRESALE_RECORD_SLOTS_MS);
    await at(w, T0 + 200 * HOUR);
    expect([w.posts.length, w.ext.alarmsSet.has(PRESALE_RECORD_ALARM)]).toEqual([9, false]);
  });

  it('a worker asleep across slots POSTs once when it wakes, then waits for the first slot after now', async () => {
    const w = world([SERVER_ERROR]);
    await confirm(w);
    await at(w, T0 + 3 * HOUR);
    expect(w.posts.map(p => p.at - T0)).toEqual([0, 3 * HOUR]);
    expect(await entries(w)).toEqual([entry({attempts: 2, nextAt: T0 + 12 * HOUR})]);
  });

  it('asleep past 72 h: one last attempt — given up if it fails, done if it succeeds', async () => {
    const failing = world([SERVER_ERROR]);
    await confirm(failing);
    await at(failing, T0 + 100 * HOUR);
    expect([failing.posts.length, (await entries(failing))[0]?.state]).toEqual([2, 'given-up']);
    const late = world([SERVER_ERROR, OK]);
    await confirm(late);
    await at(late, T0 + 100 * HOUR);
    expect([late.posts.length, (await entries(late))[0]?.state]).toEqual([2, 'done']);
  });

  it('slotAfter: the first slot strictly after now, null past the last', () => {
    expect(slotAfter(T0, T0 - 5)).toBe(T0);
    expect(slotAfter(T0, T0)).toBe(T0 + MINUTE);
    expect(slotAfter(T0, T0 + MINUTE - 1)).toBe(T0 + MINUTE);
    expect(slotAfter(T0, T0 + 48 * HOUR)).toBe(T0 + 72 * HOUR);
    expect(slotAfter(T0, T0 + 72 * HOUR - 1)).toBe(T0 + 72 * HOUR);
    expect(slotAfter(T0, T0 + 72 * HOUR)).toBeNull();
  });
});

describe('a 403 (the shared latch): the entry waits for the cool-down, never retried inside it', () => {
  /** The real poster and latch on the world's clock and storage; `status` is what the route answers next. */
  function latched(w: World, statuses: number[]) {
    const sent: {url: string; at: number}[] = [];
    const fetch: FetchLike = async url => {
      const status = statuses[Math.min(sent.length, statuses.length - 1)] as number;
      sent.push({url, at: w.deps.clock.t});
      return {status, json: async () => (status === 200 ? {success: true} : {success: false, error: 'boom'})};
    };
    const latch = createForbiddenLatch({now: () => w.deps.clock.t, store: latchStore(w.ext)});
    const poster = createJsonPoster(fetch, latch);
    w.deps.postJson = (path, body) => poster.post(path, body);
    return {sent, fetch, latch};
  }

  it('a 403 on the record: next attempt at the cool-down’s end (past the 1 min slot) — nothing sent at 1 min — then done', async () => {
    const w = world();
    const l = latched(w, [403, 200]);
    await confirm(w);
    expect(await w.ext.local.get(FORBIDDEN_UNTIL_KEY)).toBe(T0 + FORBIDDEN_COOLDOWN_MS);
    expect(await entries(w)).toEqual([entry({attempts: 1, nextAt: T0 + FORBIDDEN_COOLDOWN_MS})]);
    expect(w.ext.alarmsSet.get(PRESALE_RECORD_ALARM)).toBe(FORBIDDEN_COOLDOWN_MS / MINUTE);
    await at(w, T0 + MINUTE);
    await at(w, T0 + FORBIDDEN_COOLDOWN_MS - 1);
    expect(l.sent).toHaveLength(1);
    await at(w, T0 + FORBIDDEN_COOLDOWN_MS);
    expect(l.sent.map(s => s.at - T0)).toEqual([0, FORBIDDEN_COOLDOWN_MS]);
    expect((await entries(w))[0]?.state).toBe('done');
  });

  it('another route’s 403 first (the RPC, the same latch): the record’s attempt sends nothing and waits for the same end', async () => {
    const w = world();
    const l = latched(w, [403, 200]);
    await expect(createRpc({fetch: l.fetch, latch: l.latch}).call('getBlockHeight', [])).rejects.toBeInstanceOf(RpcForbidden);
    await confirm(w);
    expect(l.sent.map(s => s.url)).toEqual(['https://api.noc-tura.io/api/v1/rpc']);
    expect(await entries(w)).toEqual([entry({attempts: 1, nextAt: T0 + FORBIDDEN_COOLDOWN_MS})]);
  });

  it('a cool-down refusal (RpcCoolingDown) thrown by any poster is waited out the same way; a 403 at the last slot gives up', async () => {
    const w = world([new RpcCoolingDown('/solana/purchase')]);
    await w.ext.local.set(FORBIDDEN_UNTIL_KEY, T0 + 7 * MINUTE);
    await confirm(w);
    expect(await entries(w)).toEqual([entry({attempts: 1, nextAt: T0 + 7 * MINUTE})]);
    const last = world([new RpcForbidden('/solana/purchase')]);
    await last.ext.local.set(PRESALE_RECORDS_KEY, [entry({attempts: 8, nextAt: T0 + 72 * HOUR})]);
    await last.ext.local.set(FORBIDDEN_UNTIL_KEY, T0 + 73 * HOUR);
    await at(last, T0 + 72 * HOUR);
    expect(await entries(last)).toEqual([entry({attempts: 9, nextAt: T0 + 72 * HOUR, state: 'given-up'})]);
  });

  it('negative control: an earlier slot than the cool-down’s end is never moved later than the end, and a cool-down already over moves nothing', async () => {
    const w = world([new RpcForbidden('/solana/purchase')]);
    await w.ext.local.set(FORBIDDEN_UNTIL_KEY, T0 - 1);
    await confirm(w);
    expect(await entries(w)).toEqual([entry({attempts: 1, nextAt: T0 + MINUTE})]);
  });
});

describe('one POST in flight; never two for one signature within a slot', () => {
  /** A POST held until `release`. */
  function held(w: World) {
    const gate: {release: (a: PostAnswer) => void; calls: number} = {release: () => undefined, calls: 0};
    w.deps.postJson = async (path, body) => {
      gate.calls += 1;
      w.posts.push({at: w.deps.clock.t, path, body});
      return new Promise<PostAnswer>(resolve => {
        gate.release = resolve;
      });
    };
    return gate;
  }
  const settle = async () => {
    for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0));
  };

  it('a second purchase confirmed while the first POST is held waits for it; then it is sent by the same run, and both are done', async () => {
    const w = world();
    const gate = held(w);
    await recordConfirmedPurchase({ext: w.ext, deps: w.deps}, purchase());
    await settle();
    expect(gate.calls).toBe(1);
    // Claimed before the request: its next slot is already written.
    expect(await entries(w)).toEqual([entry({attempts: 1, nextAt: T0 + MINUTE})]);
    await recordConfirmedPurchase({ext: w.ext, deps: w.deps}, purchase({id: 'buy2', signature: SIG2}));
    const again = runPresaleRecords(w.ext, w.deps);
    await settle();
    expect(gate.calls).toBe(1);
    gate.release(OK);
    await settle();
    expect(gate.calls).toBe(2);
    gate.release(OK);
    await again;
    expect((await entries(w)).map(e => [e.signature, e.state])).toEqual([
      [SIG, 'done'],
      [SIG2, 'done'],
    ]);
    expect(w.posts.map(p => (p.body as PresaleRecordPayload).txHash)).toEqual([SIG, SIG2]);
  });

  it('a purchase confirmed while the run is arming its alarm is still sent by that run, not left for the alarm', async () => {
    const w = world([SERVER_ERROR, OK]);
    let release = (): void => undefined;
    const arming = new Promise<void>(r => {
      release = r;
    });
    const create = w.ext.alarms.create;
    w.ext.alarms.create = async (name, o) => {
      await arming;
      create(name, o);
    };
    const first = confirm(w);
    await settle();
    expect(w.posts).toHaveLength(1);
    await recordConfirmedPurchase({ext: w.ext, deps: w.deps}, purchase({id: 'buy2', signature: SIG2}));
    release();
    await first;
    expect(w.posts.map(p => (p.body as PresaleRecordPayload).txHash)).toEqual([SIG, SIG2]);
    expect((await entries(w)).map(e => [e.signature, e.state])).toEqual([
      [SIG, 'due'],
      [SIG2, 'done'],
    ]);
  });

  it('a restarted worker (another background over the same storage) during the held POST sends nothing: the entry is not due until its next slot', async () => {
    const w = world();
    const gate = held(w);
    await recordConfirmedPurchase({ext: w.ext, deps: w.deps}, purchase());
    await settle();
    const restarted = {...w.ext};
    await runPresaleRecords(restarted, w.deps);
    expect(gate.calls).toBe(1);
    gate.release(SERVER_ERROR);
    await runPresaleRecords(w.ext, w.deps);
    expect(await entries(w)).toEqual([entry({attempts: 1, nextAt: T0 + MINUTE})]);
  });
});

describe('the alarm (presale-record): at the earliest due entry, through the host index.ts holds', () => {
  it('armed at min(nextAt) over the due entries, never sooner than 30 s; cleared when nothing is due', async () => {
    const w = world([SERVER_ERROR]);
    await w.ext.local.set(PRESALE_RECORDS_KEY, [entry({nextAt: T0 + 30 * MINUTE}), entry({signature: SIG2, payload: {...PAYLOAD, txHash: SIG2}, nextAt: T0 + 5 * MINUTE}), entry({signature: firstSignature(signedWire(13n)), payload: {...PAYLOAD, txHash: firstSignature(signedWire(13n))}, nextAt: T0 + MINUTE, state: 'done'})]);
    await runPresaleRecords(w.ext, w.deps);
    expect([w.posts.length, w.ext.alarmsSet.get(PRESALE_RECORD_ALARM)]).toEqual([0, 5]);
    await w.ext.local.set(PRESALE_RECORDS_KEY, [entry({nextAt: T0 + 10_000})]);
    await runPresaleRecords(w.ext, w.deps);
    expect(w.ext.alarmsSet.get(PRESALE_RECORD_ALARM)).toBe(0.5);
    await w.ext.local.set(PRESALE_RECORDS_KEY, [entry({state: 'given-up'}), entry({signature: SIG2, payload: {...PAYLOAD, txHash: SIG2}, state: 'refused'})]);
    await runPresaleRecords(w.ext, w.deps);
    expect(w.ext.alarmsSet.has(PRESALE_RECORD_ALARM)).toBe(false);
  });

  it('registerPresale registers the alarm’s run: it reconciles, then sends its host’s due entries', async () => {
    expect([...alarms.keys()]).toEqual([PRESALE_RECORD_ALARM]);
    const posts: unknown[] = [];
    HOST.deps.postJson = async (_path, body) => (posts.push(body), OK);
    HOST.deps.clock.t = T0;
    await HOST.ext.local.set(PRESALE_RECORDS_KEY, [entry()]);
    await HOST.ext.local.set(VAULT_KEY, ENVELOPE);
    await HOST.ext.local.set(PENDING_KEY, [purchase({id: 'buy2', signature: SIG2, createdAt: T0})]);
    await alarms.get(PRESALE_RECORD_ALARM)?.();
    expect(posts).toEqual([PAYLOAD, {...PAYLOAD, txHash: SIG2}]);
    expect((await readPresaleRecords(HOST.ext)).map(e => [e.signature, e.state])).toEqual([
      [SIG, 'done'],
      [SIG2, 'done'],
    ]);
  });
});

// Controller ruling (B1d-2 Task 1): a worker stopped between the poller's `confirmed` write and the hook's entry is made
// good when it wakes — the entry the hook would have written, `confirmedAt` the record's `createdAt`.
describe('reconciled when the worker wakes: a confirmed purchase the hook never recorded', () => {
  const CREATED = T0 - 5 * MINUTE;
  async function woken(records: PendingRecord[], stored: PresaleRecordEntry[] | null = null, now = T0, envelope: unknown = ENVELOPE) {
    const w = world([OK], envelope);
    await w.ext.local.set(PENDING_KEY, records);
    if (stored !== null) await w.ext.local.set(PRESALE_RECORDS_KEY, stored);
    w.deps.clock.t = now;
    await reconcilePresaleRecords(w.ext, w.deps);
    await runPresaleRecords(w.ext, w.deps);
    return w;
  }

  it('the hook was skipped: the wake writes its entry (confirmedAt = createdAt, due now) and the run POSTs it once (positive control)', async () => {
    const w = await woken([purchase({createdAt: CREATED})]);
    expect(w.posts).toEqual([{at: T0, path: PRESALE_RECORD_PATH, body: PAYLOAD}]);
    expect(await entries(w)).toEqual([entry({confirmedAt: CREATED, attempts: 1, nextAt: CREATED + 30 * MINUTE, state: 'done'})]);
  });

  it('an entry already there, in any state: no second entry, no POST', async () => {
    for (const state of ['done', 'due', 'refused', 'given-up'] as const) {
      const present = entry({nextAt: T0 + HOUR, state});
      const w = await woken([purchase({createdAt: CREATED})], [present]);
      expect([state, w.posts, await entries(w)]).toEqual([state, [], [present]]);
    }
  });

  it('confirmed more than 72 h ago: written given-up, never POSTed; at exactly 72 h it is still due and POSTed once', async () => {
    const late = await woken([purchase({createdAt: CREATED})], null, CREATED + 72 * HOUR + 1);
    expect([late.posts, await entries(late), late.ext.alarmsSet.has(PRESALE_RECORD_ALARM)]).toEqual([[], [entry({confirmedAt: CREATED, nextAt: CREATED + 72 * HOUR + 1, state: 'given-up'})], false]);
    const edge = await woken([purchase({createdAt: CREATED})], null, CREATED + 72 * HOUR);
    expect([edge.posts.length, (await entries(edge))[0]?.state]).toEqual([1, 'done']);
  });

  it('nothing else is reconciled: an open or failed purchase, a send, a dApp record, another kind, another wallet’s account, data that does not read back', async () => {
    for (const record of [
      purchase({state: 'pending'}),
      purchase({state: 'stuck'}),
      purchase({state: 'failed', failure: 'landed'}),
      purchase({state: 'expired'}),
      pendingRecord({account: ACCOUNT, signature: SIG, state: 'confirmed'}),
      purchase({origin: 'https://jup.ag', extra: null}),
      purchase({extra: {kind: 'test-buy', data: DATA}}),
      purchase({}, {currency: 'NOC'}),
    ]) {
      const w = await woken([record]);
      expect([record.state, w.posts, await w.ext.local.get(PRESALE_RECORDS_KEY)]).toEqual([record.state, [], undefined]);
    }
    for (const envelope of [null, {...ENVELOPE, accounts: [{index: 0, name: 'Other', publicKey: RECIPIENT}]}]) {
      const w = await woken([purchase()], null, T0, envelope);
      expect([w.posts, await w.ext.local.get(PRESALE_RECORDS_KEY)]).toEqual([[], undefined]);
    }
  });

  it('two purchases, one recorded and one not: only the missing one is added, after the present one', async () => {
    const other = purchase({id: 'buy2', signature: SIG2, createdAt: CREATED});
    const present = entry({nextAt: T0 + HOUR, state: 'done'});
    const w = await woken([purchase(), other], [present]);
    expect((await entries(w)).map(e => [e.signature, e.state])).toEqual([
      [SIG, 'done'],
      [SIG2, 'done'],
    ]);
    expect(w.posts.map(p => (p.body as PresaleRecordPayload).txHash)).toEqual([SIG2]);
  });
});

describe('the store (§2.4): at most 50, read strictly', () => {
  const sig = (n: number) => fakeSig(1000 + n);
  const nth = (n: number, state: PresaleRecordEntry['state']) => entry({signature: sig(n), payload: {...PAYLOAD, txHash: sig(n)}, state, nextAt: T0 + HOUR});
  const fill = (states: PresaleRecordEntry['state'][]) => states.map((s, i) => nth(i, s));

  it('the 51st drops the oldest accepted entry first, then the oldest given up, then refused, then due', async () => {
    const order: [PresaleRecordEntry['state'][], number][] = [
      [['due', 'refused', 'given-up', 'done', 'done', ...Array<PresaleRecordEntry['state']>(45).fill('due')], 3],
      [['due', 'refused', 'given-up', 'given-up', ...Array<PresaleRecordEntry['state']>(46).fill('due')], 2],
      [['due', 'refused', 'refused', ...Array<PresaleRecordEntry['state']>(47).fill('due')], 1],
      [Array<PresaleRecordEntry['state']>(50).fill('due'), 0],
    ];
    for (const [states, dropped] of order) {
      const w = world();
      await w.ext.local.set(PRESALE_RECORDS_KEY, fill(states));
      w.deps.clock.t = T0 - 1;
      await recordConfirmedPurchase({ext: w.ext, deps: w.deps}, purchase());
      const after = await entries(w);
      expect(after).toHaveLength(MAX_PRESALE_RECORDS);
      expect([dropped, after.some(e => e.signature === sig(dropped)), after.at(-1)?.signature]).toEqual([dropped, false, SIG]);
    }
  });

  // Final review Minor 1 (its probe P4): 49 held entries (a replaced wallet's, due) and two purchases of the stored wallet
  // still in v1_pending. The second purchase's write takes the store to 51; trim may not drop the first one's `done`
  // entry, which the reconcile would write again at the next wake and POST once more — then drop the second's for it, and
  // so on at every wake (P1, P2, P1, P2, P1). The oldest held entry goes instead.
  it('an entry whose purchase is still in v1_pending is never dropped: 49 held and two own purchases — each POSTed once, never again at five wakes; the oldest held one goes', async () => {
    const w = world();
    const held = Array.from({length: 49}, (_, n) => entry({signature: sig(n), account: RECIPIENT, payload: {...PAYLOAD, txHash: sig(n), buyerAddress: RECIPIENT}}));
    await w.ext.local.set(PRESALE_RECORDS_KEY, held);
    const first = purchase({createdAt: T0});
    const second = purchase({id: 'buy2', signature: SIG2, createdAt: T0});
    await w.ext.local.set(PENDING_KEY, [first, second]);
    await confirm(w, first);
    await confirm(w, second);
    for (let i = 1; i <= 5; i++) {
      w.deps.clock.t = T0 + i * HOUR;
      await wakePresaleRecords(w.ext, w.deps);
    }
    expect(w.posts.map(p => (p.body as PresaleRecordPayload).txHash)).toEqual([SIG, SIG2]);
    const after = await entries(w);
    expect([after.length, after.slice(0, 48).map(e => e.signature), after.slice(48).map(e => [e.signature, e.state])]).toEqual([
      MAX_PRESALE_RECORDS,
      held.slice(1).map(e => e.signature),
      [
        [SIG, 'done'],
        [SIG2, 'done'],
      ],
    ]);
  });

  // Re-review residual 1 (D29): the guard is not `done`'s only. An own `refused` entry whose purchase is still in
  // v1_pending, dropped for the 51st, would come back `due` at the next wake and be POSTed again — a refusal is final.
  it('a refused entry whose purchase is still in v1_pending is never dropped for the 51st: never re-created, never POSTed again (D29); a held due one goes', async () => {
    const w = world();
    const refused = entry({attempts: 1, nextAt: T0 + MINUTE, state: 'refused'});
    const held = Array.from({length: 49}, (_, n) => entry({signature: sig(n), account: RECIPIENT, payload: {...PAYLOAD, txHash: sig(n), buyerAddress: RECIPIENT}}));
    await w.ext.local.set(PRESALE_RECORDS_KEY, [refused, ...held]);
    const second = purchase({id: 'buy2', signature: SIG2, createdAt: T0});
    await w.ext.local.set(PENDING_KEY, [purchase({createdAt: T0}), second]);
    await confirm(w, second);
    for (let i = 1; i <= 5; i++) {
      w.deps.clock.t = T0 + i * HOUR;
      await wakePresaleRecords(w.ext, w.deps);
    }
    expect(w.posts.map(p => (p.body as PresaleRecordPayload).txHash)).toEqual([SIG2]);
    const after = await entries(w);
    expect([after.length, after[0], after.slice(1, 49).map(e => e.signature), after.at(-1)?.state]).toEqual([MAX_PRESALE_RECORDS, refused, held.slice(1).map(e => e.signature), 'done']);
  });

  it('what does not read back is dropped; the rest is kept, as fresh objects', async () => {
    const w = world();
    const good = entry({nextAt: T0 + HOUR});
    const bad: unknown[] = [
      {...good, extra: 1},
      {...good, state: 'pending'},
      {...good, attempts: -1},
      {...good, nextAt: 1.5},
      {...good, signature: SIG2},
      {...good, account: RECIPIENT},
      {...good, payload: {...PAYLOAD, paymentAmount: 2}},
      {...good, payload: {...PAYLOAD, stage: 0}},
      {...good, payload: {...PAYLOAD, nocAmount: Number.NaN}},
      {...good, payload: {...PAYLOAD, referrerAddress: undefined, extra: 1}},
      'x',
      null,
    ];
    await w.ext.local.set(PRESALE_RECORDS_KEY, [...bad, good, {...good, signature: SIG2, payload: {...PAYLOAD, txHash: SIG2, referrerAddress: RECIPIENT}}]);
    const read = await entries(w);
    expect(read).toEqual([good, {...good, signature: SIG2, payload: {...PAYLOAD, txHash: SIG2, referrerAddress: RECIPIENT}}]);
    read[0]!.payload.stage = 7;
    expect((await entries(w))[0]?.payload.stage).toBe(1);
    await w.ext.local.set(PRESALE_RECORDS_KEY, {not: 'a list'});
    expect(await entries(w)).toEqual([]);
  });
});

describe('a delete wipes the records, a restore keeps them (§2.4: WALLET_DATA_KEYS)', () => {
  const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
  const STORED = {
    v: 1,
    scheme: 'slip10',
    kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)},
    seed: {iv: B(12, 2), ct: B(48, 3)},
    password: {wrapped: B(40, 4)},
    accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT}],
  };
  const REV = envelopeRevision(STORED as Parameters<typeof envelopeRevision>[0]);
  const zero = () => fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => []});
  async function stored(w: World) {
    await w.ext.local.set(VAULT_KEY, STORED);
    await unlocked(w.ext);
    await w.ext.local.set(PRESALE_RECORDS_KEY, [entry({nextAt: T0 + HOUR})]);
    w.deps.reader = zero();
  }

  it('a delete removes them; a restore (the same wallet, a new password) keeps them', async () => {
    const del = world();
    await stored(del);
    expect(await forgetWallet(del.ext, del.deps, {expectedRevision: REV})).toBe('forgotten');
    expect(await del.ext.local.get(PRESALE_RECORDS_KEY)).toBeUndefined();
    const restore = world();
    await stored(restore);
    expect(await forgetWallet(restore.ext, restore.deps, {expectedRevision: REV, replacement: {...STORED, kdf: {...STORED.kdf, salt: B(16, 9)}, seed: {iv: B(12, 8), ct: B(48, 7)}, password: {wrapped: B(40, 6)}}})).toBe('forgotten');
    expect(await entries(restore)).toEqual([entry({nextAt: T0 + HOUR})]);
  });

  it('a first write (a crashed delete left them) removes them too', async () => {
    const w = world([OK], null);
    await w.ext.local.set(PRESALE_RECORDS_KEY, [entry()]);
    expect(await storeEnvelope(w.ext, null, STORED)).toBe('stored');
    expect(await w.ext.local.get(PRESALE_RECORDS_KEY)).toBeUndefined();
  });

  // Final review Minor 2 (its probe P5): the POST is outside the records' section, so a delete can wipe the key while it
  // is out; its answer — accepted or refused — finds no entry and writes nothing (before the fix it wrote `[]` back).
  it.each([
    ['accepted', OK],
    ['refused', {status: 400, body: {success: false, error: 'not_a_presale_purchase'}}],
  ] as const)('a record POST answered (%s) after a delete wiped the records writes nothing back: the key stays gone', async (_name, answer) => {
    const w = world();
    await stored(w);
    let release = (_a: PostAnswer): void => undefined;
    w.deps.postJson = async (path, body) => {
      w.posts.push({at: w.deps.clock.t, path, body});
      return new Promise<PostAnswer>(resolve => {
        release = resolve;
      });
    };
    const sending = confirm(w, purchase({signature: SIG2}));
    for (let i = 0; i < 20 && w.posts.length === 0; i++) await new Promise(r => setTimeout(r, 0));
    expect(w.posts.map(p => (p.body as PresaleRecordPayload).txHash)).toEqual([SIG2]);
    expect(await forgetWallet(w.ext, w.deps, {expectedRevision: REV})).toBe('forgotten');
    expect(await w.ext.local.get(PRESALE_RECORDS_KEY)).toBeUndefined();
    release(answer);
    await sending;
    expect([await w.ext.local.get(PRESALE_RECORDS_KEY), w.posts.length]).toEqual([undefined, 1]);
  });

  it('a record write parked mid-write when the delete arrives: the delete waits, and nothing of it is left after forgotten', async () => {
    const w = world();
    await stored(w);
    let release = (): void => undefined;
    const gate = new Promise<void>(r => {
      release = r;
    });
    const set = w.ext.local.set;
    w.ext.local.set = async (k, v) => {
      if (k === PRESALE_RECORDS_KEY) await gate;
      await set(k, v);
    };
    const writing = recordConfirmedPurchase({ext: w.ext, deps: w.deps}, purchase({signature: SIG2}));
    for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0));
    const forgetting = forgetWallet(w.ext, w.deps, {expectedRevision: REV});
    for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0));
    release();
    await writing;
    expect(await forgetting).toBe('forgotten');
    await runPresaleRecords(w.ext, w.deps);
    expect([await w.ext.local.get(PRESALE_RECORDS_KEY), w.posts]).toEqual([undefined, []]);
  });
});

// Review 1 I2 (rev 2): the shared latch serialises every coordinator request — a record POST the route holds until its
// timeout holds every read behind it (measured: deps.test.ts) — so nothing is POSTed while a transaction of the stored
// wallet is open; and only the stored wallet's entries are POSTed: another account's is held (a restore keeps the
// records, WALLET_DATA_KEYS), never dropped.
describe('when, and for whom, the worker POSTs (review 1 I2)', () => {
  const SIG3 = firstSignature(signedWire(13n));
  const tx = (state: PendingRecord['state'], over: Partial<PendingRecord> = {}): PendingRecord => pendingRecord({id: `tx-${state}`, account: ACCOUNT, signature: SIG3, state, ...over});
  const OPEN: [string, PendingRecord][] = [
    ['a send pending', tx('pending')],
    ['a send stuck', tx('stuck')],
    ['another purchase pending', purchase({id: 'buy3', signature: SIG3, state: 'pending'})],
    ['a site’s transaction pending', tx('pending', {origin: 'https://jup.ag', intent: null})],
  ];
  const OTHER_WALLET = {...ENVELOPE, accounts: [{index: 0, name: 'Other', publicKey: RECIPIENT}]};
  const theirs = (over: Partial<PresaleRecordEntry> = {}) => entry({signature: SIG2, account: RECIPIENT, payload: {...PAYLOAD, txHash: SIG2, buyerAddress: RECIPIENT}, ...over});

  it.each(OPEN)('%s, of the stored wallet: the confirmed purchase is not POSTed — due, no attempt, the alarm looking again in 30 s (positive control)', async (_name, open) => {
    const w = world();
    await w.ext.local.set(PENDING_KEY, [open]);
    expect(await readPending(w.ext)).toHaveLength(1);
    await confirm(w);
    expect([w.posts, await entries(w), w.ext.alarmsSet.get(PRESALE_RECORD_ALARM)]).toEqual([[], [entry()], 0.5]);
  });

  it('once it settles the next run POSTs the record, once, and it is done; the alarm cleared (negative control)', async () => {
    for (const settled of ['confirmed', 'failed', 'expired'] as const) {
      const w = world();
      await w.ext.local.set(PENDING_KEY, [tx('pending')]);
      await confirm(w);
      expect(w.posts).toEqual([]);
      await w.ext.local.set(PENDING_KEY, [tx(settled)]);
      await at(w, T0 + 30_000);
      expect([settled, w.posts, await entries(w), w.ext.alarmsSet.has(PRESALE_RECORD_ALARM)]).toEqual([settled, [{at: T0 + 30_000, path: PRESALE_RECORD_PATH, body: PAYLOAD}], [entry({attempts: 1, nextAt: T0 + MINUTE, state: 'done'})], false]);
    }
  });

  it('settled from the start, or open but of an account not in the stored wallet: POSTed at once', async () => {
    for (const other of [tx('confirmed'), tx('failed', {failure: 'landed'}), tx('pending', {account: RECIPIENT})]) {
      const w = world();
      await w.ext.local.set(PENDING_KEY, [other]);
      await confirm(w);
      expect([other.state, w.posts.length, (await entries(w))[0]?.state]).toEqual([other.state, 1, 'done']);
    }
  });

  it('an entry of an account not in the stored wallet (a replaced wallet’s, or none stored) is held: never POSTed, no alarm, kept as it was', async () => {
    for (const wallet of [OTHER_WALLET, null]) {
      const w = world([OK], wallet);
      await w.ext.local.set(PRESALE_RECORDS_KEY, [entry()]);
      for (const t of [T0, T0 + HOUR, T0 + 73 * HOUR]) await at(w, t);
      expect([w.posts, await entries(w), w.ext.alarmsSet.has(PRESALE_RECORD_ALARM)]).toEqual([[], [entry()], false]);
    }
  });

  it('a held entry goes out when its wallet is stored again (a restore of the first): one POST at the next run, done', async () => {
    const w = world([OK], OTHER_WALLET);
    await w.ext.local.set(PRESALE_RECORDS_KEY, [entry()]);
    await at(w, T0 + MINUTE);
    expect(w.posts).toEqual([]);
    await w.ext.local.set(VAULT_KEY, ENVELOPE);
    await at(w, T0 + 2 * MINUTE);
    expect([w.posts, await entries(w)]).toEqual([[{at: T0 + 2 * MINUTE, path: PRESALE_RECORD_PATH, body: PAYLOAD}], [entry({attempts: 1, nextAt: T0 + 5 * MINUTE, state: 'done'})]]);
  });

  it('beside a held entry the stored wallet’s own is POSTed, and the alarm is armed at its next slot, not at the held one’s', async () => {
    const w = world([SERVER_ERROR]);
    await w.ext.local.set(PRESALE_RECORDS_KEY, [theirs(), entry()]);
    await runPresaleRecords(w.ext, w.deps);
    expect(w.posts.map(p => (p.body as PresaleRecordPayload).txHash)).toEqual([SIG]);
    expect([await entries(w), w.ext.alarmsSet.get(PRESALE_RECORD_ALARM)]).toEqual([[theirs(), entry({attempts: 1, nextAt: T0 + MINUTE})], 1]);
  });
});

describe('presale.unrecorded {account} (§1.4, §4.6, D29, rev 3.6): what #27 shows Q34 or Q60 for — no network', () => {
  const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
  const POPUP = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/popup.html`};
  const sig = (n: number) => fakeSig(2000 + n);
  const of = (n: number, state: PresaleRecordEntry['state'], account = ACCOUNT) => entry({signature: sig(n), account, payload: {...PAYLOAD, txHash: sig(n), buyerAddress: account}, state});
  const ask = (w: World, msg: Record<string, unknown>) => handleMessage(w.ext, msg, POPUP, w.deps);

  it('this account’s due, given-up and refused records with their states, in order; not an accepted one, not another account’s', async () => {
    const w = world([new Error('no POST from a read')]);
    w.deps.reader = fakeReader();
    await unlocked(w.ext);
    await w.ext.local.set(PRESALE_RECORDS_KEY, [of(0, 'due'), of(1, 'done'), of(2, 'given-up'), of(3, 'refused', RECIPIENT), of(4, 'refused')]);
    expect(await ask(w, {type: 'presale.unrecorded', account: ACCOUNT})).toEqual({
      ok: true,
      data: [
        {signature: sig(0), state: 'due'},
        {signature: sig(2), state: 'given-up'},
        {signature: sig(4), state: 'refused'},
      ],
    });
    await w.ext.local.set(PRESALE_RECORDS_KEY, [of(1, 'done')]);
    expect(await ask(w, {type: 'presale.unrecorded', account: ACCOUNT})).toEqual({ok: true, data: []});
    expect(w.posts).toEqual([]);
  });

  it('strict payload, then the session: malformed, locked, unknown-account', async () => {
    const w = world();
    for (const m of [{type: 'presale.unrecorded'}, {type: 'presale.unrecorded', account: 'nope'}, {type: 'presale.unrecorded', account: ACCOUNT, signature: SIG}]) expect(await ask(w, m)).toEqual({ok: false, error: 'malformed'});
    expect(await ask(w, {type: 'presale.unrecorded', account: ACCOUNT})).toEqual({ok: false, error: 'locked'});
    await unlocked(w.ext);
    expect(await ask(w, {type: 'presale.unrecorded', account: RECIPIENT})).toEqual({ok: false, error: 'unknown-account'});
  });
});
