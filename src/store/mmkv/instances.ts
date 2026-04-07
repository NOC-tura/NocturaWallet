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
