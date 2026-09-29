import type {JsonGetter} from '../ports';
import type {Prices} from './value';

/**
 * CoinGecko ids, as the coordinator's proxy accepts them. NOC is absent on purpose: the route
 * refuses it — there is no market for NOC before TGE (core/portfolio/value.ts).
 */
export const PRICE_PATH = '/wallet/prices?ids=solana,usd-coin,tether';

/** USD prices for SOL, USDC and USDT. A missing or unusable price is `undefined`, never 0. */
export async function fetchUsdPrices(get: JsonGetter): Promise<Prices> {
  const body = await get.get<unknown>(PRICE_PATH);
  if (typeof body !== 'object' || body === null) throw new Error('prices unavailable');
  const {success, data} = body as {success?: unknown; data?: unknown};
  if (success !== true || typeof data !== 'object' || data === null) throw new Error('prices unavailable');
  const d = data as Record<string, unknown>;
  const usd = (id: string): number | undefined => {
    const e = d[id];
    const v = typeof e === 'object' && e !== null ? (e as {usd?: unknown}).usd : undefined;
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;
  };
  return {solana: usd('solana'), usdc: usd('usd-coin'), usdt: usd('tether')};
}
