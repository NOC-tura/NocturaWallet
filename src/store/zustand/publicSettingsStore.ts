import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {mmkvPublicStorage} from '../mmkv/publicAdapter';

interface PublicSettingsState {
  hideBalances: boolean;
  hideZeroBalanceTokens: boolean;
  currency: 'USD' | 'EUR' | 'GBP';
  language: 'en' | 'sl';
  amoledMode: boolean;
  hapticsEnabled: boolean;
  explorer: 'solscan' | 'solanaexplorer' | 'solanafm';

  setHideBalances: (v: boolean) => void;
  setHideZeroBalanceTokens: (v: boolean) => void;
  setCurrency: (v: 'USD' | 'EUR' | 'GBP') => void;
  setLanguage: (v: 'en' | 'sl') => void;
  setAmoledMode: (v: boolean) => void;
  setHapticsEnabled: (v: boolean) => void;
  setExplorer: (v: 'solscan' | 'solanaexplorer' | 'solanafm') => void;
  reset: () => void;
}

const DEFAULTS = {
  hideBalances: false,
  hideZeroBalanceTokens: false,
  currency: 'USD' as const,
  language: 'en' as const,
  amoledMode: false,
  hapticsEnabled: true,
  explorer: 'solscan' as const,
};

export const usePublicSettingsStore = create<PublicSettingsState>()(
  persist(
    set => ({
      ...DEFAULTS,
      setHideBalances: (v: boolean) => set({hideBalances: v}),
      setHideZeroBalanceTokens: (v: boolean) => set({hideZeroBalanceTokens: v}),
      setCurrency: (v: 'USD' | 'EUR' | 'GBP') => set({currency: v}),
      setLanguage: (v: 'en' | 'sl') => set({language: v}),
      setAmoledMode: (v: boolean) => set({amoledMode: v}),
      setHapticsEnabled: (v: boolean) => set({hapticsEnabled: v}),
      setExplorer: (v: 'solscan' | 'solanaexplorer' | 'solanafm') => set({explorer: v}),
      reset: () => set(DEFAULTS),
    }),
    {
      name: 'noctura-public-settings',
      storage: createJSONStorage(() => mmkvPublicStorage),
    },
  ),
);
