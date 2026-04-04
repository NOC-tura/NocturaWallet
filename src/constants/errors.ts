interface ErrorEntry {
  readonly code: string;
  readonly message: string;
  readonly action: string;
}

export const ERROR_CODES = {
  // ─── Network ──────────────────────────────────────────────────────────
  NETWORK_OFFLINE: {code: 'E001', message: 'No internet connection', action: 'Check your connection and try again'},
  RPC_TIMEOUT: {code: 'E002', message: 'Network is slow', action: 'Please try again in a moment'},
  RPC_RATE_LIMIT: {code: 'E003', message: 'Too many requests', action: 'Please wait a few seconds and retry'},

  // ─── Balance ──────────────────────────────────────────────────────────
  INSUFFICIENT_SOL: {code: 'E010', message: 'Not enough SOL', action: 'You need more SOL to cover network fees'},
  INSUFFICIENT_TOKEN: {code: 'E011', message: 'Not enough tokens', action: 'Reduce the amount or add more tokens'},
  INSUFFICIENT_RENT: {code: 'E012', message: 'Account needs rent deposit', action: 'Keep at least 0.00203 SOL for rent'},
  INSUFFICIENT_NOC_FEE: {code: 'E013', message: 'Not enough NOC for privacy fee', action: 'You need NOC tokens for shielded transactions'},

  // ─── Transaction ──────────────────────────────────────────────────────
  TX_SIMULATION_FAILED: {code: 'E020', message: 'Transaction would fail', action: 'Try a different amount or check recipient address'},
  TX_SEND_FAILED: {code: 'E021', message: 'Transaction failed to send', action: 'Please try again'},
  TX_TIMEOUT: {code: 'E022', message: 'Transaction not confirmed', action: 'Check transaction history — it may still confirm'},
  TX_ALREADY_PROCESSED: {code: 'E023', message: 'Transaction already processed', action: 'No action needed — check your history'},
  INVALID_ADDRESS: {code: 'E024', message: 'Invalid recipient address', action: 'Check the address and try again'},

  // ─── ZK Proof ─────────────────────────────────────────────────────────
  PROOF_GENERATION_FAILED: {code: 'E030', message: 'Privacy proof failed', action: 'Please try again. If this persists, try a smaller amount.'},
  PROOF_VERIFICATION_FAILED: {code: 'E031', message: 'Proof verification failed', action: 'Please try again'},
  PROVER_UNAVAILABLE: {code: 'E032', message: 'Privacy service temporarily unavailable', action: 'Please try again in a moment'},

  // ─── Auth / Security ──────────────────────────────────────────────────
  BIOMETRIC_FAILED: {code: 'E040', message: 'Authentication failed', action: 'Try again or use your PIN'},
  BIOMETRIC_NOT_ENROLLED: {code: 'E041', message: 'Biometric not set up', action: 'Set up Face ID / fingerprint in device settings'},
  SESSION_EXPIRED: {code: 'E042', message: 'Session expired', action: 'Please unlock your wallet again'},

  // ─── Geo / Compliance ─────────────────────────────────────────────────
  GEO_BLOCKED: {code: 'E050', message: 'Privacy mode not available in your region', action: 'Transparent mode is fully functional'},
  GEO_VPN_DETECTED: {code: 'E051', message: 'VPN detected', action: 'Set your country manually in Settings for accurate access'},

  // ─── Backup ───────────────────────────────────────────────────────────
  BACKUP_FAILED: {code: 'E060', message: 'Backup failed', action: 'Check cloud storage space and try again'},
  RESTORE_FAILED: {code: 'E061', message: 'Restore failed', action: 'Make sure you are using the correct wallet seed phrase'},
  RESTORE_NO_BACKUP: {code: 'E062', message: 'No backup found', action: 'Your wallet was restored from seed phrase. Shielded history is not available.'},

  // ─── Staking ──────────────────────────────────────────────────────────
  STAKE_LOCKED: {code: 'E070', message: 'Stake is still locked', action: 'Your stake unlocks on [date]'},
  STAKE_BELOW_MINIMUM: {code: 'E071', message: 'Below minimum stake amount', action: 'Minimum stake is [X] NOC'},

  // ─── App Version ──────────────────────────────────────────────────────
  APP_UPDATE_REQUIRED: {code: 'E080', message: 'App update required', action: 'Please update Noctura Wallet to continue'},

  // ─── Note Consolidation ───────────────────────────────────────────────
  CONSOLIDATION_NEEDED: {code: 'E090', message: 'Balance needs optimization', action: 'Tap "Optimize" to prepare your private balance for this transfer'},

  // ─── Presale / TGE ────────────────────────────────────────────────────
  PRESALE_SOLD_OUT: {code: 'E100', message: 'This presale stage is sold out', action: 'The next stage opens shortly'},
  PRESALE_STAGE_CHANGED: {code: 'E101', message: 'Presale price has changed', action: 'Review the new price and try again'},
  PRESALE_NOT_ACTIVE: {code: 'E102', message: 'Presale is not currently active', action: 'Check back later'},
  PRESALE_TX_FAILED: {code: 'E103', message: 'Purchase failed', action: 'Check your balance and try again'},
  CLAIM_NOT_AVAILABLE: {code: 'E104', message: 'Token claim is not yet available', action: 'Tokens will be claimable after TGE. Stay tuned!'},
  CLAIM_NOTHING_TO_CLAIM: {code: 'E105', message: 'No tokens to claim', action: 'You have already claimed all your presale tokens'},
  CLAIM_TX_FAILED: {code: 'E106', message: 'Claim transaction failed', action: 'Please try again. Your allocation is safe.'},

  // ─── Shielded Address ─────────────────────────────────────────────────
  INVALID_SHIELDED_ADDR: {code: 'E110', message: 'Invalid private address', action: 'Shielded addresses start with noc1. Check and try again.'},

  // ─── PIN ──────────────────────────────────────────────────────────────
  PIN_COOLDOWN: {code: 'E120', message: 'Too many incorrect attempts', action: 'Wait [X] seconds before trying again'},
  PIN_MISMATCH: {code: 'E121', message: 'PINs do not match', action: 'Re-enter both PINs'},

  // ─── Referral ─────────────────────────────────────────────────────────
  REFERRAL_INVALID_CODE: {code: 'E140', message: 'Invalid referral code', action: 'Check the code and try again'},
  REFERRAL_ALREADY_USED: {code: 'E141', message: 'Referral code already applied', action: 'Each wallet can only use one referral code'},

  // ─── Sync ─────────────────────────────────────────────────────────────
  SYNC_TIMEOUT: {code: 'E150', message: 'Wallet sync timed out', action: 'Your balance may not be current. Pull to refresh.'},
  SYNC_PARTIAL: {code: 'E151', message: 'Partial sync completed', action: 'Some data may be outdated. Pull to refresh.'},
} as const satisfies Record<string, ErrorEntry>;

export type ErrorCode = keyof typeof ERROR_CODES;
