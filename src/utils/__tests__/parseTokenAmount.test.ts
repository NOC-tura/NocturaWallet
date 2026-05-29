import {
  parseTokenAmount,
  formatTokenAmount,
  formatBalanceForDisplay,
} from '../parseTokenAmount';

describe('parseTokenAmount', () => {
  it("parses whole number '1' with 9 decimals", () => {
    expect(parseTokenAmount('1', 9)).toBe(1_000_000_000n);
  });

  it("parses decimal '1.5' with 9 decimals", () => {
    expect(parseTokenAmount('1.5', 9)).toBe(1_500_000_000n);
  });

  it("parses small decimal '0.000000001' with 9 decimals", () => {
    expect(parseTokenAmount('0.000000001', 9)).toBe(1n);
  });

  it("parses 6-decimal token (USDC) '1.5'", () => {
    expect(parseTokenAmount('1.5', 6)).toBe(1_500_000n);
  });

  it("rejects too many decimals '1.0000000001' with 9", () => {
    expect(() => parseTokenAmount('1.0000000001', 9)).toThrow();
  });

  it("parses zero '0'", () => {
    expect(parseTokenAmount('0', 9)).toBe(0n);
  });

  it("parses empty string ''", () => {
    expect(parseTokenAmount('', 9)).toBe(0n);
  });

  it("rejects negative '-1'", () => {
    expect(() => parseTokenAmount('-1', 9)).toThrow();
  });

  it("rejects non-numeric 'abc'", () => {
    expect(() => parseTokenAmount('abc', 9)).toThrow();
  });

  it("handles no decimal point '100' with 9 decimals", () => {
    expect(parseTokenAmount('100', 9)).toBe(100_000_000_000n);
  });
});

describe('formatTokenAmount', () => {
  it('formats 1_500_000_000n with 9 decimals to "1.5"', () => {
    expect(formatTokenAmount(1_500_000_000n, 9)).toBe('1.5');
  });

  it('formats 1_000_000_000n with 9 decimals to "1"', () => {
    expect(formatTokenAmount(1_000_000_000n, 9)).toBe('1');
  });

  it('formats 0n to "0"', () => {
    expect(formatTokenAmount(0n, 9)).toBe('0');
  });

  it('formats USDC 1_500_000n with 6 decimals to "1.5"', () => {
    expect(formatTokenAmount(1_500_000n, 6)).toBe('1.5');
  });
});

describe('formatBalanceForDisplay', () => {
  it("formats 5 SOL (raw '5000000000', 9 decimals) as '5'", () => {
    expect(formatBalanceForDisplay('5000000000', 9)).toBe('5');
  });

  it("formats 5.5 SOL ('5500000000', 9) as '5.5'", () => {
    expect(formatBalanceForDisplay('5500000000', 9)).toBe('5.5');
  });

  it("rounds to maxDecimals (default 4) for '1234567890' / 9 → '1.2346'", () => {
    expect(formatBalanceForDisplay('1234567890', 9)).toBe('1.2346');
  });

  it("returns '0' for raw '0'", () => {
    expect(formatBalanceForDisplay('0', 9)).toBe('0');
  });

  it("returns '0' for empty string", () => {
    expect(formatBalanceForDisplay('', 9)).toBe('0');
  });

  it("uses thousand separators for large balances: '10000000000000' / 9 → '10,000'", () => {
    expect(formatBalanceForDisplay('10000000000000', 9)).toBe('10,000');
  });

  it("formats USDC '1500000' / 6 as '1.5'", () => {
    expect(formatBalanceForDisplay('1500000', 6)).toBe('1.5');
  });

  it("uses scientific notation for sub-display amounts: '100' / 9 (1e-7) → '1.00e-7'", () => {
    expect(formatBalanceForDisplay('100', 9)).toBe('1.00e-7');
  });

  it('respects custom maxDecimals override', () => {
    expect(formatBalanceForDisplay('1234567890', 9, 2)).toBe('1.23');
  });

  it('preserves precision for balances far above Number.MAX_SAFE_INTEGER (20-digit raw, 9 dec, 9 maxDisplay)', () => {
    // Number('99999999999999999999') = 1e20 (15+ digits of precision lost).
    // /1e9 = 1e11 with no fractional part → "100,000,000,000" via Number path.
    // bigint stays exact: whole=99999999999, frac=999999999 → "99,999,999,999.999999999"
    expect(formatBalanceForDisplay('99999999999999999999', 9, 9)).toBe(
      '99,999,999,999.999999999',
    );
  });

  it('rounds up with carry into whole (1.99995 / 9 dec → "2")', () => {
    expect(formatBalanceForDisplay('1999950000', 9)).toBe('2');
  });

  it('does NOT use scientific notation when maxDisplayDecimals=0 — small value rounds half-up to whole', () => {
    // 0.5 SOL with 0 max display decimals should render as rounded whole "1"
    // (round-half-up, consistent with how the rest of the function rounds),
    // NOT as "5.00e-1" (the pre-fix behavior when threshold collapses to 1).
    expect(formatBalanceForDisplay('500000000', 9, 0)).toBe('1');
  });

  it('rounds half-up to whole when maxDisplayDecimals=0 (1.5 SOL → "2")', () => {
    expect(formatBalanceForDisplay('1500000000', 9, 0)).toBe('2');
  });
});
