import {useEffect, useRef} from 'react';
import {AppState} from 'react-native';
import {useSessionStore} from '../store/zustand/sessionStore';

/**
 * Enforces session timeout by checking expiry:
 * 1. When app returns to foreground (AppState 'active')
 * 2. Every 30 seconds while app is in foreground
 *
 * Calls onSessionExpired when the session has timed out.
 */
export function useSessionGuard(onSessionExpired: () => void): void {
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function checkExpiry() {
      const session = useSessionStore.getState();
      if (session.isUnlocked && session.isExpired()) {
        session.lock();
        onSessionExpired();
      }
    }

    // Check on foreground return
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        checkExpiry();
      }
    });

    // Periodic check every 30 seconds
    checkIntervalRef.current = setInterval(checkExpiry, 30_000);

    return () => {
      subscription.remove();
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [onSessionExpired]);
}
