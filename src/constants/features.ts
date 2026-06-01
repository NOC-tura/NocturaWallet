/**
 * Build-time feature flags. Single source of truth for gating unfinished
 * features out of a shippable build without deleting their code.
 */
export const FEATURES = {
  /**
   * Shielded (private) mode. false until ZK proving is live end-to-end
   * (backend prover + Polygen WASM). Flip to true to restore the shielded
   * UX exactly as designed (index.html s16–s18).
   */
  shielded: false,
} as const;

/** Whether shielded mode is enabled in this build. */
export function isShieldedEnabled(): boolean {
  return FEATURES.shielded;
}
