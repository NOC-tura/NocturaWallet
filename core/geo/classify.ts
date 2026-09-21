import type {RestrictedCountry} from './restrictedList';

export interface JurisdictionResult {
  action: 'allow' | 'warn' | 'block';
  countryCode: string;
  reason?: 'restricted' | 'sanctioned' | 'ambiguous' | 'vpn_detected';
  transparentAllowed: true;
  message?: string;
}

/** Presale buy policy (OFAC-only): block only sanctioned jurisdictions. */
export function isPresaleBlocked(result: JurisdictionResult): boolean {
  return result.action === 'block';
}

export interface ClassifyOptions {
  /**
   * When true, a sanctioned country code blocks even if the IP is flagged as a VPN.
   *
   * The app's long-standing order is the opposite — the VPN check runs first and
   * returns `warn`, so a sanctioned country behind a VPN flag is not blocked. That is
   * defensible for a feature gate on an installed app; for a public sale surface it is
   * not, because an IP that geolocates to a sanctioned country IS an IP there, and the
   * VPN flag only says the exit is a proxy. Defaults to false so moving this function
   * out of the app changed nothing.
   */
  sanctionedWinsOverVpn?: boolean;
}

/**
 * Classify a country code and VPN flag against the active restricted list.
 *
 * Pure: the transport, the cache and the fallback stay with each platform, because the
 * app caches in MMKV with a 6-hour TTL and the web has neither.
 */
export function classifyJurisdiction(
  input: {countryCode: string; isVpn: boolean},
  restricted: readonly RestrictedCountry[],
  opts: ClassifyOptions = {},
): JurisdictionResult {
  const {countryCode, isVpn} = input;
  const entry = restricted.find(c => c.code === countryCode);
  const sanctioned = entry?.category === 'sanctioned';

  if (sanctioned && (opts.sanctionedWinsOverVpn || !isVpn)) {
    return {
      action: 'block',
      countryCode,
      reason: 'sanctioned',
      transparentAllowed: true,
      message: 'Access to shielded features is unavailable in your jurisdiction.',
    };
  }

  if (isVpn) {
    return {
      action: 'warn',
      countryCode,
      reason: 'vpn_detected',
      transparentAllowed: true,
      message: 'VPN or proxy detected. Shielded features may be limited.',
    };
  }

  if (!entry) {
    return {action: 'allow', countryCode, transparentAllowed: true};
  }

  return {
    action: 'warn',
    countryCode,
    reason: 'restricted',
    transparentAllowed: true,
    message: 'Shielded features may have limited availability in your region.',
  };
}
