import {useQuery} from '@tanstack/react-query';
import {useWallet} from '@solana/wallet-adapter-react';
import {json} from '../lib/api';
import {fetchPurchases, type PresalePurchase} from '../../../core/presale/purchases';

export interface PurchaseState {
  purchases: PresalePurchase[] | null;
  isError: boolean;
  isLoading: boolean;
}

/**
 * `null` and `[]` mean different things and the panel renders them differently: one is
 * "we could not read your history", the other is "you have not bought yet". Collapsing
 * them would tell someone who has paid that they have not.
 */
export function usePurchases(): PurchaseState {
  const {publicKey} = useWallet();
  const address = publicKey?.toBase58() ?? null;

  const q = useQuery({
    queryKey: ['purchases', address],
    enabled: address !== null,
    staleTime: 30_000,
    queryFn: () => fetchPurchases(json, address as string),
  });

  if (!address) return {purchases: null, isError: false, isLoading: false};
  if (q.isError || !q.data) return {purchases: null, isError: q.isError, isLoading: q.isPending};
  return {purchases: q.data, isError: false, isLoading: false};
}
