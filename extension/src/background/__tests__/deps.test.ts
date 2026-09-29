import {BROADCAST_TIMEOUT_MS, FORBIDDEN_UNTIL_KEY, REQUEST_TIMEOUT_MS, RequestTimedOut, browserDeps, createJsonGetter, stagePriceFrom, timedFetch} from '../deps';
import {submitSigned} from '../pending';
import {PENDING_KEY} from '../pendingStore';
import {fakeDeps} from './fakeDeps';
import {FORBIDDEN_COOLDOWN_MS, RpcCoolingDown, RpcForbidden, createForbiddenLatch, createRpc, type FetchInit} from '../../../../core/solana/rpc';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, signedWire} from './fixtures';

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

describe('browserDeps request timeouts (CrowdSec answers some users with silence, not an error)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** A fetch whose first call never settles — it even ignores the abort signal — and whose later calls answer. */
  function silentThenAnswering() {
    const signals: AbortSignal[] = [];
    const bodies: string[] = [];
    let calls = 0;
    vi.stubGlobal('fetch', async (_url: string, init: {body?: string; signal?: AbortSignal}) => {
      calls += 1;
      if (init.signal !== undefined) signals.push(init.signal);
      bodies.push(init.body ?? '');
      if (calls === 1) return new Promise<never>(() => undefined);
      return {status: 200, json: async () => ({jsonrpc: '2.0', id: calls, result: 77})};
    });
    return {signals, bodies, calls: () => calls};
  }

  it('a read that never answers times out after REQUEST_TIMEOUT_MS, is aborted, and the request queued behind it still runs', async () => {
    vi.useFakeTimers();
    const f = silentThenAnswering();
    const ext = fakeExt();
    const deps = browserDeps(ext);
    const first = deps.reader.getBlockHeight();
    const firstSettled = first.then(
      () => 'resolved',
      (e: unknown) => e,
    );
    const second = deps.reader.getBlockHeight();
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(f.calls()).toBe(1); // serialised: the second waits behind the silent one
    await vi.advanceTimersByTimeAsync(1);
    expect(await firstSettled).toBeInstanceOf(RequestTimedOut);
    expect(f.signals[0]?.aborted).toBe(true);
    expect(await second).toBe(77);
    expect(f.calls()).toBe(2);
    // A timeout is not a 403: no cool-down was stored, and the next read goes out.
    expect(await ext.local.get(FORBIDDEN_UNTIL_KEY)).toBeUndefined();
    expect(await deps.reader.getBlockHeight()).toBe(77);
    // A finished request leaves no timer behind.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('an answer whose body is never read leaves no unhandled rejection when its deadline passes', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', async () => ({status: 403, json: async () => ({})}));
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    try {
      const res = await timedFetch(REQUEST_TIMEOUT_MS)('https://example.invalid/x', {method: 'GET'});
      expect(res.status).toBe(403); // a 403 is decided from the status alone; its body is never read
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 1);
      vi.useRealTimers();
      await new Promise(r => setTimeout(r, 10)); // let Node report any unhandled rejection
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('the JSON reads time out the same way', async () => {
    vi.useFakeTimers();
    silentThenAnswering();
    const deps = browserDeps(fakeExt());
    const settled = deps.stagePrice().then(
      () => 'resolved',
      (e: unknown) => e,
    );
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(await settled).toBeInstanceOf(RequestTimedOut);
  });

  it('a silent broadcast gets BROADCAST_TIMEOUT_MS, and a timed-out first broadcast leaves the record pending, not failed', async () => {
    expect(BROADCAST_TIMEOUT_MS).toBeGreaterThan(REQUEST_TIMEOUT_MS);
    vi.useFakeTimers();
    const f = silentThenAnswering();
    const ext = fakeExt();
    const deps = {...fakeDeps(), broadcast: browserDeps(ext).broadcast};
    let done = false;
    const view = submitSigned(ext, deps, {account: ACCOUNT.publicKey, wire: signedWire(), lastValidBlockHeight: 1000, intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}}).then(v => {
      done = true;
      return v;
    });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(done).toBe(false); // a read's timeout is not the broadcast's
    await vi.advanceTimersByTimeAsync(BROADCAST_TIMEOUT_MS - REQUEST_TIMEOUT_MS);
    expect(await view).toMatchObject({state: 'pending'});
    expect(f.bodies[0]).toContain('"transaction"');
    const [record] = (await ext.local.get(PENDING_KEY)) as {state: string; detail: string}[];
    expect(record).toMatchObject({state: 'pending', detail: expect.stringContaining('Not acknowledged')});
  });
});
