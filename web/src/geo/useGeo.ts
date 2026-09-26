import {json} from '../lib/api';
import {classifyJurisdiction, type JurisdictionResult} from '../../../core/geo/classify';
import {BUNDLED_RESTRICTED_LIST, BUNDLED_LIST_DATE, type RestrictedCountry} from '../../../core/geo/restrictedList';

export interface GeoDecision {
  result: JurisdictionResult;
  /** Where the restricted list came from. The page must be able to say which. */
  listSource: 'server' | 'bundled';
  listStale: boolean;
  listUpdatedAt: string;
}

interface ListEnvelope {
  success?: boolean;
  data?: {countries?: RestrictedCountry[]; updated_at?: string; stale?: boolean};
}

/**
 * The real contract, read out of the app and confirmed against the live endpoint:
 * `/geo/check` answers `{countryCode, isVpn}` with **no envelope** and no `allowed`
 * field — the decision has always been made client-side, and it is OFAC-only.
 *
 * Two deliberate differences from the app:
 *
 *  1. A failed country lookup THROWS. The app warns and carries on, which is its
 *     shielded-era fail-safe; spec 6.8 requires a failed geo check to block the action
 *     and say so, and this gate sits in front of a purchase.
 *  2. A sanctioned country blocks even when the IP is flagged as a VPN. An IP that
 *     geolocates to a sanctioned country is an IP there; the flag only says the exit is
 *     a proxy.
 *
 * The list itself is allowed to fail: `/geo/restricted-list` returns 404 in production
 * today, and without the bundled fallback the page could block nobody — including the
 * jurisdictions the gate exists for. Which list was used, and how old it is, travels
 * with the decision so the page can say so instead of presenting a stale list as
 * current.
 */
export async function checkGeo(): Promise<GeoDecision> {
  // Deliberately not caught: a failure here must stop the purchase.
  const where = await json.get<{countryCode: string; isVpn: boolean}>('/geo/check');

  let countries: RestrictedCountry[] = BUNDLED_RESTRICTED_LIST;
  let listSource: 'server' | 'bundled' = 'bundled';
  let listStale = true;
  let listUpdatedAt = BUNDLED_LIST_DATE;

  try {
    const env = await json.get<ListEnvelope>('/geo/restricted-list');
    if (env.success && env.data?.countries?.length) {
      countries = env.data.countries;
      listSource = 'server';
      listStale = env.data.stale === true;
      listUpdatedAt = env.data.updated_at ?? BUNDLED_LIST_DATE;
    }
  } catch {
    // Fall back to the bundled list, and say so through listSource.
  }

  return {
    result: classifyJurisdiction(where, countries, {sanctionedWinsOverVpn: true}),
    listSource,
    listStale,
    listUpdatedAt,
  };
}
