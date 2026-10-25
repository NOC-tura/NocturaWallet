import {createEngine, type Transport} from '../../engine';
import {PREPARE_REFUSALS, bannerOf, presaleClient, presaleViewOf, purchaseDataOf, purchaseViewOf, quoteOf, resumableOf} from '../client';
import {registerPresale} from '../../../background/presale/api';
import {handleMessage, registerPresaleHandler} from '../../../background/messages';
import {PENDING_KEY} from '../../../background/pendingStore';
import type {GeoAnswer} from '../../../background/geo/gate';
import {fakeDeps} from '../../../background/__tests__/fakeDeps';
import {fakeExt} from '../../../background/__tests__/fakeExt';
import {HOLDING_LARGE, pendingRecord, signedWire, unlocked} from '../../../background/__tests__/fixtures';
import {viewOf} from '../../../background/pendingStore';
import {firstSignature} from '../../../../../core/solana/broadcast';
import {base64} from '@scure/base';
import {ACCOUNT, NOW_MS, TREASURY_ADDRESS, chainMap, chainReader, configData, program, type Chain} from '../../../background/presale/__tests__/chain';
import {MAINNET_USDC_MINT} from '../../../../../core/presale/addresses';

registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler});

// B1d §1.4, §2.5, §3.2, §3.3 (C3): the popup's presale client — its shape checks on the REAL background's answers
// (positive controls), and every way a reply can be of another shape (failed, never shown).
const OPEN: GeoAnswer = {open: true, reason: null, countryCode: 'SI'};
function depsFor(o: {chain?: Partial<Chain>; geo?: GeoAnswer}) {
  const reader = chainReader(chainMap(o.chain), [], {
    getBalance: async () => 5_000_000_000n,
    getTokenAccountsByOwner: async owner => [{pubkey: HOLDING_LARGE, mint: MAINNET_USDC_MINT, owner, amount: 50_000_000n, decimals: 6}],
  });
  const deps = fakeDeps({reader, geo: async () => o.geo ?? OPEN, prices: async () => ({solana: 198.42, usdc: 1, usdt: 1})});
  deps.clock.t = NOW_MS;
  return deps;
}
const popupOf = (ext: ReturnType<typeof fakeExt>) => ({id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/popup.html`});
async function wired(o: {chain?: Partial<Chain>; geo?: GeoAnswer} = {}) {
  const ext = fakeExt();
  await unlocked(ext);
  const deps = depsFor(o);
  const sent: unknown[] = [];
  const transport: Transport = m => {
    sent.push(m);
    return handleMessage(ext, m, popupOf(ext), deps);
  };
  return {ext, sent, client: presaleClient(createEngine(transport, async () => undefined))};
}
/** The background's raw answer to a message, for the shape checks' negative rows. */
async function raw(m: Record<string, unknown>, o: {chain?: Partial<Chain>; geo?: GeoAnswer} = {}): Promise<Record<string, unknown>> {
  const ext = fakeExt();
  await unlocked(ext);
  const r = (await handleMessage(ext, m, popupOf(ext), depsFor(o))) as {data: Record<string, unknown>};
  return r.data;
}
const DATA = {currency: 'USDC', amount: '25000000', stage: '0', priceTicks: '1501', nocBase: '166555629580', spentCents: '2500', destination: TREASURY_ADDRESS, referrer: null};
const SIGNATURE = '5'.repeat(88);

describe('the client against the real background (positive controls)', () => {
  it('view: the open variant with bigints; the messages as the background parses them, `refresh` only when asked', async () => {
    const w = await wired();
    const r = await w.client.view(ACCOUNT);
    expect(r).toEqual({
      ok: true,
      data: {
        open: true,
        state: {stage: 0, priceTicks: 1501n, nextPriceTicks: 1723n, stageSoldBase: 1_312_240_123_017_711n, stageCapBase: 10_240_000_000_000_000n, raisedCents: 19_696_720n},
        limits: {minCents: 1000n, maxTxCents: 5_000_000n, userRemainingCents: 20_000_000n, firstPurchase: true},
        allocation: {exists: false, totalBase: 0n, bonusBase: 0n},
        balances: {SOL: 5_000_000_000n, USDC: {largest: 50_000_000n, total: 50_000_000n}, USDT: {largest: 0n, total: 0n}},
        solUsdMicros: 198_420_000n,
        countryCode: 'SI',
        pending: null,
      },
    });
    expect(await w.client.view(ACCOUNT, 'gate')).toMatchObject({ok: true, data: {open: true}});
    expect(w.sent).toEqual([
      {type: 'presale.view', account: ACCOUNT},
      {type: 'presale.view', account: ACCOUNT, refresh: 'gate'},
    ]);
  });

  it('view: the closed variants — inactive with its stage, geo with the gate’s answer and the stage, unavailable with its code', async () => {
    expect(await (await wired({chain: {config: program(configData({active: 0}))}})).client.view(ACCOUNT)).toMatchObject({ok: true, data: {open: false, why: 'inactive', state: {stage: 0, priceTicks: 1501n}, pending: null}});
    expect(await (await wired({geo: {open: false, reason: 'sanctioned', countryCode: 'KP'}})).client.view(ACCOUNT)).toMatchObject({
      ok: true,
      data: {open: false, why: 'geo', geo: {open: false, reason: 'sanctioned', countryCode: 'KP'}, state: {stage: 0}},
    });
    expect(await (await wired({chain: {config: null}})).client.view(ACCOUNT)).toEqual({ok: true, data: {open: false, why: 'unavailable', code: 'malformed', pending: null}});
  });

  it('view: an open purchase record rides in every variant, its data as stored', async () => {
    const w = await wired({chain: {config: null}});
    await w.ext.local.set(PENDING_KEY, [pendingRecord({id: 'b1', account: ACCOUNT, signature: SIGNATURE, intent: null, extra: {kind: 'presale-buy', data: DATA}})]);
    const r = await w.client.view(ACCOUNT);
    expect(r).toMatchObject({ok: true, data: {why: 'unavailable', pending: {id: 'b1', intent: null, extra: {kind: 'presale-buy', data: DATA}}}});
    expect(await w.client.pending(ACCOUNT)).toMatchObject({ok: true, data: {id: 'b1'}});
  });

  it('quote: amounts as bigint; MAX sent as "max"; stale before any view', async () => {
    const w = await wired();
    expect(await w.client.quote(ACCOUNT, 'USDC', 25_000_000n)).toEqual({ok: true, data: 'stale'});
    await w.client.view(ACCOUNT);
    expect(await w.client.quote(ACCOUNT, 'USDC', 25_000_000n)).toEqual({ok: true, data: {amount: 25_000_000n, cents: 2500n, nocBase: 166_555_629_580n, line: null}});
    expect(await w.client.quote(ACCOUNT, 'USDC', 'max')).toMatchObject({ok: true, data: {amount: 50_000_000n, line: null}});
    expect(await w.client.quote(ACCOUNT, 'SOL', 1n)).toMatchObject({ok: true, data: {line: 'below-min'}});
    expect(w.sent.slice(-2)).toEqual([
      {type: 'presale.quote', account: ACCOUNT, currency: 'USDC', amount: 'max'},
      {type: 'presale.quote', account: ACCOUNT, currency: 'SOL', amount: '1'},
    ]);
  });

  it('refusals come through typed: locked, unknown-account; prepareBuy’s own codes (a listed refusal)', async () => {
    const w = await wired();
    expect(await w.client.view(HOLDING_LARGE)).toEqual({ok: false, error: 'unknown-account'});
    expect(await w.client.prepareBuy(ACCOUNT, {currency: 'USDC', amount: 1n, stage: 0})).toEqual({ok: false, error: 'below-min'});
    expect(w.sent.at(-1)).toEqual({type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'USDC', amount: '1', stage: 0}});
    expect(PREPARE_REFUSALS).toContain('presale-busy');
    const locked = await wired();
    await locked.ext.session.clear();
    expect(await locked.client.view(ACCOUNT)).toEqual({ok: false, error: 'locked'});
  });
});

describe('the shape checks: anything else the background did not promise is failed', () => {
  it('view: an extra key anywhere, a stage outside 0–9, a zero price or cap, a zero SOL price, a geo answer open with a reason or a geo variant that is open, a record that is not a purchase', async () => {
    const open = await raw({type: 'presale.view', account: ACCOUNT});
    expect(presaleViewOf(open)).toBeDefined();
    const state = open.state as Record<string, unknown>;
    const bad: unknown[] = [
      {...open, extra: 1},
      {...open, state: {...state, extra: 1}},
      {...open, state: {...state, stage: 10}},
      {...open, state: {...state, priceTicks: '0'}},
      {...open, state: {...state, stageCapBase: '0'}},
      {...open, state: {...state, raisedCents: 196_967}},
      {...open, solUsdMicros: '0'},
      // D22: the gate's country as the gate gives it — two capital letters or null, and the key always there.
      {...open, countryCode: 'si'},
      {...open, countryCode: 'SVN'},
      {...open, countryCode: 386},
      Object.fromEntries(Object.entries(open).filter(([k]) => k !== 'countryCode')),
      {...open, limits: {...(open.limits as object), firstPurchase: 'yes'}},
      {...open, balances: {...(open.balances as object), USDC: {largest: '2', total: '1'}}},
      {...open, pending: pendingRecord({intent: null, signature: SIGNATURE, account: ACCOUNT, extra: {kind: 'other-kind', data: null}})},
      {...open, pending: pendingRecord({signature: SIGNATURE, account: ACCOUNT, intent: {token: 'SOL', recipient: TREASURY_ADDRESS, amount: '1'}})},
      {...open, open: 'yes'},
    ];
    for (const b of bad) expect([b, presaleViewOf(b)]).toEqual([b, undefined]);
    expect(presaleViewOf({...open, countryCode: null})).toMatchObject({open: true, countryCode: null});
    const geo = await raw({type: 'presale.view', account: ACCOUNT}, {geo: {open: false, reason: 'stale_list', countryCode: 'SI'}});
    expect(presaleViewOf(geo)).toBeDefined();
    for (const g of [{open: true, reason: 'stale_list', countryCode: 'SI'}, {open: false, reason: null, countryCode: 'SI'}, {open: false, reason: 'elsewhere', countryCode: null}, {open: false, reason: 'no_check', countryCode: 'si'}, {open: true, reason: null, countryCode: null}]) {
      expect([g, presaleViewOf({...geo, geo: g})]).toEqual([g, undefined]);
    }
    expect(presaleViewOf({open: false, why: 'unavailable', code: 'exploded', pending: null})).toBeUndefined();
    expect(presaleViewOf({open: false, why: 'closed', pending: null})).toBeUndefined();
    expect(presaleViewOf({open: false, why: 'unavailable', code: 'refused'})).toBeUndefined();
  });

  it('quote: an estimate is missing exactly with no-sol-price; an unknown line; a float; stale only as {stale: true}', () => {
    expect(quoteOf({amount: '1', cents: '1', nocBase: '1', line: null})).toEqual({amount: 1n, cents: 1n, nocBase: 1n, line: null});
    expect(quoteOf({amount: '1', cents: null, nocBase: null, line: 'no-sol-price'})).toEqual({amount: 1n, cents: null, nocBase: null, line: 'no-sol-price'});
    expect(quoteOf({stale: true})).toBe('stale');
    for (const b of [
      {amount: '1', cents: null, nocBase: null, line: null},
      {amount: '1', cents: '1', nocBase: null, line: 'no-sol-price'},
      {amount: '1', cents: '1', nocBase: '1', line: 'no-sol-price'},
      {amount: '1', cents: '1', nocBase: '1', line: 'too-much'},
      {amount: 1, cents: '1', nocBase: '1', line: null},
      {amount: '1', cents: '1', nocBase: '1', line: null, extra: 1},
      {stale: false},
    ]) {
      expect([b, quoteOf(b)]).toEqual([b, undefined]);
    }
  });

  it('a purchase record’s data (§2.3): the eight strings; a stage outside 0–9, a non-address, an extra key are refused', () => {
    expect(purchaseDataOf(DATA)).toEqual({currency: 'USDC', amount: 25_000_000n, stage: 0, priceTicks: 1501n, nocBase: 166_555_629_580n, spentCents: 2500n, destination: TREASURY_ADDRESS, referrer: null});
    for (const b of [{...DATA, stage: '10'}, {...DATA, stage: 0}, {...DATA, currency: 'NOC'}, {...DATA, destination: 'D'}, {...DATA, referrer: 'x'}, {...DATA, extra: 1}, {...DATA, amount: '-1'}]) {
      expect([b, purchaseDataOf(b)]).toEqual([b, undefined]);
    }
  });

  it('a prepared purchase: the programs exactly compute-budget and presale; a bad id, a reason unknown, a fee not a string are refused', () => {
    const good = {
      id: 'ab'.repeat(16),
      currency: 'SOL',
      amount: '2000000000',
      stage: 0,
      priceTicks: '1501',
      nocBase: '2643837441705',
      spentCents: '39684',
      destination: TREASURY_ADDRESS,
      referrer: null,
      fees: {networkLamports: '5000', priorityLamports: '6000', rentLamports: '2189480'},
      reauth: {challengeId: 'cd'.repeat(16), reasons: ['first-purchase'], proven: false},
      validUntil: 1_000,
      simulation: {slot: 1, elapsedMs: 2, programs: ['compute-budget', 'presale'], instructionCount: 3},
    };
    expect(purchaseViewOf(good)).toMatchObject({amount: 2_000_000_000n, fees: {rentLamports: 2_189_480n}, reauth: {reasons: ['first-purchase']}});
    for (const b of [
      {...good, id: 'AB'.repeat(16)},
      {...good, simulation: {...good.simulation, programs: ['presale', 'compute-budget']}},
      {...good, simulation: {...good.simulation, programs: ['compute-budget', 'presale', 'system']}},
      {...good, reauth: {...good.reauth, reasons: ['first-send']}},
      {...good, fees: {...good.fees, networkLamports: 5000}},
      {...good, stage: 10},
    ]) {
      expect(purchaseViewOf(b)).toBeUndefined();
    }
  });
});

// B1d-1b Task 5: what #20's purchase variant asks — presale.preparedFor, presale.buy, presale.discardPrepared — and
// prepareBuy carrying a challenge. The messages as the background parses them; each reply's shape checked.
describe('the client for #20’s purchase variant', () => {
  const GOOD = {
    id: 'ab'.repeat(16),
    currency: 'SOL',
    amount: '2000000000',
    stage: 0,
    priceTicks: '1501',
    nocBase: '2643837441705',
    spentCents: '39684',
    destination: TREASURY_ADDRESS,
    referrer: null,
    fees: {networkLamports: '11000', priorityLamports: '6000', rentLamports: '2189480'},
    reauth: {challengeId: 'cd'.repeat(16), reasons: ['first-purchase'], proven: true},
    validUntil: 1_000,
    simulation: {slot: 1, elapsedMs: 2, programs: ['compute-budget', 'presale'], instructionCount: 3},
  };
  const canned = (answer: unknown) => {
    const sent: unknown[] = [];
    const client = presaleClient(createEngine(async m => (sent.push(m), answer), async () => undefined));
    return {sent, client};
  };
  const record = (over: Parameters<typeof pendingRecord>[0] = {}) =>
    viewOf(pendingRecord({id: 'b1', account: ACCOUNT, signature: firstSignature(signedWire(7n)), wire: base64.encode(signedWire(7n)), intent: null, extra: {kind: 'presale-buy', data: DATA}, ...over}));
  const wire = (x: unknown): unknown => JSON.parse(JSON.stringify(x, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));

  it('resumableOf: a prepared purchase with its `expired`; without it, or not a boolean, refused', () => {
    expect(resumableOf({...GOOD, expired: true})).toMatchObject({id: GOOD.id, expired: true, reauth: {proven: true}});
    expect(resumableOf({...GOOD, expired: false})?.expired).toBe(false);
    expect(resumableOf(GOOD)).toBeUndefined();
    expect(resumableOf({...GOOD, expired: 'no'})).toBeUndefined();
    expect(resumableOf({...GOOD, stage: 10, expired: false})).toBeUndefined();
  });

  it('preparedFor: {type, account}; null, or a resumable purchase; anything else failed', async () => {
    const none = canned({ok: true, data: null});
    expect(await none.client.preparedFor(ACCOUNT)).toEqual({ok: true, data: null});
    expect(none.sent).toEqual([{type: 'presale.preparedFor', account: ACCOUNT}]);
    expect((await canned({ok: true, data: {...GOOD, expired: false}}).client.preparedFor(ACCOUNT)).ok).toBe(true);
    expect(await canned({ok: true, data: GOOD}).client.preparedFor(ACCOUNT)).toEqual({ok: false, error: 'failed'});
    expect(await canned({ok: false, error: 'locked'}).client.preparedFor(ACCOUNT)).toEqual({ok: false, error: 'locked'});
  });

  it('buy: {type, id}; the wallet’s own purchase record only — a send’s record, or a record of another kind, is failed; the refusals typed with their data', async () => {
    const ok = canned({ok: true, data: wire(record())});
    const r = await ok.client.buy(GOOD.id);
    expect(ok.sent).toEqual([{type: 'presale.buy', id: GOOD.id}]);
    expect(r.ok && r.data.extra?.kind).toBe('presale-buy');
    expect(await canned({ok: true, data: wire(record({intent: {token: 'SOL', recipient: TREASURY_ADDRESS, amount: '1'}, extra: null}))}).client.buy(GOOD.id)).toEqual({ok: false, error: 'failed'});
    expect(await canned({ok: true, data: wire(record({extra: {kind: 'later-kind', data: DATA}}))}).client.buy(GOOD.id)).toEqual({ok: false, error: 'failed'});
    expect(await canned({ok: false, error: 'reauth-required', data: {challengeId: 'cd'.repeat(16)}}).client.buy(GOOD.id)).toEqual({ok: false, error: 'reauth-required', data: {challengeId: 'cd'.repeat(16)}});
    for (const code of ['price-changed', 'state-changed', 'geo-closed', 'presale-closed', 'blocked', 'above-user-limit', 'check-pending', 'prepared-expired']) {
      expect((await canned({ok: false, error: code}).client.buy(GOOD.id)) as unknown).toEqual({ok: false, error: code});
    }
    expect(await canned({ok: false, error: 'simulation-failed'}).client.buy(GOOD.id)).toEqual({ok: false, error: 'failed'});
  });

  it('discardPrepared: {type, account}, answered {ok: true} with no data; a reply carrying data is failed', async () => {
    const d = canned({ok: true});
    expect(await d.client.discardPrepared(ACCOUNT)).toEqual({ok: true, data: null});
    expect(d.sent).toEqual([{type: 'presale.discardPrepared', account: ACCOUNT}]);
    expect(await canned({ok: true, data: 1}).client.discardPrepared(ACCOUNT)).toEqual({ok: false, error: 'failed'});
  });

  it('prepareBuy carries a challenge id only when given one', async () => {
    const c = canned({ok: true, data: GOOD});
    await c.client.prepareBuy(ACCOUNT, {currency: 'SOL', amount: 2_000_000_000n, stage: 0}, 'cd'.repeat(16));
    await c.client.prepareBuy(ACCOUNT, {currency: 'SOL', amount: 2_000_000_000n, stage: 0});
    expect(c.sent).toEqual([
      {type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '2000000000', stage: 0}, challengeId: 'cd'.repeat(16)},
      {type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '2000000000', stage: 0}},
    ]);
  });
});

// B1d-1b Task 6 (§1.4, §4.5): #11's banner.
describe('the client for #11’s banner', () => {
  it('banner: {type} alone; the active sale as bigint price and whole percent (positive control); null for an inactive sale or an unreadable config', async () => {
    const w = await wired();
    expect(await w.client.banner()).toEqual({ok: true, data: {stage: 0, priceTicks: 1501n, stagePercent: 12}});
    expect(w.sent).toEqual([{type: 'presale.banner'}]);
    for (const chain of [{config: program(configData({active: 0}))}, {config: program(configData({length: 369}))}, {config: null}]) {
      expect(await (await wired({chain})).client.banner()).toEqual({ok: true, data: null});
    }
  });

  it('bannerOf: exactly three keys; a stage outside 0–9, a zero or non-decimal price, a percent not a whole number in 0–100 → failed (undefined)', () => {
    const good = {stage: 3, priceTicks: '2199', stagePercent: 47};
    expect(bannerOf(good)).toEqual({stage: 3, priceTicks: 2199n, stagePercent: 47});
    expect(bannerOf({...good, stagePercent: 0})).toEqual({stage: 3, priceTicks: 2199n, stagePercent: 0});
    expect(bannerOf({...good, stagePercent: 100})?.stagePercent).toBe(100);
    expect(bannerOf(null)).toBeNull();
    for (const bad of [
      {...good, extra: 1},
      {stage: 3, priceTicks: '2199'},
      {...good, stage: 10},
      {...good, stage: -1},
      {...good, stage: '3'},
      {...good, priceTicks: '0'},
      {...good, priceTicks: 2199},
      {...good, priceTicks: '21.99'},
      {...good, stagePercent: 101},
      {...good, stagePercent: -1},
      {...good, stagePercent: 4.5},
      {...good, stagePercent: '47'},
      [],
      'banner',
    ]) {
      expect([bad, bannerOf(bad)]).toEqual([bad, undefined]);
    }
  });
});
