import {getPrivacyLevel, shouldRepeatWarning} from '../privacyMeter';

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
});
