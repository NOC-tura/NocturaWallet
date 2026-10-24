/**
 * B1d §3.6, §4.3: a detected country as the user reads it — shared by #50b (the popup) and #48's F12 banner (the approve
 * window), so the two say the same name. The name is the browser's English one (`Intl.DisplayNames`); when that throws
 * or has no name for the code, the code itself is shown, never nothing. " · EU" follows the 27 EU members (a static
 * table, ISO 3166-1 alpha-2 codes).
 */
export const EU_MEMBERS: ReadonlySet<string> = new Set([
  'AT',
  'BE',
  'BG',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
]);

/** The country's English name, or the code itself when the browser cannot name it. */
export function regionName(code: string): string {
  try {
    const name = new Intl.DisplayNames(['en'], {type: 'region'}).of(code);
    return name === undefined || name === '' ? code : name;
  } catch {
    return code;
  }
}

/** #50b's region: "Slovenia · EU" for an EU member, the name alone otherwise. */
export const regionText = (code: string): string => (EU_MEMBERS.has(code) ? `${regionName(code)} · EU` : regionName(code));
