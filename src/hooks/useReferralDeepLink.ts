import {useEffect} from 'react';
import {Linking} from 'react-native';
import {parseReferralInput} from '../modules/presale/referralInput';
import {useReferralCaptureStore} from '../store/zustand/referralCaptureStore';
import {useWalletStore} from '../store/zustand/walletStore';

/**
 * Captures a `?ref=<address>` referrer from the launching / incoming deep link
 * into the referral-capture store (B1 registers + credits it on the next buy).
 * Kept OUT of deepLinkConfig (getInitialURL/subscribe there caused re-render
 * loops) — a plain Linking effect, mounted once at the app root.
 */
export function useReferralDeepLink(): void {
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url) return;
      const ref = parseReferralInput(url);
      if (!ref) return;
      if (ref === useWalletStore.getState().publicKey) return; // no self-referral
      useReferralCaptureStore.getState().setCapturedReferrer(ref);
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', ({url}) => handle(url));
    return () => sub.remove();
  }, []);
}
