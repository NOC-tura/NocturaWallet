import {USDC_MINT} from '../tokens/coreTokens';
import {COINGECKO_API_KEY} from '../../constants/programs';

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
  'https://api.coingecko.com/api/v3/simple/price?ids=solana,usd-coin&vs_currencies=usd&include_24hr_change=true';

interface CoinGeckoEntry {
  usd?: number;
  usd_24h_change?: number;
}

/**
 * Fetch SOL + USDC USD prices and 24h change from CoinGecko. Public market data
 * on a third-party host (cert not pinned) → plain fetch with a 6s timeout.
 * Returns a map keyed by the app's mint key ('native' for SOL, USDC mint).
 * NOC is NOT included (it is presale-only; the consumer injects it).
 * Throws on timeout / non-200 / parse failure; the hook keeps the last cache.
 */
export async function fetchPrices(): Promise<Record<string, TokenPrice>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(COINGECKO_URL, {
      signal: controller.signal,
      headers: coingeckoHeaders(),
    });
    if (!res.ok) {
      throw new Error(`CoinGecko HTTP ${res.status}`);
    }
    const body = (await res.json()) as Record<string, CoinGeckoEntry>;
    const sol = body.solana;
    const usdc = body['usd-coin'];
    if (sol?.usd == null || usdc?.usd == null) {
      throw new Error('CoinGecko response missing prices');
    }
    return {
      native: {usd: sol.usd, change24h: sol.usd_24h_change ?? null},
      [USDC_MINT]: {usd: usdc.usd, change24h: usdc.usd_24h_change ?? null},
    };
  } finally {
    clearTimeout(timeout);
  }
}
