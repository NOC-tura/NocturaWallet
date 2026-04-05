import {parseTokenAmount, formatTokenAmount} from '../parseTokenAmount';

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
