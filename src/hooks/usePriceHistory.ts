import {useQuery, keepPreviousData} from '@tanstack/react-query';
import {fetchPriceHistory, type PriceHistory, type Timeframe} from '../modules/prices/priceHistory';

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
    // fetchPriceHistory already tries backend → direct internally, so a failure
    // means both fell over; one quick retry, not a ~minute-long backoff storm.
    retry: 1,
  });
}
