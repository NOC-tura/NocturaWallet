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

/** Root-stack route names that belong to shielded mode. */
export const SHIELDED_ROUTES = [
  'ShieldedExplainer',
  'ShieldedBalance',
  'ShieldedTransfer',
  'ShieldUnshield',
  'ShieldUnshieldModal',
  'Deposit',
  'Withdraw',
  'ZkProof',
] as const;

export type ShieldedRoute = (typeof SHIELDED_ROUTES)[number];

/** True if the given route name is a shielded route (gated by FEATURES.shielded). */
export function isShieldedRoute(name: string): boolean {
  return (SHIELDED_ROUTES as readonly string[]).includes(name);
}
