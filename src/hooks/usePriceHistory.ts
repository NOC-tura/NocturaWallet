import {useEffect} from 'react';
import {useQuery, useQueryClient, keepPreviousData} from '@tanstack/react-query';
import {
  fetchPriceHistory,
  TIMEFRAME_DAYS,
  type PriceHistory,
  type Timeframe,
} from '../modules/prices/priceHistory';

/**
 * CoinGecko price history for a token over a timeframe. Disabled when the token
 * has no market (coingeckoId null → NOC). History is slow-moving: 5min stale.
 *
 * `keepPreviousData`: when the timeframe changes, the previous series stays
 * visible (with `isPlaceholderData` true) until the new one loads, so switching
 * ranges never blanks the chart to a spinner.
 */
export function usePriceHistory(coingeckoId: string | null, tf: Timeframe) {
  return useQuery<PriceHistory>({
    queryKey: ['priceHistory', coingeckoId, tf],
    queryFn: () => fetchPriceHistory(coingeckoId as string, tf),
    enabled: coingeckoId != null,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Warm every timeframe in the background once the screen mounts, so tapping a
 * different range shows instantly (cache hit) instead of waiting on a fetch.
 * Cheap: the backend caches chart responses for 5 min. No-op for NOC (null id).
 */
export function usePrefetchPriceHistory(coingeckoId: string | null): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (coingeckoId == null) {
      return;
    }
    for (const tf of Object.keys(TIMEFRAME_DAYS) as Timeframe[]) {
      void queryClient.prefetchQuery({
        queryKey: ['priceHistory', coingeckoId, tf],
        queryFn: () => fetchPriceHistory(coingeckoId, tf),
        staleTime: 5 * 60_000,
      });
    }
  }, [coingeckoId, queryClient]);
}
