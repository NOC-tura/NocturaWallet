import {
  getPrivacyLevel,
  shouldRepeatWarning,
  getPrivacyStrength,
} from '../privacyMeter';

describe('privacyMeter', () => {
  it('leafCount < 100 returns low/red/shouldShow', () => {
    const result = getPrivacyLevel(50, false);
    expect(result.level).toBe('low');
    expect(result.color).toBe('red');
    expect(result.shouldShow).toBe(true);
    expect(result.message).toContain('very small');
  });

  it('leafCount 500 returns moderate/yellow/shouldShow', () => {
    const result = getPrivacyLevel(500, false);
    expect(result.level).toBe('moderate');
    expect(result.color).toBe('yellow');
    expect(result.shouldShow).toBe(true);
  });

  it('leafCount 5000 returns good/green/shouldShow', () => {
    const result = getPrivacyLevel(5000, false);
    expect(result.level).toBe('good');
    expect(result.color).toBe('green');
    expect(result.shouldShow).toBe(true);
  });

  it('leafCount >= 10000 returns shouldShow=false when not first deposit', () => {
    const result = getPrivacyLevel(15000, false);
    expect(result.level).toBe('good');
    expect(result.shouldShow).toBe(false);
  });

  it('leafCount >= 10000 returns shouldShow=true when isFirstDeposit', () => {
    const result = getPrivacyLevel(15000, true);
    expect(result.level).toBe('good');
    expect(result.shouldShow).toBe(true);
  });

  it('shouldRepeatWarning returns true < 1000, false >= 1000', () => {
    expect(shouldRepeatWarning(999)).toBe(true);
    expect(shouldRepeatWarning(1000)).toBe(false);
    expect(shouldRepeatWarning(50)).toBe(true);
  });

  describe('getPrivacyStrength', () => {
    it('maps anonymity set size to 0..5 bars across bands', () => {
      expect(getPrivacyStrength(0)).toEqual({bars: 0, label: 'None', tone: 'muted'});
      expect(getPrivacyStrength(5)).toEqual({bars: 1, label: 'Very weak', tone: 'danger'});
      expect(getPrivacyStrength(50)).toEqual({bars: 2, label: 'Weak', tone: 'danger'});
      expect(getPrivacyStrength(500)).toEqual({bars: 3, label: 'Fair', tone: 'warn'});
      expect(getPrivacyStrength(5000)).toEqual({bars: 4, label: 'Strong', tone: 'accent'});
      expect(getPrivacyStrength(15000)).toEqual({bars: 5, label: 'Very strong', tone: 'accent'});
    });

    it('treats negative leaf counts as no anonymity set', () => {
      expect(getPrivacyStrength(-1).bars).toBe(0);
    });

    it('band edges are inclusive-low / exclusive-high', () => {
      expect(getPrivacyStrength(9).bars).toBe(1);
      expect(getPrivacyStrength(10).bars).toBe(2);
      expect(getPrivacyStrength(999).bars).toBe(3);
      expect(getPrivacyStrength(1000).bars).toBe(4);
      expect(getPrivacyStrength(9999).bars).toBe(4);
      expect(getPrivacyStrength(10000).bars).toBe(5);
    });
  });
});
