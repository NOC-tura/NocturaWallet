import {Linking} from 'react-native';
import type {LinkingOptions} from '@react-navigation/native';
import type {RootStackParamList} from '../types/navigation';
import {useSessionStore} from '../store/zustand/sessionStore';
import {mmkvPublic} from '../store/mmkv/instances';
import {MMKV_KEYS} from '../constants/mmkvKeys';

/**
 * Stores a pending deep link URL when the session is not active.
 * After the user unlocks, the pending URL is replayed.
 */
const PENDING_DEEP_LINK_KEY = MMKV_KEYS.APP_PENDING_DEEP_LINK;

function isSessionActive(): boolean {
  const session = useSessionStore.getState();
  return session.isUnlocked && !session.isExpired();
}

/**
 * Check if the wallet exists (has completed onboarding).
 * If no wallet, deep links to authenticated screens should be ignored.
 */
function hasWallet(): boolean {
  return mmkvPublic.getString(MMKV_KEYS.WALLET_EXISTS) === 'true';
}

/**
 * Guard a deep link URL: if session is not active, store it for later
 * replay and return null (which prevents React Navigation from acting on it).
 */
function guardUrl(url: string | null): string | null {
  if (!url) return null;
  if (!hasWallet()) return null; // No wallet — deep link to auth screens is meaningless

  if (isSessionActive()) return url; // Session active — allow through

  // Session not active — store for replay after unlock
  mmkvPublic.set(PENDING_DEEP_LINK_KEY, url);
  return null; // Block navigation — user will be on Splash/Unlock
}

/** Retrieve and clear any pending deep link (called after successful unlock). */
export function consumePendingDeepLink(): string | null {
  const url = mmkvPublic.getString(PENDING_DEEP_LINK_KEY) ?? null;
  if (url) {
    mmkvPublic.remove(PENDING_DEEP_LINK_KEY);
  }
  return url;
}

export const deepLinkConfig: LinkingOptions<RootStackParamList> = {
  prefixes: ['noctura://', 'https://noc-tura.io', 'https://noc-tura.io/wallet'],

  // Override getInitialURL to guard cold-start deep links
  async getInitialURL(): Promise<string | null> {
    const url = await Linking.getInitialURL();
    return guardUrl(url);
  },

  // Override subscribe to guard runtime deep links
  subscribe(listener: (url: string) => void) {
    const subscription = Linking.addEventListener('url', ({url}) => {
      const guarded = guardUrl(url);
      if (guarded) {
        listener(guarded);
      }
      // If guarded returned null, the URL is stored in MMKV for replay
    });
    return () => subscription.remove();
  },

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
