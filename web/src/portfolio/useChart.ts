import {useQuery} from '@tanstack/react-query';
import {json} from '../lib/api';

interface ChartBody {
  success?: boolean;
  data?: {prices?: unknown};
}

/**
 * SOL's price over seven days, as `[[msSinceEpoch, usd], …]`.
 *
 * Shape confirmed against the live route 2026-09-22: it takes `id` (singular) and `days`,
 * and answers 400 "Unsupported id" for `ids`. Only SOL is charted — NOC has no market to
 * chart, and a stablecoin's line is a flat one.
 */
export function useChart(days = 7): {points: number[] | null; isError: boolean; isLoading: boolean} {
  const q = useQuery({
    queryKey: ['chart', days],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const body = await json.get<ChartBody>(`/wallet/chart?id=solana&days=${days}`);
      const raw = body.data?.prices;
      if (!body.success || !Array.isArray(raw)) throw new Error('chart unavailable');
      const usd = (raw as unknown[])
        .map(p => (Array.isArray(p) ? Number((p as unknown[])[1]) : NaN))
        .filter(n => Number.isFinite(n));
      // A line needs two points. One, or none, is not a short chart — it is no chart,
      // and drawing it would put a flat stroke on the page implying a flat price.
      if (usd.length < 2) throw new Error('chart has too few points to draw');
      return usd;
    },
  });

  if (q.isError || !q.data) return {points: null, isError: q.isError, isLoading: q.isPending};
  return {points: q.data, isError: false, isLoading: false};
}
