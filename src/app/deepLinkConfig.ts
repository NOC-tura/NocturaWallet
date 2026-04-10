import type {LinkingOptions} from '@react-navigation/native';
import type {RootStackParamList} from '../types/navigation';

// NOTE: Auth guard for deep links is handled by useSessionGuard in App.tsx.
// Previously had getInitialURL/subscribe overrides here but they caused
// re-render loops with NavigationContainer. Unauthenticated users land
// on Splash → Unlock flow regardless of the deep link target.

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
          SendTab: {
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
          ReceiveTab: 'receive',
        },
      },
      Deposit: 'deposit',
      ShieldedTransfer: 'transfer',
      Withdraw: 'withdraw',
    },
  },
};
