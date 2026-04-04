import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {mmkvSecureStorage} from '../mmkv/secureAdapter';

interface ShieldedState {
  mode: 'transparent' | 'shielded';
  geoAcknowledged: boolean;
  merkleRoot: string | null;
  merkleLeafCount: number;
  lastMerkleSyncAt: number | null;
  privacyLevel: 'low' | 'moderate' | 'good' | null;
  pendingProofs: number;

  setMode: (mode: 'transparent' | 'shielded') => void;
  setGeoAcknowledged: (v: boolean) => void;
  updateMerkle: (root: string, leafCount: number) => void;
  setPrivacyLevel: (level: ShieldedState['privacyLevel']) => void;
  setPendingProofs: (n: number) => void;
  reset: () => void;
}

const DEFAULTS = {
  mode: 'transparent' as const,
  geoAcknowledged: false,
  merkleRoot: null,
  merkleLeafCount: 0,
  lastMerkleSyncAt: null,
  privacyLevel: null,
  pendingProofs: 0,
};

export const useShieldedStore = create<ShieldedState>()(
  persist(
    set => ({
      ...DEFAULTS,
      setMode: mode => set({mode}),
      setGeoAcknowledged: v => set({geoAcknowledged: v}),
      updateMerkle: (root, leafCount) =>
        set({merkleRoot: root, merkleLeafCount: leafCount, lastMerkleSyncAt: Date.now()}),
      setPrivacyLevel: level => set({privacyLevel: level}),
      setPendingProofs: n => set({pendingProofs: n}),
      reset: () => set(DEFAULTS),
    }),
    {
      name: 'noctura-shielded',
      storage: createJSONStorage(() => mmkvSecureStorage),
    },
  ),
);
