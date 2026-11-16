import type {LinkingOptions} from '@react-navigation/native';
import type {RootStackParamList} from '../types/navigation';
import {isShieldedEnabled} from '../constants/features';
import {isPresaleEnabled} from '../constants/chain';

// NOTE: Auth guard for deep links is handled by useSessionGuard in App.tsx.
// Previously had getInitialURL/subscribe overrides here but they caused
// re-render loops with NavigationContainer. Unauthenticated users land
// on Splash → Unlock flow regardless of the deep link target.

// Shielded deep links are gated out of the transparent build. Without this,
// noctura://deposit would open a shielded screen directly, bypassing the
// FEATURES.shielded flag (NavigationContainer linking resolves these paths
// regardless of in-app UI guards). In the devnet build `deposit` opens #16's
// shield side; there is NO `withdraw` or `transfer` link: the unshield side and
// the shielded transfer are hidden until their plans land (spec §12), and a
// path with no config entry never reaches a shielded screen.
const shieldedDeepLinks = isShieldedEnabled() ? {ShieldUnshieldModal: 'deposit' as const} : {};

// The Phase 1 program's links (presale, staking, the presale referral) exist only where presale
// does — mainnet (S13); in the devnet build their routes are not registered either.
const presaleDeepLinks = isPresaleEnabled()
  ? {Presale: 'presale' as const, Staking: 'stake' as const, Referral: 'referral' as const}
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
              ...presaleDeepLinks,
            },
          },
          PortfolioTab: 'portfolio',
          NftsTab: 'nfts',
          ProfileTab: 'profile',
        },
      },
      SendModal: 'pay',
      ReceiveModal: 'receive',
      ...shieldedDeepLinks,
    },
  },
};
