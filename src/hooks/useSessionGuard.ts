import {useEffect, useRef} from 'react';
import {AppState} from 'react-native';
import {useSessionStore} from '../store/zustand/sessionStore';

/**
 * Enforces session timeout by checking expiry:
 * 1. When app returns to foreground (AppState 'active')
 * 2. Every 30 seconds while app is in foreground
 *
 * Calls onSessionExpired when the session has timed out.
 * Uses a ref for the callback to avoid recreating the interval on re-render.
 *
 * Note: JS is single-threaded so interval and AppState cannot truly race,
 * but the isUnlocked guard ensures lock()+callback fire at most once —
 * after lock(), isUnlocked is false and subsequent checks exit early.
 */
export function useSessionGuard(onSessionExpired: () => void): void {
  const onExpiredRef = useRef(onSessionExpired);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);

  // Keep callback ref up to date without recreating the effect
  useEffect(() => {
    onExpiredRef.current = onSessionExpired;
  });

  useEffect(() => {
    function checkExpiry() {
      const session = useSessionStore.getState();
      if (session.isUnlocked && session.isExpired()) {
        session.lock();
        onExpiredRef.current();
      }
    }

    // Check on foreground return
    const subscription = AppState.addEventListener('change', nextState => {
      appStateRef.current = nextState;
      if (nextState === 'active') {
        checkExpiry();
      }
    });

    // Periodic check every 30 seconds — only in foreground
    checkIntervalRef.current = setInterval(() => {
      if (appStateRef.current === 'active') {
        checkExpiry();
      }
    }, 30_000);

    return () => {
      subscription.remove();
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []); // stable — never recreated
}
