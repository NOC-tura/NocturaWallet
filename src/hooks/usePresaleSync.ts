import {useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';
import {PublicKey} from '@solana/web3.js';
import {fetchPresaleStats, fetchUserAllocation} from '../modules/presale/presaleModule';
import {fetchOnChainAllocation} from '../modules/presale/presaleBuyModule';
import {usePresaleStore} from '../store/zustand/presaleStore';
import {useWalletStore} from '../store/zustand/walletStore';

/**
 * Resolve the user's presale allocation, preferring the AUTHORITATIVE on-chain
 * `total_tokens` (matches the website + what's claimable at TGE; already
 * includes any referral bonus, so it's reported as the full purchased amount
 * with a 0 bonus to avoid double-counting). Falls back to the coordinator DB
 * sum only when there's no on-chain allocation account or the RPC read fails.
 */
async function resolveAllocation(
  address: string,
): Promise<{tokensPurchasedBase: string; referralBonusBase: string}> {
  try {
    const onChain = await fetchOnChainAllocation(new PublicKey(address));
    if (onChain.exists) {
      return {tokensPurchasedBase: onChain.totalTokensBase, referralBonusBase: '0'};
    }
  } catch {
    // RPC/decoding failure → fall through to the coordinator DB sum.
  }
  return fetchUserAllocation(address);
}

/**
 * Fetches live presale stage/price/progress (+ the user's allocation) from the
 * coordinator and writes it into presaleStore. Mounted by the dashboard. A
 * fetch failure leaves the last (persisted) store values intact. Returns
 * `isPaused` so the dashboard can hide the banner when the presale is paused.
 */
export function usePresaleSync(): {isPaused: boolean} {
  const address = useWalletStore(s => s.publicKey);
  const setStageInfo = usePresaleStore(s => s.setStageInfo);
  const setAllocation = usePresaleStore(s => s.setAllocation);

  const statsQ = useQuery({
    queryKey: ['presaleStats'],
    queryFn: fetchPresaleStats,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  const allocQ = useQuery({
    queryKey: ['presaleAllocation', address],
    queryFn: () => resolveAllocation(address as string),
    enabled: address != null,
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!statsQ.data) {
      return;
    }
    setStageInfo({
      currentStage: statsQ.data.displayStage,
      pricePerNoc: String(statsQ.data.pricePerNocUsd),
      soldInStage: statsQ.data.soldInStageBase,
      stageCapacity: statsQ.data.stageCapacityBase,
    });
  }, [statsQ.data, setStageInfo]);

  useEffect(() => {
    if (!allocQ.data) {
      return;
    }
    setAllocation({
      tokensPurchased: allocQ.data.tokensPurchasedBase,
      claimedTokens: '0',
      referralBonusTokens: allocQ.data.referralBonusBase,
      isZeroFeeEligible: false,
    });
  }, [allocQ.data, setAllocation]);

  return {isPaused: statsQ.data?.isPaused ?? false};
}
