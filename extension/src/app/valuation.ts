import {marketTotalUsd, valueHoldings} from '../../../core/portfolio/value';
import type {Balances, Prices, Token} from './engine';

export interface TokenValue {
  token: Token;
  base: bigint;
  /** USD, or null when no price is known — never 0 (core/portfolio/value.ts). */
  usd: number | null;
  /** 'stage' for NOC: the presale stage price, labelled "at stage price", never in the total. */
  basis: 'market' | 'stage';
}

/**
 * The dashboard's numbers (spec §5.1, parent §4): each token's USD value, and the market total —
 * SOL + USDC + USDT only. NOC is valued at the stage price and kept out of the total, exactly as
 * web/ does (core/portfolio/value.ts). A total with no market price at all is null, shown as "—".
 */
export function valuation(b: Balances, p: Prices | null): {total: number | null; rows: Record<Token, TokenValue>} {
  const market = valueHoldings({sol: b.sol, noc: null, usdc: b.usdc, usdt: b.usdt}, {solana: p?.sol ?? undefined, usdc: p?.usdc ?? undefined, usdt: p?.usdt ?? undefined}, 0);
  const usdOf = (symbol: string): number | null => market.find(v => v.symbol === symbol)?.usd ?? null;
  const nocUsd = p?.noc == null ? null : valueHoldings({sol: null, noc: b.noc, usdc: null, usdt: null}, {}, p.noc)[0]?.usd ?? null;
  return {
    total: marketTotalUsd(market),
    rows: {
      SOL: {token: 'SOL', base: b.sol, usd: usdOf('SOL'), basis: 'market'},
      NOC: {token: 'NOC', base: b.noc, usd: nocUsd, basis: 'stage'},
      USDC: {token: 'USDC', base: b.usdc, usd: b.usdc === 0n ? (p?.usdc == null ? null : 0) : usdOf('USDC'), basis: 'market'},
      USDT: {token: 'USDT', base: b.usdt, usd: b.usdt === 0n ? (p?.usdt == null ? null : 0) : usdOf('USDT'), basis: 'market'},
    },
  };
}
