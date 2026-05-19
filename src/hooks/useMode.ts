import {useContext} from 'react';
import {ModeContext} from '../contexts/ModeContext';
import type {Mode} from '../contexts/ModeContext';
import {useShieldedStore} from '../store/zustand/shieldedStore';

/**
 * Returns the effective mode for the calling component.
 *
 * Resolution order:
 *   1. Nearest <ModeScope> ancestor — local override (per-row markers, scoped
 *      screen variants per Section VI pattern)
 *   2. Global zustand store (`useShieldedStore().mode`) — defaults to
 *      'transparent', persisted in MMKV under `noctura-shielded`
 *
 * This bridges the design-system mode awareness (data-mode in HTML mockup) with
 * runtime React Native styling. Components consume the hook then compose
 * className based on the returned value.
 *
 * For accent colors specifically, prefer `useAccentColor()` / `useAccentBgClass()`
 * / `useAccentTextClass()` from `./useAccent` — they encapsulate the mode→color
 * mapping so callers don't duplicate the ternary.
 */
export function useMode(): Mode {
  const scopedMode = useContext(ModeContext);
  const storeMode = useShieldedStore(s => s.mode);
  return scopedMode ?? storeMode;
}
