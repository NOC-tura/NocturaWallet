import type {StateStorage} from 'zustand/middleware';
import {mmkvSecure, onSecureMmkvReady} from './instances';

/**
 * Queued writes that arrived before initSecureMmkv().
 * Replayed in order when the secure store becomes available.
 * This prevents silent data loss during early app lifecycle
 * (e.g., presaleStore mutations during onboarding).
 */
type QueuedWrite = {type: 'set'; name: string; value: string} | {type: 'remove'; name: string};
const pendingWrites: QueuedWrite[] = [];
let replayRegistered = false;

function ensureReplayRegistered(): void {
  if (replayRegistered) return;
  replayRegistered = true;
  onSecureMmkvReady(store => {
    for (const op of pendingWrites) {
      if (op.type === 'set') {
        store.set(op.name, op.value);
      } else {
        store.remove(op.name);
      }
    }
    pendingWrites.length = 0;
  });
}

export const mmkvSecureStorage: StateStorage = {
  getItem: (name: string) => {
    const store = mmkvSecure();
    if (!store) return null;
    return store.getString(name) ?? null;
  },
  setItem: (name: string, value: string) => {
    const store = mmkvSecure();
    if (!store) {
      // Queue the write for replay when secure MMKV initializes
      pendingWrites.push({type: 'set', name, value});
      ensureReplayRegistered();
      return;
    }
    store.set(name, value);
  },
  removeItem: (name: string) => {
    const store = mmkvSecure();
    if (!store) {
      pendingWrites.push({type: 'remove', name});
      ensureReplayRegistered();
      return;
    }
    store.remove(name);
  },
};
