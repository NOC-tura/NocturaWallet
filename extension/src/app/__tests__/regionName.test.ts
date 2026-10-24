import {EU_MEMBERS, regionName, regionText} from '../ui/regionName';

// B1d §3.6, §4.3: the shared country helper of #50b and #48's F12 — the browser's English name, the code itself when
// the browser cannot name it, and " · EU" for the 27 EU members only.
afterEach(() => {
  vi.restoreAllMocks();
});

describe('regionName / regionText (§4.3)', () => {
  it('the English name; " · EU" for a member (SI, DE, GR) and for no other country (positive and negative controls)', () => {
    expect(regionName('SI')).toBe('Slovenia');
    expect(regionText('SI')).toBe('Slovenia · EU');
    expect(regionText('DE')).toBe('Germany · EU');
    expect(regionText('GR')).toBe('Greece · EU');
    for (const [code, name] of [
      ['KP', 'North Korea'],
      ['US', 'United States'],
      ['CH', 'Switzerland'],
      ['GB', 'United Kingdom'],
      ['NO', 'Norway'],
    ]) {
      expect(regionText(code as string)).toBe(name);
    }
  });

  it('the EU-27, exactly (ISO 3166-1 alpha-2: Greece is GR)', () => {
    expect([...EU_MEMBERS].sort()).toEqual(['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK']);
    expect(EU_MEMBERS.has('EL')).toBe(false);
    expect(EU_MEMBERS.has('GB')).toBe(false);
  });

  it('Intl.DisplayNames throwing → the code itself, never nothing (with " · EU" still from the table)', () => {
    vi.spyOn(Intl, 'DisplayNames').mockImplementation(function () {
      throw new RangeError('no display names');
    });
    expect(regionName('KP')).toBe('KP');
    expect(regionText('SI')).toBe('SI · EU');
  });

  it('Intl.DisplayNames answering undefined or an empty name → the code itself', () => {
    for (const answer of [undefined, '']) {
      vi.spyOn(Intl, 'DisplayNames').mockImplementation(function () {
        return {of: () => answer} as unknown as Intl.DisplayNames;
      });
      expect(regionName('KP')).toBe('KP');
      vi.restoreAllMocks();
    }
  });
});
