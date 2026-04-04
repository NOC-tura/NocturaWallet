import {pinnedFetch} from '../sslPinning/pinnedFetch';
import {API_BASE} from '../../constants/programs';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {mmkvPublic} from '../../store/mmkv/instances';
import {
  BUNDLED_RESTRICTED_LIST,
  type RestrictedCountry,
} from './restrictedList';

/** 6-hour TTL for the cached restricted list (in milliseconds) */
const RESTRICTED_LIST_TTL_MS = 6 * 60 * 60 * 1000;

export interface JurisdictionResult {
  action: 'allow' | 'warn' | 'block';
  countryCode: string;
  reason?: 'restricted' | 'sanctioned' | 'ambiguous' | 'vpn_detected';
  transparentAllowed: true;
  message?: string;
}

interface GeoCheckResponse {
  countryCode: string;
  isVpn: boolean;
}

/**
 * GeoFenceManager — 3-tier soft-block jurisdiction enforcement.
 *
 * Tiers:
 *  - allow  : unrestricted country, no VPN
 *  - warn   : restricted country, VPN detected, or API unreachable (fail-safe)
 *  - block  : OFAC sanctioned country
 *
 * transparentAllowed is ALWAYS true — only shielded features are gated.
 */
export class GeoFenceManager {
  private kycCountry: string | null;

  constructor() {
    // Load KYC country override from MMKV on construction
    const stored = mmkvPublic.getString(MMKV_KEYS.GEO_KYC_COUNTRY);
    this.kycCountry = stored ?? null;
  }

  /**
   * Persist a KYC-verified country code. Once set, IP-based detection is
   * skipped and this country is used for every subsequent jurisdiction check.
   */
  setKycCountry(code: string): void {
    this.kycCountry = code;
    mmkvPublic.set(MMKV_KEYS.GEO_KYC_COUNTRY, code);
  }

  /**
   * Check jurisdiction and return a JurisdictionResult.
   *
   * - If KYC country is set → classify it directly (no network call).
   * - Otherwise → fetch geo check from API, classify result.
   * - On API failure → fail-safe warn with ambiguous.
   */
  async checkJurisdiction(): Promise<JurisdictionResult> {
    // KYC country overrides IP detection entirely — no network calls at all
    if (this.kycCountry !== null) {
      return this.classifyCountry(this.kycCountry, {skipBackgroundRefresh: true});
    }

    try {
      const response = await pinnedFetch(`${API_BASE}/v1/geo/check`);
      const data = (await response.json()) as GeoCheckResponse;
      const {countryCode, isVpn} = data;

      // VPN check takes priority over country classification
      if (isVpn) {
        return {
          action: 'warn',
          countryCode,
          reason: 'vpn_detected',
          transparentAllowed: true,
          message: 'VPN or proxy detected. Shielded features may be limited.',
        };
      }

      return this.classifyCountry(countryCode, {skipBackgroundRefresh: false});
    } catch {
      // NEVER silent-block on API failure — always fail open with warn
      return {
        action: 'warn',
        countryCode: 'UNKNOWN',
        reason: 'ambiguous',
        transparentAllowed: true,
        message:
          'Jurisdiction check unavailable. Shielded features temporarily limited.',
      };
    }
  }

  /**
   * Classify a country code against the active restricted list.
   * Uses MMKV-cached list (6h TTL), falls back to bundled list.
   * Triggers a background refresh when the cache is stale (unless skipBackgroundRefresh).
   */
  private classifyCountry(
    countryCode: string,
    opts: {skipBackgroundRefresh: boolean} = {skipBackgroundRefresh: false},
  ): JurisdictionResult {
    const list = this.getActiveRestrictedList(opts.skipBackgroundRefresh);
    const entry = list.find(c => c.code === countryCode);

    if (!entry) {
      return {
        action: 'allow',
        countryCode,
        transparentAllowed: true,
      };
    }

    if (entry.category === 'sanctioned') {
      return {
        action: 'block',
        countryCode,
        reason: 'sanctioned',
        transparentAllowed: true,
        message:
          'Access to shielded features is unavailable in your jurisdiction.',
      };
    }

    return {
      action: 'warn',
      countryCode,
      reason: 'restricted',
      transparentAllowed: true,
      message:
        'Shielded features may have limited availability in your region.',
    };
  }

  /**
   * Return the active restricted list:
   *  1. If MMKV cache exists and is < 6h old → use cached list.
   *  2. Otherwise → use bundled list and trigger a background refresh
   *     (unless skipBackgroundRefresh is true).
   */
  private getActiveRestrictedList(
    skipBackgroundRefresh = false,
  ): RestrictedCountry[] {
    const cachedJson = mmkvPublic.getString(MMKV_KEYS.GEO_RESTRICTED_LIST);
    const cachedAtStr = mmkvPublic.getString(MMKV_KEYS.GEO_RESTRICTED_LIST_AT);

    if (cachedJson && cachedAtStr) {
      const cachedAt = Number(cachedAtStr);
      const age = Date.now() - cachedAt;

      if (age < RESTRICTED_LIST_TTL_MS) {
        try {
          return JSON.parse(cachedJson) as RestrictedCountry[];
        } catch {
          // Corrupted cache — fall through to bundled list
        }
      }
    }

    // Cache is missing or stale — kick off a background refresh if allowed
    if (!skipBackgroundRefresh) {
      this.refreshRestrictedListInBackground();
    }

    return BUNDLED_RESTRICTED_LIST;
  }

  /**
   * Fetch the latest restricted list from the API and cache it.
   * Runs fire-and-forget — errors are silently ignored.
   * Wrapped in Promise.resolve() to guard against mock/stub environments
   * where pinnedFetch may return undefined instead of a Promise.
   */
  private refreshRestrictedListInBackground(): void {
    Promise.resolve()
      .then(() => pinnedFetch(`${API_BASE}/v1/geo/restricted-list`))
      .then(async response => {
        const list = (await response.json()) as RestrictedCountry[];
        mmkvPublic.set(MMKV_KEYS.GEO_RESTRICTED_LIST, JSON.stringify(list));
        mmkvPublic.set(
          MMKV_KEYS.GEO_RESTRICTED_LIST_AT,
          String(Date.now()),
        );
      })
      .catch(() => {
        // Background refresh failure is non-fatal; bundled list remains active
      });
  }
}

/** Module-level singleton for convenience. */
export const geoFenceManager = new GeoFenceManager();
