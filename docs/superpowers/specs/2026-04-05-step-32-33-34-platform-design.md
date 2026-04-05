# Step 32-33-34: Push Notifications, Analytics, Settings Screen

## Overview

Three platform modules + Settings screen for the Noctura Wallet. Push notifications (APNs/FCM, 4 types, opt-in), privacy-safe analytics (36 event types, batched), and a full Settings screen (7 sub-screens covering security, backup, notifications, network, display, storage, advanced, accessibility).

---

## Module Layer

### Notification Module (`src/modules/notifications/`)

**`types.ts`:**
```typescript
type NotificationType = 'incoming_tx' | 'staking_reward' | 'tx_confirmed' | 'security_alert';

interface NotificationPayload {
  type: NotificationType;
  token?: string;    // for incoming_tx only (e.g. 'NOC')
  txId?: string;     // for tx_confirmed only (internal ID, NOT tx hash)
}

// Display messages per type
const NOTIFICATION_MESSAGES: Record<NotificationType, string> = {
  incoming_tx: 'You received tokens',
  staking_reward: 'Your staking rewards are ready to claim',
  tx_confirmed: 'Transaction confirmed',
  security_alert: 'Security alert — please check your wallet',
};

// Tap destinations per type
const NOTIFICATION_ROUTES: Record<NotificationType, string> = {
  incoming_tx: 'MainTabs',
  staking_reward: 'Staking',
  tx_confirmed: 'TransactionHistory',
  security_alert: 'SettingsTab',
};
```

**`notificationModule.ts`** — `NotificationManager` class:
- `requestPermission(): Promise<boolean>` — requests OS notification permission
- `registerToken(): Promise<void>` — gets device token, POSTs to `/v1/notifications/register` with enabled types and platform
- `unregisterToken(): Promise<void>` — DELETEs `/v1/notifications/unregister`
- `setEnabled(type, enabled): void` — updates secureSettingsStore toggle, calls registerToken() to sync
- `isEnabled(type): boolean` — reads from secureSettingsStore
- `getEnabledTypes(): NotificationType[]` — returns array of enabled types
- `handleNotification(payload): void` — routes to correct screen via navigation

Privacy rules:
- Token is ephemeral, NOT tied to wallet address
- NO PII in any payload (no addresses, amounts, tx hashes)
- Backend links token to wallet via encrypted hash-based lookup only

### Analytics Module (`src/modules/analytics/`)

**`types.ts`:**
```typescript
type AnalyticsEvent =
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

interface AnalyticsPayload {
  event: AnalyticsEvent;
  timestamp_utc: number;
  app_version: string;
  platform: 'ios' | 'android';
}
```

**`analyticsModule.ts`** — `AnalyticsManager` class:
- `track(event: AnalyticsEvent): void` — adds to in-memory queue; no-op if opted out
- `flush(): Promise<void>` — POSTs batched events to `/v1/analytics/event` (max 50 per call); clears queue on success
- `isOptedOut(): boolean` — reads `publicSettingsStore.analyticsOptOut`
- Internal: queue auto-flushes when size >= 50 or every 60 seconds
- On `app_background`: flush immediately

Privacy rules (enforced in code):
- NEVER send: wallet address, tx hash, balance, amount, IP, device ID
- Event shape is ONLY: event name + UTC timestamp + app version + platform
- Opted-out users: `track()` is a complete no-op (doesn't even queue)

---

## Settings Screen Layer (`src/screens/settings/`)

### `SettingsScreen.tsx` — Main settings list

Section-based ScrollView with navigation to sub-screens:

| Section | Items |
|---------|-------|
| Security | Biometric toggle, Session timeout, Auto-lock, Change PIN → nav |
| Backup | Cloud backup toggle, Last backup, Force backup, Export |
| Notifications | → nav to NotificationSettingsScreen |
| Network | RPC endpoint, Explorer preference |
| Display | Currency, Language, AMOLED mode, Haptics |
| Storage | Data version, Clear cache |
| Advanced | View address, Export view key → nav, Wipe wallet → nav |
| Accessibility | Hide balances toggle (with tap-to-reveal), Hide zero-balance tokens |

Items that are simple toggles/selectors render inline. Complex flows navigate to sub-screens.

### `SecuritySettingsScreen.tsx`

- Biometric toggle → `secureSettingsStore.setBiometricEnabled()`
- Session timeout slider: 1min → 5min (default) → 30min → `sessionManager.setTimeoutMinutes()`
- Auto-lock on background toggle → `secureSettingsStore.setAutoLockOnBackground()`
- "Change PIN" button → navigates to ChangePinScreen
- Jailbreak/root warning banner if `SECURITY_JAILBREAK_DETECTED` is set

### `ChangePinScreen.tsx`

3-step flow using PinPad component (already exists):
1. **Verify current**: PinPad → `keychainManager.verifyPin()` → if fail, show error (E120 cooldown)
2. **Enter new**: PinPad → store in local state
3. **Confirm new**: PinPad → compare → if match, `keychainManager.changePin(old, new)` → success → navigate back

### `ExportViewKeyScreen.tsx`

Flow:
1. Warning dialog about view key sharing
2. Biometric auth via react-native-keychain
3. Retrieve `sk_view` from keychain → encode as Bech32m `nocvk1...`
4. Display: monospace text (copyable) + QR code placeholder
5. FLAG_SECURE on Android (prevent screenshots)
6. Message: "This view key is read-only. It cannot move your funds."

### `BackupSettingsScreen.tsx`

- Cloud backup toggle → `backupManager.enableCloudBackup()` / `disableCloudBackup()`
- Last backup timestamp display
- "Force Backup Now" button → `backupManager.performCloudBackup()`
- "Export Encrypted Backup" button → password prompt → `backupManager.exportToFile(password)`

### `NotificationSettingsScreen.tsx`

4 independent toggles:
- Incoming transactions → `notificationManager.setEnabled('incoming_tx', value)`
- Staking rewards → `notificationManager.setEnabled('staking_reward', value)`
- Transaction confirmations → `notificationManager.setEnabled('tx_confirmed', value)`
- Security alerts → `notificationManager.setEnabled('security_alert', value)` + "Always recommended ON" hint

First toggle enable triggers `requestPermission()` + `registerToken()`.

### `WipeWalletScreen.tsx`

Triple safety:
1. If shielded balance > 0 → extra warning about PERMANENT loss
2. Text input: type "DELETE" to confirm
3. On confirm: `keychainManager.wipeKeys()` + clear all MMKV stores + `sessionManager.lock()` → navigate to Onboarding

---

## File Structure

```
src/
├── modules/
│   ├── notifications/
│   │   ├── types.ts
│   │   ├── notificationModule.ts
│   │   └── __tests__/
│   │       └── notificationModule.test.ts
│   └── analytics/
│       ├── types.ts
│       ├── analyticsModule.ts
│       └── __tests__/
│           └── analyticsModule.test.ts
├── screens/
│   └── settings/
│       ├── SettingsScreen.tsx
│       ├── SecuritySettingsScreen.tsx
│       ├── ChangePinScreen.tsx
│       ├── ExportViewKeyScreen.tsx
│       ├── BackupSettingsScreen.tsx
│       ├── NotificationSettingsScreen.tsx
│       ├── WipeWalletScreen.tsx
│       └── __tests__/
│           ├── SettingsScreen.test.tsx
│           ├── SecuritySettingsScreen.test.tsx
│           ├── ChangePinScreen.test.tsx
│           ├── ExportViewKeyScreen.test.tsx
│           ├── BackupSettingsScreen.test.tsx
│           ├── NotificationSettingsScreen.test.tsx
│           └── WipeWalletScreen.test.tsx
```

---

## Testing Strategy

**Module tests (TDD):**
- notificationModule (8 tests): permission request, register/unregister API calls, toggle persistence via store, getEnabledTypes, payload routing to correct screen, privacy check (no PII), re-register on toggle change
- analyticsModule (8 tests): track queues event, flush POSTs batch, opt-out no-op, max 50 per batch, flush clears queue, event shape has only allowed fields, no PII fields present, empty queue flush is no-op

**Screen tests (component, mock modules):**
- SettingsScreen (5 tests): renders all section headers, navigation to sub-screens
- SecuritySettingsScreen (5 tests): biometric toggle, timeout slider, auto-lock toggle, Change PIN navigation
- ChangePinScreen (5 tests): verify step renders PinPad, error on wrong PIN, new PIN step, confirm mismatch error, success navigation
- ExportViewKeyScreen (5 tests): warning shown first, biometric prompt, view key displayed as nocvk1..., copy button, read-only message
- BackupSettingsScreen (5 tests): cloud toggle, last backup display, force backup button, export button
- NotificationSettingsScreen (5 tests): 4 toggles render, toggle calls setEnabled, security alert hint text
- WipeWalletScreen (5 tests): shielded balance warning, DELETE input, wipe triggers keychainManager, navigation to onboarding
