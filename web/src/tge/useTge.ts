import {useQuery} from '@tanstack/react-query';
import {fetchTgeTimestamp} from '../../../core/presale/allocation';
import {accountReader} from '../lib/solana';

/** Read from the chain, where the date actually lives. null means it is not set. */
export function useTge() {
  return useQuery({
    queryKey: ['tge'],
    staleTime: 5 * 60_000,
    queryFn: () => fetchTgeTimestamp(accountReader),
  });
}
