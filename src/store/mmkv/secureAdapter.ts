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
    if (!store) return;
    store.set(name, value);
  },
  removeItem: (name: string) => {
    const store = mmkvSecure();
    if (!store) return;
    store.remove(name);
  },
};
