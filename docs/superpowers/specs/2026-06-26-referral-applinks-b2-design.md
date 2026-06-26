# Referral on Buy — B2: App Links capture — Design

**Status:** Approved (brainstorming). **Date:** 2026-06-26. **Repo:** NocturaWallet. **Branch:** `feat/referral-applinks-b2`.

## Context

B2 of #4 part B: let a `noc-tura.io` referral link **open the app and pre-fill the captured referrer** (which B1's engine then registers + credits on the next buy). B1 (PR #34) is done + mainnet-verified.

### What already exists
- `src/app/deepLinkConfig.ts` — a React Navigation `LinkingOptions` with prefixes `['noctura://', 'https://noc-tura.io', 'https://noc-tura.io/wallet']` and screen paths (`presale`, `referral`, …). **But the native side is NOT wired** — `AndroidManifest.xml` has only a MAIN/LAUNCHER intent-filter, so no `https`/`noctura://` link actually reaches the app yet.
- B1's `referralCaptureStore` (`setCapturedReferrer`) + `parseReferralInput(url)` (extracts `?ref=` + validates a base58 pubkey).
- `applicationId = com.nocturawallet`. Release APK is signed with the **debug keystore**, SHA256 `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`.

### Key constraint (decided)
Android App Links match by **host + path**, NOT query. Claiming `noc-tura.io` (root) would hijack the **whole website** into the app. So the referral deep link uses the dedicated path **`https://noc-tura.io/wallet/...?ref=<addr>`** — the app claims only `/wallet`; the rest of the site is unaffected. The recommended link is `https://noc-tura.io/wallet/presale?ref=<addr>` (lands on the Presale screen via the existing `/wallet` prefix).

## A. Android native — `android/app/src/main/AndroidManifest.xml`

Add two intent-filters to the existing `MainActivity` (keep the MAIN/LAUNCHER one):
1. **App Links (https, scoped):**
   ```xml
   <intent-filter android:autoVerify="true">
     <action android:name="android.intent.action.VIEW" />
     <category android:name="android.intent.category.DEFAULT" />
     <category android:name="android.intent.category.BROWSABLE" />
     <data android:scheme="https" android:host="noc-tura.io" android:pathPrefix="/wallet" />
   </intent-filter>
   ```
2. **Custom scheme (always works, no website file — for immediate testing + a fallback):**
   ```xml
   <intent-filter>
     <action android:name="android.intent.action.VIEW" />
     <category android:name="android.intent.category.DEFAULT" />
     <category android:name="android.intent.category.BROWSABLE" />
     <data android:scheme="noctura" />
   </intent-filter>
   ```
`MainActivity` is already `launchMode="singleTask"` + `exported="true"` (correct for deep links).

## B. Referral capture hook — `src/hooks/useReferralDeepLink.ts` (new)

A small effect (mounted once in the app root) that captures the referrer from the launching/incoming URL — kept SEPARATE from `deepLinkConfig` (the file's comment notes `getInitialURL`/`subscribe` in the linking config caused re-render loops; a plain `Linking` effect avoids that):
- On mount: `Linking.getInitialURL().then(handle)` (cold start) + `const sub = Linking.addEventListener('url', ({url}) => handle(url)); return () => sub.remove()` (warm).
- `handle(url)`: `const ref = parseReferralInput(url)`; if `ref != null` and `ref !== useWalletStore.getState().publicKey` → `useReferralCaptureStore.getState().setCapturedReferrer(ref)`. (Reuses B1's parser, which already pulls `ref` out of a full URL.)
- No navigation here — the existing `deepLinkConfig` routes `/wallet/presale` → the Presale screen; the hook only captures.
- Mount the hook in the app root (where `App`/providers live — find the component under `NavigationContainer` that can call hooks; e.g. `App.tsx`). Call `useReferralDeepLink()` once.

## C. iOS — documented, not built this cycle

- `ios/.../<App>.entitlements`: add `com.apple.developer.associated-domains` = `["applinks:noc-tura.io"]` (the implementer adds the entitlement key if the iOS project is present; if not set up, document it in the README).
- AASA content provided in the handoff doc. iOS is not buildable/testable in this Android-only flow → ship the entitlement/doc, verify on iOS later.

## D. Website handoff — `docs/referral-applinks-website.md` (new, for the ICO Claude)

A doc the ICO Claude implements on `noc-tura.io`:
1. **`/.well-known/assetlinks.json`** (served at `https://noc-tura.io/.well-known/assetlinks.json`, `Content-Type: application/json`, HTTP 200, no redirect):
   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package_name": "com.nocturawallet",
       "sha256_cert_fingerprints": ["FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C"]
     }
   }]
   ```
   ⚠️ This SHA256 is the **debug keystore** (current release signing). For a Play Store build, replace with the upload/Play-App-Signing cert SHA256.
2. **`/.well-known/apple-app-site-association`** (iOS, when iOS ships): `{"applinks":{"details":[{"appIDs":["<TEAMID>.com.nocturawallet"],"components":[{"/":"/wallet/*"}]}]}}` (Team ID TBD).
3. **Affiliate Portal:** generate the wallet referral link as `https://noc-tura.io/wallet/presale?ref=<address>` (in addition to / instead of the current root `?ref=` browser link). Ensure a `/wallet/presale` route exists and works in a browser (e.g. redirect to the presale section / an "open in app" page) for users without the app.

## E. Testing

- `useReferralDeepLink` unit test: mock `react-native` `Linking` (`getInitialURL` resolves a `noctura://presale?ref=<addr>` / `https://noc-tura.io/wallet/presale?ref=<addr>` URL; `addEventListener` captures the handler) → asserts `setCapturedReferrer` called with the address; a URL with no `ref` → not called; a self-referrer (== publicKey) → not called.
- `deepLinkConfig` existing test stays green.

## F. On-device

- **Now (custom scheme, no website file):** `adb shell am start -a android.intent.action.VIEW -d "noctura://presale?ref=KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr"` (or tap such a link) → app opens at Presale, "Referral applied · KnZ5…39qr" chip shows. Then a buy uses it (B1).
- **After the ICO Claude hosts assetlinks.json:** tapping `https://noc-tura.io/wallet/presale?ref=<addr>` opens the app (verify `adb shell pm get-app-links com.nocturawallet` shows `verified`), captures the referrer.

## Out of scope
- iOS build/verification (entitlement + AASA documented; verify when iOS ships).
- Play Store signing cert (debug cert used; swap before store release).
- Changing B1's engine or the manual field (the manual "Have a referral?" field stays as a fallback).
