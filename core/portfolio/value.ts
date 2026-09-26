/**
 * What a holding is worth, and — just as important — what kind of claim that is.
 *
 * SOL, USDC and USDT have a market: a price someone else is paying right now, which the
 * coordinator relays from CoinGecko. NOC does not. It is not listed, not traded, and will
 * not be until TGE, so any number attached to a NOC balance is a
 * statement the market has never made.
 *
 * Measured 2026-09-22 rather than assumed: `/wallet/prices` answers for `solana`,
 * `usd-coin` and `tether`, and refuses `noctura`, `noc` and the mint address with "No
 * supported ids requested".
 *
 * So a NOC figure carries `basis: 'stage'` and the UI is expected to say so. "Worth
 * $10.50" and "$10.50 at the stage 1 price" are different sentences, and only the second
 * one is true before there is a market. The type makes it impossible to render the first
 * by accident: there is no plain number to reach for.
 */

export type ValueBasis = 'market' | 'stage';

export interface Valued {
  /** Base units, as read from chain. */
  base: bigint;
  decimals: number;
  symbol: string;
  /** USD, or null when no price is known — never 0, which would read as "worthless". */
  usd: number | null;
  basis: ValueBasis;
}

export interface Prices {
  solana?: number;
  usdc?: number;
  usdt?: number;
}

function toUsd(base: bigint, decimals: number, unitPrice: number | undefined): number | null {
  if (unitPrice === undefined) return null;
  return (Number(base) / 10 ** decimals) * unitPrice;
}

/**
 * Value the four balances this page shows. NOC takes the presale stage price and says so;
 * everything else takes the market.
 */
export function valueHoldings(
  balances: {sol: bigint | null; noc: bigint | null; usdc: bigint | null; usdt: bigint | null},
  prices: Prices,
  stagePriceUsd: number,
): Valued[] {
  const out: Valued[] = [];
  if (balances.noc !== null) {
    out.push({
      base: balances.noc,
      decimals: 9,
      symbol: 'NOC',
      usd: toUsd(balances.noc, 9, stagePriceUsd),
      basis: 'stage',
    });
  }
  if (balances.sol !== null) {
    out.push({base: balances.sol, decimals: 9, symbol: 'SOL', usd: toUsd(balances.sol, 9, prices.solana), basis: 'market'});
  }
  if (balances.usdc !== null && balances.usdc > 0n) {
    out.push({base: balances.usdc, decimals: 6, symbol: 'USDC', usd: toUsd(balances.usdc, 6, prices.usdc), basis: 'market'});
  }
  if (balances.usdt !== null && balances.usdt > 0n) {
    out.push({base: balances.usdt, decimals: 6, symbol: 'USDT', usd: toUsd(balances.usdt, 6, prices.usdt), basis: 'market'});
  }
  return out;
}

/**
 * The one number a portfolio header shows. Only MARKET values are summed.
 *
 * Adding the NOC figure in would produce a single total that is part market price and
 * part a price the project set for itself, with nothing in the number saying which part
 * is which. A buyer reading one bold figure would have no way to know. So the total is
 * what the holdings are worth today, and the NOC line states its own basis beside it.
 *
 * Returns null when no market price is known at all — an unknown total must not render
 * as $0.00.
 */
export function marketTotalUsd(valued: Valued[]): number | null {
  const market = valued.filter(v => v.basis === 'market' && v.usd !== null);
  if (market.length === 0) return null;
  return market.reduce((sum, v) => sum + (v.usd as number), 0);
}
