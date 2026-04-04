import {createMMKV} from 'react-native-mmkv';
import type {MMKV} from 'react-native-mmkv';

// Always available — non-sensitive settings, onboarding flags
export const mmkvPublic = createMMKV({id: 'noctura-public'});

// Lazy-initialized after onboarding when mnemonic-derived encryption key is available
let _mmkvSecure: MMKV | null = null;

export function mmkvSecure(): MMKV | null {
  return _mmkvSecure;
}

export function initSecureMmkv(encryptionKey: string): void {
  _mmkvSecure = createMMKV({id: 'noctura-secure', encryptionKey});
}
