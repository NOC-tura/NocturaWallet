import {createMMKV} from 'react-native-mmkv';
import type {MMKV} from 'react-native-mmkv';

// Always available — non-sensitive settings, onboarding flags
export const mmkvPublic = createMMKV({id: 'noctura-public'});

// Lazy-initialized after onboarding when mnemonic-derived encryption key is available
let _mmkvSecure: MMKV | null = null;

/** Callbacks to fire after secure MMKV is initialized (e.g., replay queued writes). */
const _initCallbacks: Array<(store: MMKV) => void> = [];

export function mmkvSecure(): MMKV | null {
  return _mmkvSecure;
}

/** Register a callback to run when initSecureMmkv is called. */
export function onSecureMmkvReady(cb: (store: MMKV) => void): void {
  if (_mmkvSecure) {
    cb(_mmkvSecure);
  } else {
    _initCallbacks.push(cb);
  }
}

export function initSecureMmkv(encryptionKey: string): void {
  _mmkvSecure = createMMKV({id: 'noctura-secure', encryptionKey});
  // Replay any queued operations
  for (const cb of _initCallbacks) {
    cb(_mmkvSecure);
  }
  _initCallbacks.length = 0;
}

/**
 * Wipe both stores and close the secure handle.
 *
 * "Wipe wallet" previously reset the keychain and four Zustand stores and never
 * touched MMKV, so shielded notes, the merkle sync cache, the address book, the
 * derivation scheme and the PIN-lockout counters all survived — with the
 * decrypted secure handle still open in memory. A wipe that leaves the data is
 * worse than no wipe, because the user believes the device is clean.
 *
 * Dropping the handle also means the next unlock must re-derive the key from the
 * seed, so a stale handle cannot outlive the wallet it belonged to.
 */
export function clearAllStores(): void {
  mmkvPublic.clearAll();
  _mmkvSecure?.clearAll();
  _mmkvSecure = null;
  _initCallbacks.length = 0;
}
