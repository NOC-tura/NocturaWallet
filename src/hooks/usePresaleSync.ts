import {useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';
import {fetchPresaleStats, fetchUserAllocation} from '../modules/presale/presaleModule';
import {usePresaleStore} from '../store/zustand/presaleStore';
import {useWalletStore} from '../store/zustand/walletStore';

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
    queryFn: () => fetchUserAllocation(address as string),
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
