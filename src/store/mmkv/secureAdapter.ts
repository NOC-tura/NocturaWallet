import type {StateStorage} from 'zustand/middleware';
import {mmkvSecure, onSecureMmkvReady} from './instances';

/**
 * Queued writes that arrived before initSecureMmkv().
 * Replayed in order when the secure store becomes available.
 * This prevents silent data loss during early app lifecycle
 * (e.g., presaleStore mutations during onboarding).
 *
 * Uses a Map for deduplication — only the latest write per key is kept,
 * preventing unbounded memory growth from repeated Zustand persist calls.
 */
const pendingWrites = new Map<string, {type: 'set'; value: string} | {type: 'remove'}>();
let replayRegistered = false;

function ensureReplayRegistered(): void {
  if (replayRegistered) return;
  replayRegistered = true;
  onSecureMmkvReady(store => {
    for (const [name, op] of pendingWrites) {
      if (op.type === 'set') {
        store.set(name, op.value);
      } else {
        store.remove(name);
      }
    }
    pendingWrites.clear();
  });
}

export const mmkvSecureStorage: StateStorage = {
  getItem: (name: string) => {
    const store = mmkvSecure();
    if (store) return store.getString(name) ?? null;
    // Return the most recent queued value if not yet persisted
    const pending = pendingWrites.get(name);
    if (pending) {
      return pending.type === 'set' ? pending.value : null;
    }
    return null;
  },
  setItem: (name: string, value: string) => {
    const store = mmkvSecure();
    if (!store) {
      // Queue (deduplicated by key — last write wins)
      pendingWrites.set(name, {type: 'set', value});
      ensureReplayRegistered();
      return;
    }
    store.set(name, value);
  },
  removeItem: (name: string) => {
    const store = mmkvSecure();
    if (!store) {
      pendingWrites.set(name, {type: 'remove'});
      ensureReplayRegistered();
      return;
    }
    store.remove(name);
  },
};

/** Reset queue state for testing. */
export function _resetSecureAdapterForTest(): void {
  pendingWrites.clear();
  replayRegistered = false;
}
