import type {LinkingOptions} from '@react-navigation/native';
import type {RootStackParamList} from '../types/navigation';

export const deepLinkConfig: LinkingOptions<RootStackParamList> = {
  prefixes: ['noctura://', 'https://noc-tura.io'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          HomeTab: {
            screens: {
              Presale: 'presale',
            },
          },
        },
      },
    },
  },
};
