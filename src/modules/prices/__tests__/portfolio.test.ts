import {computePortfolio, priceKeyFor} from '../portfolio';
import type {TokenPrice} from '../priceModule';

const prices: Record<string, TokenPrice> = {
  native: {usd: 100, change24h: 2}, // SOL $100, +2%
  NOC: {usd: 0.1501, change24h: null},
  USDC: {usd: 1, change24h: 0},
};

describe('computePortfolio', () => {
  it('sums USD value across holdings', () => {
    const r = computePortfolio(
      [
        {mint: 'native', amountRaw: '2000000000', decimals: 9}, // 2 SOL → $200
        {mint: 'NOC', amountRaw: '1000000000000', decimals: 9}, // 1000 NOC → $150.10
        {mint: 'USDC', amountRaw: '50000000', decimals: 6}, // 50 USDC → $50
      ],
      prices,
    );
    expect(r.totalUsd).toBeCloseTo(400.1, 2);
    expect(r.perToken.native.usd).toBeCloseTo(200, 2);
  });

  it('computes the USD-weighted 24h change over priced holdings with a change', () => {
    const r = computePortfolio(
      [
        {mint: 'native', amountRaw: '2000000000', decimals: 9}, // $200, +2%
        {mint: 'USDC', amountRaw: '200000000', decimals: 6}, // $200, 0%
      ],
      prices,
    );
    expect(r.change24hPct).toBeCloseTo(1.0, 4);
  });

  it('returns null change when no holding has a known change', () => {
    const r = computePortfolio([{mint: 'NOC', amountRaw: '1000000000000', decimals: 9}], prices);
    expect(r.change24hPct).toBeNull();
  });

  it('omits perToken entries for holdings with no price', () => {
    const r = computePortfolio([{mint: 'UNKNOWN', amountRaw: '5', decimals: 0}], prices);
    expect(r.totalUsd).toBe(0);
    expect(r.change24hPct).toBeNull();
    expect(r.perToken.UNKNOWN).toBeUndefined();
  });
});

const WSOL = 'So11111111111111111111111111111111111111112';

describe('r2-4: wrapped SOL is priced as SOL', () => {
  it('priceKeyFor: wSOL → native; everything else → itself', () => {
    expect(priceKeyFor(WSOL)).toBe('native');
    expect(priceKeyFor('native')).toBe('native');
    expect(priceKeyFor('USDC')).toBe('USDC');
  });

  it('a wSOL holding gets USD and 24h % from the SOL price, under its own mint', () => {
    const r = computePortfolio([{mint: WSOL, amountRaw: '500000000', decimals: 9}], prices);
    expect(r.perToken[WSOL]).toEqual({usd: 50, change24h: 2});
    expect(r.totalUsd).toBeCloseTo(50, 6);
  });

  // W3 (Review Focus 5)
  it('R7: native SOL + wSOL — each its own row, the total counts each once', () => {
    const r = computePortfolio(
      [
        {mint: 'native', amountRaw: '1000000000', decimals: 9},
        {mint: WSOL, amountRaw: '500000000', decimals: 9},
      ],
      prices,
    );
    expect(r.perToken.native!.usd).toBeCloseTo(100, 6);
    expect(r.perToken[WSOL]!.usd).toBeCloseTo(50, 6);
    expect(r.totalUsd).toBeCloseTo(150, 6);
  });
});
