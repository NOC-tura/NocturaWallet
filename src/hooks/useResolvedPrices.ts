import {useMemo} from 'react';
import {usePrices} from './usePrices';
import {usePresaleStore} from '../store/zustand/presaleStore';
import {nocUsdPriceForStage} from '../constants/presale';
import {NOC_MINT} from '../constants/programs';
import type {TokenPrice} from '../modules/prices/priceModule';
import {isPricingEnabled} from '../constants/chain';

/**
 * Market prices (SOL/USDC from CoinGecko) merged with NOC's presale price.
 * `havePrices` is false until the market fetch resolves.
 *
 * A build without pricing (devnet) resolves no price at all — not NOC's presale
 * price either (presale is mainnet-only) — and `havePrices` stays false, so every
 * surface shows its no-price form instead of a mainnet figure (or a "$0.00").
 */
export function useResolvedPrices(): {prices: Record<string, TokenPrice>; havePrices: boolean} {
  const {data: marketPrices} = usePrices();
  const currentStage = usePresaleStore(s => s.currentStage);
  const pricePerNoc = usePresaleStore(s => s.pricePerNoc);
  const nocUsd =
    pricePerNoc != null && Number(pricePerNoc) > 0
      ? Number(pricePerNoc)
      : nocUsdPriceForStage(currentStage);
  const pricing = isPricingEnabled();
  const prices = useMemo<Record<string, TokenPrice>>(
    () => (pricing ? {...(marketPrices ?? {}), [NOC_MINT]: {usd: nocUsd, change24h: null}} : {}),
    [pricing, marketPrices, nocUsd],
  );
  return {prices, havePrices: pricing && marketPrices != null};
}
