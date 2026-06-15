import {fetchPriceHistory, changeOverSeries, coingeckoIdForMint, TIMEFRAME_DAYS} from '../priceHistory';
import {USDC_MINT} from '../../tokens/coreTokens';
import {NOC_MINT} from '../../../constants/programs';

afterEach(() => {(global.fetch as jest.Mock | undefined)?.mockReset?.();});

describe('coingeckoIdForMint', () => {
  it('maps native→solana, USDC→usd-coin, NOC→null', () => {
    expect(coingeckoIdForMint('native')).toBe('solana');
    expect(coingeckoIdForMint(USDC_MINT)).toBe('usd-coin');
    expect(coingeckoIdForMint(NOC_MINT)).toBeNull();
  });
});

describe('changeOverSeries', () => {
  it('returns abs + pct from first→last', () => {
    expect(changeOverSeries([100, 110])).toEqual({absUsd: 10, pct: 10});
  });
  it('returns null for <2 points or first 0', () => {
    expect(changeOverSeries([100])).toBeNull();
    expect(changeOverSeries([0, 5])).toBeNull();
  });
});

describe('fetchPriceHistory', () => {
  it('extracts the price column from market_chart', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({prices: [[1000, 100], [2000, 110], [3000, 120]]}),
    })) as unknown as typeof fetch;
    const r = await fetchPriceHistory('solana', '7D');
    expect(r.prices).toEqual([100, 110, 120]);
  });
  it('throws on non-200', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    await expect(fetchPriceHistory('solana', '24H')).rejects.toThrow();
  });
});

describe('TIMEFRAME_DAYS', () => {
  it('maps timeframes to day counts; 1Y is the longest (free-tier 365d cap)', () => {
    expect(TIMEFRAME_DAYS['24H']).toBe(1);
    expect(TIMEFRAME_DAYS['1Y']).toBe(365);
    // No timeframe exceeds 365 — CoinGecko's free API rejects days>365 (HTTP 401).
    expect(Math.max(...Object.values(TIMEFRAME_DAYS))).toBe(365);
  });
});
