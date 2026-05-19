import React, {createContext, ReactNode} from 'react';

/**
 * Noctura mode type — Transparent (standard Solana) vs Shielded (ZK-private).
 *
 * Source of truth for the GLOBAL mode is `useShieldedStore().mode`, persisted in
 * MMKV. ModeScope (below) lets a sub-tree LOCALLY override the global mode for
 * per-row mode markers (Section VI per-row pattern — e.g., #25 portfolio
 * allocation rows where each row shows its own transparent / shielded marker
 * independent of the screen's current mode).
 */
export type Mode = 'transparent' | 'shielded';

/**
 * Context value — `undefined` means "no scope override, fall back to global store".
 * Consumers should use the `useMode()` hook rather than reading this directly,
 * because the hook handles the fallback to zustand store.
 */
export const ModeContext = createContext<Mode | undefined>(undefined);

interface ModeScopeProps {
  /** Mode that overrides the global mode for descendants of this scope. */
  mode: Mode;
  children: ReactNode;
}

/**
 * Wraps a sub-tree to override the parent / global mode for descendants.
 *
 * Usage — per-row mode marker (Section VI pattern):
 *   <AllocationRow token={t}>
 *     <ModeScope mode={t.mode}>
 *       <Dot />               // resolves to t.mode's accent, not screen's mode
 *     </ModeScope>
 *   </AllocationRow>
 *
 * Usage — entire screen in a specific mode (Section II/III pattern):
 *   <ModeScope mode="shielded">
 *     <ZkProofScreen />       // always shielded, regardless of global mode
 *   </ModeScope>
 */
export function ModeScope({mode, children}: ModeScopeProps) {
  return <ModeContext.Provider value={mode}>{children}</ModeContext.Provider>;
}
