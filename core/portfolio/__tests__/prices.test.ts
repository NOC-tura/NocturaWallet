import {PRICE_PATH, fetchUsdPrices} from '../prices';

const getter = (body: unknown) => {
  const paths: string[] = [];
  return {paths, get: {get: async <T,>(path: string): Promise<T> => (paths.push(path), body as T)}};
};

describe('fetchUsdPrices', () => {
  it('reads SOL, USDC and USDT from one call to the coordinator proxy', async () => {
    const g = getter({success: true, data: {solana: {usd: 150.5}, 'usd-coin': {usd: 1}, tether: {usd: 0.999}}});
    expect(await fetchUsdPrices(g.get)).toEqual({solana: 150.5, usdc: 1, usdt: 0.999});
    expect(g.paths).toEqual([PRICE_PATH]);
    expect(PRICE_PATH).toBe('/wallet/prices?ids=solana,usd-coin,tether');
  });

  it('drops a missing, non-finite or non-positive price instead of reading it as 0', async () => {
    const g = getter({success: true, data: {solana: {usd: 'x'}, 'usd-coin': {usd: 0}, tether: {}}});
    expect(await fetchUsdPrices(g.get)).toEqual({solana: undefined, usdc: undefined, usdt: undefined});
  });

  it('throws when the body is not a success', async () => {
    await expect(fetchUsdPrices(getter({success: false}).get)).rejects.toThrow('prices unavailable');
    await expect(fetchUsdPrices(getter(null).get)).rejects.toThrow('prices unavailable');
  });
});
