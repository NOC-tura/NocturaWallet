import {FORBIDDEN_UNTIL_KEY, browserDeps, createJsonGetter, stagePriceFrom} from '../deps';
import {FORBIDDEN_COOLDOWN_MS, RpcCoolingDown, RpcForbidden, createForbiddenLatch, createRpc, type FetchInit} from '../../../../core/solana/rpc';
import {fakeExt} from './fakeExt';
import {signedWire} from './fixtures';

describe('createJsonGetter', () => {
  it('GETs API_BASE + path without credentials and returns the JSON (positive control)', async () => {
    const calls: {url: string; init: FetchInit}[] = [];
    const get = createJsonGetter(async (url, init) => (calls.push({url, init}), {status: 200, json: async () => ({x: 1})}), createForbiddenLatch());
    expect(await get.get('/wallet/prices?ids=solana')).toEqual({x: 1});
    expect(calls).toEqual([{url: 'https://api.noc-tura.io/api/v1/wallet/prices?ids=solana', init: {method: 'GET', credentials: 'omit'}}]);
  });

  it('a 403 on any coordinator route trips the one latch the RPC shares — no second request anywhere', async () => {
    let requests = 0;
    const fetch = async () => (requests++, {status: 403, json: async () => null});
    const latch = createForbiddenLatch();
    const get = createJsonGetter(fetch, latch);
    const rpc = createRpc({fetch, latch});
    await expect(get.get('/wallet/prices')).rejects.toBeInstanceOf(RpcForbidden);
    await expect(rpc.call('getBlockHeight', [])).rejects.toBeInstanceOf(RpcForbidden);
    expect(requests).toBe(1);
  });
});

describe('browserDeps (review M3: the cool-down survives a restarted worker)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('after a 403 the cool-down is stored, and a FRESH browserDeps still refuses without a request', async () => {
    let requests = 0;
    // A stubbed fetch: nothing here leaves the process.
    vi.stubGlobal('fetch', async () => (requests++, {status: 403, json: async () => null}));
    const ext = fakeExt();
    await expect(browserDeps(ext).reader.getBlockHeight()).rejects.toBeInstanceOf(RpcForbidden);
    expect(requests).toBe(1);
    const until = await ext.local.get(FORBIDDEN_UNTIL_KEY);
    expect(typeof until === 'number' && until > Date.now() + FORBIDDEN_COOLDOWN_MS - 60_000).toBe(true);
    await expect(browserDeps(ext).reader.getBlockHeight()).rejects.toBeInstanceOf(RpcForbidden);
    await expect(browserDeps(ext).stagePrice()).rejects.toBeInstanceOf(RpcForbidden);
    await expect(browserDeps(ext).broadcast(signedWire())).rejects.toBeInstanceOf(RpcCoolingDown);
    expect(requests).toBe(1);
  });

  it('ONE latch per instance: a 403 on the JSON route silences the RPC and the broadcast route of the same deps', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => (urls.push(url), {status: 403, json: async () => null}));
    const deps = browserDeps(fakeExt());
    await expect(deps.prices()).rejects.toBeInstanceOf(RpcForbidden);
    await expect(deps.reader.getBlockHeight()).rejects.toBeInstanceOf(RpcCoolingDown);
    await expect(deps.broadcast(signedWire())).rejects.toBeInstanceOf(RpcCoolingDown);
    expect(urls).toEqual(['https://api.noc-tura.io/api/v1/wallet/prices?ids=solana,usd-coin,tether']);
  });

  it('reads the NOC stage price from /stats (owner decision B)', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => (urls.push(url), {status: 200, json: async () => ({success: true, data: {currentStage: 1, totalNocSold: 0, isPaused: false}})}));
    expect(await browserDeps(fakeExt()).stagePrice()).toBe(0.1723);
    expect(urls).toEqual(['https://api.noc-tura.io/api/v1/stats']);
  });

  it('randomBytes comes from crypto.getRandomValues (a CSPRNG)', () => {
    const spy = vi.spyOn(globalThis.crypto, 'getRandomValues');
    const bytes = browserDeps(fakeExt()).randomBytes(16);
    expect(bytes).toHaveLength(16);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toBe(bytes);
    spy.mockRestore();
  });
});

describe('stagePriceFrom (strict: no stage-1 fallback, which would fail open)', () => {
  it('a known stage gives its price (positive control)', () => {
    expect(stagePriceFrom({success: true, data: {currentStage: 0}})).toBe(0.1501);
    expect(stagePriceFrom({success: true, data: {currentStage: 9}})).toBe(0.3499);
  });

  it('a missing, unknown or malformed stage is null — never the stage-1 price', () => {
    for (const body of [
      {success: true, data: {}},
      {success: true, data: {currentStage: null}},
      {success: true, data: {currentStage: '1'}},
      {success: true, data: {currentStage: 1.5}},
      {success: true, data: {currentStage: -1}},
      {success: true, data: {currentStage: 10}},
      {success: false, data: {currentStage: 1}},
      null,
    ]) {
      expect(stagePriceFrom(body)).toBeNull();
    }
  });
});
