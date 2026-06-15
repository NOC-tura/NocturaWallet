import {useMemo} from 'react';
import {usePrices} from './usePrices';
import {usePresaleStore} from '../store/zustand/presaleStore';
import {nocUsdPriceForStage} from '../constants/presale';
import {NOC_MINT} from '../constants/programs';
import type {TokenPrice} from '../modules/prices/priceModule';

/**
 * Market prices (SOL/USDC from CoinGecko) merged with NOC's presale price.
 * `havePrices` is false until the market fetch resolves.
 */
export function useResolvedPrices(): {prices: Record<string, TokenPrice>; havePrices: boolean} {
  const {data: marketPrices} = usePrices();
  const currentStage = usePresaleStore(s => s.currentStage);
  const pricePerNoc = usePresaleStore(s => s.pricePerNoc);
  const nocUsd =
    pricePerNoc != null && Number(pricePerNoc) > 0
      ? Number(pricePerNoc)
      : nocUsdPriceForStage(currentStage);
  const prices = useMemo<Record<string, TokenPrice>>(
    () => ({...(marketPrices ?? {}), [NOC_MINT]: {usd: nocUsd, change24h: null}}),
    [marketPrices, nocUsd],
  );
  return {prices, havePrices: marketPrices != null};
}
