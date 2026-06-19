import {fetchPrices} from '../priceModule';
import {USDC_MINT, USDT_MINT} from '../../tokens/coreTokens';
import {pinnedFetch} from '../../sslPinning/pinnedFetch';

jest.mock('../../sslPinning/pinnedFetch');
const mockPinned = pinnedFetch as jest.Mock;

const backendBody = {
  success: true,
  data: {
    solana: {usd: 178.42, usd_24h_change: 2.34},
    'usd-coin': {usd: 0.999, usd_24h_change: 0.01},
    tether: {usd: 1.0, usd_24h_change: -0.02},
  },
};
const cgBody = {
  solana: {usd: 150, usd_24h_change: 1.1},
  'usd-coin': {usd: 1.0, usd_24h_change: 0.0},
  tether: {usd: 0.999, usd_24h_change: 0.05},
};

afterEach(() => {
  mockPinned.mockReset();
  (global.fetch as jest.Mock | undefined)?.mockReset?.();
});

describe('fetchPrices', () => {
  it('uses the backend and maps SOL/USDC/USDT (no direct call)', async () => {
    mockPinned.mockResolvedValue({status: 200, json: async () => backendBody});
    global.fetch = jest.fn() as unknown as typeof fetch;

    const prices = await fetchPrices();
    expect(prices.native).toEqual({usd: 178.42, change24h: 2.34});
    expect(prices[USDC_MINT]).toEqual({usd: 0.999, change24h: 0.01});
    expect(prices[USDT_MINT]).toEqual({usd: 1.0, change24h: -0.02});
    expect(mockPinned).toHaveBeenCalledWith(
      expect.stringContaining('/wallet/prices?ids=solana,usd-coin,tether'),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls back to direct CoinGecko when the backend fails', async () => {
    mockPinned.mockRejectedValue(new Error('pin fail'));
    global.fetch = jest.fn(async () => ({ok: true, status: 200, json: async () => cgBody})) as unknown as typeof fetch;

    const prices = await fetchPrices();
    expect(prices.native).toEqual({usd: 150, change24h: 1.1});
    expect(prices[USDT_MINT]).toEqual({usd: 0.999, change24h: 0.05});
    expect(global.fetch).toHaveBeenCalled();
  });

  it('throws when both backend and direct fail', async () => {
    mockPinned.mockRejectedValue(new Error('pin fail'));
    global.fetch = jest.fn(async () => ({ok: false, status: 503, json: async () => ({})})) as unknown as typeof fetch;
    await expect(fetchPrices()).rejects.toThrow();
  });
});
