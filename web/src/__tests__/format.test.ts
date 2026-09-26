import {formatBaseUnits, formatAmount} from '../format';

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

describe('formatBaseUnits with a fraction limit', () => {
  it('drops the fraction entirely at 0, for aggregates nobody counts to the unit', () => {
    // The live figure that prompted this: 1,279,937.425329514 NOC of a stage total.
    expect(formatBaseUnits(1_279_937_425_329_514n, 9, 'NOC', {maxFractionDigits: 0})).toBe(
      '1,279,937 NOC',
    );
  });

  it('truncates rather than rounds — a progress figure must not overstate', () => {
    // .9 rounds to 1 and would report a NOC that has not been sold. Down can only understate.
    expect(formatBaseUnits(1_900_000_000n, 9, 'NOC', {maxFractionDigits: 0})).toBe('1 NOC');
    expect(formatBaseUnits(1_999_999_999n, 9, 'NOC', {maxFractionDigits: 2})).toBe('1.99 NOC');
  });

  it('still trims trailing zeros inside the limit', () => {
    expect(formatBaseUnits(1_500_000_000n, 9, 'SOL', {maxFractionDigits: 4})).toBe('1.5 SOL');
    expect(formatBaseUnits(1_000_000_000n, 9, 'SOL', {maxFractionDigits: 4})).toBe('1 SOL');
  });

  it('leaves full precision alone when no limit is given (negative control)', () => {
    // Everywhere the number is YOUR money — a balance, an allocation — nothing is hidden.
    expect(formatBaseUnits(1_279_937_425_329_514n, 9, 'NOC')).toBe('1,279,937.425329514 NOC');
  });

  it('does not grow a fraction that was not there', () => {
    expect(formatBaseUnits(5_000_000_000n, 9, 'NOC', {maxFractionDigits: 9})).toBe('5 NOC');
  });
});

describe('formatAmount — readable, with the exact value kept', () => {
  it('shortens the nine-decimal allocation to something a person reads', () => {
    // The live figure that prompted this: 1,964.890655947 NOC.
    const {text, exact} = formatAmount(1_964_890_655_947n, 9, 'NOC');
    expect(text).toBe('1,964.8906 NOC');
    expect(exact).toBe('1,964.890655947 NOC');
  });

  it('TRUNCATES rather than rounds, so it can never show more than is held', () => {
    // Rounding this to four places gives 1,964.8907 — larger than the holding, printed
    // as the holding. The direction matters more than the digit.
    expect(formatAmount(1_964_890_655_947n, 9, 'NOC').text).not.toBe('1,964.8907 NOC');
  });

  it('keeps full precision for dust rather than printing a flat zero', () => {
    // 0.000000001 NOC truncated to four places is "0 NOC", which says the wallet is
    // empty. A number too small to shorten is the one a reader most needs in full.
    const {text} = formatAmount(1n, 9, 'NOC');
    expect(text).toBe('0.000000001 NOC');
  });

  it('still prints a real zero as zero (the control)', () => {
    // Without this the dust rule could be satisfied by never shortening anything.
    expect(formatAmount(0n, 9, 'NOC').text).toBe('0 NOC');
  });

  it('leaves a short number alone', () => {
    expect(formatAmount(1_500_000_000n, 9, 'SOL').text).toBe('1.5 SOL');
  });
});
