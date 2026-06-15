import type {TokenPrice} from './priceModule';

export interface Holding {
  mint: string; // 'native' | mint base58
  amountRaw: string; // integer base units
  decimals: number;
}

export interface PortfolioValue {
  totalUsd: number;
  change24hPct: number | null; // USD-weighted; null if no priced holding has a change
  perToken: Record<string, {usd: number; change24h: number | null}>;
}

/**
 * Turn holdings + prices into total USD, a USD-weighted 24h % change, and a
 * per-token fiat value. USD figures are DISPLAY floats; on-chain token amounts
 * (amountRaw) stay integer. Holdings with no matching price contribute 0.
 */
export function computePortfolio(
  holdings: Holding[],
  prices: Record<string, TokenPrice>,
): PortfolioValue {
  let totalUsd = 0;
  let weightedChangeNumer = 0;
  let changeWeight = 0;
  const perToken: PortfolioValue['perToken'] = {};

  for (const h of holdings) {
    const price = prices[h.mint];
    if (price == null) {
      // No price for this mint → omit it from perToken so the UI hides the
      // fiat column instead of showing a misleading $0.00.
      continue;
    }
    const uiAmount = Number(h.amountRaw) / Math.pow(10, h.decimals);
    const usd = uiAmount * price.usd;
    totalUsd += usd;
    perToken[h.mint] = {usd, change24h: price.change24h};
    if (price.change24h != null) {
      weightedChangeNumer += usd * price.change24h;
      changeWeight += usd;
    }
  }

  const change24hPct = changeWeight > 0 ? weightedChangeNumer / changeWeight : null;
  return {totalUsd, change24hPct, perToken};
}
