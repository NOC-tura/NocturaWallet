import {USDC_MINT, USDT_MINT} from '../tokens/coreTokens';
import {API_BASE, COINGECKO_API_KEY} from '../../constants/programs';
import {pinnedFetch} from '../sslPinning/pinnedFetch';

export interface TokenPrice {
  usd: number;
  change24h: number | null; // percent; null when unknown
}

/**
 * Auth header for CoinGecko when a Demo API key is configured (lifts the
 * ~2/min public-tier limit to ~30/min). Empty → public tier (no header).
 */
export function coingeckoHeaders(): Record<string, string> | undefined {
  return COINGECKO_API_KEY ? {'x-cg-demo-api-key': COINGECKO_API_KEY} : undefined;
}

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=solana,usd-coin,tether&vs_currencies=usd&include_24hr_change=true';

interface CoinGeckoEntry {
  usd?: number;
  usd_24h_change?: number;
}

function mapEntries(d: Record<string, CoinGeckoEntry>): Record<string, TokenPrice> {
  const sol = d.solana;
  const usdc = d['usd-coin'];
  const usdt = d.tether;
  if (sol?.usd == null || usdc?.usd == null || usdt?.usd == null) {
    throw new Error('price response missing SOL/USDC/USDT');
  }
  return {
    native: {usd: sol.usd, change24h: sol.usd_24h_change ?? null},
    [USDC_MINT]: {usd: usdc.usd, change24h: usdc.usd_24h_change ?? null},
    [USDT_MINT]: {usd: usdt.usd, change24h: usdt.usd_24h_change ?? null},
  };
}

/** Backend proxy (privacy + shared rate limit), SSL-pinned. Throws on failure. */
export async function fetchPricesFromBackend(): Promise<Record<string, TokenPrice>> {
  const res = await pinnedFetch(`${API_BASE}/wallet/prices?ids=solana,usd-coin,tether`);
  if (res.status !== 200) {
    throw new Error(`backend prices HTTP ${res.status}`);
  }
  const body = (await res.json()) as {success?: boolean; data?: Record<string, CoinGeckoEntry>};
  if (!body.success || !body.data) {
    throw new Error('backend prices unsuccessful');
  }
  return mapEntries(body.data);
}

/**
 * Direct CoinGecko fallback. Public market data on a third-party host (cert not
 * pinned) → plain fetch with a 6s timeout. Throws on timeout / non-200 / parse.
 */
export async function fetchPricesDirect(): Promise<Record<string, TokenPrice>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(COINGECKO_URL, {signal: controller.signal, headers: coingeckoHeaders()});
    if (!res.ok) {
      throw new Error(`CoinGecko HTTP ${res.status}`);
    }
    return mapEntries((await res.json()) as Record<string, CoinGeckoEntry>);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * SOL + USDC + USDT USD prices and 24h change. Backend-first (privacy); on any
 * backend failure, falls back to direct CoinGecko. Keyed by mint ('native' for
 * SOL). NOC is NOT included (presale-only; the consumer injects it). Throws only
 * when both paths fail; the hook then keeps its last cache.
 */
export async function fetchPrices(): Promise<Record<string, TokenPrice>> {
  try {
    return await fetchPricesFromBackend();
  } catch {
    return fetchPricesDirect();
  }
}
