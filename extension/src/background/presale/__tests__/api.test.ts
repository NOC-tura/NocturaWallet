import {PRESALE_MESSAGE_TYPES, registerPresale} from '../api';
import {quote, type PresaleBalances} from '../quote';
import {handleMessage, registerPresaleHandler} from '../../messages';
import {PENDING_KEY, type PendingRecord} from '../../pendingStore';
import type {GeoAnswer} from '../../geo/gate';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {fakeExt} from '../../__tests__/fakeExt';
import {HOLDING_LARGE, HOLDING_SMALL, pendingRecord, unlocked} from '../../__tests__/fixtures';
import {MAINNET_NOC_MINT, MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../../core/presale/addresses';
import {SPL_TOKEN_PROGRAM} from '../../../../../core/solana/encoding';
import {RequestUnreachable, RpcCoolingDown, RpcForbidden, type AccountData, type TokenAccountEntry} from '../../../../../core/solana/rpc';
import type {Prices} from '../../../../../core/portfolio/value';
import {ACCOUNT, CONFIG_PDA, NOW_MS, OTHER, allocationData, chainMap, chainReader, configData, program, userData, type Chain} from './chain';

// B1d §1.4, §2.5, §3.2 (C3, C8, C12, C30, C35): the three presale messages of B1d-1b Task 1, through the real
// background's message handler — the partition, the strict payloads, the view in every variant with the open record
// in each, the gate-only re-read, the quote from the last view's snapshot, the banner from the last config snapshot.
registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});

const EXT = fakeExt();
const ORIGIN = EXT.extensionOrigin;
const ID = EXT.runtimeId;
const POPUP = {id: ID, origin: ORIGIN, url: `${ORIGIN}/popup.html`};
const TAB = {id: ID, origin: ORIGIN, url: `${ORIGIN}/wallet.html#/presale`, tab: {}, frameId: 0};
const SOL_USD = 198.42;
const OPEN: GeoAnswer = {open: true, reason: null, countryCode: 'SI'};
const USDC_SMALL = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const USDT_ONE = '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh';
const NOC_ONE = 'BQcdHdAQW1hczDbBi9hiegXAR7A98Q9jx3X3iBBBDiq4';

const holding = (pubkey: string, mint: string, amount: bigint, owner = ACCOUNT): TokenAccountEntry => ({pubkey, mint, owner, amount, decimals: mint === MAINNET_NOC_MINT ? 9 : 6});
const HOLDINGS: TokenAccountEntry[] = [
  holding(USDC_SMALL, MAINNET_USDC_MINT, 30_000_000n),
  holding(HOLDING_LARGE, MAINNET_USDC_MINT, 50_000_000n),
  holding(USDT_ONE, MAINNET_USDT_MINT, 7_000_000n),
  holding(NOC_ONE, MAINNET_NOC_MINT, 999_000_000_000n),
  // Not the account's: an RPC that lists it is believed for nothing.
  holding(HOLDING_SMALL, MAINNET_USDC_MINT, 900_000_000n, OTHER),
];

interface Calls {
  accounts: string[][];
  balance: number;
  tokens: unknown[][];
  prices: number;
  geo: number;
}
interface World {
  chain: Map<string, AccountData | null>;
  wallet: {sol: bigint; holdings: TokenAccountEntry[]};
  calls: Calls;
  deps: ReturnType<typeof fakeDeps>;
}
function world(o: {chain?: Partial<Chain>; geo?: () => Promise<GeoAnswer>; prices?: () => Promise<Prices>; balance?: () => Promise<bigint>} = {}): World {
  const calls: Calls = {accounts: [], balance: 0, tokens: [], prices: 0, geo: 0};
  const chain = chainMap(o.chain);
  const wallet = {sol: 5_000_000_000n, holdings: HOLDINGS};
  const reader = chainReader(chain, calls.accounts, {
    getBalance: async owner => {
      calls.balance += 1;
      if (owner !== ACCOUNT) throw new Error(`unexpected owner ${owner}`);
      return o.balance === undefined ? wallet.sol : o.balance();
    },
    getTokenAccountsByOwner: async (owner, filter) => {
      calls.tokens.push([owner, filter]);
      return wallet.holdings;
    },
  });
  const deps = fakeDeps({
    reader,
    geo: async () => {
      calls.geo += 1;
      return o.geo === undefined ? OPEN : o.geo();
    },
    prices: async () => {
      calls.prices += 1;
      return o.prices === undefined ? {solana: SOL_USD, usdc: 1, usdt: 1} : o.prices();
    },
  });
  deps.clock.t = NOW_MS;
  return {chain, wallet, calls, deps};
}
async function unlockedExt() {
  const ext = fakeExt();
  await unlocked(ext);
  return ext;
}
const send = (ext: ReturnType<typeof fakeExt>, w: World, msg: Record<string, unknown>, sender: object = POPUP) => handleMessage(ext, msg, sender, w.deps);
const viewMsg = {type: 'presale.view', account: ACCOUNT};
const quoteMsg = (currency: string, amount: string) => ({type: 'presale.quote', account: ACCOUNT, currency, amount});
const requests = (c: Calls) => ({accounts: c.accounts.length, balance: c.balance, tokens: c.tokens.length, prices: c.prices, geo: c.geo});

const STAGE_VIEW = {stage: 0, priceTicks: '1501', nextPriceTicks: '1723', stageSoldBase: '1312240123017711', stageCapBase: '10240000000000000', raisedCents: '19696720'};
const OPEN_VIEW = {
  open: true,
  state: STAGE_VIEW,
  limits: {minCents: '1000', maxTxCents: '5000000', userRemainingCents: '20000000', firstPurchase: true},
  allocation: {exists: false, totalBase: '0', bonusBase: '0'},
  balances: {SOL: '5000000000', USDC: {largest: '50000000', total: '80000000'}, USDT: {largest: '7000000', total: '7000000'}},
  solUsdMicros: '198420000',
  countryCode: 'SI',
  referral: {onChain: null, canRegister: true},
  pending: null,
};
/** B1d §2.3: an open purchase of ACCOUNT in v1_pending. */
const PURCHASE: PendingRecord = pendingRecord({
  id: 'buy',
  account: ACCOUNT,
  signature: 'sig-buy',
  intent: null,
  fee: {networkLamports: '5050', markupLamports: '0'},
  extra: {kind: 'presale-buy', data: {currency: 'SOL', amount: '2000000000', stage: '0', priceTicks: '1501', nocBase: '1', spentCents: '30000', destination: 'D', referrer: null}},
});
const {wire: _wire, firstBroadcast: _firstBroadcast, ...PURCHASE_VIEW} = PURCHASE;

describe('the partition (§1.4): the popup and the full tab only', () => {
  it('the three types of B1d-1b Task 1, Task 2’s prepare, Task 3’s four and B1d-2’s presale.unrecorded, presale.checkReferrer and presale.referral, all privileged', () => {
    expect(PRESALE_MESSAGE_TYPES).toEqual(['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded', 'presale.checkReferrer', 'presale.referral']);
  });

  it('answered from the popup and from the full tab (positive control)', async () => {
    for (const sender of [POPUP, TAB]) {
      const ext = await unlockedExt();
      const w = world();
      expect(await send(ext, w, viewMsg, sender)).toEqual({ok: true, data: OPEN_VIEW});
      expect(await send(ext, w, {type: 'presale.banner'}, sender)).toMatchObject({ok: true});
      expect(await send(ext, w, quoteMsg('USDC', '10000000'), sender)).toMatchObject({ok: true});
    }
  });

  it('refused, before any read, from a content script, the approval window, the vault page, a web page, another extension and any other own page', async () => {
    const other = 'someotherextensionidxxxxxxxxxxxx';
    const refused = [
      // A content script: this extension's id, the page's origin.
      {id: ID, origin: 'https://dapp.example', url: 'https://dapp.example/', tab: {}, frameId: 0},
      {id: ID, origin: ORIGIN, url: `${ORIGIN}/approve.html`, tab: {}, frameId: 0},
      {id: ID, origin: ORIGIN, url: `${ORIGIN}/unlock.html`, tab: {}, frameId: 0},
      {origin: 'https://evil.example', url: 'https://evil.example/', tab: {}, frameId: 0},
      {id: other, origin: `chrome-extension://${other}`, url: `chrome-extension://${other}/popup.html`},
      {...POPUP, id: other},
      {id: ID, origin: ORIGIN, url: `${ORIGIN}/offscreen.html`},
      {id: ID, origin: ORIGIN},
    ];
    const ext = await unlockedExt();
    for (const type of PRESALE_MESSAGE_TYPES) {
      for (const sender of refused) {
        const w = world();
        expect([type, sender, await send(ext, w, {...quoteMsg('SOL', '1'), type}, sender)]).toEqual([type, sender, {ok: false, error: 'forbidden'}]);
        expect(requests(w.calls)).toEqual({accounts: 0, balance: 0, tokens: 0, prices: 0, geo: 0});
      }
    }
  });

  it('a handler that is registered twice, or a type outside the presale list, is refused at registration', () => {
    expect(() => registerPresaleHandler('presale.view', async () => ({ok: true}))).toThrow('registered already');
    expect(() => registerPresaleHandler('wallet.send', async () => ({ok: true}))).toThrow('not a presale message type');
  });
});

describe('strict payloads, then the session', () => {
  it.each([
    ['an extra key', {...viewMsg, extra: 1}],
    ['no account', {type: 'presale.view'}],
    ['a non-address account', {...viewMsg, account: 'not-an-address'}],
    ['refresh other than gate', {...viewMsg, refresh: 'all'}],
    ['banner with a key', {type: 'presale.banner', account: ACCOUNT}],
    ['quote: NOC', quoteMsg('NOC', '1')],
    ['quote: sol', quoteMsg('sol', '1')],
    ['quote: 0', quoteMsg('USDC', '0')],
    ['quote: empty', quoteMsg('USDC', '')],
    ['quote: leading zero', quoteMsg('USDC', '01')],
    ['quote: negative', quoteMsg('USDC', '-1')],
    ['quote: decimal', quoteMsg('USDC', '1.5')],
    ['quote: above u64', quoteMsg('USDC', '18446744073709551616')],
    ['quote: MAX', quoteMsg('USDC', 'MAX')],
    ['quote: a number', {...quoteMsg('USDC', '1'), amount: 1}],
    ['quote: an extra key', {...quoteMsg('USDC', '1'), stage: 0}],
  ])('%s → malformed, nothing read', async (_name, msg) => {
    const ext = await unlockedExt();
    const w = world();
    expect(await send(ext, w, msg)).toEqual({ok: false, error: 'malformed'});
    expect(requests(w.calls)).toEqual({accounts: 0, balance: 0, tokens: 0, prices: 0, geo: 0});
  });

  it('the largest u64 is an amount (positive control)', async () => {
    const ext = await unlockedExt();
    const w = world();
    await send(ext, w, viewMsg);
    expect(await send(ext, w, quoteMsg('USDC', '18446744073709551615'))).toMatchObject({ok: true, data: {line: 'above-max-tx'}});
  });

  it('locked, or an account outside the session — nothing read', async () => {
    const w = world();
    for (const msg of [viewMsg, quoteMsg('USDC', '1'), {type: 'presale.banner'}]) expect(await send(fakeExt(), w, msg)).toEqual({ok: false, error: 'locked'});
    const ext = await unlockedExt();
    for (const msg of [{...viewMsg, account: OTHER}, {...quoteMsg('USDC', '1'), account: OTHER}]) expect(await send(ext, w, msg)).toEqual({ok: false, error: 'unknown-account'});
    expect(requests(w.calls)).toEqual({accounts: 0, balance: 0, tokens: 0, prices: 0, geo: 0});
  });

  it('without deps the background answers unavailable', async () => {
    expect(await handleMessage(await unlockedExt(), viewMsg, POPUP)).toEqual({ok: false, error: 'unavailable'});
  });
});

describe('presale.view (§2.5)', () => {
  it('open: the stage, the limits, the allocation, both stablecoins’ largest and total holding, SOL, the price — one read each', async () => {
    const ext = await unlockedExt();
    const w = world();
    expect(await send(ext, w, viewMsg)).toEqual({ok: true, data: OPEN_VIEW});
    expect(requests(w.calls)).toEqual({accounts: 1, balance: 1, tokens: 1, prices: 1, geo: 1});
    expect(w.calls.tokens).toEqual([[ACCOUNT, {programId: SPL_TOKEN_PROGRAM}]]);
  });

  it('open with an existing allocation: its totals, the remainder, not a first purchase', async () => {
    const ext = await unlockedExt();
    const w = world({chain: {user: program(userData()), allocation: program(allocationData({spent: 300_000n}))}});
    expect(await send(ext, w, viewMsg)).toMatchObject({
      ok: true,
      data: {open: true, limits: {userRemainingCents: '19700000', firstPurchase: false}, allocation: {exists: true, totalBase: '1998667554963', bonusBase: '16142571618'}},
    });
  });

  it('B1d-2 (§2.5): the referral — the referrer on chain, and canRegister exactly for a first purchase without one (D8: an on-chain referrer always wins)', async () => {
    const referral = async (chain: Partial<Chain>) => ((await send(await unlockedExt(), world({chain}), viewMsg)) as {data: {referral: unknown}}).data.referral;
    // No allocation: a first purchase, nothing on chain → the field is offered (positive control).
    expect(await referral({})).toEqual({onChain: null, canRegister: true});
    // An allocation that never bought (purchase_count 0) and has no referrer: still a first purchase (C21).
    expect(await referral({user: program(userData()), allocation: program(allocationData({count: 0, spent: 0n, totalTokens: 0n, bonus: 0n}))})).toEqual({onChain: null, canRegister: true});
    // Bought before: nothing can be registered any more.
    expect(await referral({user: program(userData()), allocation: program(allocationData())})).toEqual({onChain: null, canRegister: false});
    // A referrer on chain — with no purchase yet, and after purchases: it is named, and it wins.
    expect(await referral({user: program(userData()), allocation: program(allocationData({count: 0, spent: 0n, totalTokens: 0n, bonus: 0n, referrer: OTHER}))})).toEqual({onChain: OTHER, canRegister: false});
    expect(await referral({user: program(userData()), allocation: program(allocationData({referrer: OTHER}))})).toEqual({onChain: OTHER, canRegister: false});
  });

  it('the open view carries the country the gate detected (D22) — as the gate named it, null when it named none, never a default', async () => {
    for (const countryCode of ['SI', 'CN', null]) {
      const ext = await unlockedExt();
      const w = world({geo: async () => ({open: true, reason: null, countryCode})});
      expect([countryCode, await send(ext, w, viewMsg)]).toEqual([countryCode, {ok: true, data: {...OPEN_VIEW, countryCode}}]);
    }
  });

  it('no SOL price — a failed read or no usable price — is solUsdMicros null, never an invented price', async () => {
    for (const prices of [async () => ({}), async () => ({solana: 0}), async () => ({solana: Number.NaN}), async () => Promise.reject(new RequestUnreachable('/wallet/prices', 'down'))]) {
      const ext = await unlockedExt();
      expect(await send(ext, world({prices}), viewMsg)).toEqual({ok: true, data: {...OPEN_VIEW, solUsdMicros: null}});
    }
  });

  it.each([
    ['read-failed', {balance: async () => Promise.reject(new RequestUnreachable('/rpc', 'down'))}],
    ['refused', {balance: async () => Promise.reject(new RpcForbidden('/rpc'))}],
    ['refused', {prices: async () => Promise.reject(new RpcCoolingDown('/wallet/prices'))}],
  ] as const)('a balance or price read failing → unavailable %s (fail closed, never a zero balance)', async (code, o) => {
    const ext = await unlockedExt();
    expect(await send(ext, world(o), viewMsg)).toEqual({ok: true, data: {open: false, why: 'unavailable', code, pending: null}});
  });

  it.each([
    ['read-failed', new RequestUnreachable('/rpc', 'down')],
    ['refused', new RpcForbidden('/rpc')],
  ] as const)('the state read failing → unavailable %s, and no balance read', async (code, error) => {
    const ext = await unlockedExt();
    const w = world();
    const deps = {...w.deps, reader: {...w.deps.reader, getAccountsData: async () => Promise.reject(error)}};
    expect(await handleMessage(ext, viewMsg, POPUP, deps)).toEqual({ok: true, data: {open: false, why: 'unavailable', code, pending: null}});
    expect([w.calls.balance, w.calls.tokens.length, w.calls.prices]).toEqual([0, 0, 0]);
  });

  it('a moved pin → unavailable malformed', async () => {
    const ext = await unlockedExt();
    const w = world({chain: {config: program(configData({treasury: OTHER}))}});
    expect(await send(ext, w, viewMsg)).toEqual({ok: true, data: {open: false, why: 'unavailable', code: 'malformed', pending: null}});
    expect(w.calls.balance).toBe(0);
  });

  it('inactive and blocked carry the stage as last read, and read no balance', async () => {
    const ext = await unlockedExt();
    const inactive = world({chain: {config: program(configData({active: 0}))}});
    expect(await send(ext, inactive, viewMsg)).toEqual({ok: true, data: {open: false, why: 'inactive', state: STAGE_VIEW, pending: null}});
    const blocked = world({chain: {user: program(userData({blocked: 1}))}});
    expect(await send(ext, blocked, viewMsg)).toEqual({ok: true, data: {open: false, why: 'blocked', state: STAGE_VIEW, pending: null}});
    expect([inactive.calls.balance, blocked.calls.balance]).toEqual([0, 0]);
  });

  it.each([
    {open: false, reason: 'refused', countryCode: null},
    {open: false, reason: 'no_check', countryCode: null},
    {open: false, reason: 'stale_list', countryCode: 'SI'},
    {open: false, reason: 'unknown_country', countryCode: null},
    {open: false, reason: 'sanctioned', countryCode: 'KP'},
  ] as GeoAnswer[])('the gate closed ($reason) → why geo, over every state; the stage when it was read, null when it was not', async geo => {
    const ext = await unlockedExt();
    const closed = async () => geo;
    const w = world({geo: closed});
    expect(await send(ext, w, viewMsg)).toEqual({ok: true, data: {open: false, why: 'geo', geo, state: STAGE_VIEW, pending: null}});
    expect([w.calls.balance, w.calls.prices]).toEqual([0, 0]);
    for (const chain of [{config: program(configData({active: 0}))}, {user: program(userData({blocked: 1}))}]) {
      expect(await send(ext, world({geo: closed, chain}), viewMsg)).toEqual({ok: true, data: {open: false, why: 'geo', geo, state: STAGE_VIEW, pending: null}});
    }
    expect(await send(ext, world({geo: closed, chain: {config: null}}), viewMsg)).toEqual({ok: true, data: {open: false, why: 'geo', geo, state: null, pending: null}});
  });

  it('a gate that throws is no_check — closed', async () => {
    const ext = await unlockedExt();
    const w = world({geo: async () => Promise.reject(new Error('boom'))});
    expect(await send(ext, w, viewMsg)).toEqual({ok: true, data: {open: false, why: 'geo', geo: {open: false, reason: 'no_check', countryCode: null}, state: STAGE_VIEW, pending: null}});
  });

  it('the state and the gate are both asked on every view (C12)', async () => {
    const ext = await unlockedExt();
    const w = world();
    for (let i = 0; i < 3; i++) await send(ext, w, viewMsg);
    expect([w.calls.accounts.length, w.calls.geo]).toEqual([3, 3]);
  });
});

describe('the open purchase is in every variant (C30)', () => {
  const variants: [string, Parameters<typeof world>[0], Record<string, unknown>][] = [
    ['open', {}, {open: true}],
    ['unavailable', {chain: {config: null}}, {why: 'unavailable'}],
    ['inactive', {chain: {config: program(configData({active: 0}))}}, {why: 'inactive'}],
    ['blocked', {chain: {user: program(userData({blocked: 1}))}}, {why: 'blocked'}],
    ['geo', {geo: async () => ({open: false, reason: 'no_check', countryCode: null})}, {why: 'geo'}],
  ];
  it.each(variants)('%s', async (_name, o, shape) => {
    const ext = await unlockedExt();
    await ext.local.set(PENDING_KEY, [PURCHASE]);
    expect(await send(ext, world(o), viewMsg)).toMatchObject({ok: true, data: {...shape, pending: PURCHASE_VIEW}});
  });

  it('only this account’s open presale-buy record: not a send, a dApp record, another kind, another account or a closed one', async () => {
    const records = [
      pendingRecord({id: 'send', account: ACCOUNT}),
      pendingRecord({id: 'dapp', account: ACCOUNT, intent: null, origin: 'https://dapp.example'}),
      {...PURCHASE, id: 'other-kind', extra: {kind: 'stake', data: null}},
      {...PURCHASE, id: 'no-extra', extra: null},
      {...PURCHASE, id: 'other-account', account: OTHER},
      {...PURCHASE, id: 'confirmed', state: 'confirmed' as const},
      {...PURCHASE, id: 'failed', state: 'failed' as const, failure: 'landed' as const},
    ];
    const ext = await unlockedExt();
    await ext.local.set(PENDING_KEY, records);
    expect(await send(ext, world(), viewMsg)).toEqual({ok: true, data: OPEN_VIEW});
    await ext.local.set(PENDING_KEY, [...records, {...PURCHASE, state: 'stuck'}]);
    expect(await send(ext, world(), viewMsg)).toMatchObject({ok: true, data: {pending: {...PURCHASE_VIEW, state: 'stuck'}}});
  });
});

describe('presale.view {refresh: gate} (C35): the snapshot and the gate only', () => {
  it('after a full view: two requests, the state re-read, the balances and the price of that view', async () => {
    const ext = await unlockedExt();
    const w = world();
    await send(ext, w, viewMsg);
    w.wallet.sol = 1n;
    w.chain.set(CONFIG_PDA, program(configData({stage: 1})));
    const before = requests(w.calls);
    const r = await send(ext, w, {...viewMsg, refresh: 'gate'});
    expect(r).toEqual({ok: true, data: {...OPEN_VIEW, state: {...STAGE_VIEW, stage: 1, priceTicks: '1723', nextPriceTicks: '1945'}}});
    expect(requests(w.calls)).toEqual({...before, accounts: before.accounts + 1, geo: before.geo + 1});
  });

  it('without a full view first — or after a closed one — it answers in full', async () => {
    const ext = await unlockedExt();
    const w = world();
    await send(ext, w, {...viewMsg, refresh: 'gate'});
    expect(requests(w.calls)).toEqual({accounts: 1, balance: 1, tokens: 1, prices: 1, geo: 1});
    let geo: GeoAnswer = {open: false, reason: 'no_check', countryCode: null};
    const v = world({geo: async () => geo});
    await send(ext, v, viewMsg);
    geo = OPEN;
    await send(ext, v, {...viewMsg, refresh: 'gate'});
    expect([v.calls.balance, v.calls.prices]).toEqual([1, 1]);
  });

  it('a full view after a gate view reads the balances again', async () => {
    const ext = await unlockedExt();
    const w = world();
    await send(ext, w, viewMsg);
    await send(ext, w, {...viewMsg, refresh: 'gate'});
    w.wallet.sol = 7n;
    expect(await send(ext, w, viewMsg)).toMatchObject({ok: true, data: {balances: {SOL: '7'}}});
    expect(w.calls.balance).toBe(2);
  });
});

describe('presale.quote (§3.2): from the last view’s snapshot of that account, at most 30 s old', () => {
  const BALANCES: PresaleBalances = {SOL: 5_000_000_000n, USDC: {largest: 50_000_000n, total: 80_000_000n}, USDT: {largest: 7_000_000n, total: 7_000_000n}};

  it('no view yet → stale; then the quote, as quote() computes it, in decimal strings — no network', async () => {
    const ext = await unlockedExt();
    const w = world();
    expect(await send(ext, w, quoteMsg('USDC', '20000000'))).toEqual({ok: true, data: {stale: true}});
    await send(ext, w, viewMsg);
    const before = requests(w.calls);
    expect(await send(ext, w, quoteMsg('USDC', '20000000'))).toEqual({ok: true, data: {amount: '20000000', cents: '2000', nocBase: '133244503664', line: null}});
    const snapshot = {stage: {stage: 0, priceTicks: 1501n, nextPriceTicks: 1723n, stageSoldBase: 0n, stageCapBase: 0n, raisedCents: 0n}, limits: {minCents: 1_000n, maxTxCents: 5_000_000n, userRemainingCents: 20_000_000n, firstPurchase: true}, newPdaRent: 2_999_760n};
    for (const [currency, amount] of [['SOL', 'max'], ['USDC', 'max'], ['USDT', '7000001'], ['SOL', '1000000000']] as const) {
      const q = quote({snapshot, balances: BALANCES, solUsd: SOL_USD}, currency, amount === 'max' ? 'max' : BigInt(amount));
      const expected = {amount: q.amount.toString(), cents: q.cents?.toString() ?? null, nocBase: q.nocBase?.toString() ?? null, line: q.line};
      expect([currency, amount, await send(ext, w, quoteMsg(currency, amount))]).toEqual([currency, amount, {ok: true, data: expected}]);
    }
    expect(requests(w.calls)).toEqual(before);
  });

  it('30 000 ms after the view’s read began it still quotes; 30 001 ms, or a clock that went backwards, is stale', async () => {
    const ext = await unlockedExt();
    const w = world();
    await send(ext, w, viewMsg);
    w.deps.clock.t = NOW_MS + 30_000;
    expect(await send(ext, w, quoteMsg('USDC', '20000000'))).toMatchObject({ok: true, data: {line: null}});
    w.deps.clock.t = NOW_MS + 30_001;
    expect(await send(ext, w, quoteMsg('USDC', '20000000'))).toEqual({ok: true, data: {stale: true}});
    w.deps.clock.t = NOW_MS - 1;
    expect(await send(ext, w, quoteMsg('USDC', '20000000'))).toEqual({ok: true, data: {stale: true}});
  });

  it('a gate re-read renews the snapshot; a closed view ends it; another account has none', async () => {
    const ext = await unlockedExt();
    let geo = OPEN;
    const w = world({geo: async () => geo});
    await send(ext, w, viewMsg);
    w.deps.clock.t = NOW_MS + 25_000;
    await send(ext, w, {...viewMsg, refresh: 'gate'});
    w.deps.clock.t = NOW_MS + 50_000;
    expect(await send(ext, w, quoteMsg('USDC', '20000000'))).toMatchObject({ok: true, data: {line: null}});
    geo = {open: false, reason: 'stale_list', countryCode: 'SI'};
    await send(ext, w, {...viewMsg, refresh: 'gate'});
    expect(await send(ext, w, quoteMsg('USDC', '20000000'))).toEqual({ok: true, data: {stale: true}});
  });

  it('the snapshot of another deps instance (another background) is not this one’s', async () => {
    const ext = await unlockedExt();
    await send(ext, world(), viewMsg);
    expect(await send(ext, world(), quoteMsg('USDC', '20000000'))).toEqual({ok: true, data: {stale: true}});
  });

  it('a view without a SOL price quotes SOL as no-sol-price — and the stablecoins as usual', async () => {
    const ext = await unlockedExt();
    const w = world({prices: async () => ({usdc: 1, usdt: 1})});
    await send(ext, w, viewMsg);
    expect(await send(ext, w, quoteMsg('SOL', '1000000000'))).toEqual({ok: true, data: {amount: '1000000000', cents: null, nocBase: null, line: 'no-sol-price'}});
    expect(await send(ext, w, quoteMsg('USDC', '20000000'))).toMatchObject({ok: true, data: {cents: '2000', line: null}});
  });

  it('the limits are the snapshot’s: one cent below the configured $10 for SOL is below-min, $10 is not (D7, no $25 SOL floor)', async () => {
    const ext = await unlockedExt();
    const w = world();
    await send(ext, w, viewMsg);
    // At $198.42, 50 398 145 lamports are worth 999 cents and 50 398 146 are worth 1 000.
    expect(await send(ext, w, quoteMsg('SOL', '50398145'))).toMatchObject({ok: true, data: {cents: '999', line: 'below-min'}});
    expect(await send(ext, w, quoteMsg('SOL', '50398146'))).toMatchObject({ok: true, data: {cents: '1000', line: null}});
  });
});

describe('presale.banner (§1.4): the last config snapshot ≤ 60 s old, else a config-only read; no gate', () => {
  it('after an open view: from its snapshot, no read; at 60 001 ms one config-only read', async () => {
    const ext = await unlockedExt();
    const w = world({geo: async () => OPEN});
    await send(ext, w, viewMsg);
    const geoCalls = w.calls.geo;
    w.deps.clock.t = NOW_MS + 60_000;
    expect(await send(ext, w, {type: 'presale.banner'})).toEqual({ok: true, data: {stage: 0, priceTicks: '1501', stagePercent: 12}});
    expect(w.calls.accounts).toHaveLength(1);
    w.deps.clock.t = NOW_MS + 60_001;
    expect(await send(ext, w, {type: 'presale.banner'})).toEqual({ok: true, data: {stage: 0, priceTicks: '1501', stagePercent: 12}});
    expect(w.calls.accounts).toEqual([expect.any(Array), [CONFIG_PDA]]);
    expect(w.calls.geo).toBe(geoCalls);
  });

  it('with no snapshot: one config-only read, then none within 60 s; the gate is never asked', async () => {
    const ext = await unlockedExt();
    const w = world({geo: async () => Promise.reject(new Error('the banner must not ask the gate'))});
    expect(await send(ext, w, {type: 'presale.banner'})).toEqual({ok: true, data: {stage: 0, priceTicks: '1501', stagePercent: 12}});
    w.deps.clock.t = NOW_MS + 59_000;
    await send(ext, w, {type: 'presale.banner'});
    expect(w.calls.accounts).toEqual([[CONFIG_PDA]]);
  });

  it('a blocked account’s view keeps the banner — the sale is live; an inactive sale has none', async () => {
    const ext = await unlockedExt();
    const w = world({chain: {user: program(userData({blocked: 1}))}});
    await send(ext, w, viewMsg);
    expect(await send(ext, w, {type: 'presale.banner'})).toMatchObject({ok: true, data: {stage: 0}});
    const inactive = world({chain: {config: program(configData({active: 0}))}});
    expect(await send(ext, inactive, {type: 'presale.banner'})).toEqual({ok: true, data: null});
    await send(ext, inactive, viewMsg);
    expect(await send(ext, inactive, {type: 'presale.banner'})).toEqual({ok: true, data: null});
  });

  it.each([
    ['a 403', {getAccountsData: async () => Promise.reject(new RpcForbidden('/rpc'))}],
    ['the cool-down', {getAccountsData: async () => Promise.reject(new RpcCoolingDown('/rpc'))}],
    ['no answer', {getAccountsData: async () => Promise.reject(new RequestUnreachable('/rpc', 'down'))}],
    ['a malformed config', {getAccountsData: async () => [program(configData({admin: OTHER}))]}],
    ['no config', {getAccountsData: async () => [null]}],
  ])('null on %s', async (_name, reader) => {
    const ext = await unlockedExt();
    const w = world();
    const deps = {...w.deps, reader: {...w.deps.reader, ...reader}};
    expect(await handleMessage(ext, {type: 'presale.banner'}, POPUP, deps)).toEqual({ok: true, data: null});
  });

  it('a view that found the presale unavailable drops the snapshot: the banner reads again', async () => {
    const ext = await unlockedExt();
    const w = world();
    await send(ext, w, viewMsg);
    w.chain.set(CONFIG_PDA, null);
    await send(ext, w, viewMsg);
    expect(await send(ext, w, {type: 'presale.banner'})).toEqual({ok: true, data: null});
    expect(w.calls.accounts.at(-1)).toEqual([CONFIG_PDA]);
  });

  it('the banner’s own config read finding the presale unavailable drops the stale snapshot: null, not the old stage (R-B4)', async () => {
    const ext = await unlockedExt();
    const w = world();
    await send(ext, w, viewMsg);
    w.deps.clock.t = NOW_MS + 60_001;
    w.deps.reader.getAccountsData = async () => Promise.reject(new RequestUnreachable('/rpc', 'down'));
    expect(await send(ext, w, {type: 'presale.banner'})).toEqual({ok: true, data: null});
  });

  it('stagePercent is floor(100 × sold / cap)', async () => {
    const ext = await unlockedExt();
    const w = world({chain: {config: program(configData({stageSold: 10_137_599_999_999_999n}))}});
    expect(await send(ext, w, {type: 'presale.banner'})).toMatchObject({ok: true, data: {stagePercent: 98}});
  });
});
