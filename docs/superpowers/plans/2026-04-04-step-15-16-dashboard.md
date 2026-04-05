# Step 15–16: BackupReminderBanner + Dashboard + Background Sync

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the BackupReminderBanner with session-dismiss logic, the complete Dashboard screen with all conditional banners (priority-based mutual exclusion), token list with NOC pinned, quick actions (swap disabled), wallet header, mode toggle, balance card, background sync module, and pull-to-refresh.

**Architecture:** Dashboard is a ScrollView with a strict vertical component order. Banner visibility is controlled by a `useDashboardBanners()` hook that implements the priority logic (backup > offline > update, never two simultaneously). BackgroundSyncModule provides `forceSync()` for pull-to-refresh and `registerBackgroundTask()` for native background fetch. Components are presentational — data flows from Zustand stores via hooks.

**Tech Stack:** React Native ScrollView/RefreshControl, Zustand stores (wallet, shielded, presale, settings), useNetworkStatus, MMKV, NativeWind v4

---

## File Structure

```
src/
├── components/
│   ├── BackupReminderBanner.tsx      — Session-dismiss, 3-dismiss permanent
│   ├── WalletChip.tsx                — Truncated address + copy
│   ├── ModeToggle.tsx                — [Transparent | Private] toggle
│   ├── BalanceCard.tsx               — SOL/NOC balance + USD total
│   ├── QuickActions.tsx              — Send, Receive, Stake, Swap(disabled)
│   ├── TokenRow.tsx                  — Token icon + balance + trust badge
│   └── __tests__/
│       ├── BackupReminderBanner.test.tsx
│       └── QuickActions.test.tsx
├── screens/
│   └── dashboard/
│       └── DashboardScreen.tsx       — Full dashboard layout with banner priority
├── hooks/
│   └── useDashboardBanners.ts        — Banner priority logic
├── modules/
│   └── backgroundSync/
│       ├── backgroundSyncModule.ts   — forceSync, registerBackgroundTask
│       └── __tests__/
│           └── backgroundSyncModule.test.ts
```

---

## Task 1: BackupReminderBanner (TDD)

**Files:**
- Create: `src/components/BackupReminderBanner.tsx`
- Create: `src/components/__tests__/BackupReminderBanner.test.tsx`

- [ ] **Step 1: Write tests**

Create `src/components/__tests__/BackupReminderBanner.test.tsx`:
```typescript
import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {BackupReminderBanner} from '../BackupReminderBanner';

describe('BackupReminderBanner', () => {
  it('renders nothing when not visible', () => {
    const {queryByText} = render(
      <BackupReminderBanner visible={false} onBackup={() => {}} onDismiss={() => {}} canDismiss={true} />,
    );
    expect(queryByText(/back up/i)).toBeNull();
  });

  it('renders banner when visible', () => {
    const {getByText} = render(
      <BackupReminderBanner visible={true} onBackup={() => {}} onDismiss={() => {}} canDismiss={true} />,
    );
    expect(getByText(/back up your wallet/i)).toBeTruthy();
    expect(getByText(/your funds are at risk/i)).toBeTruthy();
  });

  it('calls onBackup when banner tapped', () => {
    const onBackup = jest.fn();
    const {getByText} = render(
      <BackupReminderBanner visible={true} onBackup={onBackup} onDismiss={() => {}} canDismiss={true} />,
    );
    fireEvent.press(getByText(/back up your wallet/i));
    expect(onBackup).toHaveBeenCalled();
  });

  it('shows dismiss button when canDismiss is true', () => {
    const {getByText} = render(
      <BackupReminderBanner visible={true} onBackup={() => {}} onDismiss={() => {}} canDismiss={true} />,
    );
    expect(getByText('✕')).toBeTruthy();
  });

  it('hides dismiss button when canDismiss is false (3+ dismisses)', () => {
    const {queryByText} = render(
      <BackupReminderBanner visible={true} onBackup={() => {}} onDismiss={() => {}} canDismiss={false} />,
    );
    expect(queryByText('✕')).toBeNull();
  });

  it('calls onDismiss when X pressed', () => {
    const onDismiss = jest.fn();
    const {getByText} = render(
      <BackupReminderBanner visible={true} onBackup={() => {}} onDismiss={onDismiss} canDismiss={true} />,
    );
    fireEvent.press(getByText('✕'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement BackupReminderBanner**

Create `src/components/BackupReminderBanner.tsx`:
```typescript
import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

interface BackupReminderBannerProps {
  visible: boolean;
  onBackup: () => void;
  onDismiss: () => void;
  canDismiss: boolean; // false after 3 session dismisses
}

// Dashboard integration: highest priority banner.
// Priority: BackupReminder > Offline > AppUpdate (never show two simultaneously).
// Dismiss is session-only (MMKV BACKUP_DISMISSED_SESSION).
// After 3 session dismisses → remove X button (becomes permanent).

export function BackupReminderBanner({visible, onBackup, onDismiss, canDismiss}: BackupReminderBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.content} onPress={onBackup}>
        <View style={styles.headerRow}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Back up your wallet</Text>
          <Text style={styles.arrow}>→</Text>
        </View>
        <Text style={styles.subtitle}>
          Your funds are at risk without a recovery phrase backup
        </Text>
      </TouchableOpacity>
      {canDismiss && (
        <TouchableOpacity onPress={onDismiss} style={styles.dismiss}>
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    padding: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(251,191,36,0.25)',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  content: {flex: 1},
  headerRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  icon: {fontSize: 14},
  title: {fontSize: 13, fontWeight: '600', color: '#FBBF24', flex: 1},
  arrow: {fontSize: 14, color: '#FBBF24'},
  subtitle: {
    fontSize: 11,
    color: 'rgba(251,191,36,0.75)',
    lineHeight: 17.6, // 11 * 1.6
    marginTop: 4,
  },
  dismiss: {padding: 4, marginLeft: 8},
  dismissText: {fontSize: 14, color: 'rgba(255,255,255,0.45)'},
});
```

- [ ] **Step 3: Run tests — 6 pass**

- [ ] **Step 4: Commit**

```bash
git add src/components/BackupReminderBanner.tsx src/components/__tests__/BackupReminderBanner.test.tsx
git commit -m "feat: BackupReminderBanner with session-dismiss, 3-dismiss permanent"
```

---

## Task 2: Dashboard Sub-Components (WalletChip, ModeToggle, BalanceCard, TokenRow)

**Files:**
- Create: `src/components/WalletChip.tsx`
- Create: `src/components/ModeToggle.tsx`
- Create: `src/components/BalanceCard.tsx`
- Create: `src/components/TokenRow.tsx`

- [ ] **Step 1: Create WalletChip**

```typescript
// Props: {address: string, onCopy: () => void}
// Truncated address (first 6 + last 4) + copy button
```

- [ ] **Step 2: Create ModeToggle**

```typescript
// Props: {mode: 'transparent' | 'shielded', onToggle: () => void}
// [Transparent | Private] segmented control
// Active tab: accent (#6C47FF), inactive: muted
```

- [ ] **Step 3: Create BalanceCard**

```typescript
// Props: {solBalance: string, nocBalance: string, totalUsdValue: number, nocUsdPrice: number, hidden: boolean}
// SOL balance + USD, NOC balance + USD, total portfolio
// "•••••" when hidden
```

- [ ] **Step 4: Create TokenRow**

```typescript
// Props: {symbol: string, name: string, balance: string, usdValue?: number, trust: 'core' | 'verified' | 'unknown', isPinned?: boolean}
// Token icon placeholder + balance + trust badge
// "⚠️ Unverified" for unknown tier
```

- [ ] **Step 5: Commit**

```bash
git add src/components/WalletChip.tsx src/components/ModeToggle.tsx src/components/BalanceCard.tsx src/components/TokenRow.tsx
git commit -m "feat: dashboard sub-components (WalletChip, ModeToggle, BalanceCard, TokenRow)"
```

---

## Task 3: QuickActions with Swap Disabled (TDD)

**Files:**
- Create: `src/components/QuickActions.tsx`
- Create: `src/components/__tests__/QuickActions.test.tsx`

- [ ] **Step 1: Write tests**

Tests:
1. Renders Send, Receive, Stake, Swap buttons
2. Calls onSend when Send pressed
3. Calls onReceive when Receive pressed
4. Calls onStake when Stake pressed
5. Shows "Coming Soon" modal when Swap pressed (not navigation)
6. Send disabled when isOffline is true

- [ ] **Step 2: Implement QuickActions**

4 action buttons in a row. Swap is 50% opacity with lock icon.
Swap tap → modal: "Token Swap — Coming Soon" + "Available in Phase 4." + [Got it]
Send disabled when offline.

- [ ] **Step 3: Run tests — 6 pass**

- [ ] **Step 4: Commit**

```bash
git add src/components/QuickActions.tsx src/components/__tests__/QuickActions.test.tsx
git commit -m "feat: QuickActions (Send, Receive, Stake, Swap disabled with Coming Soon modal)"
```

---

## Task 4: useDashboardBanners Hook + Background Sync Module (TDD)

**Files:**
- Create: `src/hooks/useDashboardBanners.ts`
- Create: `src/modules/backgroundSync/backgroundSyncModule.ts`
- Create: `src/modules/backgroundSync/__tests__/backgroundSyncModule.test.ts`

- [ ] **Step 1: Create useDashboardBanners hook**

```typescript
// Returns: { showBackupBanner, showOfflineBanner, showUpdateBanner, canDismissBackup, dismissBackup }
// Logic:
//   backupNeeded = ONBOARDING_COMPLETED === true && ONBOARDING_SEED_CONFIRMED !== true
//   backupDismissed = BACKUP_DISMISSED_SESSION === true
//   dismissCount = BACKUP_DISMISSED_COUNT (number)
//   showBackupBanner = backupNeeded && !backupDismissed
//   showOfflineBanner = !isOnline && !showBackupBanner
//   showUpdateBanner = updateAvailable && !showBackupBanner && !showOfflineBanner
//   canDismissBackup = dismissCount < 3
```

- [ ] **Step 2: Write backgroundSync tests**

Tests:
1. forceSync calls getBalance and getTokenAccounts
2. forceSync updates walletStore
3. forceSync handles RPC errors gracefully
4. lastSyncedAt returns timestamp after sync

- [ ] **Step 3: Implement backgroundSyncModule**

```typescript
// forceSync(): fetch SOL balance + token accounts + NOC price → update walletStore
// registerBackgroundTask(): stub (real native registration deferred)
// lastSyncedAt(): read from walletStore.lastSyncedAt
```

- [ ] **Step 4: Run tests — 4 pass**

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDashboardBanners.ts src/modules/backgroundSync/
git commit -m "feat: useDashboardBanners (priority logic) + backgroundSync (forceSync)"
```

---

## Task 5: DashboardScreen — Full Layout

**Files:**
- Create: `src/screens/dashboard/DashboardScreen.tsx`

- [ ] **Step 1: Implement DashboardScreen**

Full vertical layout per spec:
```
StatusBar
WalletChip (address + copy)
ModeToggle [Transparent | Private]
← BackupReminderBanner (conditional, highest priority)
← OfflineBanner (conditional, if no backup banner)
← AppUpdateBanner (conditional, lowest priority)
BalanceCard
QuickActions
Section "Tokens"
TokenRow (NOC — pinned)
TokenRow (SOL)
TokenRow (USDC)
[other tokens sorted by USD]
```

Uses:
- `useWalletStore` for balances, publicKey, tokens
- `useShieldedStore` for mode
- `useNetworkStatus` for isOnline
- `useDashboardBanners` for banner visibility
- `useSettings` for hideBalances
- ScrollView with RefreshControl → forceSync()

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
git add src/screens/dashboard/DashboardScreen.tsx
git commit -m "feat: DashboardScreen with full layout, banner priority, pull-to-refresh"
```

---

## Task 6: Wire DashboardScreen into Navigator

**Files:**
- Modify: `src/app/Navigator.tsx`

- [ ] **Step 1: Replace Dashboard placeholder with real screen**

Import `DashboardScreen` from `../screens/dashboard/DashboardScreen` and replace `makePlaceholder('Dashboard')`.

- [ ] **Step 2: Verify TypeScript compiles + App test passes**

- [ ] **Step 3: Commit**

```bash
git add src/app/Navigator.tsx
git commit -m "feat: wire DashboardScreen into Navigator"
```

---

## Task 7: Full Verification

- [ ] **Step 1: TypeScript check**
- [ ] **Step 2: Full test suite**
- [ ] **Step 3: Verification checklist**

```
✅ / ❌  Check
─────────────────────────────────────────────────────────
[ ]  BackupReminderBanner: shows when seedConfirmed false + onboarding complete
[ ]  BackupReminderBanner: session dismiss only (not permanent)
[ ]  BackupReminderBanner: after 3 dismisses → no X button
[ ]  BackupReminderBanner: noc-warning color (rgba(251,191,36,...))
[ ]  Banner priority: backup > offline > update (never 2 simultaneously)
[ ]  Dashboard layout order: StatusBar → WalletChip → ModeToggle → banners → BalanceCard → QuickActions → Tokens
[ ]  WalletChip: truncated address + copy
[ ]  ModeToggle: Transparent/Private toggle
[ ]  BalanceCard: SOL + NOC + USD total, "•••••" when hidden
[ ]  QuickActions: Send, Receive, Stake active; Swap disabled 50% opacity
[ ]  Swap tap: "Coming Soon" modal (NOT navigation)
[ ]  TokenRow: NOC pinned at top
[ ]  TokenRow: trust badge for unknown tier
[ ]  Pull-to-refresh: triggers forceSync()
[ ]  forceSync: fetches balances + updates walletStore
[ ]  backgroundSync: registerBackgroundTask stub
[ ]  DashboardScreen wired into Navigator
[ ]  TypeScript strict: zero errors
[ ]  All tests pass
```
