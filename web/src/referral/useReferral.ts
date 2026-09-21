import {useQuery} from '@tanstack/react-query';
import {useWallet} from '@solana/wallet-adapter-react';
import {fetchReferralStats} from '../../../core/referral';
import {json} from '../lib/api';

export function useReferral() {
  const {publicKey} = useWallet();
  const address = publicKey?.toBase58() ?? null;
  const q = useQuery({
    queryKey: ['referral', address],
    enabled: address !== null,
    staleTime: 60_000,
    queryFn: () => fetchReferralStats(json, address as string),
  });
  return {address, ...q};
}
