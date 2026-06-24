import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {mmkvPublicStorage} from '../mmkv/publicAdapter';

interface ReferralCaptureState {
  capturedReferrer: string | null;
  setCapturedReferrer: (a: string) => void;
  clearCapturedReferrer: () => void;
}

export const useReferralCaptureStore = create<ReferralCaptureState>()(
  persist(
    set => ({
      capturedReferrer: null,
      setCapturedReferrer: (a: string) => set({capturedReferrer: a}),
      clearCapturedReferrer: () => set({capturedReferrer: null}),
    }),
    {
      // Persists to mmkvPublic — the referrer is a public Solana address (no
      // secret material), so the unencrypted public instance is appropriate.
      name: 'noctura-referral-capture',
      storage: createJSONStorage(() => mmkvPublicStorage),
    },
  ),
);
