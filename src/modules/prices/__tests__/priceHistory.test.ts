import {fetchPriceHistory, changeOverSeries, coingeckoIdForMint, TIMEFRAME_DAYS} from '../priceHistory';
import {USDC_MINT, USDT_MINT} from '../../tokens/coreTokens';
import {NOC_MINT} from '../../../constants/programs';
import {pinnedFetch} from '../../sslPinning/pinnedFetch';

jest.mock('../../sslPinning/pinnedFetch');
const mockPinned = pinnedFetch as jest.Mock;

afterEach(() => {
  mockPinned.mockReset();
  (global.fetch as jest.Mock | undefined)?.mockReset?.();
});

describe('coingeckoIdForMint', () => {
  it('maps native→solana, USDC→usd-coin, USDT→tether, NOC→null', () => {
    expect(coingeckoIdForMint('native')).toBe('solana');
    expect(coingeckoIdForMint(USDC_MINT)).toBe('usd-coin');
    expect(coingeckoIdForMint(USDT_MINT)).toBe('tether');
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
  it('uses the backend and extracts the price column (no direct call)', async () => {
    mockPinned.mockResolvedValue({
      status: 200,
      json: async () => ({success: true, data: {prices: [[1000, 100], [2000, 110], [3000, 120]]}}),
    });
    global.fetch = jest.fn() as unknown as typeof fetch;

    const r = await fetchPriceHistory('solana', '7D');
    expect(r.prices).toEqual([100, 110, 120]);
    expect(mockPinned).toHaveBeenCalledWith(expect.stringContaining('/wallet/chart?id=solana&days=7'));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls back to direct CoinGecko when the backend fails', async () => {
    mockPinned.mockRejectedValue(new Error('pin fail'));
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({prices: [[1000, 5], [2000, 6]]}),
    })) as unknown as typeof fetch;

    const r = await fetchPriceHistory('tether', '24H');
    expect(r.prices).toEqual([5, 6]);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('throws when both backend and direct fail', async () => {
    mockPinned.mockRejectedValue(new Error('pin fail'));
    global.fetch = jest.fn(async () => ({ok: false, status: 429, json: async () => ({})})) as unknown as typeof fetch;
    await expect(fetchPriceHistory('solana', '24H')).rejects.toThrow();
  });
});

describe('TIMEFRAME_DAYS', () => {
  it('maps timeframes to day counts; 1Y is the longest (free-tier 365d cap)', () => {
    expect(TIMEFRAME_DAYS['24H']).toBe(1);
    expect(TIMEFRAME_DAYS['1Y']).toBe(365);
    expect(Math.max(...Object.values(TIMEFRAME_DAYS))).toBe(365);
  });
});
