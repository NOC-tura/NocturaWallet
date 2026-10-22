import type {JsonGetter} from '../../../../core/ports';
import {fetchGeoCheck, fetchRestrictedList, isGeoRefusal, type GeoList, type GeoLocation} from '../../../../core/geo/fetch';
import {evaluateListFreshness, isKnownCountry, presaleGeoGate} from '../../../../core/geo/freshness';

/**
 * B1d §2.2: the jurisdiction gate — shared compliance code, in both builds (D15). #23 asks it through `presale/` and
 * F12 through `dapp/` (both B1d-1b), via `WalletDeps.geo`; it imports nothing under a presale directory.
 *
 * It fails closed: a 403 (or the shared latch's cool-down) is `refused`; any other failed or malformed read is
 * `no_check`; otherwise core's `presaleGeoGate` decides — a stale list, an unknown or empty country, a sanctioned
 * country (whatever `isVpn` says). `/geo/check` is asked on every call; the list is kept in memory for less than
 * GEO_LIST_CACHE_MS and its age is evaluated against the clock on every call (C12), against the server's
 * `max_staleness_days` capped at GEO_MAX_STALENESS_DAYS (D18). There is no bundled list.
 */
export type GeoReason = 'refused' | 'no_check' | 'stale_list' | 'unknown_country' | 'sanctioned';

export interface GeoAnswer {
  open: boolean;
  reason: GeoReason | null;
  /** The detected country when it is a known one (#50b's region card); null when there is none to show. */
  countryCode: string | null;
}

export const GEO_LIST_CACHE_MS = 10 * 60_000;
/** D18: the gate judges a list's age against min(the server's `max_staleness_days`, 30); a missing limit stays missing (stale). */
export const GEO_MAX_STALENESS_DAYS = 30;

export interface JurisdictionGate {
  check(): Promise<GeoAnswer>;
}

/**
 * Review 1 M1: a list with several entries for the same code must fail closed on the worst one, not on whichever
 * entry `classifyJurisdiction`'s `find` happens to hit first (which was the first entry, in list order — an
 * ambiguous list opening on a lenient entry is a hole, not a shrug). The merge is here, in the extension's gate,
 * not in `core/geo/classify.ts` (D12): web and the app read `classifyJurisdiction` unchanged.
 */
function worstPerCountry(countries: GeoList['countries']): GeoList['countries'] {
  const worst = new Map<string, GeoList['countries'][number]>();
  for (const c of countries) {
    const seen = worst.get(c.code);
    if (seen === undefined || (seen.category !== 'sanctioned' && c.category === 'sanctioned')) worst.set(c.code, c);
  }
  return [...worst.values()];
}

export function createJurisdictionGate(io: {get: JsonGetter; now(): number}): JurisdictionGate {
  let cached: {at: number; list: GeoList} | null = null;
  let reading: Promise<GeoList> | null = null;

  const list = (): Promise<GeoList> => {
    const at = io.now();
    if (cached !== null && at >= cached.at && at - cached.at < GEO_LIST_CACHE_MS) return Promise.resolve(cached.list);
    // One list request for callers that arrive together; a failed or malformed read is not kept.
    reading ??= fetchRestrictedList(io.get).then(
      l => {
        cached = {at, list: l};
        reading = null;
        return l;
      },
      (e: unknown) => {
        reading = null;
        throw e;
      },
    );
    return reading;
  };

  return {
    async check() {
      let location: GeoLocation;
      let restricted: GeoList;
      try {
        location = await fetchGeoCheck(io.get);
        restricted = await list();
      } catch (e) {
        return {open: false, reason: isGeoRefusal(e) ? 'refused' : 'no_check', countryCode: null};
      }
      const limit = restricted.meta.maxStalenessDays;
      const meta = limit === undefined ? restricted.meta : {...restricted.meta, maxStalenessDays: Math.min(limit, GEO_MAX_STALENESS_DAYS)};
      const g = presaleGeoGate({freshness: evaluateListFreshness(meta, new Date(io.now())), location, restricted: worstPerCountry(restricted.countries)});
      return {open: g.open, reason: g.reason, countryCode: isKnownCountry(location.countryCode) ? location.countryCode : null};
    },
  };
}
