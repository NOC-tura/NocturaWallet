# Android Transparent v1 — Sideload & Smoke Test Runbook

**APK:** `/home/user/Downloads/noctura-transparent-v1.apk` (release, debug-signed,
self-contained, mainnet env). Shielded mode is gated ("coming soon").

## Install (sideload)
1. Transfer the APK to your Android phone (USB / cloud / cable).
2. On the phone: Settings → Apps → Special access → Install unknown apps → allow your
   file manager / browser. (Android warns about the source — expected for a debug-signed build.)
3. Open the APK → Install → Open.

## Stage A — install & UI (read-only, no spending)
- [ ] App installs and launches
- [ ] Onboarding: create wallet → seed phrase → confirm seed → set PIN → biometric → success
- [ ] Import existing seed works
- [ ] Unlock with PIN and with biometric
- [ ] All tabs navigate (Home / Portfolio / Nfts / Profile); settings screens open
- [ ] Dashboard "Shielded" toggle shows **"Shielded · soon"** disabled (tapping does nothing)
- [ ] Seed and PIN screens are screenshot-blocked (FLAG_SECURE)

## Stage B — real on-chain reads (mainnet, no spending)
- [ ] Dashboard shows real SOL + $NOC balances
- [ ] Receive screen shows correct address + scannable QR
- [ ] Transaction history loads
- [ ] Presale / Staking / Referral screens show real on-chain state

## Stage C — tiny real transactions (mainnet, small amounts)
> **Prerequisite:** `NOCTURA_FEE_TREASURY` must be a real address (currently
> `TODO_MAINNET_FEE_TREASURY`). Set the Squads multisig (or a temporary wallet you
> control) in `src/constants/programs.ts`, then request a rebuilt APK. Until then,
> transparent send will crash at transaction build.
- [ ] Send a tiny amount of SOL to yourself → status → appears in history
- [ ] Send a tiny amount of $NOC to yourself
- [ ] Minimal stake / unstake (if testing staking)
- [ ] Verify each on a Solana explorer

## Reporting issues
For any failure, capture: the on-screen error, and `adb logcat | grep -i noctura`
(or full logcat around the crash). Send it back for an iterative fix + rebuild.
