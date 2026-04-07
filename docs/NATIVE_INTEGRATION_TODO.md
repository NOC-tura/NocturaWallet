# Native Integration TODO

> Ta dokument opisuje vse module ki čakajo na zunanjo integracijo (native SDK, ZK circuits, backend).
> NE briši — preveri pred vsakim releaseom.

---

## 1. ZK Circuit Integration (Poseidon + BN254)

**Status:** Čaka na deploy ZK circuita na devnet

**Kaj je treba narediti:**

Ko ZK ekipa deploya Groth16/BN254 circuit na devnet, dobiš circuit spec z:
- Poseidon parametri (t, RF, RP, field order)
- BN254_ORDER konstanto
- Exact field encoding za pk_recipient in mint_hash

Potem implementiraj:

1. **`buildFeeCommitment(fee, randomness)`** v `src/modules/fees/feeEngine.ts`
   - `Poseidon_2(fee, randomness)` — hash za ZK fee proof
   - Namesti: `poseidon-lite` (že v CLAUDE.md kot planiran dependency)

2. **`pk_recipient` hash-to-field** v `src/modules/zkProver/`
   - 48 bytes BLS G1 compressed → 2 field elements (pk_hi, pk_lo)
   - `Poseidon_3(0x05, pk_hi, pk_lo)`

3. **`mint_hash` mod BN254_ORDER** v `src/modules/zkProver/`
   - `mint_bytes mod BN254_ORDER` — modular reduction
   - BN254_ORDER = `21888242871839275222246405745257275088548364400416034343698204186575808495617`

4. **Zamenjaj XOR placeholder** v `src/modules/merkle/merkleModule.ts` (line 23-36)
   - Trenutno: XOR fold (ni kriptografsko varen)
   - Zamenjaj z: `Poseidon(left, right)` z enakimi parametri kot circuit

**KRITIČNO:** Parametri MORAJO matchat deployed circuit. Napačni parametri = neveljavni proofs.

**Verify:** `wallet_commitment === circuit_verification` round-trip test

---

## 2. Native Shielded Signing (BLST)

**Status:** Stub v `src/modules/keychain/nativeBridge.ts`

**Kaj je treba:**
- **iOS:** `native/ios/NocturaSecureEnclave.swift` — BLST via C interop
  - P-256 envelope encryption (Secure Enclave) za wrapping BLS ključev
  - `signShieldedOp(payload)` → BLS12-381 podpis
  - `getShieldedPublicKey()` → G1 compressed (48 bytes)
- **Android:** `native/android/NocturaKeyStore.kt` — BLST via JNI
  - BiometricPrompt + Android Keystore
  - Enake funkcije kot iOS

**KRITIČNO:** `sk_spend` NIKOLI ne sme zapustiti native boundary.

---

## 3. Screen Security (FLAG_SECURE)

**Status:** Stub v `src/modules/screenSecurity/screenSecurityModule.ts`

**Kaj je treba:**
- **Android:** Native module `NocturaScreenSecurity.kt`
  - `enableSecureScreen()` → `setFlags(FLAG_SECURE)`
  - `disableSecureScreen()` → `clearFlags(FLAG_SECURE)`
- **iOS:** `isCaptured()` → `UIScreen.main.isCaptured` (samo detekcija, Apple ne dovoli blokade)

---

## 4. Push Notifications (APNs / FCM)

**Status:** Stub v `src/modules/notifications/notificationModule.ts`

**Kaj je treba:**
- **iOS:** APNs certifikat + `@notifee/react-native` native setup
- **Android:** Firebase projekt + FCM config + `google-services.json`
- Zamenjaj `'stub-device-token'` z realnim device tokenom iz native SDK

---

## 5. Cloud Backup (iCloud / Google Drive)

**Status:** Stub v `src/modules/backup/backupModule.ts` (performCloudBackup/restoreFromCloud)

**Kaj je treba:**
- **iOS:** CloudKit ali iCloud Drive entitlement + upload/download
- **Android:** Google Drive API v3 + OAuth 2.0
- Šifriranje (AES-256-GCM) je že implementirano v JS — samo upload/download je native

---

## 6. QR Scanner

**Status:** Stub v `src/screens/transparent/SendScreen.tsx` (handleQrScan)

**Kaj je treba:**
- `react-native-vision-camera` + ML Kit (Android) / Vision framework (iOS)
- Camera permission (`NSCameraUsageDescription` iOS, `CAMERA` Android)
- Scanned string gre skozi obstoječi `validateRecipientInput()`

---

## 7. Background Sync

**Status:** Stub v `src/modules/backgroundSync/backgroundSyncModule.ts` (registerBackgroundTask)

**Kaj je treba:**
- **iOS:** `BGTaskScheduler` (battery-safe, ~15min minimum)
- **Android:** `WorkManager` (periodic, 15min minimum)
- Prioriteta: NIZKA — foreground sync ob odprtju aplikacije je primarni mehanizem

---

## 8. Deep Linking (Universal / App Links)

**Status:** JS logika deluje, manjka native config

**Kaj je treba:**
- **iOS:** `apple-app-site-association` datoteka na `noc-tura.io` domeni + app entitlements
- **Android:** `assetlinks.json` na `noc-tura.io` + intent filter v `AndroidManifest.xml`
- JS `Linking.addEventListener` v `deepLinkModule.initialize()` je že pripravljen

---

## 9. SSL Pinning — produkcijski pini

**Status:** Placeholder pini v `src/modules/sslPinning/pinnedFetch.ts` (lines 10-13)

**Kaj je treba:**
- Pridobi SHA-256 SPKI pine: `openssl s_client -connect api.noc-tura.io:443`
- Zamenjaj `BBBBB...` in `CCCCC...` z realnimi pini (primary + backup za rotacijo)

---

## Prioritetni vrstni red

| # | Modul | Blokira | Prioriteta |
|---|-------|---------|------------|
| 1 | ZK Circuits (Poseidon/BN254) | Shielded transactions | KRITIČNO |
| 2 | BLST Native Signing | Shielded transactions | KRITIČNO |
| 3 | SSL produkcijski pini | Production deploy | KRITIČNO |
| 4 | Screen Security | Seed phrase zaščita | VISOKO |
| 5 | Push Notifications | User engagement | SREDNJE |
| 6 | QR Scanner | UX convenience | SREDNJE |
| 7 | Cloud Backup | Data recovery | SREDNJE |
| 8 | Deep Linking config | Marketing / UX | NIZKO |
| 9 | Background Sync | Battery-safe sync | NIZKO |
