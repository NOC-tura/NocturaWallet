import {create} from 'zustand';

const DEFAULT_TIMEOUT_MINUTES = 5;

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
      sessionExpiresAt: now + DEFAULT_TIMEOUT_MINUTES * 60 * 1000,
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
      sessionExpiresAt: now + DEFAULT_TIMEOUT_MINUTES * 60 * 1000,
    });
  },

  isExpired: () => {
    const {sessionExpiresAt} = get();
    if (!sessionExpiresAt) return true;
    return Date.now() > sessionExpiresAt;
  },
}));
