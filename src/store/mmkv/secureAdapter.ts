import type {StateStorage} from 'zustand/middleware';
import {mmkvSecure} from './instances';

export const mmkvSecureStorage: StateStorage = {
  getItem: (name: string) => {
    const store = mmkvSecure();
    if (!store) return null;
    return store.getString(name) ?? null;
  },
  setItem: (name: string, value: string) => {
    const store = mmkvSecure();
    if (!store) {
      if (__DEV__) {
        console.warn(`mmkvSecureStorage.setItem('${name}') called before secure MMKV initialized`);
      }
      return;
    }
    store.set(name, value);
  },
  removeItem: (name: string) => {
    const store = mmkvSecure();
    if (!store) return;
    store.remove(name);
  },
};
