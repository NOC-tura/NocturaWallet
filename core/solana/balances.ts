import type {SolanaReader} from './rpc';
import {MAINNET_NOC_MINT, MAINNET_USDC_MINT, MAINNET_USDT_MINT, NOC_DECIMALS} from '../presale/addresses';
import {SPL_TOKEN_PROGRAM} from '../presale/buyInstructions';

/** The classic SPL Token program — one literal, owned by core/presale/buyInstructions.ts. */
export {SPL_TOKEN_PROGRAM};

export type WalletToken = 'SOL' | 'NOC' | 'USDC' | 'USDT';

/**
 * What the wallet shows and sends. `mint: null` is native SOL. NOC, USDC and USDT are all classic
 * SPL Token mints (owner program `Tokenkeg…`), and balances are read by that program; a Token-2022
 * holding of any of them is out of scope for B1b-1 (plan "Scope" item 11).
 */
export const WALLET_TOKENS: Record<WalletToken, {mint: string | null; decimals: number}> = {
  SOL: {mint: null, decimals: 9},
  NOC: {mint: MAINNET_NOC_MINT, decimals: NOC_DECIMALS},
  USDC: {mint: MAINNET_USDC_MINT, decimals: 6},
  USDT: {mint: MAINNET_USDT_MINT, decimals: 6},
};

export function tokenForMint(mint: string): WalletToken | null {
  for (const t of ['NOC', 'USDC', 'USDT'] as const) if (WALLET_TOKENS[t].mint === mint) return t;
  return null;
}

export interface TokenAmount {
  mint: string;
  /** Base units as a decimal string. */
  amount: string;
}

/**
 * Aggregate raw token-account balances into mint → total. An owner can hold one mint across several
 * accounts (this project's own wallet holds every token in a non-canonical account), so keeping only
 * one account per mint showed zero, or part, of a real balance. Summed as BigInt; a malformed amount
 * is skipped rather than poisoning the map. Moved from src/modules/solana/tokenBalances.ts.
 */
export function sumTokenBalancesByMint(accounts: readonly TokenAmount[]): Record<string, string> {
  const totals = new Map<string, bigint>();
  for (const account of accounts) {
    let amount: bigint;
    try {
      amount = BigInt(account.amount);
    } catch {
      continue;
    }
    totals.set(account.mint, (totals.get(account.mint) ?? 0n) + amount);
  }
  const out: Record<string, string> = {};
  for (const [mint, total] of totals) out[mint] = total.toString();
  return out;
}

export interface WalletBalances {
  sol: bigint;
  noc: bigint;
  usdc: bigint;
  usdt: bigint;
}

/**
 * SOL plus the three tokens for one owner: two calls, every token account by program (not the
 * derived ATA), summed per mint. A failed call throws — "0" and "could not read" must never look
 * alike to someone checking whether their money arrived.
 */
export async function readWalletBalances(
  reader: Pick<SolanaReader, 'getBalance' | 'getTokenAccountsByOwner'>,
  owner: string,
): Promise<WalletBalances> {
  const [sol, accounts] = await Promise.all([reader.getBalance(owner), reader.getTokenAccountsByOwner(owner, {programId: SPL_TOKEN_PROGRAM})]);
  const sums = sumTokenBalancesByMint(accounts.map(a => ({mint: a.mint, amount: a.amount.toString()})));
  const of = (token: WalletToken): bigint => {
    const mint = WALLET_TOKENS[token].mint;
    return mint === null ? 0n : BigInt(sums[mint] ?? '0');
  };
  return {sol, noc: of('NOC'), usdc: of('USDC'), usdt: of('USDT')};
}
