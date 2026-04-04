/**
 * Bundled fallback restricted country list.
 * Used when API_BASE/v1/geo/restricted-list is unreachable.
 * Max staleness: 30 days — update this list on every app release.
 */

export interface RestrictedCountry {
  code: string;
  category: 'sanctioned' | 'restricted';
}

export const BUNDLED_RESTRICTED_LIST: RestrictedCountry[] = [
  // OFAC Sanctioned (shielded blocked)
  {code: 'CU', category: 'sanctioned'},
  {code: 'IR', category: 'sanctioned'},
  {code: 'KP', category: 'sanctioned'},
  {code: 'SY', category: 'sanctioned'},
  {code: 'RU', category: 'sanctioned'},
  // Restricted (shielded warn)
  {code: 'CN', category: 'restricted'},
  {code: 'MM', category: 'restricted'},
  {code: 'BY', category: 'restricted'},
  {code: 'VE', category: 'restricted'},
  {code: 'ZW', category: 'restricted'},
];

export const BUNDLED_LIST_DATE = '2026-04-04';
