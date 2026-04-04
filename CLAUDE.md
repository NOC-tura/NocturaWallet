# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Noctura Wallet is a privacy-first, dual-mode (Transparent + Shielded) Solana mobile wallet for iOS and Android. Phase 1 (on-chain programs: presale, staking, airdrop, referral) is live on mainnet. This repo is **Phase 2: the mobile wallet** built with React Native 0.84.1 (New Architecture / Fabric / Hermes).

The codebase is currently at scaffold stage — the RN project is initialized but `src/` and application code have not been created yet. The full architectural specification lives in `.instructions.md` (4,300+ lines).

## Common Commands

```bash
# Development
npx react-native start              # Start Metro bundler
npx react-native run-ios            # Build and run on iOS simulator
npx react-native run-android        # Build and run on Android emulator

# Quality
npx eslint .                        # Lint entire project
npx jest                            # Run all tests
npx jest --testPathPattern=<path>   # Run a single test file
npx tsc --noEmit                    # Type-check without emitting

# iOS native
cd ios && bundle exec pod install    # Install CocoaPods dependencies

# Android native
cd android && ./gradlew assembleDebug  # Build Android debug APK
```

## Architecture

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.84.1+ (New Architecture mandatory) |
| Language | TypeScript 5.x, strict mode, no `any`, no `@ts-ignore` |
| State | Zustand (persisted via MMKV) + TanStack Query v5 |
| Storage | react-native-mmkv (encrypted, schema-versioned with `v1_` prefixes) |
| Navigation | React Navigation v7 (native-stack + bottom-tabs) |
| Styling | NativeWind v4 (Tailwind CSS for React Native) |
| Animations | React Native Reanimated v3 |
| Solana | @solana/web3.js >= 1.95.8 (locked — 1.95.6/1.95.7 had supply chain incident) |
| Key Derivation | @scure/bip32 (Ed25519 only) + micro-key-producer/bls.js (EIP-2333 for BLS12-381) |
| Crypto | @noble/curves, @noble/hashes, poseidon-lite (ZK hashing) |
| ZK Proofs | @callstack/polygen (AOT WASM) + hosted prover fallback |
| Secure Storage | react-native-keychain + custom native modules (iOS Secure Enclave / Android Keystore) |

### Planned Source Structure (`src/`)

- `app/` — Root component, Navigator (RootStack, MainTabs, OnboardingStack), AppProviders
- `screens/` — Onboarding, Dashboard, Transparent (Send/Receive/History), Shielded, Presale, Staking, Settings
- `components/` — Reusable UI (Button, Card, Input, Modal) + domain components (BalanceCard, TokenRow, ModeToggle)
- `modules/` — Core business logic: keychain, keyDerivation, solana (RPC/tx builder), tokens, shielded, zkProver, fees, geoFence, session, backup, notifications
- `store/` — Zustand stores (wallet, session, settings, presale, shielded) + MMKV adapter + migrations
- `hooks/` — Custom hooks (useNetworkStatus, useSessionTimeout, etc.)
- `api/` — Noctura backend client
- `constants/` — Program IDs, MMKV keys, error codes
- `utils/` — Helpers (cn, haptics, parseTokenAmount, formatAddress)

### Key Derivation Paths

- **Transparent (Ed25519):** `m/44'/501'/0'/0'` via @scure/bip32
- **Shielded (BLS12-381 EIP-2333):** `m/12381/371/{1,2,3}/index` via micro-key-producer/bls.js
  - Do NOT use @scure/bip32 for BLS12-381 — BIP-32 is invalid for this curve

### Security Boundaries

- `sk_spend` (shielded spend key) NEVER touches JavaScript — derivation and signing happen in native only (iOS Secure Enclave / Android Keystore)
- `sk_view` and disclosure keys are allowed in JS (read-only operations)
- iOS Secure Enclave supports only P-256 — used for envelope encryption key (P-256 ECDH -> AES -> encrypt seed), not direct Ed25519/BLS signing

### Mainnet Constants

- **NOC_MINT:** `B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW`
- **NOC_DECIMALS:** 9
- **PROGRAM_ID:** `6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt`
- **RPC:** Helius (API key via .env / react-native-config)

### Polyfill Bootstrap Order (index.js)

These must load before any other imports:
1. `react-native-get-random-values` — crypto.getRandomValues()
2. `react-native-url-polyfill/auto` — URL API
3. `text-encoding` — TextEncoder / TextDecoder

## Cardinal Rules

1. **No placeholders** — every function fully implemented, `// TODO` is never acceptable
2. **Integer cents for money** — all token amounts as BigInt (lamports/smallest unit), never floats
3. **UTC everywhere** — local time conversion only at UI layer
4. **sk_spend NEVER in JS** — shielded spend key stays in native secure boundary
5. **TypeScript strict** — no `any`, no `@ts-ignore`
6. **No double-submit** — all send/sign buttons debounce 500ms minimum, disable on tap
7. **One decision per question** — pick most secure default, document reasoning

## Configuration Notes

- **New Architecture** is enabled on both platforms (Hermes + Fabric)
- **Android:** minSdk 24, targetSdk 36, Kotlin 2.1.20
- **Node:** >= 22.11.0 required
- **License:** BSL 1.1 (converts to MIT on 2034-01-01)
- **Prettier:** single quotes, trailing commas, no parens on single arrow params
- Babel needs NativeWind and Reanimated plugins (in specific order per .instructions.md)
- OTA updates must be DISABLED in eas.json
