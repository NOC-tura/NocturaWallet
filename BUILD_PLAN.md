# Noctura Wallet — Build Plan v1.0

> Obra Superpowers workflow za implementacijo noctura-wallet-superpowers-prompt-v1.9.md
> 35 implementation stepov, 15 worktree skupin, ~128+ verification checks.

---

## PRED ZAČETKOM (enkratna priprava)

```
1. Naloži Obra Superpowers plugin v VS Code
   Extensions → Obra Superpowers → Install

2. Ustvari nov React Native projekt:
   npx @react-native-community/cli init NocturaWallet --version 0.84.1
   cd NocturaWallet
   git init && git add -A && git commit -m "Initial RN 0.84.1 scaffold"

3. Kopiraj noctura-wallet-superpowers-prompt-v1.9.md → .instructions.md v root projekta
   cp ~/Downloads/noctura-wallet-superpowers-prompt-v1.9.md ~/NocturaWallet/.instructions.md

4. Odpri folder v VS Code:
   code ~/NocturaWallet

5. Preveri da Obra vidi .instructions.md:
   → Obra status bar mora prikazati "Instructions loaded"

6. Repo strategija (PO KONČANI IMPLEMENTACIJI — ne pred):
   Zgradi vse v enem projektu (vseh 35 stepov).
   Ko je koda pripravljena, razdeli v 2 GitHub repoja:

   noctura-wallet/ (PUBLIC, BSL 1.1 licenca)
     src/screens/, src/components/, src/constants/, src/hooks/,
     src/modules/tokens/, src/modules/geo/, src/navigation/

   noctura-core/ (PRIVATE)
     src/modules/keychain/, src/modules/zkProver/, src/modules/shielded/,
     src/modules/session/, src/crypto/, native/ios/, native/android/

   Pravilo: vse kar se dotika private keyev, seed phraseov,
   ZK proofov ali native secure storage → PRIVATE repo.
   Public repo importa noctura-core kot npm git dependency.
```

---

## OBRA WORKFLOW — PONOVLJIV CIKEL ZA VSAK WORKTREE

```
Za vsak worktree skupino (1-15) ponovi ta cikel:

┌─────────────────────────────────────────────────────────────┐
│  1. using-git-worktrees                                     │
│     → Kreira branch + izoliran workspace                    │
│     → Zaženi project setup, preveri da testi pašejo         │
│                                                             │
│  2. writing-plans                                           │
│     → Pošlji STEP PROMPT iz tega dokumenta                  │
│     → Obra razbije v 2-5 minutne taske                      │
│     → Preglej plan, approve                                 │
│                                                             │
│  3. executing-plans / subagent-driven-development            │
│     → Obra izvaja task po task                               │
│     → Za crypto/logiko module: test-driven-development       │
│       (RED → GREEN → REFACTOR za vsak task)                 │
│                                                             │
│  4. requesting-code-review                                  │
│     → Review proti .instructions.md spec                    │
│     → Critical → fix pred nadaljevanjem                     │
│                                                             │
│  5. finishing-a-development-branch                           │
│     → Preveri teste, merge v main                           │
│     → Zaženi verification checklist                         │
│     → TypeScript compile = 0 errors                         │
│     → npm audit = clean                                     │
│     → Cleanup worktree                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## BRAINSTORMING (enkrat, pred Step 1)

```
Vklopi: brainstorming

Prompt:
  "Review my system prompt in .instructions.md. This is a privacy-first
   dual-mode Solana wallet (React Native 0.84+) with 35 implementation steps.
   The core features are:
   - Transparent mode (standard Solana SPL transfers)
   - Shielded mode (Groth16/BN254 ZK proofs, Poseidon hashing, BLS12-381 keys)
   - Live Phase 1 presale/staking/referral program integration
   - Privacy-safe push notifications, analytics, geo-fence

   Ask me questions to validate the architecture before we start Step 1.
   Focus on: crypto primitives, ZK circuit assumptions, native bridge
   boundaries, and any ambiguities in the spec."

→ Odgovori na Obra vprašanja
→ Shrani design document
→ POTEM začni s prvim worktree-jem
```

---

## WORKTREE SKUPNE + STEP PROMPTI

---

### WORKTREE 1: `step-01-02/scaffold`
**Branch:** `feature/step-01-02-scaffold`
**Steps:** 1, 2
**TDD:** Ne (scaffold)
**Estimated tasks po writing-plans:** ~15-20

#### Step 1 prompt za Obra:

```
Build Step 1 — Project scaffold. Follow the system prompt (.instructions.md) exactly.

Create the full RN 0.84.1 project with TypeScript strict mode, including ALL of the following:

1. react-native-config setup:
   - .env.development (devnet endpoints)
   - .env.production (mainnet endpoints)
   - env.d.ts (TypeScript declarations for Config.HELIUS_RPC_URL etc.)

2. NativeWind v4 setup:
   - npm install nativewind tailwindcss
   - tailwind.config.js with Noctura design tokens (all colors from Design System section)
   - babel.config.js with NativeWind babel plugin (Reanimated plugin LAST)

3. AppProviders.tsx — exact wrapper order:
   GestureHandlerRootView → SafeAreaProvider → QueryClientProvider → NavigationContainer

4. Navigator.tsx:
   - RootStack (Onboarding, MainTabs, Unlock, modal screens)
   - MainTabs with 4 tabs: Home, Send, Receive, Settings
   - FAB Mode Toggle overlay for Transparent ↔ Shielded
   - Custom tab bar component

5. All 5 Zustand stores with TypeScript interfaces:
   - walletStore (address, balances as string for BigInt, tokens)
   - sessionStore (NO persist — security, keypair metadata must not survive restart)
   - settingsStore (all settings from MMKV_KEYS)
   - presaleStore (stage info, allocation, TGE status)
   - shieldedStore (mode, shielded balances, sync state)

6. MMKV persist adapter:
   - Encryption key derived from keychain (not hardcoded)
   - Schema version support

7. src/constants/mmkvKeys.ts:
   - ALL keys from the MMKV Key Registry section in the spec
   - Every key with v1_ prefix (except SCHEMA_VERSION)
   - Organized by category with comments

8. cn() utility function for conditional NativeWind classes

9. src/constants/programs.ts:
   - IS_DEVNET toggle
   - NOC_MINT, PROGRAM_ID, ADMIN_ADDRESS, SOL_TREASURY with devnet fallbacks
   - NOCTURA_FEE_TREASURY (separate Squads multisig for fee collection)

Use the exact file paths from the PROJECT STRUCTURE section in the spec.
```

#### Step 2 prompt za Obra:

```
Build Step 2 — Polyfill bootstrap.

Create index.js with exact import order (CRITICAL — wrong order = crypto crashes):
  1. react-native-get-random-values (FIRST — before anything that uses crypto)
  2. react-native-url-polyfill/auto (SECOND)
  3. text-encoding (TextEncoder/TextDecoder polyfill) (THIRD)
  4. Then import App

Follow the polyfill bootstrap spec from .instructions.md exactly.
Verify: import order must match the spec — no exceptions.
```

---

### WORKTREE 2: `step-03-04/foundation`
**Branch:** `feature/step-03-04-foundation`
**Steps:** 3, 4
**TDD:** Da (hook logic)
**Estimated tasks:** ~10-12

#### Step 3 prompt za Obra:

```
Build Step 3 — Error taxonomy.

Create src/constants/errors.ts with ALL ~41 error codes from the ERROR TAXONOMY
section in .instructions.md. Every error MUST have:
  - code: string (E001-E151)
  - message: string (user-friendly, no technical jargon)
  - action: string (what user should do)

Categories to include:
  - Network: E001-E003
  - Balance: E010-E013
  - Transaction: E020-E024
  - ZK Proof: E030-E032
  - Auth/Security: E040-E042
  - Geo/Compliance: E050-E051
  - Backup: E060-E062
  - Staking: E070-E071
  - App Version: E080
  - Note Consolidation: E090
  - Presale/TGE: E100-E106
  - Shielded Address: E110
  - PIN: E120-E121
  - Referral: E140-E141
  - Sync: E150-E151

Export as ERROR_CODES const object with TypeScript types.
Copy every code, message, and action string EXACTLY from the spec.
```

#### Step 4 prompt za Obra:

```
Build Step 4 — Network status hook.

Create useNetworkStatus() hook using @react-native-community/netinfo.
Include OfflineBanner component following the spec:
  - Persistent banner: "Offline — showing data from [lastSyncedAt]"
  - Dashboard: disable send button + tooltip "No internet connection"
  - Shielded: "Offline — balance shown from last sync"
  - Proof gen: skip hosted prover → queue for retry
  - Auto-trigger forceSync() on reconnect

Follow the OFFLINE GRACEFUL DEGRADATION spec exactly.
```

---

### WORKTREE 3: `step-05-06-07/security-core`
**Branch:** `feature/step-05-06-07-security-core`
**Steps:** 5, 6, 7
**TDD:** Da (crypto MORA imeti test vectorje)
**Estimated tasks:** ~25-30

#### Step 5 prompt za Obra:

```
Build Step 5 — SSL certificate pinning.

Implement react-native-ssl-pinning for api.noc-tura.io:
  - Primary pin + backup pin
  - On pin failure → block API call + show network error to user
  - Follow Security Requirements section in .instructions.md

Note: there is no dedicated SSL error code in the error taxonomy.
Use NETWORK_OFFLINE (E001) or RPC_TIMEOUT (E002) as fallback error display
when SSL pinning fails, since the user-visible behavior is identical
(API call blocked → "Network unreachable").
```

#### Step 6 prompt za Obra:

```
Build Step 6 — Secure keychain + session key module.

Build the full KeychainModule interface from .instructions.md:
  - storeSeed, retrieveSeed (biometric required)
  - storeViewKey, retrieveViewKey
  - hasWallet, wipeKeys
  - signShieldedOp (BLS12-381 — native only, NEVER in JS)
  - getShieldedPublicKey (pk_shielded cached in JS after unlock)

PIN management:
  - setupPin, verifyPin, changePin
  - PBKDF2-SHA512, 600K iterations (OWASP 2024)
  - Salt: 32 random bytes
  - Cooldown: +30s after each 3rd incorrect PIN

Native bridges:
  - iOS: NocturaSecureEnclave.swift (P-256 envelope encryption ONLY)
  - Android: NocturaKeyStore.kt (BiometricPrompt + KeyStore)

⚠️  CRITICAL: sk_spend NEVER leaves native boundary.
    iOS Secure Enclave does NOT support BLS12-381 — use P-256 envelope encryption
    to wrap BLS keys (encrypt BLS key with SE-backed P-256 key).

Follow the Session Module spec for unlock/lock/timeout behavior.
```

#### Step 7 prompt za Obra:

```
Build Step 7 — Key derivation.

Transparent key derivation:
  - @scure/bip32 for Ed25519
  - Path: m/44'/501'/0'/0'
  - Output: Solana keypair (Ed25519)

Shielded key derivation (blsViewKeyDerivation.ts):
  - micro-key-producer/bls.js for EIP-2333 (⚠️ NOT bls12-381-keygen — deprecated)
  - View key path: m/12381/371/2/0
  - Disclosure key path: m/12381/371/3/index
  - ⚠️ NO spend key (m/12381/371/0/0) in JS — native only

  - View key (sk_view) may exist in JS memory (read-only, never logged)
  - Disclosure key used for selective transaction reveal to auditors

Include test vectors that verify:
  - Known mnemonic → known Ed25519 public key
  - Known mnemonic → known BLS12-381 view public key
  - View key derivation matches EIP-2333 spec

Follow blsViewKeyDerivation.ts spec from .instructions.md exactly.
```

---

### WORKTREE 4: `step-08/solana-rpc`
**Branch:** `feature/step-08-solana-rpc`
**Steps:** 8
**TDD:** Da
**Estimated tasks:** ~15-20

#### Step 8 prompt za Obra:

```
Build Step 8 — Solana RPC module.

Implement full SolanaModule interface from .instructions.md:

Connection:
  - getConnection() → Helius RPC (primary) + fallback public RPC
  - WebSocket for live updates (balance, tx confirmation) instead of polling

Queries:
  - getBalance(address)
  - getTokenAccounts(address) → getTokenAccountsByOwner
  - getTransactionHistory(address, { limit, before })

Transaction building:
  - buildTransferTx (SOL) — VersionedTransaction v0
  - buildSPLTransferTx (SPL tokens) — VersionedTransaction v0
  - Include createAssociatedTokenAccountInstruction when recipient has no ATA

Simulation:
  - simulateTransaction() MUST be called before EVERY confirm screen
  - Error mapping: InsufficientFunds → E010, AccountNotFound → E024, etc.
  - If simulation fails → BLOCK confirm button

Priority fees:
  - Helius getPriorityFeeEstimate API
  - Normal (50th percentile), Fast (75th), Urgent (90th)
  - Fallback: getRecentPrioritizationFees → compute locally

Signing:
  - signAndSend with blockhash expiry retry:
    1. getLatestBlockhash → assign → sign → send
    2. Poll confirmTransaction with lastValidBlockHeight
    3. If expired: NEW blockhash → NEW signature → re-send
    4. Max 3 retries, then throw TX_TIMEOUT (E022)
    ⚠️ Each retry needs NEW blockhash + NEW signature

  - Returns { signature, confirmationStatus } — not just signature

Relayer:
  - getRelayerLookupTables() → fetch from /v1/relayer/lookup-tables
  - Client does NOT create ALTs

Client-side rate limiting:
  - Max 10 concurrent RPC calls
  - Exponential backoff on 429: 1s → 2s → 4s → 8s (max 3 retries)
  - Request deduplication (same RPC call in queue → skip duplicate)
  - Batch JSON-RPC where possible
  - React Query cache: getBalance TTL 10s, token list 60s, tx history 30s

Rate limiting for expensive endpoints:
  - /v1/prove/*: max 1 concurrent, 3s cooldown between calls
  - /v1/relayer/submit: max 1 concurrent, 5s cooldown

Follow ALL specs from Solana RPC module section in .instructions.md.
```

---

### WORKTREE 5: `step-09-10-11/modules`
**Branch:** `feature/step-09-10-11-modules`
**Steps:** 9, 10, 11
**TDD:** Da (geo-fence logic, token trust logic)
**Estimated tasks:** ~18-22

#### Step 9 prompt za Obra:

```
Build Step 9 — Geo-fence module.

Implement GeoFenceModule with 3-tier soft-block policy:

  action: 'allow'  → normal access (unrestricted jurisdiction)
  action: 'warn'   → show warning, shielded accessible after acknowledgment
  action: 'block'  → OFAC sanctioned ONLY, shielded disabled, transparent works

VPN detection:
  - Mark as 'vpn_detected' → show warning + request KYC country
  - KYC country override via setKycCountry()

Restricted list:
  - Fetch from API_BASE/v1/geo/restricted-list (cache 6h in MMKV)
  - Fallback: locally bundled list (max 30 days old)

Check triggers:
  - App open
  - Shielded mode toggle

Fail-safe: if detection fails or ambiguous → 'warn' (NEVER silent block)
⚠️ This is SOFT-BLOCK — not hard-block. False positives must not brick wallet.

Follow the exact GeoFenceModule interface from .instructions.md.
```

#### Step 10 prompt za Obra:

```
Build Step 10 — Token module.

Implement 3-tier trust model:
  tier: 'core'     — NOC, SOL (wSOL), USDC, USDT — hardcoded, always shown
  tier: 'verified' — Jupiter "strict" list (verified badge, cache 24h)
  tier: 'unknown'  — other SPL tokens with balance → ⚠️ "Unverified token"

Token metadata:
  - Fetch from Jupiter verified token list (cache 24h)
  - Fallback to on-chain metadata
  - Scam flag check: GET API_BASE/v1/tokens/flagged?mint=... (cache 1h)
  - If flagged scam: ⛔ icon + disable send (user can explicit override)

Auto-detection:
  - On wallet open: getTokenAccountsByOwner → parse all accounts
  - Filter: show balance > 0 (toggle in settings: SETTINGS_HIDE_ZERO_BALANCE)
  - NOC always pinned at top regardless of balance

Close empty token accounts (rent reclaim):
  - Settings → Advanced → "Close empty token accounts"
  - Fetch all accounts with balance === 0n, exclude 'core' tier
  - Show: "N empty accounts found — reclaim ~X.XXX SOL"
  - Build closeAccount() instructions (batch max 20 per tx)
  - ⚠️ NEVER close NOC ATA even if balance is 0

Follow TokenMetadata interface from .instructions.md.
```

#### Step 11 prompt za Obra:

```
Build Step 11 — Device integrity check + ScreenSecurity native module.

Jailbreak/root detection:
  - Use react-native-jail-monkey (or custom native check)
  - Policy: WARN, NOT BLOCK (false positives = bricked wallet)
  - Flow:
    1. App start → check jailbreak
    2. If detected: MMKV SECURITY_JAILBREAK_DETECTED = true
    3. Continue normally (do not block)
    4. UnlockScreen: show warning below PIN pad
    5. Settings → Security: persistent warning card
    6. Shielded mode toggle: require explicit acknowledgment
  - Log event: device_integrity_warning (no device ID)

Android FLAG_SECURE native bridge:
  - ScreenSecurity.kt: enableSecureScreen() / disableSecureScreen()
  - Blocks screenshots on sensitive screens (seed phrase, import, view key export)
  - React Native bridge module

iOS screen capture detection:
  - UIScreen.main.isCaptured — detection only (Apple doesn't allow hard block)
  - On capture detected → blur sensitive content + show warning

Follow exact flow spec from .instructions.md Security Requirements section.
```

---

### WORKTREE 6: `step-12-13/entry-screens`
**Branch:** `feature/step-12-13-entry-screens`
**Steps:** 12, 13
**TDD:** Ne (UI screens)
**Estimated tasks:** ~12-15

#### Step 12 prompt za Obra:

```
Build Step 12 — Splash screen navigator + App Update check.

SplashScreen.tsx:
  - resolveSplashRoute() async function:
    1. walletExists? → if no → 'Onboarding'
    2. sessionActive? → if yes → 'MainTabs'
    3. Else → 'Unlock'
  - UI: Noctura shield logo centered, loading pulse animation, max 1.5s display
  - Check MMKV flags: WALLET_EXISTS, ONBOARDING_COMPLETED, SESSION_LAST_ACTIVE,
    APP_FORCE_UPDATE_REQUIRED
  - ⚠️ Always use MMKV_KEYS.* constants (never hardcoded strings)

App Update check:
  - On startup: GET /v1/app/version-check?platform=ios|android&version=X.Y.Z
  - Response handling:
    'ok' → nothing
    'update_available' → AppUpdateBanner (dismissable, low priority on dashboard)
    'update_required' → AppUpdateModal (BLOCKING, no dismiss, must update)
    network error → SKIP check (never block app on failed version check)

  - AppUpdateModal: full-screen overlay, Noctura logo, "Update required",
    single CTA "Update now" → open App Store / Play Store
  - AppUpdateBanner: bottom dashboard banner, X dismiss (session only)
  - MMKV: APP_FORCE_UPDATE_REQUIRED = true until user updates

Follow exact specs from .instructions.md.
```

#### Step 13 prompt za Obra:

```
Build Step 13 — UnlockScreen.

UI (centered, dark bg):
  - Noctura logo + "Welcome back" (18px/700)
  - Truncated wallet address (12px monospace, muted)

Primary: Biometric auto-trigger on screen mount
  - iOS: FaceID / TouchID system dialog
  - Android: Fingerprint / FaceUnlock system dialog
  - On success: SessionModule.unlockSession() → navigate Dashboard

Fallback: "Use PIN instead" link (always visible)
  - 6-digit custom PIN pad (NOT system keyboard)
  - Error shake on incorrect PIN
  - After 5 failures: "Too many attempts. Wait 30 seconds." (cooldown timer)
  - Cooldown countdown displayed

Bottom: "Lost access? Restore wallet →"
  - → ImportWallet flow (mnemonic)
  - Show warning: "You will need your 24-word recovery phrase"

Error handling:
  - E040 (BIOMETRIC_FAILED) → show PIN option (not auto-redirect)
  - E041 (BIOMETRIC_NOT_ENROLLED) → directly show PIN pad

reason prop: 'session_expired' | 'app_foreground' | 'manual_lock'

Follow exact UnlockScreen spec from .instructions.md.
```

---

### WORKTREE 7: `step-14/onboarding`
**Branch:** `feature/step-14-onboarding`
**Steps:** 14
**TDD:** Da (seed validation, PIN logic)
**Estimated tasks:** ~25-35 (velik step — Obra bo razbil v veliko malih taskov)

#### Step 14 prompt za Obra:

```
Build Step 14 — All onboarding screens. This is a large step.
Follow EVERY KORAK in the Onboarding Flow section of .instructions.md.

Screens to build (exact order):

KORAK 2 — WelcomeScreen:
  - Noctura logo + "Welcome to Noctura" + subtitle
  - "Create new wallet" (primary) + "Import existing wallet" (ghost)
  - NO "Learn more" link (dead end)

KORAK 3 — SecurityIntroScreen:
  - "Your wallet, your responsibility" title
  - 3 bullet points with ❗ warnings about recovery phrase
  - Checkbox (MANDATORY): "I understand and accept responsibility"
  - CTA "Continue" DISABLED until checkbox checked
  - MMKV: MMKV_KEYS.ONBOARDING_SECURITY_ACK = true

KORAK 4 — CreateWalletScreen:
  - generateMnemonic(256) → 24 words (@scure/bip39)
  - Store in memory ONLY (not MMKV, not keychain yet)
  - Loading spinner, max 1s

KORAK 5 — SeedPhraseScreen:
  - 3×8 grid, all BLUR 8px default
  - Tap cell → reveal that word only
  - Android: FLAG_SECURE (ScreenSecurityModule.enableSecureScreen())
  - iOS: UIScreen.isCaptured detection → blur on capture
  - Clipboard copy: warning + auto-wipe after 30s
  - Warnings visible, not dismissable
  - CTA "I've written them down"
  - MMKV: MMKV_KEYS.ONBOARDING_SEED_DISPLAYED = true

KORAK 6 — ConfirmSeedScreen:
  - 3 random word positions (e.g., #3, #7, #11)
  - Shuffled word grid, user taps in order
  - Correct → green ✓ → Next
  - Incorrect → "Incorrect — try again" + shake animation
  - After 3 failures → back to KORAK 5
  - MMKV: MMKV_KEYS.ONBOARDING_SEED_CONFIRMED = true

KORAK 7 — SetPinScreen:
  - 6-digit custom PIN pad (not system keyboard)
  - Enter PIN → dot indicators → Confirm PIN
  - Mismatch → "PINs don't match — try again"
  - PBKDF2-SHA512, 600K iterations, 32-byte random salt

KORAK 8 — BiometricSetupScreen:
  - FaceID/Fingerprint icon
  - "Enable" (primary, recommended) | "Skip for now" (ghost)
  - Skip → PIN is sole unlock method

KORAK 9 — SuccessScreen:
  - Animated checkmark (green circle draw-in)
  - "Wallet created! 🎉"
  - CTA: "Enter wallet"
  - ⚠️ CRITICAL: on CTA tap:
    1. Save mnemonic to keychain (encrypted, biometric protected)
    2. Derive Ed25519 keypair + BLS12-381 view key
    3. Initialize Zustand stores
    4. MMKV: MMKV_KEYS.ONBOARDING_COMPLETED = true
    5. Navigate → PresaleScreen (KORAK 10A)
  - Mnemonic saved to keychain ONLY here (not before)

KORAK 10A — PresaleScreen (3 states):
  - State A: Presale active (buy NOC, stage info, progress bar)
  - State B: Post-TGE claim available (claim allocation)
  - State C: Fully claimed / presale ended
  - Connect to live PROGRAM_ID on mainnet
  - Follow full TGE claim flow spec from .instructions.md

Import flow:
  KORAK 3 — ImportSeedScreen:
    - 12/24 word input (word by word or paste)
    - BIP-39 validation: checksum + wordlist (inline, not on submit)
    - FLAG_SECURE active
  KORAK 4 — SyncWalletScreen:
    - Animated loading steps (derive keys → balances → staking → history)
    - Max 5s timeout → Dashboard anyway
    - Merkle sync in background (don't block UI)
  KORAK 5 — Cloud Backup Restore:
    - Check iCloud/Google Drive for backup by SHA-256(publicKey)
    - Found → offer restore
    - Not found → skip

PrivacyExplainerScreen:
  - Show on FIRST Shielded mode toggle
  - "Privacy Mode" explanation (no ZK jargon)
  - "Learn more" + "Got it →" buttons

Referral code input:
  - Optional during onboarding
  - One-time only, stored in MMKV_KEYS.REFERRAL_CODE_APPLIED
```

---

### WORKTREE 8: `step-15-16/dashboard`
**Branch:** `feature/step-15-16-dashboard`
**Steps:** 15, 16
**TDD:** Ne (UI)
**Estimated tasks:** ~15-20

#### Step 15 prompt za Obra:

```
Build Step 15 — BackupReminderBanner component.

Show conditions:
  - MMKV_KEYS.ONBOARDING_SEED_CONFIRMED === false (or doesn't exist)
  - AND MMKV_KEYS.ONBOARDING_COMPLETED === true

Position: between ModeToggle and BalanceCard on Dashboard

UI:
  - bg: rgba(251,191,36,0.08), border: 0.5px rgba(251,191,36,0.25)
  - border-radius: 12px, padding: 10px 14px
  - Row: ⚠️ icon + "Back up your wallet" + → arrow
  - Sub: "Your funds are at risk without a recovery phrase backup"

Dismiss behavior:
  - ❌ NO permanent dismiss
  - ✅ Session dismiss only (MMKV_KEYS.BACKUP_DISMISSED_SESSION = true)
  - After 3 session dismisses → remove X button (becomes permanent)

Priority: BackupReminderBanner > OfflineBanner > AppUpdateBanner
  ⚠️ Never show 2 banners simultaneously

Tap → SeedPhraseBackupFlow (abbreviated, no onboarding context)
  → Security intro → Show seed → Confirm seed → "Wallet backed up ✓"
  → MMKV_KEYS.ONBOARDING_SEED_CONFIRMED = true → banner disappears

Follow exact spec from .instructions.md.
```

#### Step 16 prompt za Obra:

```
Build Step 16 — Dashboard + background sync.

Dashboard layout (EXACT vertical order):
  1. StatusBar
  2. WalletChip header (address + copy)
  3. ModeToggle [Transparent | Private]
  4. BackupReminderBanner (CONDITIONAL)
  5. OfflineBanner (CONDITIONAL)
  6. AppUpdateBanner (CONDITIONAL)
  7. BalanceCard [Mode=current, ShowChange=true]
  8. QuickActions [Send, Receive, Stake, Swap(disabled)]
  9. SectionHeader "Tokens" + "Manage" link
  10. TokenRow [NOC — Pinned, ShowStaking, ShowUnlock]
  11. StakingUnlockRow (CONDITIONAL — unlock < 7 days)
  12. TokenRow [SOL]
  13. TokenRow [USDC]
  14. [other SPL by USD value]
  15. BottomNav + FAB center (Mode Toggle)

Banner priority (never show 2):
  1. BackupReminderBanner (highest)
  2. OfflineBanner
  3. AppUpdateBanner (lowest)

Swap button (disabled):
  - 50% opacity + lock icon
  - On tap: bottom sheet "Token Swap — Coming Soon" + [Got it] dismiss
  - Do NOT navigate anywhere

BackgroundSyncModule:
  - iOS: BGTaskScheduler (battery-safe, ~15min minimum)
  - Android: WorkManager (periodic, 15min minimum)
  - Syncs: SOL balance, NOC + key SPL balances, pending tx confirmations,
    staking rewards
  - Does NOT sync: shielded notes (foreground only), full tx history, ZK proofs
  - On foreground: immediate sync + WebSocket subscription

Pull-to-refresh: trigger forceSync()
⚠️ iOS BGTaskScheduler is secondary — foreground sync on app open is PRIMARY.

Follow all Dashboard specs from .instructions.md.
```

---

### WORKTREE 9: `step-17-18-19-20/transactions`
**Branch:** `feature/step-17-20-transactions`
**Steps:** 17, 18, 19, 20
**TDD:** Da (amount parsing, tx building)
**Estimated tasks:** ~25-30

#### Step 17 prompt za Obra:

```
Build Step 17 — Staking screen.

Connect to live mainnet PROGRAM_ID (unified program).

Current position (if staking exists):
  - Locked amount + tier + unlock date
  - Accrued rewards
  - [CLAIM REWARDS] [EXTEND LOCK] buttons

New stake:
  - Amount input (BigInt, string-based parsing)
  - Tier selector: [90d — 34% APY] [182d — 68% APY] [365d — 128% APY]
  - Projected reward calculator
  - [STAKE] CTA

Presale buyer badge:
  - "Zero-fee eligible — 18 months remaining"
  - Check isZeroFeeEligible from MMKV/on-chain

Staking tier → fee discount display:
  - Show current tier's NOC fee discount (10/20/30%) in badge
  - "Your 365d stake gives you 30% off private transaction fees"

⚠️  Post-presale: 3-layer staking architecture documented in .instructions.md.
    Layer 1 (Holder Staking) ships at TGE with hybrid yield (emissions + fees).
    Layers 2-3 (LP + Protocol) are Phase 4-5; prepare modular contract interface.

Follow Staking Screen + Post-Presale Staking Architecture spec from .instructions.md.
```

#### Step 18 prompt za Obra:

```
Build Step 18 — Transparent send screen.

Fields:
  - Recipient address: paste / QR scan / address book autocomplete
    QR validation:
      - Valid Solana address (Base58, 32-44 chars) → use
      - Solana Pay URI: solana:<addr>?amount=...&spl-token=... → pre-fill
      - Noctura shielded (noc1...) → redirect to Shielded Transfer
      - Invalid QR → E024 + "Scan again"
      - Non-Solana → "This is not a Solana address"

  - Token selector (NOC / SOL / other SPL)

  - Amount input:
    ⚠️ String-based BigInt parsing — NEVER parseFloat!
    "1.5" → split(".") → padEnd(decimals) → BigInt
    NOC (9 decimals): "1.5" → BigInt("1500000000")
    MAX button: balance - estimatedFee (BigInt arithmetic)

  - Priority fee toggle (Normal / Fast / Urgent)

SPL token account check:
  - Before simulation: check if recipient has ATA for selected token
  - If no ATA: show warning about 0.00203 SOL rent for account creation
  - User confirms → include createAssociatedTokenAccountInstruction

Pre-send confirmation (ONLY if simulation passes):
  - From, To, Amount (token + USD), Network fee (SOL + USD — includes Noctura
    0.00002 SOL markup, shown as single combined line), Account creation
    fee (if ATA created)
  - CONFIRM button disabled until simulation passes
  - After tap: disabled (no double-submit)

Post-send:
  - navigate('TransactionStatusScreen', { signature, amount, recipient, token })
  - Do NOT show explorer link on send screen

Follow all Send screen specs from .instructions.md.
```

#### Step 19 prompt za Obra:

```
Build Step 19 — TransactionStatusScreen.

4 states with distinct UI:

1. PENDING:
   - Animated pulse circle (accent color)
   - "Transaction submitted" + "Waiting for Solana confirmation..."
   - Truncated tx hash + "View on Solscan →" link
   - Back button ALLOWED (tx already submitted)
   - Poll getSignatureStatus every 500ms

2. SUCCESS (confirmed | finalized):
   - Green checkmark circle (animated draw-in, 400ms spring)
   - "Sent!" + amount + recipient
   - "View on Solscan →" link
   - "+ Add to contacts" (if address not in address book)
   - "Back to dashboard" CTA

3. FAILED:
   - Red X circle
   - "Transaction failed" (danger color)
   - User-friendly error from ERROR_CODES (NEVER raw RPC error)
   - "Try again" → back to Send (pre-filled)
   - "Back to dashboard" ghost

4. TIMEOUT (E022):
   ⚠️ Do NOT show "failed" — tx may have gone through
   - Amber warning icon (not red)
   - "Transaction status unknown"
   - "Check Activity tab for status"
   - "View on Solscan →" link
   - "Back to dashboard" CTA

Polling logic:
  MAX_ATTEMPTS = 120 (120 × 500ms = 60s, matches signAndSend timeout)
  confirmed → SUCCESS
  err → FAILED
  120 attempts reached → TIMEOUT

Follow exact spec from .instructions.md.
```

#### Step 20 prompt za Obra:

```
Build Step 20 — Transparent receive screen.

  - QR code displaying wallet address
  - Address text (monospace, copyable) with copy button
  - ⚠️ Clipboard auto-clear after 30s (matches seed phrase timing)
  - Token selector (same address for all SPL on Solana)
  - Share button (native share sheet)

Follow Transparent Receive Screen spec from .instructions.md.
```

---

### WORKTREE 10: `step-21-22-23/social`
**Branch:** `feature/step-21-23-social`
**Steps:** 21, 22, 23
**TDD:** Da (address book logic)
**Estimated tasks:** ~15-18

#### Step 21 prompt za Obra:

```
Build Step 21 — Address book module.

Implement AddressBookModule interface:
  - addContact, removeContact, updateContact
  - getContacts, findByAddress, findByName (partial match)

Contact interface:
  - id (UUID, locally generated)
  - name (user-defined label)
  - address (Solana transparent OR Noctura shielded)
  - addressType: 'transparent' | 'shielded'
  - memo (optional)
  - lastUsedAt (UTC timestamp, for recency sort)
  - createdAt (UTC timestamp)

Storage: MMKV encrypted, prefix MMKV_KEYS.ADDRESS_BOOK_PREFIX ('v1_contacts_')
⚠️ NEVER sync to server — local only.

Send screen integration:
  - Autocomplete from address book on recipient input
  - On successful send: "Add to contacts?" prompt (if address not saved)

Import/export: encrypted .noctura-contacts file (same format as backup)

Follow exact spec from .instructions.md.
```

#### Step 22 prompt za Obra:

```
Build Step 22 — Transaction history screen.

Filters: All | Sent | Received | Shielded | Staking

Each row:
  - Icon (send/receive/shielded/stake)
  - Label + truncated address
  - Amount ± in token + USD at time of tx
  - Date/time (local timezone)
  - Status badge (Confirmed / Pending / Failed)

Tap → TransactionDetailScreen (explorer link + full details)

Data source:
  - getTransactionHistory from SolanaModule
  - Shielded: local note store (NoteStore)
  - Staking: on-chain program data

Follow Transaction History Screen spec from .instructions.md.
```

#### Step 23 prompt za Obra:

```
Build Step 23 — Referral screen.

Connect to live PROGRAM_ID (unified program — referral is part of same program).

MY REFERRAL CODE card:
  - Code: generated from wallet address hash (e.g., "NOC-A7X2")
  - Share button: native share sheet
  - Copy button

REFERRAL STATS:
  - "Referrals: N friends joined"
  - "Rewards earned: X NOC ≈ $Y"
  - "Pending rewards: X NOC (unlock after 90 days)"

APPLY REFERRAL CODE:
  - Input field + "Apply code" CTA
  - ⚠️ One-time only, new wallets only
  - MMKV: MMKV_KEYS.REFERRAL_CODE_APPLIED

On-chain data from PROGRAM_ID (not from API — decentralized).
Referral bonus: 10% one-time on first purchase.

Access: Settings → "Referral program" OR deep link noctura://ref/<code>

Follow exact spec from .instructions.md.
```

---

### WORKTREE 11: `step-24-25/links-backup`
**Branch:** `feature/step-24-25-links-backup`
**Steps:** 24, 25
**TDD:** Da (deep link parsing, backup encryption)
**Estimated tasks:** ~15-18

#### Step 24 prompt za Obra:

```
Build Step 24 — Deep link module.

URI scheme: noctura://
Universal Links: https://noc-tura.io/wallet/...

Supported link types:

  noctura://pay?to=<address>&amount=<number>&token=NOC
    → Open Send screen, pre-filled. User MUST confirm (never auto-send).

  noctura://receive
    → Open Receive screen

  noctura://stake?amount=<number>&tier=90|182|365
    → Open Staking screen, pre-filled

  https://noc-tura.io/ref/<code>
    → Save referral code → use on next purchase

  noctura://presale
    → Open PresaleScreen (with optional ?ref=<code>)

  noctura://import?mnemonic=...
    → ⛔ REJECTED — mnemonic NEVER in URL
    → Show error: "For security, import your wallet manually in Settings"

Implement DeepLinkModule interface:
  - initialize() on app startup
  - handleLink(url) → DeepLinkAction | null
  - onAction(callback) for navigation

DeepLinkAction types: pay, receive, stake, referral, presale, rejected

Follow exact spec from .instructions.md.
```

#### Step 25 prompt za Obra:

```
Build Step 25 — Backup module.

3-tier backup model:

1. MNEMONIC (always):
   - 24 words — restores transparent keys
   - On import: derive transparent + shielded keys
   - Transparent balance auto-appears (on-chain)

2. ENCRYPTED CLOUD BACKUP (opt-in):
   - Shielded notes + local metadata
   - Encrypted: AES-256-GCM with mnemonic-derived key
   - Upload to iCloud (iOS) / Google Drive (Android)
   - Trigger: on every new note (deposit/receive)
   - Restore: import mnemonic → derive encryption key → decrypt backup
   - ⚠️ NEVER contains mnemonic or private keys
   - Backup identifier: SHA-256(publicKey.toBytes()) — not raw address

3. MANUAL EXPORT (power users):
   - Settings → Export Encrypted Backup → .noctura file
   - Double-layer encryption: user password + mnemonic-derived key
   - Import: .noctura file + mnemonic → restore

Implement BackupModule interface:
  - enableCloudBackup, disableCloudBackup, isCloudBackupEnabled
  - performCloudBackup, restoreFromCloud
  - exportToFile(password), importFromFile(data, password)
  - lastCloudBackupAt

RestoreResult: { notesRestored, tokensFound, transparentBalanceFound, shieldedBalanceRestored }

Follow exact spec from .instructions.md.
```

---

### WORKTREE 12: `step-26-27-28/zk-engine`
**Branch:** `feature/step-26-28-zk-engine`
**Steps:** 26, 27, 28
**TDD:** Da (Poseidon hashing, Merkle paths, proof queue)
**Estimated tasks:** ~25-30

#### Step 26 prompt za Obra:

```
Build Step 26 — Full fee engine (transparent + shielded + pre-TGE logic).

FeeEngine interface:
  - getNocUsdPrice(): Jupiter price API, cache 60s
  - feeToUsd(nocAmount: bigint): formatted "$0.0012"
  - isZeroFeeEligible(wallet): read on-chain presale buyer flag
  - isTgeActive(): config PDA → config.tge_enabled check
  - getStakingDiscount(wallet): query staking program → 0/0.1/0.2/0.3
  - getEffectiveFee(wallet, feeType): combines zero-fee + staking discount + pre-TGE
  - buildFeeCommitment(feeAmount, randomness): Poseidon hash for ZK proof
  - buildTransparentFeeInstruction(sender): SystemProgram.transfer to NOCTURA_FEE_TREASURY

Transparent fee constants:
  transferMarkup: 20_000n (0.00002 SOL flat — added to every transparent transfer)
  swapFeePercent: 0.003 (0.3% — Phase 4, not active in v1)
  gaslessSwapFeePercent: 0.004 (0.4% — Phase 4, not active in v1)

Shielded fee constants (9 decimals):
  privateTransfer:   500_000n    (0.0005 NOC)
  privateSwap:     7_000_000n    (0.007 NOC — Phase 4)
  crossModeDeposit:  1_000_000n  (0.001 NOC)
  crossModeWithdraw: 2_000_000n  (0.002 NOC)

Pre-TGE logic:
  - config.tge_enabled === false → all shielded NOC fees = 0
  - Circuit accepts fee_amount = 0 (valid proof with zero fee)
  - UI shows: "Fee: Free (until TGE)"

Post-TGE staking tier discounts:
  No stake: 0% | 90d: 10% | 182d: 20% | 365d: 30%
  UI shows: "Fee: X NOC ≈ $Y (30% staking discount applied)"

Fee distribution (off-chain, treasury multisig redistributes):
  NOC private transfer: 25% burn / 35% staking / 25% treasury / 15% community
  NOC private swap: 30% burn / 30% staking / 25% treasury / 15% community
  SOL transparent: 50% treasury / 30% NOC buyback / 20% liquidity

Display rules:
  - ALWAYS show fee in both NOC+USD or SOL+USD before any signing
  - Transparent: single "Network fee" line (base + markup combined)
  - Shielded pre-TGE: "Fee: Free (until TGE)"
  - Shielded post-TGE: "Fee: X NOC ≈ $Y" (with staking discount if applicable)

Relayer gas economics:
  - User pays NOC fee → NOCTURA_FEE_TREASURY collects via fee_commitment
  - Treasury periodically swaps NOC → SOL (Jupiter) for relayer funding
  - Relayer has dedicated SOL hot wallet
  - TODO: fill relayer wallet address before mainnet deploy
  - Monitor: alert when relayer SOL < 1 SOL

Follow exact spec from .instructions.md (v1.9 Fee Engine section).
```

#### Step 27 prompt za Obra:

```
Build Step 27 — Merkle tree sync module.

Light client incremental sync (NOT full tree on mobile):
  - Tree depth: 32 (MUST match deployed ZK circuit — verify before build)
  - Max leaves: 2^32 = ~4.3 billion
  - Storage at 100K leaves (compressed): ~2MB (acceptable for mobile)

MerkleModule interface:
  - verifyAnchor(): GET /v1/merkle/anchor → compare with local state
  - syncFromLeaf(fromIndex): GET /v1/merkle/updates?fromLeaf=N&toLeaf=M
  - fullResync(): emergency, on corruption only
  - computeLocalRoot(): verify matches anchor
  - scanForNotes(sk_view, fromLeaf): decrypt new leaves → check ownership

Sync strategy:
  1. App open → GET /v1/merkle/anchor → { root, blockHeight, leafCount }
  2. root matches local → nothing new
  3. root differs → fetch incremental update (new leaves + path updates)
  4. Client updates local tree (affected nodes only)
  5. Verify: computed root MUST match anchor root
  6. If mismatch → full resync (RARE, max 1× on first install)

Storage: MMKV (SHIELDED_MERKLE_STATE, SHIELDED_MERKLE_LEAVES_PREFIX)
Note scanning: foreground only (battery/privacy)

Follow exact spec from .instructions.md.
```

#### Step 28 prompt za Obra:

```
Build Step 28 — ZK Prover module.

⚠️ HOSTED PROVER = PRIMARY. LOCAL = FALLBACK.

Prover strategy:
  1. Try hosted FIRST: POST /v1/prove/{circuit_type}, timeout 8s
  2. Hosted fails/timeout → Polygen AOT locally (with retry logic)
  3. Both fail → proof queue (retry on reconnect, max 3x)
  4. All attempts fail → clear error with explanation, NEVER silent fail

⚠️ NEVER send sk_spend to hosted prover.
   Hosted receives: public inputs + partial witness only.

ZKProverModule interface:
  - generateDepositProof(params)
  - generateTransferProof(params)
  - generateWithdrawProof(params)
  - getProverMode(): 'hosted' | 'local'

Crash-safe proof queue:
  - Persistent in MMKV (MMKV_KEYS.PROOF_QUEUE)
  - ProofQueueEntry: { id, circuitType, params (no sk_spend), attempts, createdAt, status }
  - Max 3 attempts per entry
  - Entries >10min → mark failed, notify user
  - On app open: check pending queue → retry

Loading UX (user language, NO ZK jargon):
  "Generating proof..."      → hosted call in progress
  "Using local prover..."    → fallback active
  "Retrying..."              → retry attempt 2/3
  "Proof failed. Try again." → 3 failures

⚠️ Witness zeroization: zero all witness arrays AFTER proof generation (mandatory).

Field element conversion for Poseidon inputs:
  - pk_recipient (48 bytes BLS): hash-to-field via Poseidon_3(0x05, pk_hi, pk_lo)
  - mint_hash (32 bytes): mint_field = mint_bytes mod BN254_ORDER
  - Both reductions MUST match ZK circuit implementation

Follow exact spec from .instructions.md.
```

---

### WORKTREE 13: `step-29-30-31/shielded`
**Branch:** `feature/step-29-31-shielded`
**Steps:** 29, 30, 31
**TDD:** Da (note selection, consolidation logic)
**Estimated tasks:** ~20-25

#### Step 29 prompt za Obra:

```
Build Step 29 — Shielded deposit flow.

UI label: "Move to private balance" (NEVER "deposit to shielded")

Flow:
  1. Select token + amount
  2. Fee display: [X NOC] ≈ $Y (zero-fee badge if eligible)
  3. Privacy meter warning (BEFORE deposit, not after):
     leafCount < 100:    🔴 "Privacy pool is very small. May be traceable."
     leafCount < 1000:   🟡 "Privacy pool is growing. Moderate protection."
     leafCount < 10000:  🟢 "Good privacy protection."
     leafCount >= 10000: 🟢 silent (show only on first deposit)
     Dismissable, but repeats until pool > 1000
  4. Confirmation screen
  5. Proof generation: "Securing transaction..." (not "generating proof")
  6. Submit → success

User language terminology:
  deposit    → "Move to private balance"
  proof time → "Securing transaction..."
  commitment → never shown
  nullifier  → never shown

Follow Shielded Mode Screens spec from .instructions.md.
```

#### Step 30 prompt za Obra:

```
Build Step 30 — Shielded transfer flow.

UI label: "Send privately" (NEVER "shielded transfer")

Flow:
  1. Recipient shielded address (noc1... Bech32m) — paste or address book
  2. Token + amount
  3. Optional encrypted memo
  4. Fee display
  5. Note selection:
     - selectNotes(mint, amount, fee) from NoteStore
     - If selected.length > MAX_INPUTS (from circuit config):
       → Auto-consolidate first: "Optimizing your private balance... (step 1/3)"
       → NOT "consolidating notes" (ZK jargon)
     - MAX_INPUTS from GET /v1/config/circuit (not hardcoded)
  6. Change output note: tell user "remainder stays shielded"
  7. Proof generation → relayer submit (POST /v1/relayer/submit)
  8. Success

Shielded address validation:
  - Must start with noc1 (Bech32m, "noc" HRP)
  - Invalid → E110 (INVALID_SHIELDED_ADDR)

Follow exact spec from .instructions.md.
```

#### Step 31 prompt za Obra:

```
Build Step 31 — Shielded withdraw flow.

UI label: "Move to public balance" (NEVER "withdraw from shielded")

Flow:
  1. Destination transparent address (Solana Base58)
  2. Amount
  3. Fee: [X NOC] ≈ $Y
  4. Warning: "Withdrawal is NOT linkable to your deposit history"
  5. Confirmation → proof generation → submit → success

Follow Shielded Mode Screens spec from .instructions.md.
```

---

### WORKTREE 14: `step-32-33-34/platform`
**Branch:** `feature/step-32-34-platform`
**Steps:** 32, 33, 34
**TDD:** Ne (platform services, UI)
**Estimated tasks:** ~20-25

#### Step 32 prompt za Obra:

```
Build Step 32 — Push notifications module.

Platforms:
  iOS: APNs (Apple Push Notification service)
  Android: FCM (Firebase Cloud Messaging)

4 notification types:
  'incoming_tx'     → "You received NOC tokens" (no amounts — privacy)
  'staking_reward'  → "Your staking rewards are ready to claim"
  'tx_confirmed'    → "Transaction confirmed" (internal ID, NOT tx hash)
  'security_alert'  → "Security alert — please check your wallet"

⚠️ ALL notifications are OPT-IN. Default: OFF.
⚠️ NO PII in payload (no addresses, amounts, tx hashes)
⚠️ Token is ephemeral — NOT tied to wallet address

Settings: per-type toggles (4 independent toggles)

NotificationModule interface:
  - requestPermission()
  - registerToken(), unregisterToken()
  - setEnabled(type, enabled), isEnabled(type)
  - handleNotification(payload) — foreground + background handling

Token registration: POST API_BASE/v1/notifications/register
Backend links token to wallet via encrypted hash-based lookup only.

Use @notifee/react-native for local notification management.

Follow exact spec from .instructions.md.
```

#### Step 33 prompt za Obra:

```
Build Step 33 — Analytics module.

⚠️ Privacy-safe, opt-out available in Settings.

RULES:
  - NEVER send: wallet address, tx hash, balance, amount, IP, device ID
  - All events anonymous: event name + timestamp + app version + platform
  - Sentry: NO PII in breadcrumbs (error stack traces only)
  - User opt-out: MMKV_KEYS.SETTINGS_ANALYTICS_OPT_OUT

Implement ALL AnalyticsEvent types from the spec (~40 event types):
  wallet_created, wallet_imported, wallet_sync_completed, wallet_sync_timeout,
  send_transparent, send_shielded, deposit_to_shielded, withdraw_from_shielded,
  stake_created, stake_rewards_claimed, presale_purchase, presale_claim,
  presale_screen_viewed, referral_code_applied, referral_code_shared,
  shielded_mode_enabled/disabled, cloud_backup_enabled/restored,
  backup_reminder_dismissed, backup_completed, proof_hosted_success/failed,
  proof_local_success/failed, geo_warn_acknowledged, geo_blocked,
  session_timeout, biometric_fail, pin_unlock_used, unlock_screen_shown,
  deep_link_received, notification_tapped, app_update_prompted,
  device_integrity_warning, tx_timeout_shown, app_open, app_background

Batch POST: API_BASE/v1/analytics/event (max 50 events per call)
Event shape: { event, timestamp_utc, app_version, platform: 'ios' | 'android' }

Follow exact spec from .instructions.md.
```

#### Step 34 prompt za Obra:

```
Build Step 34 — Settings screen.

All sections:

SECURITY:
  - Biometric toggle (FaceID/TouchID/Fingerprint)
  - Session timeout slider: 1min → 5min (default) → 30min (max)
  - Change PIN flow: current PIN verify → new PIN → confirm → PBKDF2 replace
  - Auto-lock on background toggle

BACKUP:
  - Cloud backup toggle (iCloud/Google Drive)
  - Last backup: [timestamp] + [Force Backup Now]
  - Export encrypted backup → .noctura file

NOTIFICATIONS:
  - 4 toggles: incoming tx, staking rewards, tx confirmations, security alerts
  - Security alerts: "always recommended ON" hint

NETWORK:
  - RPC endpoint (advanced, default Helius)
  - Explorer preference: Solscan / Solana Explorer / SolanaFM

DISPLAY:
  - Hide zero-balance tokens toggle
  - Currency: USD / EUR / GBP
  - Language: English / Slovenščina
  - AMOLED mode toggle (pure black background)
  - Haptics enabled toggle

STORAGE:
  - Data version: v[X] (visible for support debugging)
  - Clear cache (does NOT delete keys or notes)

ADVANCED:
  - View wallet address
  - Export view key:
    1. Tap → warning dialog about view key sharing
    2. Biometric auth required
    3. Retrieve sk_view from keychain
    4. Format: Bech32m "nocvk1..." encoding
    5. Display as text (monospace, copyable) + QR code
    6. FLAG_SECURE active (Android)
    7. "Read-only. Cannot move your funds."

  - Wipe wallet (DANGER ZONE — triple safety):
    1. Check shielded balance > 0 → extra warning about PERMANENT loss
    2. "Type DELETE to confirm"
    3. Wipe: keychain + MMKV + notes + session → navigate to onboarding

  - Close empty token accounts:
    → List empty non-core accounts → batch closeAccount() → reclaim rent

ACCESSIBILITY:
  - Hide balances toggle → show "••••" instead of amounts
  - VoiceOver/TalkBack: do NOT read balances aloud when hidden
  - Tap to reveal (temporary, 5 seconds)

Follow ALL Settings sub-flow specs from .instructions.md.
```

---

### WORKTREE 15: `step-35/testing`
**Branch:** `feature/step-35-testing`
**Steps:** 35
**TDD:** N/A (meta)
**Estimated tasks:** ~15-20

#### Step 35 prompt za Obra:

```
Build Step 35 — E2E tests + accessibility audit.

Detox E2E tests for:
  1. Full onboarding flow (create wallet — all KORAKs)
  2. Full import flow (import mnemonic + sync + optional cloud restore)
  3. Transparent send + receive (with simulation, confirmation, status screen)
  4. Shielded deposit → transfer → withdraw (on devnet ZK program)
  5. Staking flow (connect to testnet staking program)
  6. Auto-lock + biometric re-auth (session timeout)
  7. Deep link handling (noctura://pay?to=...&amount=...)
  8. Cloud backup + restore (mock cloud)
  9. Push notification tap → correct screen navigation

CI gates (GitHub Actions):
  - All unit tests pass
  - npm audit clean
  - TypeScript compile with zero errors (tsc --noEmit)
  - Detox smoke test on iOS simulator + Android emulator
  - Accessibility audit: basic VoiceOver labels on ALL interactive elements

Accessibility checks:
  - Every button, input, toggle has accessibilityLabel
  - VoiceOver does NOT read balances when "Hide balances" is ON
  - Screen readers announce screen transitions correctly
  - Minimum touch target: 44×44pt (iOS) / 48×48dp (Android)

Follow Testing Requirements from .instructions.md.
```

---

## PO VSAKEM WORKTREE-JU (verifikacija)

```
Po vsaki finishing-a-development-branch:

1. Zaženi verification checklist za relevantne stepe:
   "Run the verification checklist from .instructions.md for Steps X-Y.
    Show me which checks pass ✅ and which fail ❌."

2. TypeScript compile:
   npx tsc --noEmit
   → MORA biti 0 errors

3. npm audit:
   npm audit
   → MORA biti clean (0 vulnerabilities)

4. Testi:
   npm test
   → Vsi pašejo

5. Če karkoli faila:
   "You missed [item] from the spec. Check the .instructions.md
    section [name] and implement it fully."

6. Šele ko je vse ✅ → merge in začni naslednji worktree
```

---

## REFERENCE — POGOSTI ERRORI PRI IMPLEMENTACIJI

```
⚠️  NAPAČNO: parseFloat("1.5") * 1e9     → floating point loss
    PRAVILNO: string-based BigInt parsing   → exact

⚠️  NAPAČNO: bls12-381-keygen             → DEPRECATED
    PRAVILNO: micro-key-producer/bls.js     → active, same author

⚠️  NAPAČNO: sk_spend v JS layer           → security violation
    PRAVILNO: sk_spend ONLY in native (iOS SE / Android KS)

⚠️  NAPAČNO: raw Poseidon(pk_48bytes)      → field overflow
    PRAVILNO: Poseidon_3(0x05, pk_hi mod p, pk_lo mod p) → hash-to-field

⚠️  NAPAČNO: raw mint_bytes v Poseidon     → ~25% overflow chance
    PRAVILNO: mint_field = mint_bytes mod BN254_ORDER

⚠️  NAPAČNO: hardcoded MMKV stringi        → typo = silent bug
    PRAVILNO: MMKV_KEYS.* constants vedno

⚠️  NAPAČNO: clipboard clear po 60s        → inconsistent
    PRAVILNO: clipboard clear po 30s povsod

⚠️  NAPAČNO: process.env.HELIUS_URL        → undefined v RN
    PRAVILNO: Config.HELIUS_RPC_URL (react-native-config)

⚠️  NAPAČNO: Reanimated plugin pred NativeWind v babel
    PRAVILNO: Reanimated plugin ZADNJI v babel.config.js
```

---

---

## POST-AUDIT TASKS (dodano 2026-04-07 po full codebase auditu)

> Vse najdbe iz `docs/AUDIT_FINDINGS.md`. Razvrščeno po prioriteti.
> Za podrobna navodila za vsak fix glej `docs/AUDIT_IMPLEMENTATION_GUIDE.md`.

### HIGH PRIORITY — Pred production buildom

| # | Task | Datoteka | Opis |
|---|------|----------|------|
| C-01 | Backup PBKDF2 KDF | backupModule.ts | Zamenjaj SHA-256 z PBKDF2-SHA512 600K iteracij |
| C-02 | SPL TransferChecked | transactionBuilder.ts | Dodaj dejansko SPL transfer instrukcijo |
| C-05 | parseFloat → parseTokenAmount | 3 shielded screens | Zamenjaj parseFloat z BigInt string parsing |
| C-06 | BalanceCard parseFloat | BalanceCard.tsx | Uporabi formatTokenAmount za prikaz |
| C-07 | SendScreen debounce | SendScreen.tsx | Dodaj 500ms lastTapRef guard |
| C-08 | Base58 public key | SuccessScreen.tsx | Uporabi bs58.encode namesto hex |
| C-09 | .env iz git tracking | .env.* | git rm --cached |
| C-10 | Fee treasury naslov | programs.ts | Dodaj pravi naslov + startup guard |
| C-12 | View key clipboard clear | ExportViewKeyScreen.tsx | 30s auto-clear timer |
| C-13 | Session timeout enforcement | Navigator/App.tsx | AppState listener za auto-lock |
| C-14 | FLAG_SECURE shielded screens | 3 shielded screens | enableSecureScreen() v useEffect |
| C-15 | MMKV secure adapter | secureAdapter.ts | Queue ali throw namesto silent drop |

### MEDIUM PRIORITY — Pred beta releaseom

| # | Task | Datoteka | Opis |
|---|------|----------|------|
| I-01 | getKeypair expiry check | sessionModule.ts | Kliči isActive() znotraj getKeypair() |
| I-02 | Biometric gate za seed | keychainModule.ts | accessControl na retrieveSeed |
| I-05 | Stub token guard | notificationModule.ts | Return early če deviceToken null |
| I-06 | Import contacts validation | addressBookModule.ts | Schema validacija + max count |
| I-07 | Deep link rejection razširitev | deepLinkModule.ts | Tudi seed, private_key, sk_spend |
| I-08 | Parsed token accounts | queries.ts | getParsedTokenAccountsByOwner |
| I-09 | Route params validation | Navigator.tsx | Runtime check za params |
| I-10 | TX History → Detail nav | Navigator.tsx | Cross-stack navigation |
| I-13 | Clipboard API migration | 5 datotek | @react-native-clipboard/clipboard |
| I-15 | Placeholder screens | Navigator.tsx | ShieldedBalance + AppUpdateModal |
| I-16 | No-op buttons | StakingScreen, PresaleScreen | Disable ali "Coming soon" |
| I-18 | Deep link auth guard | deepLinkConfig.ts | Redirect na Unlock če ni session |
| I-20 | npm audit CI fix | ci.yml | Odstrani || true |
| I-21 | Mock API_BASE | react-native-config mock | Pravilna domena |
| I-22 | Test coverage gate | jest.config.js + ci.yml | coverageThreshold 60% |
| I-24 | Session timeout from settings | sessionStore.ts | Beri iz secureSettingsStore |
| I-26 | Jest transform patterns | jest.config.js | Dodaj gesture-handler, safe-area, screens |

### LOW PRIORITY — Polish pred releaseom

| # | Task | Datoteka | Opis |
|---|------|----------|------|
| M-01 | Unknown mint close guard | tokenModule.ts | Default ne zapri |
| M-04 | Analytics flush retry | analyticsModule.ts | Re-add events na catch |
| M-08 | Token list FlatList | DashboardScreen.tsx | Virtualizacija |
| M-09 | sortTokens memoize | DashboardScreen.tsx | useMemo |
| M-11 | ConfirmSeed re-tap guard | ConfirmSeedScreen.tsx | disabled={isConfirmed} |
| M-12 | Backup password min length | BackupSettingsScreen.tsx | 8+ znakov |
| M-14 | Linking.openURL catch | TransactionStatusScreen.tsx | .catch() |
| M-15 | PriorityFee a11y labels | PriorityFeeToggle.tsx | Per-level labels |
| M-16 | Modal close button Android | Navigator.tsx | Vidno dismiss gumb |
| M-19 | TS 6.0 stability | package.json | Pin na ~5.8.x ali test thoroughly |

### BLOCKED — Čaka na zunanjo integracijo

| # | Task | Blokira | Čaka na |
|---|------|---------|---------|
| C-03 | Poseidon hash | Merkle roots | ZK circuit deploy |
| C-04 | Real witnesses | Shielded txs | BLST native + Merkle |
| C-11 | SSL production pins | API security | api.noc-tura.io deploy |
| Native | BLST signing | Shielded txs | iOS/Android native dev |
| Native | Push notifications | User engagement | APNs/FCM setup |
| Native | Cloud backup | Data recovery | iCloud/GDrive SDK |
| Native | QR scanner | UX convenience | vision-camera |

---

*Noctura Wallet Build Plan v1.2*
*Za uporabo z Obra Superpowers plugin + noctura-wallet-superpowers-prompt-v1.9.md*
*35 implementation stepov + post-audit remediation*
*v1.2: dodane audit najdbe (15 critical, 26 important, 20 minor) — 2026-04-07*
