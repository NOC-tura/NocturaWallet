import type {Holding} from './portfolio';
import {NOC_MINT} from '../../constants/programs';
import type {TokenMetadata} from '../../store/zustand/walletStore';

const SOL_DECIMALS = 9;
const NOC_DECIMALS = 9;

/**
 * Build the wallet's holdings list (SOL pinned as 'native', NOC pinned, then
 * the remaining store tokens). Shared by the dashboard total and the
 * per-token "% of portfolio".
 */
export function buildHoldings(args: {
  solBalance: string;
  nocBalance: string;
  tokenBalances: Record<string, string>;
  tokens: TokenMetadata[];
}): Holding[] {
  const {solBalance, nocBalance, tokenBalances, tokens} = args;
  const list: Holding[] = [
    {mint: 'native', amountRaw: solBalance || '0', decimals: SOL_DECIMALS},
    {mint: NOC_MINT, amountRaw: (tokenBalances[NOC_MINT] ?? nocBalance) || '0', decimals: NOC_DECIMALS},
  ];
  for (const t of tokens) {
    if (t.mint === NOC_MINT) continue;
    list.push({mint: t.mint, amountRaw: tokenBalances[t.mint] ?? '0', decimals: t.decimals});
  }
  return list;
}
