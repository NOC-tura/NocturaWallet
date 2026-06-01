# Android Transparent v1 (Faza 2a) — Design Spec

**Date:** 2026-06-01
**Status:** Approved for planning
**Topic:** Get the existing (design-matching) transparent Noctura wallet into a signed, sideloadable Android APK for on-phone testing, with the unfinished shielded mode gated behind a "coming soon" flag. No visual redesign — `/home/user/Downloads/index.html` (55-screen prototype) remains the visual source of truth.

This is **Faza 2a**. QR camera (vision-camera) is **Faza 2b**; BLST native signing is **Faza 3** — both separate specs.

---

## 1. Context & Goal

Phase 1 is live on mainnet (people buy $NOC via https://noc-tura.io). The RN screens (onboarding, dashboard, send/receive/history, staking, presale, referral, settings, and the shielded set) already mirror the `index.html` design section-by-section. The goal is not new UI — it is **shipping a runnable, testable transparent wallet APK** and hiding the shielded path (blocked on external ZK work) so testers never hit mocked/broken flows.

Devnet is a dead end: `NOC_MINT`/`PROGRAM_ID`/`ADMIN_ADDRESS`/`SOL_TREASURY` are all `TODO_DEVNET_*` placeholders and no devnet deployments exist. All testing is on **mainnet-beta**.

## 2. Working Model

The Android SDK (`/home/user/Android/Sdk`) and a working build exist on this machine, but the device/Metro loop is not driveable from the agent sandbox. So:

- **The agent builds a signed, self-contained release APK** (`assembleRelease`, JS bundled, signed with the existing debug keystore) and copies it to `/home/user/Downloads/`.
- **The user sideloads it** onto a phone (enable "install from unknown sources"; Android will warn about the debug-signed source — expected) and runs the staged smoke test.
- **On any error the user reports logs (logcat / on-screen), the agent fixes and rebuilds.** Iterative.

The user does NOT need an Android SDK. The agent does NOT run the device/UX test.

## 3. Scope & Deliverables

1. **Shielded gating** — `src/constants/features.ts` flag (`FEATURES.shielded = false`) applied at every shielded entry point.
2. **Mainnet build config** — `.env` set to `NETWORK=mainnet-beta` + mainnet Helius URL (user's existing key, hostname `devnet→mainnet`) + `API_BASE=https://api.noc-tura.io/v1`. Key is baked into the APK (user-confirmed; their key/build/phone).
3. **Signed release APK** in `/home/user/Downloads/` (self-contained, sideloadable).
4. **Sideload + staged smoke-test runbook** committed at `docs/runbooks/2026-06-01-android-transparent-v1-runbook.md`.

### Out of scope
QR camera scanner (Faza 2b), BLST native signing (Faza 3), iOS, push/cloud-backup/deep-link native config, Play Store release signing (real keystore), any shielded functionality, devnet.

## 4. Shielded Gating

Single source of truth:
```ts
// src/constants/features.ts
export const FEATURES = {
  /** Shielded (private) mode. false until ZK proving is live (backend + WASM). */
  shielded: false,
} as const;
```

Applied at every entry point:

1. **Dashboard `ModeToggle`** — primary entry (`onFirstShieldedToggle → navigate('ShieldedExplainer')`). With the flag off, the toggle renders in a **disabled "Private mode · coming soon"** state, reusing the visual language of the existing s14 "Camera coming soon" treatment. (Chosen over hiding entirely: this is a privacy-first wallet; teasing the headline feature — and the presale 0-fee perk — is on-brand.)
2. **Navigation guards** — shielded routes (`ShieldedExplainer`, `ShieldedBalance`, `ShieldedTransfer`, `ShieldUnshield`, `Deposit`, `Withdraw`, `ZkProof`) stay **registered** (minimal churn, flip-the-flag simplicity) but unreachable since the only entry (ModeToggle) is closed. A defensive guard prevents programmatic/deep-link `navigate` into them when the flag is off.
3. **Other entry points** — audit and gate any remaining shielded links (e.g. Settings → `ExportViewKey` shielded view key, menu items, deep-link routes). The plan enumerates them; the flag covers all.
4. **Onboarding** — verify `Success`/`SyncWallet` do not force-navigate into shielded when the flag is off.

When ZK lands: `shielded: true` → everything returns exactly as designed (s16/s17/s18), no other change.

## 5. Build & Config

Verified already-correct: `dotenv.gradle` applied in `android/app/build.gradle`; `newArchEnabled=true` + `hermesEnabled=true`; `NocturaScreenSecurityPackage` wired in `MainApplication.kt`; SDK build-tools 36 + platform android-36 + NDK present; `release` buildType signs with `signingConfigs.debug`.

Build steps (agent):
1. Edit `.env`: `NETWORK=mainnet-beta`, Helius `HELIUS_RPC_URL`/`HELIUS_WS_URL` hostname `devnet→mainnet` (same key), add `API_BASE=https://api.noc-tura.io/v1`.
2. `export ANDROID_HOME=/home/user/Android/Sdk`
3. `cd android && ./gradlew assembleRelease` → `app/build/outputs/apk/release/app-release.apk`
4. Copy APK to `/home/user/Downloads/`.

Notes / risks:
- **`NOCTURA_FEE_TREASURY = 'TODO_MAINNET_FEE_TREASURY'`** is used in `transactionBuilder.ts:148,211` and `feeEngine.ts:157` as `new PublicKey(...)`. It throws at transparent-transfer build time → **transparent send crashes**. It does NOT affect Stage A (UI) or Stage B (read-only). **Stage C prerequisite:** set a real address (Squads multisig, or a temporary user-controlled wallet for testing) and rebuild.
- **ProGuard/minify:** if `enableProguardInReleaseBuilds` is true, the release build shrinks code — verify the APK runs; if RN reflection breaks, disable minify for the test build. (Handled at implementation; debug-bundle fallback available.)
- **Build feasibility is validated first:** the implementation's first step is a trial `assembleRelease`. If the sandbox cannot build (deps/network), fall back to the agent committing all code + a build-command runbook for the user to run.

## 6. Staged Testing (A → B → C)

The user runs these on the phone with the delivered APK (built on mainnet env from the start, so the dashboard's real $NOC reads don't hit a `TODO_DEVNET_MINT` crash).

**Stage A — install & UI (read-only, no spending):**
- APK installs and launches; onboarding (create → seed → confirm → PIN → biometric → success) and import-seed work
- Unlock (PIN + biometric)
- Navigate all tabs (Home/Portfolio/Nfts/Profile) + settings screens open
- Shielded `ModeToggle` shows "coming soon" disabled (gating works)
- FLAG_SECURE on seed/PIN screens (screenshot blocked)

**Stage B — real on-chain reads (mainnet, no spending):**
- Dashboard shows real SOL + $NOC balances (real Helius RPC)
- Receive: correct address + QR
- Transaction history loads
- Presale / Staking / Referral screens show real state

**Stage C — tiny real transactions (mainnet, small amounts):**
- Prerequisite: `NOCTURA_FEE_TREASURY` real address (rebuild)
- Send a tiny SOL to self → status → history; send tiny $NOC; minimal stake/unstake
- Small amounts, verify on explorer

## 7. Testing & "Done"

**Agent-side (CI-verifiable this session):**
- Gating: component/unit test that `FEATURES.shielded=false` renders the disabled "coming soon" toggle and shielded routes are unreachable (guard test). Existing ~566 tests stay green; `tsc` + `eslint` clean.
- A signed `app-release.apk` is produced and placed in `/home/user/Downloads/` (or, if the sandbox can't build, code committed + build runbook for the user).
- Runbook committed.

**User-side (acceptance):** the on-phone Stage A/B (and C after the fee-treasury fix) smoke test. Not a CI gate.

**Faza 2a done (agent side):** gating implemented + tested, mainnet build config applied, APK delivered (or build-fallback runbook), runbook committed, all jest/tsc/eslint green.

## 8. Follow-ups (tracked, not in this spec)
- Faza 2b: QR camera scanner (vision-camera + permissions + decode→Send).
- Faza 3: BLST native signing.
- Pre-production: real release keystore; resolve `NOCTURA_FEE_TREASURY` Squads multisig; the 11-site double-`/v1` API path cleanup; `SSLPinningError`/`E032` collision.
