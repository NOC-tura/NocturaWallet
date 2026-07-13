import Config from 'react-native-config';

/**
 * Build-time feature flags. Single source of truth for gating unfinished
 * features out of a shippable build without deleting their code.
 */
export const FEATURES = {
  /**
   * Shielded (private) mode. OFF by default (mainnet/production builds); enabled
   * ONLY when the build's env sets FEATURES_SHIELDED=true (the devnet test build,
   * `.env.devnet`). Keeps the committed default false while letting the devnet
   * APK exercise the shielded UX (index.html s16–s18). NOTE: in the current
   * devnet build only the shield/deposit flow is wired end-to-end; withdraw +
   * transfer are not yet implemented.
   */
  shielded: Config.FEATURES_SHIELDED === 'true',
  /**
   * Route shielded transfers through the coordinator relayer (coordinator is
   * fee_payer → the sender's transparent key never appears on-chain). When OFF,
   * transfers SELF-RELAY: the sender's own transparent key signs + pays, and is
   * therefore visible on-chain — a devnet/debug mode only, NOT private. This is a
   * deliberate hard switch, never a silent fallback: with the relayer ON, a
   * relayer failure aborts the transfer rather than quietly leaking the sender.
   * Enabled only when the build's env sets SHIELDED_RELAYER=true.
   */
  shieldedRelayer: Config.SHIELDED_RELAYER === 'true',
  /**
   * On-device ZK proving. OFF by default. When ON, shielded proofs are generated
   * locally (noteSecret never leaves the device) and the hosted prover is NOT used
   * for shielded ops — no silent fallback. Requires the native NocturaProver module
   * + the circuit assets to be present; enable only once those ship.
   */
  localProving: Config.LOCAL_PROVING === 'true',
} as const;

/** Whether shielded mode is enabled in this build. */
export function isShieldedEnabled(): boolean {
  return FEATURES.shielded;
}

/** Whether shielded transfers route through the privacy relayer (vs self-relay). */
export function isShieldedRelayerEnabled(): boolean {
  return FEATURES.shieldedRelayer;
}

/** Whether shielded proofs are generated on-device (vs the hosted prover). */
export function isLocalProvingEnabled(): boolean {
  return FEATURES.localProving;
}
