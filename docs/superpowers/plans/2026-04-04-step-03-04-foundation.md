# Step 3–4: Error Taxonomy Verification + Network Status Hook

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify Step 3 (error taxonomy, already built) is spec-complete, then build Step 4: the `useNetworkStatus` hook and `OfflineBanner` component for offline detection and graceful degradation.

**Architecture:** `useNetworkStatus` wraps `@react-native-community/netinfo` and exposes `isOnline`, `isInternetReachable`, and a `lastOnlineAt` timestamp. `OfflineBanner` is a presentational component that displays "Offline — showing data from [date]" when connectivity is lost. The banner integrates into the Dashboard layout with priority: BackupReminder > Offline > AppUpdate (only one shown at a time). On reconnect, consumers can trigger `forceSync()`.

**Tech Stack:** @react-native-community/netinfo, React Native, NativeWind v4, Zustand (walletStore.lastSyncedAt)

**Validated decisions:** See `docs/superpowers/specs/2026-04-04-architecture-validation-design.md`

---

## File Structure

```
src/
├── hooks/
│   ├── useNetworkStatus.ts        — NetInfo wrapper hook (isOnline, connectionType, lastOnlineAt)
│   └── __tests__/
│       └── useNetworkStatus.test.ts
├── components/
│   └── OfflineBanner.tsx          — "Offline — showing data from [date]" banner
│       └── __tests__/
│           └── OfflineBanner.test.tsx
(root)
├── __mocks__/
│   └── @react-native-community/
│       └── netinfo.ts             — Jest mock for NetInfo
├── package.json                   — MODIFIED (add @react-native-community/netinfo)
```

---

## Task 1: Verify Error Taxonomy (Step 3)

**Files:**
- Read: `src/constants/errors.ts`

- [ ] **Step 1: Confirm error taxonomy is complete**

Run verification: count error codes and confirm all 41 are present.
```bash
grep -c "code: 'E" src/constants/errors.ts
```
Expected: 41

- [ ] **Step 2: Confirm ErrorCode type is exported**

```bash
grep "export type ErrorCode" src/constants/errors.ts
```
Expected: `export type ErrorCode = keyof typeof ERROR_CODES;`

- [ ] **Step 3: Confirm no hardcoded error strings elsewhere in src/**

```bash
grep -r "E0[0-9][0-9]\|E1[0-9][0-9]" src/ --include="*.ts" --include="*.tsx" -l
```
Expected: Only `src/constants/errors.ts`

- [ ] **Step 4: Commit (no changes expected — just verification)**

If no changes needed:
```
echo "Step 3 (error taxonomy) verified complete — 41/41 codes, no changes needed"
```

---

## Task 2: Install @react-native-community/netinfo

**Files:**
- Modify: `package.json`
- Create: `__mocks__/@react-native-community/netinfo.ts`

- [ ] **Step 1: Install netinfo**

```bash
npm install @react-native-community/netinfo
```

- [ ] **Step 2: Create Jest mock for NetInfo**

Create `__mocks__/@react-native-community/netinfo.ts`:
```typescript
type NetInfoStateType = 'wifi' | 'cellular' | 'none' | 'unknown';

interface NetInfoState {
  type: NetInfoStateType;
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}

type Listener = (state: NetInfoState) => void;

let _currentState: NetInfoState = {
  type: 'wifi',
  isConnected: true,
  isInternetReachable: true,
};

const _listeners: Set<Listener> = new Set();

const NetInfo = {
  fetch: jest.fn(() => Promise.resolve(_currentState)),

  addEventListener: jest.fn((listener: Listener) => {
    _listeners.add(listener);
    // Immediately fire with current state (matches real behavior)
    listener(_currentState);
    return () => {
      _listeners.delete(listener);
    };
  }),

  // Test helper — not part of real API
  __setMockState(state: Partial<NetInfoState>) {
    _currentState = {..._currentState, ...state};
    _listeners.forEach(l => l(_currentState));
  },

  // Test helper — reset between tests
  __reset() {
    _currentState = {type: 'wifi', isConnected: true, isInternetReachable: true};
    _listeners.clear();
    NetInfo.fetch.mockClear();
    NetInfo.addEventListener.mockClear();
  },
};

export default NetInfo;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json "__mocks__/@react-native-community/"
git commit -m "deps: add @react-native-community/netinfo with Jest mock"
```

---

## Task 3: useNetworkStatus Hook (TDD)

**Files:**
- Create: `src/hooks/__tests__/useNetworkStatus.test.ts`
- Create: `src/hooks/useNetworkStatus.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/__tests__/useNetworkStatus.test.ts`:
```typescript
import {renderHook, act} from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import {useNetworkStatus} from '../useNetworkStatus';

// Access mock helpers
const mockNetInfo = NetInfo as typeof NetInfo & {
  __setMockState: (state: {
    type?: string;
    isConnected?: boolean | null;
    isInternetReachable?: boolean | null;
  }) => void;
  __reset: () => void;
};

describe('useNetworkStatus', () => {
  beforeEach(() => {
    mockNetInfo.__reset();
  });

  it('returns online by default', () => {
    const {result} = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isInternetReachable).toBe(true);
  });

  it('detects offline state', () => {
    mockNetInfo.__setMockState({isConnected: false, isInternetReachable: false, type: 'none'});
    const {result} = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(false);
  });

  it('tracks connection type', () => {
    mockNetInfo.__setMockState({type: 'cellular'});
    const {result} = renderHook(() => useNetworkStatus());
    expect(result.current.connectionType).toBe('cellular');
  });

  it('updates lastOnlineAt when going offline', () => {
    const {result} = renderHook(() => useNetworkStatus());
    const beforeOffline = Date.now();

    act(() => {
      mockNetInfo.__setMockState({isConnected: false, isInternetReachable: false});
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.lastOnlineAt).toBeGreaterThanOrEqual(beforeOffline - 100);
    expect(result.current.lastOnlineAt).toBeLessThanOrEqual(Date.now());
  });

  it('updates when connection changes', () => {
    const {result} = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);

    act(() => {
      mockNetInfo.__setMockState({isConnected: false, isInternetReachable: false});
    });
    expect(result.current.isOnline).toBe(false);

    act(() => {
      mockNetInfo.__setMockState({isConnected: true, isInternetReachable: true});
    });
    expect(result.current.isOnline).toBe(true);
  });

  it('subscribes to NetInfo on mount', () => {
    renderHook(() => useNetworkStatus());
    expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on unmount', () => {
    const {unmount} = renderHook(() => useNetworkStatus());
    unmount();
    // Verify the unsubscribe function was called (addEventListener returns it)
    // After unmount, state changes should not cause errors
    act(() => {
      mockNetInfo.__setMockState({isConnected: false});
    });
    // No error thrown = success
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/hooks/__tests__/useNetworkStatus.test.ts --no-cache`
Expected: FAIL — cannot find module '../useNetworkStatus'

- [ ] **Step 3: Implement useNetworkStatus**

Create `src/hooks/useNetworkStatus.ts`:
```typescript
import {useEffect, useRef, useState} from 'react';
import NetInfo from '@react-native-community/netinfo';

interface NetworkStatus {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  connectionType: string;
  lastOnlineAt: number | null;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,
    isInternetReachable: null,
    connectionType: 'unknown',
    lastOnlineAt: null,
  });
  const wasOnline = useRef(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true;

      setStatus(prev => ({
        isOnline: online,
        isInternetReachable: state.isInternetReachable,
        connectionType: state.type,
        // Record timestamp when transitioning from online → offline
        lastOnlineAt:
          wasOnline.current && !online ? Date.now() : prev.lastOnlineAt,
      }));

      wasOnline.current = online;
    });

    return unsubscribe;
  }, []);

  return status;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/hooks/__tests__/useNetworkStatus.test.ts --no-cache`
Expected: PASS (7 tests)

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/hooks/
git commit -m "feat: useNetworkStatus hook for offline detection"
```

---

## Task 4: OfflineBanner Component (TDD)

**Files:**
- Create: `src/components/__tests__/OfflineBanner.test.tsx`
- Create: `src/components/OfflineBanner.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/__tests__/OfflineBanner.test.tsx`:
```typescript
import React from 'react';
import {render} from '@testing-library/react-native';
import {OfflineBanner} from '../OfflineBanner';

describe('OfflineBanner', () => {
  it('renders nothing when online', () => {
    const {queryByText} = render(
      <OfflineBanner isOnline={true} lastSyncedAt={null} />,
    );
    expect(queryByText(/offline/i)).toBeNull();
  });

  it('renders offline message when not online', () => {
    const {getByText} = render(
      <OfflineBanner isOnline={false} lastSyncedAt={null} />,
    );
    expect(getByText(/offline/i)).toBeTruthy();
  });

  it('shows last synced date when available', () => {
    const syncTime = new Date('2026-04-04T12:00:00Z').getTime();
    const {getByText} = render(
      <OfflineBanner isOnline={false} lastSyncedAt={syncTime} />,
    );
    // Should contain some date representation
    expect(getByText(/showing data from/i)).toBeTruthy();
  });

  it('shows generic message when no sync date', () => {
    const {getByText} = render(
      <OfflineBanner isOnline={false} lastSyncedAt={null} />,
    );
    expect(getByText(/offline/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/components/__tests__/OfflineBanner.test.tsx --no-cache`
Expected: FAIL — cannot find module '../OfflineBanner'

- [ ] **Step 3: Implement OfflineBanner**

Create `src/components/OfflineBanner.tsx`:
```typescript
import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

interface OfflineBannerProps {
  isOnline: boolean;
  lastSyncedAt: number | null;
}

function formatSyncDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
}

export function OfflineBanner({isOnline, lastSyncedAt}: OfflineBannerProps) {
  if (isOnline) return null;

  const message = lastSyncedAt
    ? `Offline — showing data from ${formatSyncDate(lastSyncedAt)}`
    : 'Offline — no internet connection';

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(248,113,113,0.25)',
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
    color: '#F87171',
    textAlign: 'center',
  },
});
```

Note: Uses StyleSheet instead of NativeWind because the OfflineBanner is a system-level component that renders early in the tree (before NativeWind may be fully initialized on cold start). Consistent with the spec's guidance that system-level banners can use StyleSheet.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/components/__tests__/OfflineBanner.test.tsx --no-cache`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: OfflineBanner component for offline state display"
```

---

## Task 5: Full Verification + Run All Tests

**Files:**
- None modified

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors)

- [ ] **Step 2: Run full test suite**

Run: `npx jest --no-cache`
Expected: PASS (all suites — 16 existing + 7 useNetworkStatus + 4 OfflineBanner = 27 tests)

- [ ] **Step 3: Verification checklist**

```
✅ / ❌  Check
─────────────────────────────────────────────────────────
[ ]  Error taxonomy: 41 error codes in src/constants/errors.ts
[ ]  ErrorCode type exported
[ ]  No hardcoded error strings outside errors.ts
[ ]  @react-native-community/netinfo installed
[ ]  useNetworkStatus hook: isOnline, isInternetReachable, connectionType, lastOnlineAt
[ ]  useNetworkStatus subscribes on mount, unsubscribes on unmount
[ ]  lastOnlineAt records timestamp on online→offline transition
[ ]  OfflineBanner renders nothing when online
[ ]  OfflineBanner shows "Offline — showing data from [date]" when offline
[ ]  OfflineBanner uses noc-danger color (#F87171) per design tokens
[ ]  NetInfo Jest mock with __setMockState and __reset helpers
[ ]  TypeScript strict: zero errors
[ ]  All tests pass
```
