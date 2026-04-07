import type {LinkingOptions} from '@react-navigation/native';
import type {RootStackParamList} from '../types/navigation';

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
