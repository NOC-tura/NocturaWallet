import {BALANCE_CACHE_KEY, PRICE_CACHE_KEY, clearCaches, readCachedBalances, readCachedPrices, writeCachedBalances} from '../balanceCache';
import {handleWallet} from '../walletApi';
import {handleMessage} from '../messages';
import {VAULT_KEY} from '../accountsStore';
import {browserDeps} from '../deps';
import {RequestUnreachable, RpcForbidden} from '../../../../core/solana/rpc';
import {WALLET_TOKENS} from '../../../../core/solana/balances';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, unlocked} from './fixtures';

const ENV = {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: ACCOUNT.publicKey}]};
const NOC = WALLET_TOKENS.NOC.mint as string;
const balanceReader = () => fakeReader({getBalance: async () => 7n, getTokenAccountsByOwner: async () => [{pubkey: 'a', mint: NOC, owner: ACCOUNT.publicKey, amount: 12n, decimals: 9}]});

describe('wallet.prices (E1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps /wallet/prices and the stage price to numbers, with the time, and caches them', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    const deps = fakeDeps({prices: async () => ({solana: 150, usdc: 1, usdt: 0.999}), stagePrice: async () => 0.1501});
    const r = await handleWallet(ext, deps, 'wallet.prices', {});
    expect(r).toEqual({ok: true, data: {sol: 150, usdc: 1, usdt: 0.999, noc: 0.1501, at: deps.clock.t}});
    expect(await readCachedPrices(ext)).toEqual({sol: 150, usdc: 1, usdt: 0.999, noc: 0.1501, at: deps.clock.t});
  });

  // Final review M5: prices are cached only while a wallet exists (the same check as the balances).
  it('with no wallet stored, fresh prices are answered but not cached', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    expect(await handleWallet(ext, deps, 'wallet.prices', {})).toMatchObject({ok: true, data: {sol: 150}});
    expect(await ext.local.get(PRICE_CACHE_KEY)).toBeUndefined();
  });

  it('one source failing nulls only its own fields', async () => {
    const noStats = fakeDeps({stagePrice: async () => {
      throw new Error('stats down');
    }});
    expect((await handleWallet(fakeExt(), noStats, 'wallet.prices', {})).data).toMatchObject({sol: 150, usdc: 1, usdt: 1, noc: null});
    const noMarket = fakeDeps({prices: async () => {
      throw new RequestUnreachable('u', 'offline');
    }});
    expect((await handleWallet(fakeExt(), noMarket, 'wallet.prices', {})).data).toMatchObject({sol: null, usdc: null, usdt: null, noc: 0.1501});
  });

  it("both failing is the first read's refusal, and nothing is cached", async () => {
    const ext = fakeExt();
    const down = fakeDeps({
      prices: async () => {
        throw new RequestUnreachable('u', 'offline');
      },
      stagePrice: async () => {
        throw new Error('x');
      },
    });
    expect(await handleWallet(ext, down, 'wallet.prices', {})).toEqual({ok: false, error: 'unreachable'});
    expect(await ext.local.get(PRICE_CACHE_KEY)).toBeUndefined();
  });

  it('a 403 from either source is never swallowed', async () => {
    const forbidden = fakeDeps({stagePrice: async () => {
      throw new RpcForbidden('/stats');
    }});
    expect(await handleWallet(fakeExt(), forbidden, 'wallet.prices', {})).toEqual({ok: false, error: 'coordinator-refused'});
  });

  it('a 403 sends no second request: the shared latch refuses the other read locally', async () => {
    let requests = 0;
    vi.stubGlobal('fetch', async () => (requests++, {status: 403, json: async () => null}));
    const ext = fakeExt();
    expect(await handleWallet(ext, browserDeps(ext), 'wallet.prices', {})).toEqual({ok: false, error: 'coordinator-refused'});
    expect(requests).toBe(1);
  });

  it('a non-finite, zero or negative price is null, never 0', async () => {
    const odd = fakeDeps({prices: async () => ({solana: Number.NaN, usdc: 0, usdt: -1}), stagePrice: async () => Number.POSITIVE_INFINITY});
    expect((await handleWallet(fakeExt(), odd, 'wallet.prices', {})).data).toMatchObject({sol: null, usdc: null, usdt: null, noc: null});
  });

  it('is refused from a web page (the privileged partition)', async () => {
    const ext = fakeExt();
    const web = {id: ext.runtimeId, origin: 'https://evil.example', url: 'https://evil.example/'};
    expect(await handleMessage(ext, {type: 'wallet.prices'}, web, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
  });
});

describe('cached balances and prices (E4)', () => {
  it('a successful wallet.balances is cached for an envelope account; a refusal writes nothing', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    const deps = fakeDeps({reader: balanceReader()});
    await handleWallet(ext, deps, 'wallet.balances', {account: ACCOUNT.publicKey});
    expect(await readCachedBalances(ext, ACCOUNT.publicKey)).toEqual({sol: '7', noc: '12', usdc: '0', usdt: '0', at: deps.clock.t});
    const failing = fakeDeps({reader: fakeReader({getBalance: async () => {
      throw new RequestUnreachable('u', 'x');
    }, getTokenAccountsByOwner: async () => []})});
    const other = fakeExt();
    await other.local.set(VAULT_KEY, ENV);
    expect(await handleWallet(other, failing, 'wallet.balances', {account: ACCOUNT.publicKey})).toEqual({ok: false, error: 'unreachable'});
    expect(await other.local.get(BALANCE_CACHE_KEY)).toBeUndefined();
  });

  it('only envelope accounts are cached, and each write trims the rest', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    await ext.local.set(BALANCE_CACHE_KEY, {[RECIPIENT]: {sol: '1', noc: '0', usdc: '0', usdt: '0', at: 1}});
    await writeCachedBalances(ext, async () => [ACCOUNT.publicKey], RECIPIENT, {sol: '5', noc: '0', usdc: '0', usdt: '0'}, 2);
    // Not an envelope account: nothing written (the stale entry is still there, untouched).
    expect(Object.keys((await ext.local.get(BALANCE_CACHE_KEY)) as object)).toEqual([RECIPIENT]);
    await writeCachedBalances(ext, async () => [ACCOUNT.publicKey], ACCOUNT.publicKey, {sol: '5', noc: '0', usdc: '0', usdt: '0'}, 3);
    expect(Object.keys((await ext.local.get(BALANCE_CACHE_KEY)) as object)).toEqual([ACCOUNT.publicKey]);
  });

  it('wallet.cached: refused while locked, served while unlocked', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    await writeCachedBalances(ext, async () => [ACCOUNT.publicKey], ACCOUNT.publicKey, {sol: '5', noc: '1', usdc: '2', usdt: '3'}, 9);
    await ext.local.set(PRICE_CACHE_KEY, {sol: 150, usdc: 1, usdt: 1, noc: null, at: 9});
    expect(await handleWallet(ext, fakeDeps(), 'wallet.cached', {account: ACCOUNT.publicKey})).toEqual({ok: false, error: 'locked'});
    await unlocked(ext);
    expect(await handleWallet(ext, fakeDeps(), 'wallet.cached', {account: ACCOUNT.publicKey})).toEqual({
      ok: true,
      data: {balances: {sol: '5', noc: '1', usdc: '2', usdt: '3', at: 9}, prices: {sol: 150, usdc: 1, usdt: 1, noc: null, at: 9}},
    });
    expect(await handleWallet(ext, fakeDeps(), 'wallet.cached', {account: 'nope'})).toEqual({ok: false, error: 'malformed'});
  });

  it('a shape-violating stored cache reads as null', async () => {
    const ext = fakeExt();
    await ext.local.set(BALANCE_CACHE_KEY, {[ACCOUNT.publicKey]: {sol: '5', noc: 1, usdc: '2', usdt: '3', at: 9}});
    await ext.local.set(PRICE_CACHE_KEY, {sol: 0, usdc: 1, usdt: 1, noc: null, at: 9});
    expect(await readCachedBalances(ext, ACCOUNT.publicKey)).toBeNull();
    expect(await readCachedPrices(ext)).toBeNull();
    await ext.local.set(BALANCE_CACHE_KEY, {['__proto__']: {}});
    expect(await readCachedBalances(ext, 'constructor')).toBeNull();
  });

  it('clearCaches removes both keys', async () => {
    const ext = fakeExt();
    await ext.local.set(BALANCE_CACHE_KEY, {});
    await ext.local.set(PRICE_CACHE_KEY, {});
    await clearCaches(ext);
    expect(await ext.local.get(BALANCE_CACHE_KEY)).toBeUndefined();
    expect(await ext.local.get(PRICE_CACHE_KEY)).toBeUndefined();
  });

  it('wallet.cached is refused from a web page', async () => {
    const ext = fakeExt();
    const web = {id: ext.runtimeId, origin: 'https://evil.example', url: 'https://evil.example/'};
    expect(await handleMessage(ext, {type: 'wallet.cached', account: ACCOUNT.publicKey}, web, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
  });
});
