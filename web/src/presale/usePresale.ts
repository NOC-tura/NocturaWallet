import {useQuery} from '@tanstack/react-query';
import {useWallet} from '@solana/wallet-adapter-react';
import {fetchPresaleStats} from '../../../core/presale/stats';
import {fetchOnChainAllocation} from '../../../core/presale/allocation';
import {json} from '../lib/api';
import {accountReader} from '../lib/solana';
import type {AllocationState} from './PresalePanel';

export function usePresaleStats() {
  return useQuery({
    queryKey: ['presale-stats'],
    queryFn: () => fetchPresaleStats(json),
    staleTime: 30_000,
  });
}

/**
 * The allocation is read from the chain, not from the coordinator: the coordinator's
 * recorded sum is approximate, and this is the number a buyer will argue about.
 *
 * The query's three outcomes are mapped explicitly, because collapsing "failed" into
 * "absent" is the defect this shape exists to prevent.
 */
export function useAllocation(): AllocationState {
  const {publicKey} = useWallet();
  const q = useQuery({
    queryKey: ['allocation', publicKey?.toBase58() ?? null],
    enabled: publicKey !== null,
    staleTime: 15_000,
    queryFn: async () => fetchOnChainAllocation(accountReader, publicKey!),
  });

  // Not connected is its own state: "Reading…" with no wallet attached is a claim
  // about work that is not happening, and the query is disabled in that case anyway.
  if (!publicKey) return {status: 'disconnected'};
  if (q.isPending) return {status: 'loading'};
  if (q.isError || !q.data) return {status: 'error'};
  return q.data.exists
    ? {
        status: 'ok',
        base: q.data.totalTokensBase,
        referralBonusBase: q.data.referralBonusBase,
      }
    : {status: 'absent'};
}
