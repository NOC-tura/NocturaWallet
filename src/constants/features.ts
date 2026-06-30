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
} as const;

/** Whether shielded mode is enabled in this build. */
export function isShieldedEnabled(): boolean {
  return FEATURES.shielded;
}
