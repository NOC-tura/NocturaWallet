import {NOC_MINT, NOC_DECIMALS} from '../../constants/programs';

export interface CoreToken {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUri?: string;
}

export const CORE_TOKENS: CoreToken[] = [
  {mint: NOC_MINT, symbol: 'NOC', name: 'Noctura', decimals: NOC_DECIMALS},
  // post-M1d R7: wrapped SOL is its own token — never labelled "SOL" (the native row is mint 'native')
  {mint: 'So11111111111111111111111111111111111111112', symbol: 'wSOL', name: 'Wrapped SOL', decimals: 9},
  {mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', name: 'USD Coin', decimals: 6},
  {mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT', name: 'Tether USD', decimals: 6},
];

export const CORE_MINTS = new Set(CORE_TOKENS.map(t => t.mint));

export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
