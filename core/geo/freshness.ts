import {classifyJurisdiction} from './classify';
import type {RestrictedCountry} from './restrictedList';

/**
 * Whether the sanctions list a purchase is judged against is fresh enough to sell on.
 *
 * Fails closed on purpose (spec §4, owner decision 2026-09-27): the app once ran five
 * months on its bundled fallback because the list endpoint 404'd silently. So the bundled
 * list is always stale, missing or unparsable dates are stale (a date more than a day in the
 * future counts as unparsable), a missing limit is stale,
 * and a server's `stale: false` never overrides an age computed here.
 */
export interface ListMeta {
  source: 'server' | 'bundled';
  updatedAt?: string;
  reviewedAt?: string;
  maxStalenessDays?: number;
  serverStale?: boolean;
}

export interface Freshness {
  stale: boolean;
  reason: 'bundled' | 'no_dates' | 'too_old' | 'server_says_stale' | null;
  ageDays: number | null;
}

const DAY = 86_400_000;

/** Days in month, with Gregorian leap-year rule. */
function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    return isLeap ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

function parseDay(v: string | undefined): number | null {
  if (!v) return null;

  // Validate date-only format: YYYY-MM-DD.
  const dateMatch = /^\d{4}-\d{2}-\d{2}$/.exec(v);
  if (dateMatch) {
    const year = parseInt(v.slice(0, 4), 10);
    const month = parseInt(v.slice(5, 7), 10);
    const day = parseInt(v.slice(8, 10), 10);
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
      return null;
    }
    const t = Date.parse(`${v}T00:00:00Z`);
    return Number.isFinite(t) ? t : null;
  }

  // Validate full ISO-8601 format with explicit offset. Parse components, validate as written (not UTC),
  // only then Date.parse. This prevents rejecting valid offset timestamps near day boundaries (e.g.,
  // 2026-09-20T01:00:00+02:00 is 2026-09-19T23:00:00Z but the written date is valid).
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})$/.exec(v);
  if (!isoMatch) return null;

  const year = parseInt(isoMatch[1]!, 10);
  const month = parseInt(isoMatch[2]!, 10);
  const day = parseInt(isoMatch[3]!, 10);
  const hour = parseInt(isoMatch[4]!, 10);
  const minute = parseInt(isoMatch[5]!, 10);
  const second = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;
  const offset = isoMatch[8]!;

  // Validate date components as written.
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }

  // Validate time components.
  if (hour > 23 || minute > 59 || second > 59) {
    return null;
  }

  // Validate offset.
  if (offset !== 'Z') {
    const offsetMatch = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
    if (!offsetMatch) return null;
    const offsetHours = parseInt(offsetMatch[2]!, 10);
    const offsetMinutes = parseInt(offsetMatch[3]!, 10);
    if (offsetHours > 14 || offsetMinutes > 59) {
      return null;
    }
  }

  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

export function evaluateListFreshness(meta: ListMeta, now: Date): Freshness {
  if (meta.source === 'bundled') return {stale: true, reason: 'bundled', ageDays: null};
  const dates = [parseDay(meta.updatedAt), parseDay(meta.reviewedAt)].filter((t): t is number => t !== null);
  if (dates.length === 0) return {stale: true, reason: 'no_dates', ageDays: null};
  const nowMs = now.getTime();
  // Fail closed: if `now` is invalid (NaN), treat as stale. This protects against clock skew or invalid dates.
  if (!Number.isFinite(nowMs)) return {stale: true, reason: 'too_old', ageDays: null};
  // A date more than a day ahead of `now` is a broken or lying server (the day covers time zones
  // and small clock skew). It is treated as unparsable, and poisons the whole list rather than
  // being dropped in favour of the other date: nothing from that server is trusted to be fresh.
  if (dates.some(t => t - nowMs > DAY)) return {stale: true, reason: 'no_dates', ageDays: null};
  const ageDays = Math.floor((nowMs - Math.max(...dates)) / DAY);
  const limit = meta.maxStalenessDays;
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0 || ageDays > limit) {
    return {stale: true, reason: 'too_old', ageDays};
  }
  if (meta.serverStale === true) return {stale: true, reason: 'server_says_stale', ageDays};
  return {stale: false, reason: null, ageDays};
}

export interface GeoGate {
  open: boolean;
  reason: 'stale_list' | 'unknown_country' | 'sanctioned' | 'no_check' | null;
}

/** ISO 3166-1 alpha-2, and not the placeholders geolocation services use for "unknown". */
function isKnownCountry(code: string): boolean {
  return /^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'ZZ';
}

/**
 * Whether the presale may sell to this visitor. The gate classifies the location itself, with
 * `sanctionedWinsOverVpn` on: an IP that geolocates to a sanctioned country is an IP there, and
 * a VPN flag only says the exit is a proxy, so a sanctioned country closes the gate whatever the
 * VPN flag says. Taking the raw location rather than a caller's classification means no caller
 * can reopen that hole by classifying with the app's default order.
 */
export function presaleGeoGate(input: {
  freshness: Freshness;
  location: {countryCode: string; isVpn: boolean} | null;
  restricted: readonly RestrictedCountry[];
}): GeoGate {
  if (input.freshness.stale) return {open: false, reason: 'stale_list'};
  if (input.location === null) return {open: false, reason: 'no_check'};
  if (!isKnownCountry(input.location.countryCode)) return {open: false, reason: 'unknown_country'};
  const j = classifyJurisdiction(input.location, input.restricted, {sanctionedWinsOverVpn: true});
  if (j.action === 'block') return {open: false, reason: 'sanctioned'};
  return {open: true, reason: null};
}
