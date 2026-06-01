import type {LinkingOptions} from '@react-navigation/native';
import type {RootStackParamList} from '../types/navigation';
import {isShieldedEnabled} from '../constants/features';

// NOTE: Auth guard for deep links is handled by useSessionGuard in App.tsx.
// Previously had getInitialURL/subscribe overrides here but they caused
// re-render loops with NavigationContainer. Unauthenticated users land
// on Splash → Unlock flow regardless of the deep link target.

// Shielded deep links are gated out of the transparent v1 build. Without this,
// noctura://deposit | transfer | withdraw would open shielded screens directly,
// bypassing the FEATURES.shielded flag (NavigationContainer linking resolves
// these paths regardless of in-app UI guards).
const shieldedDeepLinks = isShieldedEnabled()
  ? {Deposit: 'deposit' as const, ShieldedTransfer: 'transfer' as const, Withdraw: 'withdraw' as const}
  : {};

export const deepLinkConfig: LinkingOptions<RootStackParamList> = {
  prefixes: ['noctura://', 'https://noc-tura.io', 'https://noc-tura.io/wallet'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          HomeTab: {
            screens: {
              Dashboard: 'dashboard',
              Presale: 'presale',
              Staking: 'stake',
              Referral: 'referral',
            },
          },
          PortfolioTab: 'portfolio',
          NftsTab: 'nfts',
          ProfileTab: 'profile',
        },
      },
      SendModal: {
        screens: {
          Send: {
            path: 'pay',
            parse: {
              to: (to: string) => to,
              amount: (amount: string) => amount,
              token: (token: string) => token,
            },
          },
        },
      },
      ReceiveModal: 'receive',
      ...shieldedDeepLinks,
    },
  },
};
