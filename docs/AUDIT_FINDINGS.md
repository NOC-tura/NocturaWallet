# Noctura Wallet — Full Codebase Audit

> Performed 2026-04-07. Three parallel audits: modules layer, UI layer, infrastructure.
> 503 tests passing, 213 source files, ~21,400 LOC, 32 screens + 2 placeholders.

---

## Priority 1: CRITICAL (Must fix before any production build)

### C-01: Backup key derivation — single SHA-256, no stretching
**File:** `src/modules/backup/backupModule.ts:12-14`
**Risk:** Exported .noctura backup files can be brute-forced at GPU speed. AES-256-GCM is production-grade but the key derivation is not — false sense of security.
**Fix:** Replace `deriveKey` with `pbkdf2Async(sha512, password, salt, {c: 600_000, dkLen: 32})` from `@noble/hashes` (already a dependency). Bump magic to `NOCTURA_BACKUP_V2`.

### C-02: SPL token transfer instruction missing
**File:** `src/modules/solana/transactionBuilder.ts:149-152`
**Risk:** `buildSPLTransferTx()` charges the fee but never adds the actual TransferChecked instruction. Tokens are NOT transferred. User loses SOL fees, recipient gets nothing.
**Fix:** Add `@solana/spl-token` and implement TransferChecked instruction. Add runtime guard `throw new Error('SPL transfer not implemented')` as a safety net until complete.

### C-03: Merkle hash uses XOR fold, not Poseidon
**File:** `src/modules/merkle/merkleModule.ts:23-36`
**Risk:** Root verification will always fail against real on-chain roots. All ZK proofs invalid.
**Fix:** Integrate `poseidon-lite` (add to package.json). Replace `hashPair()`. This is blocked on ZK circuit parameter alignment — see `docs/NATIVE_INTEGRATION_TODO.md` item 1.

### C-04: Zero-filled witnesses in shielded service
**File:** `src/modules/shielded/shieldedService.ts:88-103`
**Risk:** All Merkle paths and noteSecrets are zeros. ZK proofs are invalid. Notes are linkable (same zero secret). Blocked on native BLST integration + Merkle module.
**Fix:** Wire MerkleModule for real paths, derive noteSecret from sk_view via native bridge. Throw until native bridge available rather than silently using zeros.

### C-05: parseFloat for money in 3 shielded screens
**Files:** `src/screens/shielded/DepositScreen.tsx:30`, `ShieldedTransferScreen.tsx:40`, `WithdrawScreen.tsx:23`
**Risk:** `BigInt(Math.round(parseFloat(amount) * 1e9))` loses precision. Users send wrong amounts. Violates cardinal rule #2.
**Fix:** Replace with `parseTokenAmount(amount, 9)` from `src/utils/parseTokenAmount.ts`.

### C-06: parseFloat in BalanceCard
**File:** `src/components/BalanceCard.tsx:71`
**Risk:** Balance display inaccurate for large amounts (>9007 SOL). Erodes user trust.
**Fix:** Use `formatTokenAmount(BigInt(nocBalance), 9)` for display conversion.

### C-07: SendScreen missing debounce on confirm/review buttons
**File:** `src/screens/transparent/SendScreen.tsx:216, 255`
**Risk:** Double-tap can submit two transactions. Violates cardinal rule #6.
**Fix:** Add `lastTapRef` 500ms debounce guard (pattern already exists in shielded screens).

### C-08: Public key stored as hex, not base58
**File:** `src/screens/onboarding/SuccessScreen.tsx:61`
**Risk:** Every screen showing the public key displays hex instead of a valid Solana address. Users cannot receive funds. Deep links fail validation.
**Fix:** Use `bs58.encode(keypair.publicKey)`. Add `bs58` to dependencies or use `@solana/web3.js` PublicKey.toBase58().

### C-09: .env files tracked in git
**Files:** `.env.development`, `.env.production`
**Risk:** When real API keys are added, they will be committed to git history.
**Fix:** `git rm --cached .env.development .env.production`. Add `.env.example` as template.

### C-10: NOCTURA_FEE_TREASURY is 'TODO_MAINNET_FEE_TREASURY'
**File:** `src/constants/programs.ts:34`
**Risk:** `new PublicKey('TODO_MAINNET_FEE_TREASURY')` crashes at runtime. Every SOL/SPL send fails on mainnet.
**Fix:** Add real address. Add startup assertion: `if (NOCTURA_FEE_TREASURY.startsWith('TODO')) throw`.

### C-11: SSL pin placeholders
**File:** `src/modules/sslPinning/pinnedFetch.ts:10-13`
**Risk:** Either all API calls fail (invalid base64) or SSL pinning is disabled (MITM vulnerable).
**Fix:** Extract real SPKI pins from `api.noc-tura.io` before production.

### C-12: View key clipboard not auto-cleared
**File:** `src/screens/settings/ExportViewKeyScreen.tsx:58-59`
**Risk:** View key stays on clipboard indefinitely. Any app can read it.
**Fix:** Add 30-second auto-clear timer (pattern exists in SeedPhraseScreen).

### C-13: No session timeout enforcement
**File:** `src/app/Navigator.tsx` (global)
**Risk:** Wallet never auto-locks. SessionStore tracks expiry but nothing checks it.
**Fix:** Add AppState listener in App.tsx that checks `sessionStore.isExpired()` and navigates to Unlock.

### C-14: Missing FLAG_SECURE on shielded screens
**Files:** `src/screens/shielded/DepositScreen.tsx`, `ShieldedTransferScreen.tsx`, `WithdrawScreen.tsx`
**Risk:** Android screenshots capture shielded amounts and addresses, breaking privacy.
**Fix:** Add `ScreenSecurityManager.enableSecureScreen()` in useEffect on all shielded screens.

### C-15: Secure MMKV adapter silently drops writes before init
**File:** `src/store/mmkv/secureAdapter.ts:13-17`
**Risk:** Store mutations before `initSecureMmkv()` are silently lost. Data disappears on restart.
**Fix:** Queue writes for replay, or throw an error that surfaces to UI.

---

## Priority 2: IMPORTANT (Should fix before beta)

### I-01: getKeypair() doesn't check session expiry
**File:** `src/modules/session/sessionModule.ts:61-63`
**Fix:** Call `isActive()` inside `getKeypair()`, return null if expired.

### I-02: No biometric gate on retrieveSeed()
**File:** `src/modules/keychain/keychainModule.ts:30-35`
**Fix:** Add `accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE`.

### I-03: RPC calls not SSL-pinned
**File:** `src/modules/solana/connection.ts:4-5`
**Fix:** Document risk or use custom fetch with pinnedFetch for Helius endpoint.

### I-04: String zeroization ineffective in JS
**File:** `src/modules/zkProver/zkProverModule.ts:34-46`
**Fix:** Document as best-effort. Use Uint8Array throughout for sensitive data.

### I-05: Stub device token sent to backend
**File:** `src/modules/notifications/notificationModule.ts:91`
**Fix:** Return early if `this.deviceToken` is null. Never send stub token.

### I-06: addressBook importContacts — no schema validation
**File:** `src/modules/addressBook/addressBookModule.ts:100-121`
**Fix:** Validate each entry against Contact interface. Reject unexpected fields. Add max count.

### I-07: Deep link mnemonic rejection incomplete
**File:** `src/modules/deepLink/deepLinkModule.ts:53`
**Fix:** Also reject `seed`, `private_key`, `secret_key`, `sk_spend` params.

### I-08: getTokenAccounts uses wrong encoding
**File:** `src/modules/solana/queries.ts:36-63`
**Fix:** Use `getParsedTokenAccountsByOwner` as the comment suggests.

### I-09: Navigator route params unsafe cast
**File:** `src/app/Navigator.tsx:262, 294`
**Fix:** Add runtime validation or default values for route params.

### I-10: TransactionHistory → TransactionDetail navigation broken
**File:** `src/app/Navigator.tsx:279-284`
**Fix:** Implement cross-stack navigation to TransactionDetail.

### I-11: App update banner passes empty storeUrl
**File:** `src/app/Navigator.tsx:89-91`
**Fix:** Don't render banner until real URL available from version check.

### I-12: useDashboardBanners never receives updateAvailable=true
**File:** `src/hooks/useDashboardBanners.ts:14`
**Fix:** Derive from MMKV/store state inside the hook.

### I-13: Deprecated Clipboard API (5 files)
**Files:** SeedPhraseScreen, ReceiveScreen, TransactionDetailScreen, ReferralScreen, ShieldedAddressInput
**Fix:** Migrate to `@react-native-clipboard/clipboard`.

### I-14: Hardcoded MMKV key in SuccessScreen
**File:** `src/screens/onboarding/SuccessScreen.tsx:44`
**Fix:** Add to MMKV_KEYS constant, reference from there.

### I-15: 2 placeholder screens still in Navigator
**File:** `src/app/Navigator.tsx:49-53`
**Fix:** Implement ShieldedBalanceScreen. Wire AppUpdateModal component as screen.

### I-16: Staking/Presale buttons have no-op handlers
**Files:** `StakingScreen.tsx:128`, `PresaleScreen.tsx:52, 112`
**Fix:** Disable buttons or show "Coming soon" alert until Anchor integration.

### I-17: ChangePinScreen old PIN not cleared from ref
**File:** `src/screens/settings/ChangePinScreen.tsx:17`
**Fix:** Clear `currentPinRef.current = ''` after successful change.

### I-18: Deep links bypass auth — no session guard
**File:** `src/app/deepLinkConfig.ts`
**Fix:** Add auth guard in Navigator that redirects to Unlock if session inactive.

### I-19: discountBps naming misleading in feeEngine
**File:** `src/modules/fees/feeEngine.ts:70-75`
**Fix:** Rename to `discountPercent`, fix comment.

### I-20: npm audit CI always passes (|| true)
**File:** `.github/workflows/ci.yml:60`
**Fix:** Remove `|| true`. Use `--ignore` for specific known CVEs instead.

### I-21: Mock API_BASE domain wrong
**File:** `__mocks__/react-native-config.ts:1-8`
**Fix:** Change to `https://api.noc-tura.io/v1`.

### I-22: No test coverage gate in CI
**File:** `.github/workflows/ci.yml`, `jest.config.js`
**Fix:** Add `coverageThreshold: { global: { lines: 60 } }`.

### I-23: E2E tests lack navigation setup (4 files)
**Files:** `e2e/shieldedFlow.test.ts`, `sessionLock.test.ts`, `transparentSend.test.ts`, `backup.test.ts`
**Fix:** Add wallet setup helper and navigation steps.

### I-24: sessionStore ignores configured timeout
**File:** `src/store/zustand/sessionStore.ts`
**Fix:** Read timeout from secureSettingsStore instead of hardcoded 5 minutes.

### I-25: TransactionHistory USD uses nocUsdPrice for ALL tokens
**File:** `src/screens/transparent/TransactionHistoryScreen.tsx:62-77`
**Fix:** Use token-specific pricing.

### I-26: Missing transformIgnorePatterns for RN packages
**File:** `jest.config.js:21`
**Fix:** Add `react-native-gesture-handler|react-native-safe-area-context|react-native-screens`.

---

## Priority 3: MINOR (Polish before release)

### M-01: buildCloseAccountsTx allows closing unknown-mint accounts
`src/modules/tokens/tokenModule.ts:200-204` — Default to NOT closing.

### M-02: signAndSend error matching too broad
`src/modules/solana/signAndSend.ts:85-98` — Match specific error code.

### M-03: feeToUsd precision loss for large amounts
`src/modules/fees/feeEngine.ts:53-57` — Use BigInt division first.

### M-04: Analytics flush loses events on partial failure
`src/modules/analytics/analyticsModule.ts:43` — Re-add unsent events on catch.

### M-05: shieldedAddressCodec swallows original error
`src/modules/shielded/shieldedAddressCodec.ts:25-28` — Include original message.

### M-06: backgroundSync doesn't update NOC balance
`src/modules/backgroundSync/backgroundSyncModule.ts:30-31` — Extract from tokenAccounts.

### M-07: TransactionStatusScreen polling without cleanup
`src/screens/transparent/TransactionStatusScreen.tsx:42-43` — Add mounted ref check.

### M-08: Dashboard token list not virtualized
`src/screens/dashboard/DashboardScreen.tsx:116` — Use FlatList.

### M-09: sortTokens not memoized
`src/screens/dashboard/DashboardScreen.tsx:54` — Wrap in useMemo.

### M-10: useSettings subscribes to all fields
`src/store/zustand/useSettings.ts:4-8` — Use individual selectors.

### M-11: ConfirmSeedScreen allows re-tapping confirmed cells
`src/screens/onboarding/ConfirmSeedScreen.tsx:137` — Add disabled={isConfirmed}.

### M-12: BackupSettingsScreen no minimum password length
`src/screens/settings/BackupSettingsScreen.tsx:76-93` — Enforce 8+ chars.

### M-13: Devnet addresses are all TODO strings
`src/constants/programs.ts:7-33` — Add real devnet addresses or startup guard.

### M-14: Linking.openURL without .catch
`src/screens/transparent/TransactionStatusScreen.tsx:88` — Add catch.

### M-15: PriorityFeeToggle missing accessibilityLabel
`src/components/PriorityFeeToggle.tsx:23-27` — Add per-level labels.

### M-16: Shielded modal screens have no visible close button on Android
`src/app/Navigator.tsx:424-425` — Add close button for non-gesture platforms.

### M-17: SeedPhraseScreen grid assumes 24 words
`src/screens/onboarding/SeedPhraseScreen.tsx:77-89` — Dynamic row count.

### M-18: Sentry DSN declared but unused
`src/types/env.d.ts:7` — Remove until integrated or add TODO comment.

### M-19: TypeScript 6.0 stability concern
`package.json:65` — Consider pinning to ~5.8.x for production.

### M-20: Float fee percentages in TRANSPARENT_FEES
`src/constants/programs.ts:44-45` — Convert to basis points BigInt or document.

---

## Architecture Observations (What's Done Well)

- sk_spend NEVER touches JS — security boundary rigorously maintained
- BigInt for all monetary amounts (except the parseFloat violations noted above)
- EIP-2333 path choice (micro-key-producer, not @scure/bip32) is correct
- PIN hashing: PBKDF2-SHA512, 600K iterations, constant-time comparison
- Proof queue persistence in encrypted MMKV for crash safety
- Witness sanitization strips noteSecret before hosted prover
- Geo-fence fails open (warn, not block) on API errors
- Rate limiting with deduplication well-designed
- 503 tests with good coverage of critical crypto paths
- Error codes centralized and well-structured
- AES-256-GCM encryption for backup files (once KDF is fixed)
- Bech32m address encoding for shielded addresses
- Jupiter verified token list with 24h cache
