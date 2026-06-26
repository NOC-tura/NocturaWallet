# Referral on Buy — B2 (App Links capture) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** A `noc-tura.io/wallet/...?ref=<addr>` (or `noctura://...?ref=<addr>`) link opens the app and pre-fills the captured referrer (B1 then registers + credits it). Plus the native config + a website handoff doc for the ICO Claude.

**Architecture:** A `useReferralDeepLink` effect captures `?ref=` from the launch/incoming URL into B1's `referralCaptureStore`; Android intent-filters (App Links scoped to `/wallet` + a `noctura://` scheme) route the links to the app; assetlinks.json (with the signing cert) is documented for the website.

**Tech Stack:** RN (Hermes), TS strict, React Navigation linking, Jest. Native: AndroidManifest.

**Working dir:** `/home/user/Solana/Project/NocturaWallet`. Branch `feat/referral-applinks-b2` (spec committed).

---

## File Structure
- `src/hooks/useReferralDeepLink.ts` (+ test) — **Create.** Capture `?ref=` from URLs.
- `src/app/App.tsx` (or the root component under `NavigationContainer`) — **Modify.** Mount the hook.
- `android/app/src/main/AndroidManifest.xml` — **Modify.** Two intent-filters.
- `docs/referral-applinks-website.md` — **Create.** assetlinks.json + AASA + portal instructions for the ICO Claude.
- iOS entitlement — **Modify if the iOS project exists**, else documented in the website doc.

---

## Task 1: useReferralDeepLink hook

**Files:** Create `src/hooks/useReferralDeepLink.ts` + `__tests__/useReferralDeepLink.test.ts`.

- [ ] **Step 1: Test** (mock `react-native` `Linking` + the two stores):
```ts
import {renderHook} from '@testing-library/react-native';
import {Linking} from 'react-native';
import {useReferralDeepLink} from '../useReferralDeepLink';
import {useReferralCaptureStore} from '../../store/zustand/referralCaptureStore';
import {useWalletStore} from '../../store/zustand/walletStore';

const ADDR = '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd';

beforeEach(() => {
  useReferralCaptureStore.getState().clearCapturedReferrer();
  jest.spyOn(Linking, 'addEventListener').mockReturnValue({remove: jest.fn()} as never);
});

it('captures ?ref= from the initial URL', async () => {
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(`https://noc-tura.io/wallet/presale?ref=${ADDR}`);
  renderHook(() => useReferralDeepLink());
  await new Promise(r => setTimeout(r, 0));
  expect(useReferralCaptureStore.getState().capturedReferrer).toBe(ADDR);
});

it('ignores a URL with no ref', async () => {
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('https://noc-tura.io/wallet/presale');
  renderHook(() => useReferralDeepLink());
  await new Promise(r => setTimeout(r, 0));
  expect(useReferralCaptureStore.getState().capturedReferrer).toBeNull();
});

it('ignores self-referral (== own publicKey)', async () => {
  useWalletStore.setState({publicKey: ADDR} as never);
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(`noctura://presale?ref=${ADDR}`);
  renderHook(() => useReferralDeepLink());
  await new Promise(r => setTimeout(r, 0));
  expect(useReferralCaptureStore.getState().capturedReferrer).toBeNull();
});
```
> Check the exact `walletStore` reset/shape the other tests use; adjust the `setState`/`getState().publicKey` access to match. If `renderHook` isn't available, render a tiny test component that calls the hook.

- [ ] **Step 2:** Run `npx jest useReferralDeepLink` → FAIL.
- [ ] **Step 3: Implement** `src/hooks/useReferralDeepLink.ts`:
```ts
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
```
- [ ] **Step 4:** `npx jest useReferralDeepLink` → PASS; `tsc` clean.
- [ ] **Step 5:** Commit `feat(referral): useReferralDeepLink — capture ?ref= from deep links`.

---

## Task 2: Mount the hook at the app root

**Files:** Modify `src/app/App.tsx` (or whichever component renders inside `NavigationContainer`/providers and may call hooks).

- [ ] **Step 1:** Find the root app component (`grep -rn "export default function App\|export function App" src`). Import + call `useReferralDeepLink()` once near the top (alongside the existing hooks like `useSessionGuard`). It needs to be inside the React tree (a component body), not in `deepLinkConfig`.
- [ ] **Step 2:** `npx jest` (no regressions) + `npx tsc --noEmit` clean. If an App-level test exists and needs `Linking` mocked, add the mock.
- [ ] **Step 3:** Commit `feat(referral): mount useReferralDeepLink at app root`.

---

## Task 3: Android intent-filters

**Files:** Modify `android/app/src/main/AndroidManifest.xml`.

- [ ] **Step 1:** Inside the existing `MainActivity` `<activity>` (after the MAIN/LAUNCHER `<intent-filter>`), add the two intent-filters from spec §A verbatim: (1) the `autoVerify="true"` https filter with `scheme="https" host="noc-tura.io" pathPrefix="/wallet"`, and (2) the `noctura` custom-scheme filter. Keep everything else unchanged.
- [ ] **Step 2:** Build sanity: `cd android && ./gradlew :app:processReleaseManifest` (or a full assembleRelease in Task 4) — the manifest must merge without error. Verify the merged manifest contains both filters.
- [ ] **Step 3:** Commit `feat(android): App Links (/wallet) + noctura:// intent-filters`.

---

## Task 4: Website handoff doc + iOS entitlement

**Files:** Create `docs/referral-applinks-website.md`; modify the iOS entitlements file IF present.

- [ ] **Step 1:** Write `docs/referral-applinks-website.md` for the ICO Claude with: the exact `assetlinks.json` JSON from spec §D.1 (package `com.nocturawallet` + the debug-cert SHA256, with the ⚠️ Play-Store-cert note); the hosting requirements (served at `/.well-known/assetlinks.json`, `application/json`, 200, no redirect); the `apple-app-site-association` JSON (Team ID TBD); and the Affiliate-Portal instruction to generate `https://noc-tura.io/wallet/presale?ref=<address>` links (+ ensure a browser-working `/wallet/presale` route). Include the verification command `adb shell pm get-app-links com.nocturawallet`.
- [ ] **Step 2:** If `ios/` has an `.entitlements` file (`find ios -name "*.entitlements"`), add `com.apple.developer.associated-domains` = `["applinks:noc-tura.io"]`. If not present / iOS not set up, note in the doc that the entitlement must be added when iOS ships (do NOT scaffold iOS).
- [ ] **Step 3:** Commit `docs(referral): App Links website handoff (assetlinks + portal link format) + iOS entitlement`.

---

## Task 5: Full verification + on-device

- [ ] **Step 1:** `npx jest && npx tsc --noEmit` → green/clean.
- [ ] **Step 2:** Build `app-release.apk` → `/home/user/Downloads/NocturaWallet-referral-b2.apk`.
- [ ] **Step 3: On-device (custom scheme, works now):** install; run
  `adb shell am start -a android.intent.action.VIEW -d "noctura://presale?ref=KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr"`
  (or tap a `noctura://presale?ref=…` link) → app opens at Presale with the "Referral applied · KnZ5…39qr" chip. (A fresh-wallet buy then credits the referrer per B1.)
- [ ] **Step 4 (after the ICO Claude hosts assetlinks.json):** tapping `https://noc-tura.io/wallet/presale?ref=<addr>` opens the app; `adb shell pm get-app-links com.nocturawallet` shows the domain `verified`.

---

## Self-Review
- **Spec coverage:** A native filters→T3; B hook→T1; mount→T2; C iOS doc→T4; D website doc→T4; E hook test→T1. ✓
- **Scope guard:** capture only (routing stays in `deepLinkConfig`); App Links scoped to `/wallet` (no whole-domain hijack); custom scheme makes it testable before the website file exists. ✓
- **Flagged:** debug signing cert in assetlinks (swap for Play Store); iOS documented not built; manual field (B1) remains as fallback.
