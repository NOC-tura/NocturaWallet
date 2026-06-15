import {fetchPrices} from '../priceModule';
import {USDC_MINT} from '../../tokens/coreTokens';

const okResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

afterEach(() => {
  (global.fetch as jest.Mock | undefined)?.mockReset?.();
});

describe('fetchPrices', () => {
  it('maps CoinGecko prices to mint keys', async () => {
    global.fetch = jest.fn(async () =>
      okResponse({
        solana: {usd: 178.42, usd_24h_change: 2.34},
        'usd-coin': {usd: 0.999, usd_24h_change: 0.01},
      }),
    ) as unknown as typeof fetch;

    const prices = await fetchPrices();
    expect(prices['native']).toEqual({usd: 178.42, change24h: 2.34});
    expect(prices[USDC_MINT]).toEqual({usd: 0.999, change24h: 0.01});
  });

  it('throws on a non-200 response', async () => {
    global.fetch = jest.fn(async () => ({ok: false, status: 503, json: async () => ({})})) as unknown as typeof fetch;
    await expect(fetchPrices()).rejects.toThrow();
  });

  it('throws when fetch rejects (offline/timeout)', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    await expect(fetchPrices()).rejects.toThrow();
  });
});
