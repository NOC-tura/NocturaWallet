import {NOC_MINT} from '../../constants/programs';
import {USDC_MINT} from '../tokens/coreTokens';

export interface SwapToken {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
}

// Tokens that can be swapped via Jupiter. 'native' = SOL (mapped to wSOL for
// Jupiter calls). NOC is presale-only (not on any DEX) and is intentionally
// excluded.
export const SWAP_TOKENS: readonly SwapToken[] = [
  {mint: 'native', symbol: 'SOL', name: 'Solana', decimals: 9},
  {mint: USDC_MINT, symbol: 'USDC', name: 'USD Coin', decimals: 6},
  {mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT', name: 'Tether USD', decimals: 6},
];

const SWAP_MINTS = new Set(SWAP_TOKENS.map(t => t.mint));

/** Whether a token can be swapped (in the registry; NOC is excluded). */
export function isSwappable(mint: string): boolean {
  return mint !== NOC_MINT && SWAP_MINTS.has(mint);
}
