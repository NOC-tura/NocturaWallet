import {GEO_LIST_CACHE_MS, GEO_MAX_STALENESS_DAYS, createJurisdictionGate, type GeoAnswer} from '../gate';
import {REQUEST_TIMEOUT_MS, RequestTimedOut, browserDeps} from '../../deps';
import {fakeExt} from '../../__tests__/fakeExt';
import {RequestUnreachable, RpcCoolingDown, RpcForbidden, RpcHttpError} from '../../../../../core/solana/rpc';
import type {JsonGetter} from '../../../../../core/ports';

// B1d §2.2, C12, C34, D15. This file runs in both vitest runs (NOPRESALE_TESTS): the gate answers the same in both builds.
const T0 = Date.parse('2026-10-19T12:00:00Z');
const CHECK = (countryCode: string, isVpn = false): Record<string, unknown> => ({countryCode, isVpn});
const COUNTRIES = [
  {code: 'CU', category: 'sanctioned', basis: 'OFAC Cuba Sanctions'},
  {code: 'IR', category: 'sanctioned', basis: 'OFAC Iran Sanctions'},
  {code: 'KP', category: 'sanctioned', basis: 'OFAC North Korea Sanctions'},
  {code: 'SY', category: 'sanctioned', basis: 'OFAC PAARSS (Syria)'},
  {code: 'RU', category: 'sanctioned', basis: 'our risk policy'},
  {code: 'CN', category: 'restricted', basis: 'our risk policy'},
  {code: 'ZW', category: 'restricted', basis: null},
];
const LIST = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  success: true,
  data: {countries: COUNTRIES, updated_at: '2026-10-10', reviewed_by: 'a reviewer', reviewed_at: '2026-10-10', source: 'OFAC', max_staleness_days: 30, age_days: 9, stale: false, ...over},
});

type Answer = unknown | (() => unknown);
/** A getter that answers each path from a script (a value, or a function that throws or returns), recording every request. */
function scripted(check: Answer, list: Answer) {
  const paths: string[] = [];
  const answers: Record<string, Answer> = {'/geo/check': check, '/geo/restricted-list': list};
  const get: JsonGetter = {
    async get<T>(path: string): Promise<T> {
      paths.push(path);
      if (!(path in answers)) throw new Error(`unexpected GET ${path}`);
      const a = answers[path];
      return (typeof a === 'function' ? (a as () => unknown)() : a) as T;
    },
  };
  return {get, paths, answers};
}
const clock = {t: T0};
const gateOf = (s: ReturnType<typeof scripted>) => createJurisdictionGate({get: s.get, now: () => clock.t});
const thrower = (e: Error) => () => {
  throw e;
};
const answer = async (check: Answer, list: Answer): Promise<GeoAnswer> => gateOf(scripted(check, list)).check();

beforeEach(() => {
  clock.t = T0;
});

describe('the jurisdiction gate — every reason (B1d §2.2, §6.1 "Geo")', () => {
  it('a fresh list and SI → open, with the country (positive control); one request per route', async () => {
    const s = scripted(CHECK('SI'), LIST());
    expect(await gateOf(s).check()).toEqual({open: true, reason: null, countryCode: 'SI'});
    expect(s.paths).toEqual(['/geo/check', '/geo/restricted-list']);
  });

  it('KP → sanctioned; KP behind a VPN flag → sanctioned (sanctioned wins over VPN)', async () => {
    expect(await answer(CHECK('KP'), LIST())).toEqual({open: false, reason: 'sanctioned', countryCode: 'KP'});
    expect(await answer(CHECK('KP', true), LIST())).toEqual({open: false, reason: 'sanctioned', countryCode: 'KP'});
  });

  it.each(['CU', 'IR', 'SY', 'RU'])('%s (sanctioned on the served list) → sanctioned', async code => {
    expect((await answer(CHECK(code), LIST())).reason).toBe('sanctioned');
  });

  it('CN and ZW (restricted, not sanctioned) → open — OFAC-only; an allowed country behind a VPN → open', async () => {
    expect(await answer(CHECK('CN'), LIST())).toEqual({open: true, reason: null, countryCode: 'CN'});
    expect(await answer(CHECK('ZW'), LIST())).toEqual({open: true, reason: null, countryCode: 'ZW'});
    expect(await answer(CHECK('SI', true), LIST())).toEqual({open: true, reason: null, countryCode: 'SI'});
  });

  it('the served list decides, not a list of our own: a country the server marks sanctioned closes', async () => {
    const list = LIST({countries: [{code: 'SI', category: 'sanctioned'}]});
    expect(await answer(CHECK('SI'), list)).toEqual({open: false, reason: 'sanctioned', countryCode: 'SI'});
    expect(await answer(CHECK('KP'), list)).toEqual({open: true, reason: null, countryCode: 'KP'});
  });

  it.each(['UNKNOWN', '', 'XX', 'ZZ', 'si', 'S', 'SVN'])('countryCode %j → unknown_country, no country reported', async code => {
    expect(await answer(CHECK(code), LIST())).toEqual({open: false, reason: 'unknown_country', countryCode: null});
  });

  it('a list 30 days old is fresh (the boundary); 31 days old → stale_list, the known country still reported', async () => {
    expect(await answer(CHECK('SI'), LIST({updated_at: '2026-09-19', reviewed_at: '2026-09-19'}))).toEqual({open: true, reason: null, countryCode: 'SI'});
    expect(await answer(CHECK('SI'), LIST({updated_at: '2026-09-18', reviewed_at: '2026-09-18'}))).toEqual({open: false, reason: 'stale_list', countryCode: 'SI'});
  });

  it.each<[string, number | undefined, string, boolean]>([
    ['29: a list 29 days old is fresh', 29, '2026-09-20', true],
    ['29: 30 days old → stale (the server’s stricter limit holds)', 29, '2026-09-19', false],
    ['30: 30 days old is fresh', 30, '2026-09-19', true],
    ['30: 31 days old → stale', 30, '2026-09-18', false],
    ['31: 30 days old is fresh', 31, '2026-09-19', true],
    ['31: 31 days old → stale (capped at 30)', 31, '2026-09-18', false],
    ['365: 31 days old → stale (capped at 30)', 365, '2026-09-18', false],
    ['missing: a list of today → stale (a missing limit is not capped into one)', undefined, '2026-10-19', false],
  ])('D18: max_staleness_days %s', async (_, limit, day, open) => {
    expect(GEO_MAX_STALENESS_DAYS).toBe(30);
    const list = LIST({updated_at: day, reviewed_at: day, max_staleness_days: limit});
    expect(await answer(CHECK('SI'), list)).toEqual(open ? {open: true, reason: null, countryCode: 'SI'} : {open: false, reason: 'stale_list', countryCode: 'SI'});
  });

  it('a stale list closes before the country is looked at: an unknown country is not reported', async () => {
    expect(await answer(CHECK('UNKNOWN'), LIST({updated_at: null, reviewed_at: null}))).toEqual({open: false, reason: 'stale_list', countryCode: null});
  });

  it.each([
    ['missing dates', LIST({updated_at: undefined, reviewed_at: undefined})],
    ['null dates', LIST({updated_at: null, reviewed_at: null})],
    ['unparsable dates', LIST({updated_at: 'yesterday', reviewed_at: '10/10/2026'})],
    ['a date two days ahead', LIST({updated_at: '2026-10-21', reviewed_at: '2026-10-10'})],
    ['stale: false on a list past its limit', LIST({updated_at: '2026-04-04', reviewed_at: '2026-04-04', stale: false})],
    ['stale: true on a young list', LIST({stale: true})],
    ['max_staleness_days null', LIST({max_staleness_days: null})],
    ['max_staleness_days missing', LIST({max_staleness_days: undefined})],
    ['max_staleness_days 0', LIST({max_staleness_days: 0})],
  ])('%s → stale_list', async (_, list) => {
    expect(await answer(CHECK('SI'), list)).toEqual({open: false, reason: 'stale_list', countryCode: 'SI'});
  });

  it.each([
    ['/geo/check 500', thrower(new RpcHttpError('/geo/check', 500)), LIST()],
    ['/geo/check timed out', thrower(new RequestTimedOut('https://api.noc-tura.io/api/v1/geo/check', REQUEST_TIMEOUT_MS)), LIST()],
    ['/geo/check unreachable', thrower(new RequestUnreachable('/geo/check', 'the request failed (offline)')), LIST()],
    ['/geo/restricted-list 404', CHECK('SI'), thrower(new RpcHttpError('/geo/restricted-list', 404))],
    ['/geo/restricted-list timed out', CHECK('SI'), thrower(new RequestTimedOut('https://api.noc-tura.io/api/v1/geo/restricted-list', REQUEST_TIMEOUT_MS))],
  ])('%s → no_check; there is no fallback list to open on', async (_, check, list) => {
    expect(await answer(check, list)).toEqual({open: false, reason: 'no_check', countryCode: null});
  });

  it.each([
    ['/geo/check 403', thrower(new RpcForbidden('/geo/check')), LIST()],
    ['/geo/restricted-list 403', CHECK('SI'), thrower(new RpcForbidden('/geo/restricted-list'))],
    ['the latch cooling down', thrower(new RpcCoolingDown('/geo/check')), LIST()],
    ["another getter's HTTP 403", thrower(new RpcHttpError('/geo/check', 403)), LIST()],
  ])('%s → refused (not no_check)', async (_, check, list) => {
    expect(await answer(check, list)).toEqual({open: false, reason: 'refused', countryCode: null});
  });

  it('a failed /geo/check sends no list request — the answer is already closed', async () => {
    const refused = scripted(thrower(new RpcForbidden('/geo/check')), LIST());
    await gateOf(refused).check();
    expect(refused.paths).toEqual(['/geo/check']);
    const silent = scripted(thrower(new RequestTimedOut('/geo/check', REQUEST_TIMEOUT_MS)), LIST());
    await gateOf(silent).check();
    expect(silent.paths).toEqual(['/geo/check']);
  });
});

describe('a country entered more than once: the worst wins (review 1 M1)', () => {
  it('KP restricted, then sanctioned (later entry worse) → sanctioned, closed', async () => {
    const list = LIST({countries: [{code: 'KP', category: 'restricted'}, {code: 'KP', category: 'sanctioned'}]});
    expect(await answer(CHECK('KP'), list)).toEqual({open: false, reason: 'sanctioned', countryCode: 'KP'});
  });

  it('KP sanctioned, then restricted (later entry milder) → still sanctioned: order does not matter', async () => {
    const list = LIST({countries: [{code: 'KP', category: 'sanctioned'}, {code: 'KP', category: 'restricted'}]});
    expect(await answer(CHECK('KP'), list)).toEqual({open: false, reason: 'sanctioned', countryCode: 'KP'});
  });

  it('a single entry is unchanged: CN restricted-only still opens (not sanctioned)', async () => {
    const list = LIST({countries: [{code: 'CN', category: 'restricted'}]});
    expect(await answer(CHECK('CN'), list)).toEqual({open: true, reason: null, countryCode: 'CN'});
  });
});

describe('parsing at the gate (C34, review 1 M8)', () => {
  it('a check body with an extra key, a list entry with basis and the envelope extras → parsed, open', async () => {
    const list = LIST({countries: [...COUNTRIES, {code: 'BY', category: 'restricted', basis: 'x', since: '2022'}], reviewed_by: 'r', source: 's', age_days: 9, extra: true});
    expect(await answer({...CHECK('SI'), city: 'Ljubljana', allowed: false}, {...list, served_by: 'node-2'})).toEqual({open: true, reason: null, countryCode: 'SI'});
  });

  it('max_staleness_days null → parsed, then stale (not no_check)', async () => {
    expect((await answer(CHECK('SI'), LIST({max_staleness_days: null}))).reason).toBe('stale_list');
  });

  it.each([
    ['isVpn missing', {countryCode: 'SI'}, LIST()],
    ['isVpn a string', {countryCode: 'SI', isVpn: 'false'}, LIST()],
    ['a non-object check body', 'SI', LIST()],
    ['a list without countries', CHECK('SI'), {success: true, data: {updated_at: '2026-10-10', max_staleness_days: 30}}],
    ['a list missing a required field (an entry without category)', CHECK('SI'), LIST({countries: [{code: 'KP'}]})],
    ['a list with success: false', CHECK('SI'), {...LIST(), success: false}],
    ['a non-object list body', CHECK('SI'), null],
  ])('%s → no_check', async (_, check, list) => {
    expect(await answer(check, list)).toEqual({open: false, reason: 'no_check', countryCode: null});
  });
});

describe('the cache and the request budget (C12, review 2 M3)', () => {
  it('/geo/check is asked on every call; the list once per 10 minutes', async () => {
    const s = scripted(CHECK('SI'), LIST());
    const gate = gateOf(s);
    await gate.check();
    clock.t = T0 + 60_000;
    await gate.check();
    clock.t = T0 + GEO_LIST_CACHE_MS - 1;
    expect(await gate.check()).toEqual({open: true, reason: null, countryCode: 'SI'});
    expect(s.paths).toEqual(['/geo/check', '/geo/restricted-list', '/geo/check', '/geo/check']);
    expect(GEO_LIST_CACHE_MS).toBe(600_000);
  });

  it('at exactly 10 minutes the list is read again (the boundary)', async () => {
    const s = scripted(CHECK('SI'), LIST());
    const gate = gateOf(s);
    await gate.check();
    clock.t = T0 + GEO_LIST_CACHE_MS;
    await gate.check();
    expect(s.paths).toEqual(['/geo/check', '/geo/restricted-list', '/geo/check', '/geo/restricted-list']);
  });

  it('a clock that went backwards does not make a cached list young — it is read again', async () => {
    const s = scripted(CHECK('SI'), LIST());
    const gate = gateOf(s);
    await gate.check();
    clock.t = T0 - 1;
    await gate.check();
    expect(s.paths).toEqual(['/geo/check', '/geo/restricted-list', '/geo/check', '/geo/restricted-list']);
  });

  it("a cached list's age is evaluated against the clock every time: it goes stale inside the cache window, without a request", async () => {
    clock.t = Date.parse('2026-10-18T23:55:00Z');
    const s = scripted(CHECK('SI'), LIST({updated_at: '2026-09-18', reviewed_at: '2026-09-18'}));
    const gate = gateOf(s);
    expect(await gate.check()).toEqual({open: true, reason: null, countryCode: 'SI'});
    clock.t = Date.parse('2026-10-19T00:01:00Z');
    expect(await gate.check()).toEqual({open: false, reason: 'stale_list', countryCode: 'SI'});
    expect(s.paths).toEqual(['/geo/check', '/geo/restricted-list', '/geo/check']);
  });

  it('a failed or malformed list is not cached: the next call reads it again, and opens once it answers', async () => {
    const s = scripted(CHECK('SI'), thrower(new RpcHttpError('/geo/restricted-list', 404)));
    const gate = gateOf(s);
    expect((await gate.check()).reason).toBe('no_check');
    s.answers['/geo/restricted-list'] = LIST({countries: []});
    expect((await gate.check()).reason).toBe('no_check');
    s.answers['/geo/restricted-list'] = LIST();
    expect((await gate.check()).open).toBe(true);
    expect(s.paths.filter(p => p === '/geo/restricted-list')).toHaveLength(3);
  });

  it('a cached list past 10 minutes whose re-read fails → no_check (or refused), never the expired list; the next call reads it again (review 1 M1)', async () => {
    const s = scripted(CHECK('SI'), LIST());
    const gate = gateOf(s);
    expect((await gate.check()).open).toBe(true);
    clock.t = T0 + GEO_LIST_CACHE_MS;
    s.answers['/geo/restricted-list'] = thrower(new RpcHttpError('/geo/restricted-list', 500));
    expect(await gate.check()).toEqual({open: false, reason: 'no_check', countryCode: null});
    s.answers['/geo/restricted-list'] = thrower(new RpcForbidden('/geo/restricted-list'));
    expect(await gate.check()).toEqual({open: false, reason: 'refused', countryCode: null});
    s.answers['/geo/restricted-list'] = LIST();
    expect(await gate.check()).toEqual({open: true, reason: null, countryCode: 'SI'});
    expect(s.paths.filter(p => p === '/geo/restricted-list')).toHaveLength(4);
  });

  it('a cached list does not open a failed check', async () => {
    const s = scripted(CHECK('SI'), LIST());
    const gate = gateOf(s);
    expect((await gate.check()).open).toBe(true);
    s.answers['/geo/check'] = thrower(new RequestTimedOut('/geo/check', REQUEST_TIMEOUT_MS));
    expect(await gate.check()).toEqual({open: false, reason: 'no_check', countryCode: null});
    s.answers['/geo/check'] = thrower(new RpcForbidden('/geo/check'));
    expect(await gate.check()).toEqual({open: false, reason: 'refused', countryCode: null});
  });

  it('two callers at once (#23 and F12) share one list request', async () => {
    const s = scripted(CHECK('SI'), LIST());
    const gate = gateOf(s);
    const [a, b] = await Promise.all([gate.check(), gate.check()]);
    expect([a.open, b.open]).toEqual([true, true]);
    expect(s.paths.filter(p => p === '/geo/restricted-list')).toHaveLength(1);
    expect(s.paths.filter(p => p === '/geo/check')).toHaveLength(2);
  });

  it('the cache window is measured from the request start, not from when the list resolves (review 1 M2)', async () => {
    const paths: string[] = [];
    let resolveList: ((v: unknown) => void) | null = null;
    let listReady = false;
    const get: JsonGetter = {
      async get<T>(path: string): Promise<T> {
        paths.push(path);
        if (path === '/geo/check') return CHECK('SI') as unknown as T;
        if (!listReady) return new Promise<T>(resolve => (resolveList = resolve as (v: unknown) => void));
        return LIST() as unknown as T;
      },
    };
    const gate = createJurisdictionGate({get, now: () => clock.t});
    const pending = gate.check();
    // Drain every pending microtask (never a real delay) so the request's own `io.now()` read — taken
    // synchronously before the list fetch is awaited — happens at T0, before the clock moves.
    await new Promise(resolve => setImmediate(resolve));
    clock.t = T0 + 9 * 60_000; // the list is slow to answer: 9 minutes pass while it is in flight
    listReady = true;
    resolveList!(LIST());
    expect(await pending).toEqual({open: true, reason: null, countryCode: 'SI'});
    // 10 minutes after the REQUEST started (only 1 minute after it resolved). Measured from the request
    // start (as built), the cache is already due; measured from the resolve, it would still look fresh
    // for ~9 more minutes.
    clock.t = T0 + GEO_LIST_CACHE_MS;
    await gate.check();
    expect(paths.filter(p => p === '/geo/restricted-list')).toHaveLength(2);
  });
});

describe('browserDeps().geo — the real getter, the shared 403 latch (D15: in both builds)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // A stubbed fetch: nothing here leaves the process.
  const respond = (byPath: Record<string, {status: number; body?: unknown}>, urls: string[]) =>
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      const r = byPath[url.replace('https://api.noc-tura.io/api/v1', '')];
      if (r === undefined) throw new Error(`unexpected fetch ${url}`);
      return {status: r.status, json: async () => r.body};
    });

  it('both GETs under API_BASE, answered → open (positive control)', async () => {
    const urls: string[] = [];
    respond({'/geo/check': {status: 200, body: CHECK('SI')}, '/geo/restricted-list': {status: 200, body: LIST({updated_at: new Date().toISOString().slice(0, 10)})}}, urls);
    expect(await browserDeps(fakeExt()).geo()).toEqual({open: true, reason: null, countryCode: 'SI'});
    expect(urls).toEqual(['https://api.noc-tura.io/api/v1/geo/check', 'https://api.noc-tura.io/api/v1/geo/restricted-list']);
  });

  it('a 403 on /geo/check → refused, and it trips the one latch: the next geo call and a price read send nothing', async () => {
    const urls: string[] = [];
    respond({'/geo/check': {status: 403}, '/wallet/prices?ids=solana,usd-coin,tether': {status: 200, body: {}}}, urls);
    const deps = browserDeps(fakeExt());
    expect(await deps.geo()).toEqual({open: false, reason: 'refused', countryCode: null});
    expect(await deps.geo()).toEqual({open: false, reason: 'refused', countryCode: null});
    await expect(deps.prices()).rejects.toBeInstanceOf(RpcCoolingDown);
    expect(urls).toEqual(['https://api.noc-tura.io/api/v1/geo/check']);
  });

  it('a non-403 failure (404 on the list) → no_check, and trips nothing', async () => {
    const urls: string[] = [];
    respond({'/geo/check': {status: 200, body: CHECK('SI')}, '/geo/restricted-list': {status: 404}, '/stats': {status: 200, body: {success: true, data: {currentStage: 0}}}}, urls);
    const deps = browserDeps(fakeExt());
    expect(await deps.geo()).toEqual({open: false, reason: 'no_check', countryCode: null});
    expect(await deps.stagePrice()).toBe(0.1501);
    expect(urls).toHaveLength(3);
  });

  it('a silent coordinator → no_check after REQUEST_TIMEOUT_MS (a timeout is not a refusal)', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', () => new Promise(() => undefined));
    const settled = browserDeps(fakeExt()).geo();
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(await settled).toEqual({open: false, reason: 'no_check', countryCode: null});
  });
});
