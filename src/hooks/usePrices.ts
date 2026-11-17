import {useQuery} from '@tanstack/react-query';
import {fetchPrices, type TokenPrice} from '../modules/prices/priceModule';
import {isPricingEnabled} from '../constants/chain';

/**
 * Live SOL + USDC USD prices (and 24h change) from CoinGecko. 60s refresh; the
 * last good value is kept (gcTime) so a transient failure doesn't blank fiat.
 * NOC is not included here — the dashboard injects its presale-stage price.
 * Disabled on a build without pricing (devnet): no query is scheduled at all.
 */
export function usePrices() {
  return useQuery<Record<string, TokenPrice>>({
    queryKey: ['prices'],
    queryFn: fetchPrices,
    enabled: isPricingEnabled(),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
  });
}
