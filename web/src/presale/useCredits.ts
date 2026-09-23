import {useQuery} from '@tanstack/react-query';
import {useWallet} from '@solana/wallet-adapter-react';
import {PublicKey} from '@solana/web3.js';
import {attributeCredits, type Credit} from '../../../core/presale/credits';
import {derivePresalePdas} from '../../../core/presale/allocation';
import {accountTransactions} from '../lib/solana';

/**
 * The individual credits behind the allocation's non-purchase total, or null.
 *
 * Only runs when there is something to explain — a zero field is the overwhelming common
 * case and costs nothing. `null` covers three different situations on purpose (nothing to
 * explain, not read yet, could not be attributed) because the panel renders all three the
 * same way: the unitemised sentence, which is true regardless.
 */
export function useCredits(referralBonusBase: string | null): Credit[] | null {
  const {publicKey} = useWallet();
  const enabled =
    publicKey !== null && referralBonusBase !== null && BigInt(referralBonusBase) > 0n;

  const q = useQuery({
    queryKey: ['allocation-credits', publicKey?.toBase58() ?? null, referralBonusBase],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const address = publicKey as PublicKey;
      const {userAllocation} = derivePresalePdas(address);
      const transactions = await accountTransactions(userAllocation);
      return attributeCredits(transactions, address.toBase58(), BigInt(referralBonusBase as string));
    },
  });

  return q.data ?? null;
}
