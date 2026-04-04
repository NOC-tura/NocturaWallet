import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {mmkvSecureStorage} from '../mmkv/secureAdapter';

interface PresaleState {
  currentStage: number | null;
  pricePerNoc: string | null;
  soldInStage: string | null;
  stageCapacity: string | null;
  tokensPurchased: string;
  claimedTokens: string;
  referralBonusTokens: string;
  isZeroFeeEligible: boolean;
  tgeStatus: 'pre_tge' | 'claimable' | 'claimed';
  claimingEnabled: boolean;

  setStageInfo: (info: {
    currentStage: number;
    pricePerNoc: string;
    soldInStage: string;
    stageCapacity: string;
  }) => void;
  setAllocation: (alloc: {
    tokensPurchased: string;
    claimedTokens: string;
    referralBonusTokens: string;
    isZeroFeeEligible: boolean;
  }) => void;
  setTgeStatus: (status: PresaleState['tgeStatus']) => void;
  setClaimingEnabled: (v: boolean) => void;
  reset: () => void;
}

const DEFAULTS = {
  currentStage: null,
  pricePerNoc: null,
  soldInStage: null,
  stageCapacity: null,
  tokensPurchased: '0',
  claimedTokens: '0',
  referralBonusTokens: '0',
  isZeroFeeEligible: false,
  tgeStatus: 'pre_tge' as const,
  claimingEnabled: false,
};

export const usePresaleStore = create<PresaleState>()(
  persist(
    set => ({
      ...DEFAULTS,
      setStageInfo: info => set(info),
      setAllocation: alloc => set(alloc),
      setTgeStatus: status => set({tgeStatus: status}),
      setClaimingEnabled: v => set({claimingEnabled: v}),
      reset: () => set(DEFAULTS),
    }),
    {
      name: 'noctura-presale',
      storage: createJSONStorage(() => mmkvSecureStorage),
    },
  ),
);
