import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {mmkvSecureStorage} from '../mmkv/secureAdapter';
import {onSecureMmkvReady} from '../mmkv/instances';

interface SecureSettingsState {
  sessionTimeoutMinutes: number;
  autoLockOnBackground: boolean;
  biometricEnabled: boolean;
  customRpcEndpoint: string | null;
  notifIncomingTx: boolean;
  notifStakingReward: boolean;
  notifTxConfirmed: boolean;
  notifSecurityAlert: boolean;

  setSessionTimeoutMinutes: (v: number) => void;
  setAutoLockOnBackground: (v: boolean) => void;
  setBiometricEnabled: (v: boolean) => void;
  setCustomRpcEndpoint: (v: string | null) => void;
  setNotifIncomingTx: (v: boolean) => void;
  setNotifStakingReward: (v: boolean) => void;
  setNotifTxConfirmed: (v: boolean) => void;
  setNotifSecurityAlert: (v: boolean) => void;
  reset: () => void;
}

const DEFAULTS = {
  sessionTimeoutMinutes: 5,
  autoLockOnBackground: true,
  biometricEnabled: false,
  customRpcEndpoint: null,
  notifIncomingTx: false,
  notifStakingReward: false,
  notifTxConfirmed: false,
  notifSecurityAlert: false,
};

export const useSecureSettingsStore = create<SecureSettingsState>()(
  persist(
    set => ({
      ...DEFAULTS,
      setSessionTimeoutMinutes: (v: number) => set({sessionTimeoutMinutes: v}),
      setAutoLockOnBackground: (v: boolean) => set({autoLockOnBackground: v}),
      setBiometricEnabled: (v: boolean) => set({biometricEnabled: v}),
      setCustomRpcEndpoint: (v: string | null) => set({customRpcEndpoint: v}),
      setNotifIncomingTx: (v: boolean) => set({notifIncomingTx: v}),
      setNotifStakingReward: (v: boolean) => set({notifStakingReward: v}),
      setNotifTxConfirmed: (v: boolean) => set({notifTxConfirmed: v}),
      setNotifSecurityAlert: (v: boolean) => set({notifSecurityAlert: v}),
      reset: () => set(DEFAULTS),
    }),
    {
      name: 'noctura-secure-settings',
      storage: createJSONStorage(() => mmkvSecureStorage),
    },
  ),
);

// Zustand hydrates at store-creation time. This module is imported during cold
// boot (App -> useSessionGuard -> sessionStore -> here), BEFORE unlock, when
// mmkvSecure() is still null — so getItem returns null and the store settles on
// DEFAULTS. Without this, the user's session timeout silently reverted to 5
// minutes on every launch, and the first post-unlock write persisted the
// defaults over their real values. The write-replay queue guaranteed the WRONG
// values were saved.
onSecureMmkvReady(() => {
  void useSecureSettingsStore.persist.rehydrate();
});
