import {useQuery} from '@tanstack/react-query';
import {fetchPriceHistory, type PriceHistory, type Timeframe} from '../modules/prices/priceHistory';

/**
 * CoinGecko price history for a token over a timeframe. Disabled when the token
 * has no market (coingeckoId null → NOC). History is slow-moving: 5min stale.
 */
export function usePriceHistory(coingeckoId: string | null, tf: Timeframe) {
  return useQuery<PriceHistory>({
    queryKey: ['priceHistory', coingeckoId, tf],
    queryFn: () => fetchPriceHistory(coingeckoId as string, tf),
    enabled: coingeckoId != null,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}
