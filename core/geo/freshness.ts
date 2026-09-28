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
  if (!v) return null;
  // Accept ONLY: (a) YYYY-MM-DD as UTC, or (b) full ISO-8601 with explicit Z or offset.
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(v);
  const isIso8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(v);
  if (!isDateOnly && !isIso8601) return null;

  const t = Date.parse(isDateOnly ? `${v}T00:00:00Z` : v);
  if (!Number.isFinite(t)) return null;

  // Validate that the parsed date is real (reject impossible dates like 2026-02-31).
  const parsed = new Date(t);
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth() + 1;
  const day = parsed.getUTCDate();
  const dateStr = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  const expectedStr = v.slice(0, 10);
  if (dateStr !== expectedStr) return null; // Round-trip failed; date was invalid.

  return t;
}

export function evaluateListFreshness(meta: ListMeta, now: Date): Freshness {
  if (meta.source === 'bundled') return {stale: true, reason: 'bundled', ageDays: null};
  const dates = [parseDay(meta.updatedAt), parseDay(meta.reviewedAt)].filter((t): t is number => t !== null);
  if (dates.length === 0) return {stale: true, reason: 'no_dates', ageDays: null};
  const nowMs = now.getTime();
  // Fail closed: if `now` is invalid (NaN), treat as stale. This protects against clock skew or invalid dates.
  if (!Number.isFinite(nowMs)) return {stale: true, reason: 'too_old', ageDays: null};
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

export function presaleGeoGate(input: {freshness: Freshness; jurisdiction: JurisdictionResult | null}): GeoGate {
  if (input.freshness.stale) return {open: false, reason: 'stale_list'};
  if (input.jurisdiction === null) return {open: false, reason: 'no_check'};
  if (!isKnownCountry(input.jurisdiction.countryCode)) return {open: false, reason: 'unknown_country'};
  if (input.jurisdiction.action === 'block') return {open: false, reason: 'sanctioned'};
  return {open: true, reason: null};
}
