import type {JsonGetter} from '../ports';
import {RpcForbidden, RpcHttpError} from '../solana/rpc';
import type {ListMeta} from './freshness';
import type {RestrictedCountry} from './restrictedList';

/**
 * The jurisdiction gate's two coordinator reads (B1d §2.2): `/geo/check` and `/geo/restricted-list`, through the caller's
 * getter (the extension's goes through the shared 403 latch). Each body is parsed for the keys the gate needs and
 * nothing else (C34): a key the coordinator adds is ignored, a required key that is missing or of the wrong type is
 * `GeoMalformed`. Nothing is cached or retried here, and there is no bundled fallback: a failed read is the caller's
 * closed answer. Used only by the extension in B1d (D12, C14).
 */
export class GeoMalformed extends Error {
  constructor(path: string, what: string) {
    super(`${path}: ${what}`);
    this.name = 'GeoMalformed';
  }
}

export const GEO_CHECK_PATH = '/geo/check';
export const GEO_LIST_PATH = '/geo/restricted-list';

export interface GeoLocation {
  countryCode: string;
  isVpn: boolean;
}

export interface GeoList {
  countries: RestrictedCountry[];
  meta: ListMeta;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** `{countryCode: string, isVpn: boolean}` at the top level — no envelope (the live contract). */
export function parseGeoCheck(body: unknown): GeoLocation {
  if (!isObject(body)) throw new GeoMalformed(GEO_CHECK_PATH, 'the body is not an object');
  const {countryCode, isVpn} = body;
  if (typeof countryCode !== 'string') throw new GeoMalformed(GEO_CHECK_PATH, 'countryCode is not a string');
  if (typeof isVpn !== 'boolean') throw new GeoMalformed(GEO_CHECK_PATH, 'isVpn is not a boolean');
  return {countryCode, isVpn};
}

/** An age key: absent or null is "not reported" (stale downstream); any other type than its own is malformed. */
function optional<T>(data: Record<string, unknown>, key: string, type: 'string' | 'number' | 'boolean'): T | undefined {
  const v = data[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== type) throw new GeoMalformed(GEO_LIST_PATH, `${key} is neither a ${type} nor null`);
  return v as T;
}

/**
 * `{success: true, data: {countries: [{code, category}, …], updated_at, reviewed_at, max_staleness_days, stale}}`.
 * `countries` must be a non-empty array of `{code: /^[A-Z]{2}$/, category: 'sanctioned' | 'restricted'}`; the four age
 * keys are each their type or null (the coordinator reports a missing value as null) and reach `evaluateListFreshness`
 * as absent, which is stale. The list is the server's (`source: 'server'`): the extension has no bundled one.
 */
export function parseRestrictedList(body: unknown): GeoList {
  if (!isObject(body)) throw new GeoMalformed(GEO_LIST_PATH, 'the body is not an object');
  if (body.success !== true) throw new GeoMalformed(GEO_LIST_PATH, 'success is not true');
  const data = body.data;
  if (!isObject(data)) throw new GeoMalformed(GEO_LIST_PATH, 'data is not an object');
  const raw = data.countries;
  if (!Array.isArray(raw) || raw.length === 0) throw new GeoMalformed(GEO_LIST_PATH, 'countries is not a non-empty array');
  const countries = raw.map((c: unknown, i): RestrictedCountry => {
    if (!isObject(c)) throw new GeoMalformed(GEO_LIST_PATH, `countries[${i}] is not an object`);
    const {code, category} = c;
    if (typeof code !== 'string' || !/^[A-Z]{2}$/.test(code)) throw new GeoMalformed(GEO_LIST_PATH, `countries[${i}].code is not two capital letters`);
    if (category !== 'sanctioned' && category !== 'restricted') throw new GeoMalformed(GEO_LIST_PATH, `countries[${i}].category is unknown`);
    return {code, category};
  });
  const meta: ListMeta = {source: 'server'};
  const updatedAt = optional<string>(data, 'updated_at', 'string');
  const reviewedAt = optional<string>(data, 'reviewed_at', 'string');
  const maxStalenessDays = optional<number>(data, 'max_staleness_days', 'number');
  const serverStale = optional<boolean>(data, 'stale', 'boolean');
  if (updatedAt !== undefined) meta.updatedAt = updatedAt;
  if (reviewedAt !== undefined) meta.reviewedAt = reviewedAt;
  if (maxStalenessDays !== undefined) meta.maxStalenessDays = maxStalenessDays;
  if (serverStale !== undefined) meta.serverStale = serverStale;
  return {countries, meta};
}

export async function fetchGeoCheck(get: JsonGetter): Promise<GeoLocation> {
  return parseGeoCheck(await get.get<unknown>(GEO_CHECK_PATH));
}

export async function fetchRestrictedList(get: JsonGetter): Promise<GeoList> {
  return parseRestrictedList(await get.get<unknown>(GEO_LIST_PATH));
}

/**
 * Whether a failed geo read was the coordinator refusing this network — a 403, or the shared latch's cool-down after
 * one (`RpcCoolingDown` is an `RpcForbidden`) — rather than no answer or a bad one. The popup says the two apart
 * (Q12 / Q27 against "the region check is unavailable"); both close the gate.
 */
export function isGeoRefusal(e: unknown): boolean {
  return e instanceof RpcForbidden || (e instanceof RpcHttpError && e.status === 403);
}
