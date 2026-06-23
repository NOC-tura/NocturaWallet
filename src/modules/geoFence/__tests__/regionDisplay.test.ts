import {regionDisplay} from '../regionDisplay';

describe('regionDisplay', () => {
  it('names EU members with the EU tag', () => {
    expect(regionDisplay('SI')).toEqual({label: 'Slovenia', isEu: true});
  });
  it('names sanctioned/restricted countries', () => {
    expect(regionDisplay('KP')).toEqual({label: 'North Korea', isEu: false});
  });
  it('falls back to the raw code when unknown', () => {
    expect(regionDisplay('ZZ')).toEqual({label: 'ZZ', isEu: false});
    expect(regionDisplay('UNKNOWN')).toEqual({label: 'UNKNOWN', isEu: false});
  });
});
