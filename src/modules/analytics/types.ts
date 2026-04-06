export type AnalyticsEvent =
  | 'wallet_created' | 'wallet_imported'
  | 'wallet_sync_completed' | 'wallet_sync_timeout'
  | 'send_transparent' | 'send_shielded'
  | 'deposit_to_shielded' | 'withdraw_from_shielded'
  | 'stake_created' | 'stake_rewards_claimed'
  | 'presale_purchase' | 'presale_claim' | 'presale_claim_partial'
  | 'presale_screen_viewed'
  | 'referral_code_applied' | 'referral_code_shared'
  | 'shielded_mode_enabled' | 'shielded_mode_disabled'
  | 'cloud_backup_enabled' | 'cloud_backup_restored'
  | 'backup_reminder_dismissed' | 'backup_completed'
  | 'proof_hosted_success' | 'proof_hosted_failed'
  | 'proof_local_success' | 'proof_local_failed'
  | 'geo_warn_acknowledged' | 'geo_blocked'
  | 'session_timeout' | 'biometric_fail' | 'pin_unlock_used'
  | 'unlock_screen_shown' | 'deep_link_received'
  | 'notification_tapped' | 'app_update_prompted'
  | 'device_integrity_warning' | 'tx_timeout_shown'
  | 'app_open' | 'app_background';

export interface AnalyticsPayload {
  event: AnalyticsEvent;
  timestamp_utc: number;
  app_version: string;
  platform: 'ios' | 'android';
}
