/**
 * regionDisplay — map an ISO-3166 alpha-2 country code to a human-readable
 * label and an EU-membership flag, for compliance UI (e.g. the #50 geo-blocked
 * screen). Falls back to the raw code when the country is not in the bundled
 * map. Coarse geo only — derived from network IP, never device location.
 */

/** The 27 EU member states (ISO-3166 alpha-2). */
const EU_MEMBERS = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES', 'SE',
]);

/**
 * Bundled country-name subset: the 27 EU members, the bundled restricted list
 * (sanctioned + restricted), plus US / GB / CH. Not exhaustive by design —
 * unknown codes fall back to the raw code in regionDisplay().
 */
const COUNTRY_NAMES: Record<string, string> = {
  AT: 'Austria',
  BE: 'Belgium',
  BG: 'Bulgaria',
  HR: 'Croatia',
  CY: 'Cyprus',
  CZ: 'Czechia',
  DK: 'Denmark',
  EE: 'Estonia',
  FI: 'Finland',
  FR: 'France',
  DE: 'Germany',
  GR: 'Greece',
  HU: 'Hungary',
  IE: 'Ireland',
  IT: 'Italy',
  LV: 'Latvia',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  MT: 'Malta',
  NL: 'Netherlands',
  PL: 'Poland',
  PT: 'Portugal',
  RO: 'Romania',
  SK: 'Slovakia',
  SI: 'Slovenia',
  ES: 'Spain',
  SE: 'Sweden',
  CU: 'Cuba',
  IR: 'Iran',
  KP: 'North Korea',
  SY: 'Syria',
  RU: 'Russia',
  CN: 'China',
  MM: 'Myanmar',
  BY: 'Belarus',
  VE: 'Venezuela',
  ZW: 'Zimbabwe',
  US: 'United States',
  GB: 'United Kingdom',
  CH: 'Switzerland',
};

export function regionDisplay(countryCode: string): {
  label: string;
  isEu: boolean;
} {
  return {
    label: COUNTRY_NAMES[countryCode] ?? countryCode,
    isEu: EU_MEMBERS.has(countryCode),
  };
}
