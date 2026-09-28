import type {JurisdictionResult} from './classify';

/**
 * Whether the sanctions list a purchase is judged against is fresh enough to sell on.
 *
 * Fails closed on purpose (spec §4, owner decision 2026-09-27): the app once ran five
 * months on its bundled fallback because the list endpoint 404'd silently. So the bundled
 * list is always stale, missing or unparsable dates are stale, a missing limit is stale,
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

function parseDay(v: string | undefined): number | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  const t = Date.parse(v.length === 10 ? `${v}T00:00:00Z` : v);
  return Number.isFinite(t) ? t : null;
}

export function evaluateListFreshness(meta: ListMeta, now: Date): Freshness {
  if (meta.source === 'bundled') return {stale: true, reason: 'bundled', ageDays: null};
  const dates = [parseDay(meta.updatedAt), parseDay(meta.reviewedAt)].filter((t): t is number => t !== null);
  if (dates.length === 0) return {stale: true, reason: 'no_dates', ageDays: null};
  const ageDays = Math.floor((now.getTime() - Math.max(...dates)) / DAY);
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

export function presaleGeoGate(input: {freshness: Freshness; jurisdiction: JurisdictionResult | null}): GeoGate {
  if (input.freshness.stale) return {open: false, reason: 'stale_list'};
  if (input.jurisdiction === null) return {open: false, reason: 'no_check'};
  if (!isKnownCountry(input.jurisdiction.countryCode)) return {open: false, reason: 'unknown_country'};
  if (input.jurisdiction.action === 'block') return {open: false, reason: 'sanctioned'};
  return {open: true, reason: null};
}
