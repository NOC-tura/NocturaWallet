import {formatAmount, parseAmount} from '../amount';

describe('parseAmount', () => {
  it('reads digits with at most the token’s decimals, exactly', () => {
    expect(parseAmount('2.48', 9)).toBe(2_480_000_000n);
    expect(parseAmount('12', 6)).toBe(12_000_000n);
    expect(parseAmount('0.000001', 6)).toBe(1n);
    expect(parseAmount('1.', 6)).toBe(1_000_000n);
    expect(parseAmount('18446744073.709551615', 9)).toBe(18_446_744_073_709_551_615n);
  });

  it('refuses anything else — more places than the token has, signs, spaces, exponents, commas', () => {
    for (const bad of ['', '.5', '1.0000001', '-1', ' 1', '1e3', '1,000', '0x10', 'NaN']) expect(parseAmount(bad, 6)).toBeNull();
    expect(parseAmount('1.5', 0)).toBeNull();
    expect(parseAmount('15', 0)).toBe(15n);
  });
});

describe('formatAmount', () => {
  it('groups thousands and keeps min..max fraction digits', () => {
    expect(formatAmount(4_200_000_000_000n, 9, {min: 2, max: 2})).toBe('4,200.00');
    expect(formatAmount(62_482_100_000n, 9, {min: 4, max: 4})).toBe('62.4821');
    expect(formatAmount(5_000n, 9, {min: 0, max: 9})).toBe('0.000005');
    expect(formatAmount(1_000_000n, 6, {min: 0, max: 6})).toBe('1');
  });

  it('truncates, never rounds a balance up', () => {
    expect(formatAmount(62_482_199_999n, 9, {min: 4, max: 4})).toBe('62.4821');
    expect(formatAmount(999_999n, 6, {min: 2, max: 2})).toBe('0.99');
    // property: for many balances, the shown value never exceeds the real one
    for (let i = 0n; i < 2000n; i++) {
      const base = i * 7_919_000n + 999_999n;
      const shown = parseAmount(formatAmount(base, 9, {min: 4, max: 4}).replaceAll(',', ''), 9);
      expect(shown !== null && shown <= base).toBe(true);
    }
  });
});
