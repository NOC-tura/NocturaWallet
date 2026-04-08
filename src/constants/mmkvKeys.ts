// Centralized MMKV key registry. NEVER hardcode MMKV key strings elsewhere.
// Format: 'version_category.subcategory'
// Instance annotation: [P] = mmkvPublic, [S] = mmkvSecure

export const MMKV_KEYS = {
  // ─── Onboarding [P] ──────────────────────────────────────────────────
  ONBOARDING_COMPLETED: 'v1_onboarding.completed',
  ONBOARDING_SECURITY_ACK: 'v1_onboarding.securityAcknowledged',
  ONBOARDING_SEED_DISPLAYED: 'v1_onboarding.seedDisplayed',
  ONBOARDING_SEED_CONFIRMED: 'v1_onboarding.seedConfirmed',

  // ─── Session [P] ─────────────────────────────────────────────────────
  SESSION_LAST_ACTIVE: 'v1_session.lastActiveAt',
  SESSION_TIMEOUT_MINUTES: 'v1_session.timeoutMinutes',

  // ─── App [P] ─────────────────────────────────────────────────────────
  APP_FORCE_UPDATE_REQUIRED: 'v1_app.forcedUpdateRequired',
  APP_LAST_VERSION_CHECK: 'v1_app.lastVersionCheck',
  APP_UPDATE_STORE_URL: 'v1_app.updateStoreUrl',

  // ─── Backup [P] dismiss state, [S] config ───────────────────────────
  BACKUP_CLOUD_ENABLED: 'v1_backup.cloudEnabled',
  BACKUP_LAST_AT: 'v1_backup.lastBackupAt',
  BACKUP_DISMISSED_COUNT: 'v1_backup.dismissedCount',
  BACKUP_DISMISSED_SESSION: 'v1_backup.dismissedForSession',

  // ─── Wallet [P] exists flag, [S] balance caches ─────────────────────
  WALLET_EXISTS: 'v1_wallet.exists',
  WALLET_SHIELDED_BALANCE_CACHE: 'v1_wallet.shieldedBalanceCache',
  WALLET_IS_ZERO_FEE_ELIGIBLE: 'v1_wallet.isZeroFeeEligible',

  // ─── Shielded [S] ───────────────────────────────────────────────────
  SHIELDED_NOTES_PREFIX: 'v1_notes_',
  SHIELDED_MERKLE_STATE: 'v1_merkle.state',
  SHIELDED_MERKLE_LEAVES_PREFIX: 'v1_merkle_leaves_',

  // ─── Address Book [S] ───────────────────────────────────────────────
  ADDRESS_BOOK_PREFIX: 'v1_contacts_',

  // ─── Proof Queue [S] ────────────────────────────────────────────────
  PROOF_QUEUE: 'v1_proofQueue',

  // ─── Geo [S] ────────────────────────────────────────────────────────
  GEO_RESTRICTED_LIST: 'v1_geo.restrictedList',
  GEO_RESTRICTED_LIST_AT: 'v1_geo.restrictedListAt',
  GEO_KYC_COUNTRY: 'v1_geo.kycCountry',

  // ─── Settings [P] public prefs ──────────────────────────────────────
  SETTINGS_HIDE_ZERO_BALANCE: 'v1_settings.hideZeroBalance',
  SETTINGS_CURRENCY: 'v1_settings.currency',
  SETTINGS_LANGUAGE: 'v1_settings.language',
  SETTINGS_ANALYTICS_OPT_OUT: 'v1_settings.analyticsOptOut',
  SETTINGS_HIDE_BALANCES: 'v1_settings.hideBalances',
  SETTINGS_EXPLORER: 'v1_settings.explorer',
  SETTINGS_RPC_ENDPOINT: 'v1_settings.rpcEndpoint',
  SETTINGS_AMOLED_MODE: 'v1_settings.amoledMode',
  SETTINGS_HAPTICS_ENABLED: 'v1_settings.hapticsEnabled',

  // ─── Notifications [S] ──────────────────────────────────────────────
  NOTIF_INCOMING_TX: 'v1_notif.incomingTx',
  NOTIF_STAKING_REWARD: 'v1_notif.stakingReward',
  NOTIF_TX_CONFIRMED: 'v1_notif.txConfirmed',
  NOTIF_SECURITY_ALERT: 'v1_notif.securityAlert',
  NOTIF_DEVICE_TOKEN: 'v1_notif.deviceToken',

  // ─── Referral [S] ──────────────────────────────────────────────────
  REFERRAL_CODE_MINE: 'v1_referral.myCode',
  REFERRAL_CODE_APPLIED: 'v1_referral.appliedCode',
  REFERRAL_REWARDS_TOTAL: 'v1_referral.totalRewards',

  // ─── Referral [P] onboarding-time entry (before secure store is ready) ─
  REFERRAL_ONBOARDING_CODE_APPLIED: 'v1_referral.onboardingApplied',

  // ─── Privacy Explainer [P] ─────────────────────────────────────────
  PRIVACY_EXPLAINER_SHOWN: 'v1_privacy.explainerShown',

  // ─── Security [P] ──────────────────────────────────────────────────
  SECURITY_JAILBREAK_DETECTED: 'v1_security.jailbreakDetected',
  SECURITY_BIOMETRIC_ENABLED: 'v1_security.biometricEnabled',
  SECURITY_AUTO_LOCK_BG: 'v1_security.autoLockOnBackground',

  // ─── PIN [S] ────────────────────────────────────────────────────────
  PIN_CONFIGURED: 'v1_pin.configured',
  PIN_ATTEMPT_COUNT: 'v1_pin.attemptCount',
  PIN_COOLDOWN_UNTIL: 'v1_pin.cooldownUntil',

  // ─── Presale / TGE [S] ─────────────────────────────────────────────
  PRESALE_ALLOCATION_CACHED: 'v1_presale.allocationCached',
  PRESALE_TGE_STATUS: 'v1_presale.tgeStatus',

  // ─── Tokens [P] ─────────────────────────────────────────────────────
  JUPITER_VERIFIED_LIST: 'v1_tokens.jupiterVerified',
  JUPITER_VERIFIED_AT: 'v1_tokens.jupiterVerifiedAt',

  // ─── Schema version [P] (no v1_ prefix — migration metadata) ───────
  SCHEMA_VERSION: 'schema_version',
} as const;
