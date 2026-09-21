import {formatBaseUnits} from '../format';

describe('formatBaseUnits', () => {
  it('formats base units without ever touching a float', () => {
    expect(formatBaseUnits(1_234_000_000_000n, 9, 'NOC')).toBe('1,234 NOC');
    expect(formatBaseUnits(473_081_440n, 9, 'SOL')).toBe('0.47308144 SOL');
    expect(formatBaseUnits(0n, 9, 'NOC')).toBe('0 NOC');
  });

  it('groups thousands manually — Hermes does not group with toLocaleString', () => {
    expect(formatBaseUnits(1_000_000_000_000_000n, 9, 'NOC')).toBe('1,000,000 NOC');
  });

  it('keeps precision a float would lose', () => {
    // 9007199254740993 > Number.MAX_SAFE_INTEGER: a float would render ...992.
    expect(formatBaseUnits(9_007_199_254_740_993n, 0, 'NOC')).toBe('9,007,199,254,740,993 NOC');
  });

  it('trims trailing zeros but keeps significant ones', () => {
    expect(formatBaseUnits(1_500_000_000n, 9, 'SOL')).toBe('1.5 SOL');
    expect(formatBaseUnits(1_000_000_001n, 9, 'SOL')).toBe('1.000000001 SOL');
  });
});
