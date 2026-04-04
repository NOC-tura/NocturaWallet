import type {StateStorage} from 'zustand/middleware';
import {mmkvPublic} from './instances';

export const mmkvPublicStorage: StateStorage = {
  getItem: (name: string) => mmkvPublic.getString(name) ?? null,
  setItem: (name: string, value: string) => mmkvPublic.set(name, value),
  removeItem: (name: string) => mmkvPublic.remove(name),
};
