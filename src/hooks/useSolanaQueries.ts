import {useQuery} from '@tanstack/react-query';
import {PublicKey} from '@solana/web3.js';
import {getConnection} from '../modules/solana/connection';
import {getBalance, getTokenAccounts, getTransactionHistory} from '../modules/solana/queries';
import type {TokenAccount, ParsedTransaction} from '../modules/solana/types';

/**
 * React Query hook for SOL balance.
 * TTL: 10 seconds (spec: getBalance refresh interval)
 */
export function useBalance(publicKey: string | null) {
  return useQuery<bigint>({
    queryKey: ['balance', publicKey],
    queryFn: async () => {
      if (!publicKey) throw new Error('No public key');
      return getBalance(getConnection(), new PublicKey(publicKey));
    },
    enabled: !!publicKey,
    staleTime: 10_000,
    gcTime: 60_000,
  });
}

/**
 * React Query hook for SPL token accounts.
 * TTL: 60 seconds (spec: token list refresh)
 */
export function useTokenAccounts(publicKey: string | null) {
  return useQuery<TokenAccount[]>({
    queryKey: ['tokenAccounts', publicKey],
    queryFn: async () => {
      if (!publicKey) throw new Error('No public key');
      return getTokenAccounts(getConnection(), new PublicKey(publicKey));
    },
    enabled: !!publicKey,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

/**
 * React Query hook for transaction history.
 * TTL: 30 seconds (spec: tx history refresh)
 */
export function useTransactionHistory(
  publicKey: string | null,
  options?: {limit?: number; before?: string},
) {
  return useQuery<ParsedTransaction[]>({
    queryKey: ['txHistory', publicKey, options?.before],
    queryFn: async () => {
      if (!publicKey) throw new Error('No public key');
      return getTransactionHistory(getConnection(), new PublicKey(publicKey), {
        limit: options?.limit ?? 20,
        before: options?.before,
      });
    },
    enabled: !!publicKey,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}
