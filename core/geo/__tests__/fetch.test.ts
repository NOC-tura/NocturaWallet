import {GEO_CHECK_PATH, GEO_LIST_PATH, GeoMalformed, fetchGeoCheck, fetchRestrictedList, isGeoRefusal, parseGeoCheck, parseRestrictedList} from '../fetch';
import {RequestUnreachable, RpcCoolingDown, RpcForbidden, RpcHttpError} from '../../solana/rpc';
import type {JsonGetter} from '../../ports';

// The live list's shape (coordinator restrictedList.js at 75450df): an envelope, per-entry `basis`, every age key present.
const LIST = {
  success: true,
  data: {
    countries: [
      {code: 'KP', category: 'sanctioned', basis: 'OFAC North Korea Sanctions'},
      {code: 'CN', category: 'restricted', basis: 'our risk policy'},
      {code: 'ZW', category: 'restricted', basis: null},
    ],
    updated_at: '2026-10-10',
    reviewed_by: 'a reviewer',
    reviewed_at: '2026-10-11',
    source: 'OFAC sanctions programs',
    max_staleness_days: 30,
    age_days: 9,
    stale: false,
  },
};
const withData = (over: Record<string, unknown>) => ({...LIST, data: {...LIST.data, ...over}});
const without = (key: string) => {
  const data: Record<string, unknown> = {...LIST.data};
  delete data[key];
  return {...LIST, data};
};

describe('parseGeoCheck (B1d §2.2, C34)', () => {
  it('reads {countryCode, isVpn} at the top level (positive control)', () => {
    expect(parseGeoCheck({countryCode: 'SI', isVpn: false})).toEqual({countryCode: 'SI', isVpn: false});
  });

  it('ignores a key it does not need', () => {
    expect(parseGeoCheck({countryCode: 'SI', isVpn: true, city: 'Ljubljana', allowed: false})).toEqual({countryCode: 'SI', isVpn: true});
  });

  it('keeps an unknown country as written: the gate, not the parser, decides it is unknown', () => {
    expect(parseGeoCheck({countryCode: 'UNKNOWN', isVpn: false}).countryCode).toBe('UNKNOWN');
    expect(parseGeoCheck({countryCode: '', isVpn: false}).countryCode).toBe('');
  });

  it.each([
    ['isVpn missing', {countryCode: 'SI'}],
    ['isVpn a string', {countryCode: 'SI', isVpn: 'false'}],
    ['isVpn null', {countryCode: 'SI', isVpn: null}],
    ['countryCode missing', {isVpn: false}],
    ['countryCode a number', {countryCode: 705, isVpn: false}],
    ['an envelope', {success: true, data: {countryCode: 'SI', isVpn: false}}],
    ['null', null],
    ['an array', [{countryCode: 'SI', isVpn: false}]],
    ['a string', 'SI'],
  ])('%s → GeoMalformed', (_, body) => {
    expect(() => parseGeoCheck(body)).toThrow(GeoMalformed);
  });
});

describe('parseRestrictedList (B1d §2.2, C34, review 1 M8)', () => {
  it('reads the live shape: per-entry basis and the envelope extras ignored (positive control)', () => {
    expect(parseRestrictedList(LIST)).toEqual({
      countries: [
        {code: 'KP', category: 'sanctioned'},
        {code: 'CN', category: 'restricted'},
        {code: 'ZW', category: 'restricted'},
      ],
      meta: {source: 'server', updatedAt: '2026-10-10', reviewedAt: '2026-10-11', maxStalenessDays: 30, serverStale: false},
    });
  });

  it('a key the coordinator adds tomorrow is ignored, at either level', () => {
    const extra = {...withData({region_notes: {KP: 'x'}}), served_by: 'node-2'};
    expect(parseRestrictedList(extra)).toEqual(parseRestrictedList(LIST));
  });

  it('a null age key is not malformed: it is absent from the meta (which is stale downstream)', () => {
    const nulls = withData({updated_at: null, reviewed_at: null, max_staleness_days: null, stale: null});
    expect(parseRestrictedList(nulls).meta).toEqual({source: 'server'});
  });

  it.each(['updated_at', 'reviewed_at', 'max_staleness_days', 'stale'])('an absent %s is read as null, not as malformed', key => {
    expect(() => parseRestrictedList(without(key))).not.toThrow();
  });

  it.each([
    ['a non-object body', 'list'],
    ['null', null],
    ['an array body', [LIST]],
    ['success false', {...LIST, success: false}],
    ['success missing', {data: LIST.data}],
    ['success "true"', {...LIST, success: 'true'}],
    ['data missing', {success: true}],
    ['data an array', {success: true, data: [LIST.data]}],
    ['countries missing', without('countries')],
    ['countries empty', withData({countries: []})],
    ['countries an object', withData({countries: {KP: 'sanctioned'}})],
    ['an entry not an object', withData({countries: ['KP']})],
    ['an entry without code', withData({countries: [{category: 'sanctioned'}]})],
    ['a lowercase code', withData({countries: [{code: 'kp', category: 'sanctioned'}]})],
    ['a three-letter code', withData({countries: [{code: 'PRK', category: 'sanctioned'}]})],
    ['an unknown category', withData({countries: [{code: 'KP', category: 'embargoed'}]})],
    ['a category missing', withData({countries: [{code: 'KP'}]})],
    ['updated_at a number', withData({updated_at: 20261010})],
    ['reviewed_at an object', withData({reviewed_at: {day: '2026-10-11'}})],
    ['max_staleness_days a string', withData({max_staleness_days: '30'})],
    ['stale a string', withData({stale: 'false'})],
  ])('%s → GeoMalformed', (_, body) => {
    expect(() => parseRestrictedList(body)).toThrow(GeoMalformed);
  });

  it('one bad entry among good ones refuses the whole list', () => {
    const one = withData({countries: [...LIST.data.countries, {code: 'IR', category: 'Sanctioned'}]});
    expect(() => parseRestrictedList(one)).toThrow(/countries\[3\]\.category/);
  });
});

describe('fetchGeoCheck / fetchRestrictedList', () => {
  it('GET the two bare paths through the given getter, one request each', async () => {
    const paths: string[] = [];
    const get: JsonGetter = {
      get: async <T>(path: string): Promise<T> => {
        paths.push(path);
        return (path === GEO_CHECK_PATH ? {countryCode: 'SI', isVpn: false} : LIST) as T;
      },
    };
    expect(await fetchGeoCheck(get)).toEqual({countryCode: 'SI', isVpn: false});
    expect((await fetchRestrictedList(get)).countries).toHaveLength(3);
    expect(paths).toEqual(['/geo/check', '/geo/restricted-list']);
    expect([GEO_CHECK_PATH, GEO_LIST_PATH]).toEqual(paths);
  });

  it("a getter's error passes through unchanged — the caller tells a 403 from the rest", async () => {
    const e = new RpcForbidden('/geo/check');
    const get: JsonGetter = {get: async () => Promise.reject(e)};
    await expect(fetchGeoCheck(get)).rejects.toBe(e);
    await expect(fetchRestrictedList(get)).rejects.toBe(e);
  });
});

describe('isGeoRefusal (the 403 distinction, Q12 / Q27)', () => {
  it('a 403, the latch’s cool-down after one, and a getter’s HTTP 403 are refusals', () => {
    expect(isGeoRefusal(new RpcForbidden('/geo/check'))).toBe(true);
    expect(isGeoRefusal(new RpcCoolingDown('/geo/check'))).toBe(true);
    expect(isGeoRefusal(new RpcHttpError('/geo/check', 403))).toBe(true);
  });

  it('every other failure is not (negative controls)', () => {
    expect(isGeoRefusal(new RpcHttpError('/geo/check', 404))).toBe(false);
    expect(isGeoRefusal(new RpcHttpError('/geo/check', 500))).toBe(false);
    expect(isGeoRefusal(new RequestUnreachable('/geo/check', 'no answer within 20000 ms; aborted'))).toBe(false);
    expect(isGeoRefusal(new GeoMalformed('/geo/check', 'isVpn is not a boolean'))).toBe(false);
    expect(isGeoRefusal(new Error('403'))).toBe(false);
    expect(isGeoRefusal({status: 403})).toBe(false);
  });
});
