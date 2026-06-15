import {USDC_MINT} from '../tokens/coreTokens';
import {NOC_MINT} from '../../constants/programs';

export type Timeframe = '24H' | '7D' | '30D' | '1Y';

// CoinGecko's free/public API caps historical data at 365 days (days>365 →
// HTTP 401, error 10012), so '1Y' is the longest range offered.
export const TIMEFRAME_DAYS: Record<Timeframe, number> = {
  '24H': 1,
  '7D': 7,
  '30D': 30,
  '1Y': 365,
};

export interface PriceHistory {
  prices: number[]; // oldest → newest
}

/** CoinGecko id for a mint, or null when the token has no market (NOC). */
export function coingeckoIdForMint(mint: string): string | null {
  if (mint === 'native') return 'solana';
  if (mint === USDC_MINT) return 'usd-coin';
  if (mint === NOC_MINT) return null;
  return null;
}

/** First→last absolute + percent change of a price series; null if undefined. */
export function changeOverSeries(prices: number[]): {absUsd: number; pct: number} | null {
  if (prices.length < 2) return null;
  const first = prices[0];
  const last = prices[prices.length - 1];
  if (first === 0) return null;
  return {absUsd: last - first, pct: ((last - first) / first) * 100};
}

/**
 * Fetch a USD price series from CoinGecko market_chart. Plain fetch (public
 * data, cert not pinned), 8s timeout. Throws on timeout / non-200 / parse.
 */
export async function fetchPriceHistory(
  coingeckoId: string,
  tf: Timeframe,
): Promise<PriceHistory> {
  const days = TIMEFRAME_DAYS[tf];
  const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=usd&days=${days}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {signal: controller.signal});
    if (!res.ok) throw new Error(`CoinGecko market_chart HTTP ${res.status}`);
    const body = (await res.json()) as {prices?: [number, number][]};
    if (!Array.isArray(body.prices)) throw new Error('market_chart missing prices');
    return {prices: body.prices.map(p => p[1])};
  } finally {
    clearTimeout(timeout);
  }
}
