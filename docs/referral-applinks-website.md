# Noctura Wallet — App Links handoff (for the noc-tura.io / ICO side)

The mobile wallet now claims **`https://noc-tura.io/wallet/*`** as Android App Links (and `noctura://` as a custom scheme) so a referral link opens the app and pre-fills the referrer. For the **https** links to auto-open the app (instead of the browser), the website must host one verification file and generate links with the `/wallet` path. **Scoped to `/wallet` on purpose — the app does NOT claim the rest of noc-tura.io.**

Author: wallet side, 2026-06-26.

---

## 1. Host `/.well-known/assetlinks.json` (Android — required)

Serve this at **`https://noc-tura.io/.well-known/assetlinks.json`**:
- `Content-Type: application/json`
- HTTP **200**, **no redirect** (Android fetches it directly; a 301/302 breaks verification)
- Publicly reachable (no auth, no Cloudflare challenge page)

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.nocturawallet",
      "sha256_cert_fingerprints": [
        "FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C"
      ]
    }
  }
]
```

> ⚠️ **This SHA256 is the wallet's current DEBUG signing keystore** (the sideloaded release APK is debug-signed today). When the app is published via Google Play, it will be re-signed — add the **Play App Signing** cert SHA256 (and/or the upload cert) to the `sha256_cert_fingerprints` array (it accepts multiple). The wallet side will provide the production fingerprint at store-release time. Keeping multiple fingerprints is fine.

After hosting, verify from a connected device with the app installed:
```
adb shell pm get-app-links com.nocturawallet      # the domain should show "verified"
adb shell pm verify-app-links --re-verify com.nocturawallet
```

## 2. Affiliate Portal — generate `/wallet/presale?ref=` links

Today the portal shares `https://noc-tura.io?ref=<address>` (root). For the **app** to capture it, generate (in addition to / instead of the browser link):

```
https://noc-tura.io/wallet/presale?ref=<referrer_wallet_address>
```

- `/wallet/presale` routes the app to the Buy screen and the wallet reads `?ref=<address>` into its referral state (then registers + credits it on the next on-chain buy — this is already live, PR #34).
- Make sure **`/wallet/presale` also works in a browser** for users without the app — e.g. redirect to the presale section / the existing `?ref=` flow, or show a lightweight "Open in the Noctura app / Continue on web" page that preserves `?ref=`. (Anything under `/wallet/*` that returns a normal page is fine; the app only intercepts it on devices where it's installed + verified.)

## 3. iOS — `apple-app-site-association` (when iOS ships)

The iOS app is **not configured yet** (still the default template bundle id; no Team ID). When iOS is set up, host this at **`https://noc-tura.io/.well-known/apple-app-site-association`** (JSON, `application/json`, 200, no redirect, no `.json` extension):

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["<TEAM_ID>.<BUNDLE_ID>"],
        "components": [{ "/": "/wallet/*", "comment": "Noctura wallet deep links" }]
      }
    ]
  }
}
```

Replace `<TEAM_ID>` (Apple Developer Team ID) and `<BUNDLE_ID>` (the real iOS bundle id, e.g. `io.noctura.wallet`) — the wallet side will provide both when the iOS build is configured (it also needs the `applinks:noc-tura.io` Associated-Domains entitlement on the app).

## 4. Quick reference

| Item | Value |
|---|---|
| Android package | `com.nocturawallet` |
| Claimed path | `https://noc-tura.io/wallet/*` (App Link) + `noctura://` (scheme) |
| Referral link to generate | `https://noc-tura.io/wallet/presale?ref=<address>` |
| assetlinks.json | host at `/.well-known/assetlinks.json` (content above) |
| Android debug cert SHA256 | `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C` |

Ping the wallet side once `assetlinks.json` is live + the portal emits `/wallet/presale?ref=` links, and we'll verify `pm get-app-links` shows `verified` on-device.
