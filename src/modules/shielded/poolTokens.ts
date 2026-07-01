import {SHIELDED_DEVNET_MINT, NOC_MINT, NOC_DECIMALS} from '../../constants/programs';

export interface PoolTokenMeta {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
}

// Minimal metadata for pool mints. NOC uses project constants; the devnet test
// mint is a stand-in for NOC (same 9 decimals) shown as "TEST".
export function poolTokenMeta(mint: string): PoolTokenMeta {
  if (mint === NOC_MINT) {
    return {mint, symbol: 'NOC', name: 'Noctura', decimals: NOC_DECIMALS};
  }
  if (mint === SHIELDED_DEVNET_MINT) {
    return {mint, symbol: 'TEST', name: 'Devnet Test Token', decimals: 9};
  }
  return {mint, symbol: mint.slice(0, 4), name: 'SPL token', decimals: 9};
}
