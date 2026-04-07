import {create} from 'zustand';
import {useSecureSettingsStore} from './secureSettingsStore';

const DEFAULT_TIMEOUT_MINUTES = 5;

function getTimeoutMs(): number {
  const minutes = useSecureSettingsStore.getState().sessionTimeoutMinutes;
  return (minutes > 0 ? minutes : DEFAULT_TIMEOUT_MINUTES) * 60 * 1000;
}

interface SessionState {
  isUnlocked: boolean;
  unlockedAt: number | null;
  lastActiveAt: number | null;
  sessionExpiresAt: number | null;

  unlock: () => void;
  lock: () => void;
  touchActivity: () => void;
  isExpired: () => boolean;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  isUnlocked: false,
  unlockedAt: null,
  lastActiveAt: null,
  sessionExpiresAt: null,

  unlock: () => {
    const now = Date.now();
    set({
      isUnlocked: true,
      unlockedAt: now,
      lastActiveAt: now,
      sessionExpiresAt: now + getTimeoutMs(),
    });
  },

  lock: () =>
    set({
      isUnlocked: false,
      unlockedAt: null,
      lastActiveAt: null,
      sessionExpiresAt: null,
    }),

  touchActivity: () => {
    const now = Date.now();
    set({
      lastActiveAt: now,
      sessionExpiresAt: now + getTimeoutMs(),
    });
  },

  isExpired: () => {
    const {sessionExpiresAt} = get();
    if (!sessionExpiresAt) return true;
    return Date.now() > sessionExpiresAt;
  },
}));
