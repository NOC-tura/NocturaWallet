import {seriesToPath} from '../SparkChart';

describe('seriesToPath', () => {
  it('maps a rising series to a path ending at the right edge', () => {
    const r = seriesToPath([1, 2, 3], 300, 100);
    expect(r.lastX).toBeCloseTo(300, 5);
    expect(r.lastY).toBeLessThan(r.firstY);
    expect(r.line.startsWith('M')).toBe(true);
    expect(r.area.endsWith('Z')).toBe(true);
  });
  it('handles a flat series without NaN', () => {
    const r = seriesToPath([5, 5, 5], 300, 100);
    expect(r.line).not.toMatch(/NaN/);
    expect(r.area).not.toMatch(/NaN/);
  });
  it('returns empty paths for <2 points', () => {
    expect(seriesToPath([5], 300, 100).line).toBe('');
  });
});
