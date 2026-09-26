import {useQuery} from '@tanstack/react-query';
import {json} from '../lib/api';
import type {Prices} from '../../../core/portfolio/value';

interface PriceBody {
  success?: boolean;
  data?: Record<string, {usd?: number}>;
}

/** CoinGecko ids, as the coordinator's proxy accepts them — verified against the live route. */
const IDS = 'solana,usd-coin,tether';

export interface PriceState {
  prices: Prices;
  isError: boolean;
  isLoading: boolean;
}

/**
 * One call for all three. NOC is deliberately absent: the endpoint refuses it, because
 * there is no market for NOC before TGE — see core/portfolio/value.ts.
 */
export function usePrices(): PriceState {
  const q = useQuery({
    queryKey: ['prices'],
    // A minute is plenty for a page that shows two decimal places, and the proxy's
    // budget is shared with the balance poll and the RPC reads.
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const body = await json.get<PriceBody>(`/wallet/prices?ids=${IDS}`);
      if (!body.success || !body.data) throw new Error('prices unavailable');
      return body.data;
    },
  });

  if (q.isError || !q.data) {
    return {prices: {}, isError: q.isError, isLoading: q.isPending};
  }
  return {
    prices: {
      solana: q.data.solana?.usd,
      usdc: q.data['usd-coin']?.usd,
      usdt: q.data.tether?.usd,
    },
    isError: false,
    isLoading: false,
  };
}
