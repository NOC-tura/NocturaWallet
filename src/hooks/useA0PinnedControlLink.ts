import {useEffect} from 'react';
import {Linking} from 'react-native';
import {a0ReadoutEnabled} from '../modules/shielded/a0/checkpointReadout';
import {A0_PINNED_CONTROL_LINK, runA0PinnedControl} from '../modules/shielded/a0/pinnedControl';
import {A0_SUBMIT_HOLD_LINK, armA0SubmitHold} from '../modules/shielded/a0/submitHold';

/**
 * The desk's trigger for the M1c `pinnedFetch` on-device control (spec §6.0; `pinnedControl.ts`):
 * `adb shell am start -a android.intent.action.VIEW -d noctura://a0-pinned-control
 * com.nocturawallet.devnet` (sent by `scripts/m1c-checkpoint/m1c-checkpoint.mjs pinned-control`).
 *
 * DEVNET BUILD ONLY: with the readout gate closed (the production build) no listener is added and
 * the link is never looked at. The link has no entry in `deepLinkConfig`, so React Navigation
 * resolves it to no state and navigates nowhere (tested). It needs no unlock: it sends no wallet
 * value, only the fixed malformed submit and a quote request.
 *
 * A plain Linking effect at the app root, like `useReferralDeepLink` (kept out of deepLinkConfig).
 *
 * ONE GATE, NOT TWO (review minor a). `runA0PinnedControl()` is called with no overrides, so it
 * applies its OWN default gate (`a0ReadoutEnabled()`) rather than being forced open with
 * `{enabled: true}`. Forcing it open here would leave production (or any build with the hook's own
 * `enabled` wrongly true) depending on this file alone to keep the control closed, instead of on
 * the same `a0ReadoutEnabled()` check both this hook's default and the control itself use.
 *
 * M1c Task 9: the same listener reads the desk's second devnet link, `noctura://a0-hold-next-submit`
 * (`submitHold.ts`, sent by `m1c-checkpoint.mjs hold-kill`): it arms the one-shot submit hold of the
 * next unshield and nothing else — no request, no navigation. Exact match only (no prefix), and
 * `armA0SubmitHold()` with no override, for the same one-gate reason as the control.
 */
export function useA0PinnedControlLink(enabled: boolean = a0ReadoutEnabled()): void {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const handle = (url: string | null) => {
      if (url === A0_SUBMIT_HOLD_LINK) {
        armA0SubmitHold();
        return;
      }
      if (url !== A0_PINNED_CONTROL_LINK) {
        return;
      }
      runA0PinnedControl().catch(() => {
        // the control reads out every failure itself; nothing escapes to the UI
      });
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', ({url}) => handle(url));
    return () => sub.remove();
  }, [enabled]);
}
