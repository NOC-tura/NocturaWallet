import {renderHook, act} from '@testing-library/react-native';
import type {AppStateStatus} from 'react-native';
import {useSessionGuard} from '../useSessionGuard';
import {useSessionStore} from '../../store/zustand/sessionStore';

// ── AppState mock ─────────────────────────────────────────────────────────────
// We maintain a module-level listener list so tests can trigger state changes.
type AppStateListener = (state: AppStateStatus) => void;
const appStateListeners: AppStateListener[] = [];
let mockCurrentState: AppStateStatus = 'active';

jest.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return mockCurrentState;
    },
    addEventListener: jest.fn((_event: string, listener: AppStateListener) => {
      appStateListeners.push(listener);
      return {
        remove: jest.fn(() => {
          const idx = appStateListeners.indexOf(listener);
          if (idx !== -1) appStateListeners.splice(idx, 1);
        }),
      };
    }),
  },
}));

function triggerAppState(state: AppStateStatus) {
  mockCurrentState = state;
  appStateListeners.forEach(l => l(state));
}

// ── sessionStore mock ─────────────────────────────────────────────────────────
jest.mock('../../store/zustand/sessionStore', () => ({
  useSessionStore: {
    getState: jest.fn(),
  },
}));

const mockGetState = useSessionStore.getState as jest.Mock;

function makeSession({
  isUnlocked,
  expired,
}: {
  isUnlocked: boolean;
  expired: boolean;
}) {
  const lock = jest.fn();
  mockGetState.mockReturnValue({
    isUnlocked,
    isExpired: () => expired,
    lock,
  });
  return {lock};
}

// ── lifecycle ─────────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  appStateListeners.length = 0;
  mockCurrentState = 'active';
});

afterEach(() => {
  jest.useRealTimers();
});

// ── tests ─────────────────────────────────────────────────────────────────────
describe('useSessionGuard', () => {
  it('does not fire onSessionExpired when session is not expired', () => {
    makeSession({isUnlocked: true, expired: false});
    const onExpired = jest.fn();
    renderHook(() => useSessionGuard(onExpired));

    act(() => {
      jest.advanceTimersByTime(30_000);
    });

    expect(onExpired).not.toHaveBeenCalled();
  });

  it('fires onSessionExpired when periodic check detects expiry', () => {
    const {lock} = makeSession({isUnlocked: true, expired: true});
    const onExpired = jest.fn();
    renderHook(() => useSessionGuard(onExpired));

    act(() => {
      jest.advanceTimersByTime(30_000);
    });

    expect(lock).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('calls lock() on the session store when expired', () => {
    const {lock} = makeSession({isUnlocked: true, expired: true});
    const onExpired = jest.fn();
    renderHook(() => useSessionGuard(onExpired));

    act(() => {
      jest.advanceTimersByTime(30_000);
    });

    expect(lock).toHaveBeenCalledTimes(1);
  });

  it('checks on AppState "active" transition', () => {
    const {lock} = makeSession({isUnlocked: true, expired: true});
    const onExpired = jest.fn();
    renderHook(() => useSessionGuard(onExpired));

    // background → no check
    act(() => {
      triggerAppState('background');
    });
    expect(onExpired).not.toHaveBeenCalled();

    // foreground → check fires
    act(() => {
      triggerAppState('active');
    });
    expect(lock).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('does not fire when session is locked (isUnlocked false)', () => {
    const {lock} = makeSession({isUnlocked: false, expired: true});
    const onExpired = jest.fn();
    renderHook(() => useSessionGuard(onExpired));

    act(() => {
      triggerAppState('active');
      jest.advanceTimersByTime(30_000);
    });

    expect(lock).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('clears interval and removes AppState listener on unmount', () => {
    makeSession({isUnlocked: false, expired: false});
    const onExpired = jest.fn();
    const {unmount} = renderHook(() => useSessionGuard(onExpired));

    expect(appStateListeners).toHaveLength(1);

    unmount();

    expect(appStateListeners).toHaveLength(0);

    // Advancing timers after unmount should not throw or fire callback
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(onExpired).not.toHaveBeenCalled();
  });
});
