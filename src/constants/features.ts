import Config from 'react-native-config';
import {assertShieldedRequiresDevnet, assertShieldedRequiresLocalProving} from './networkGuard';
import {NETWORK} from './programs';

/**
 * Build-time feature flags. Single source of truth for gating unfinished
 * features out of a shippable build without deleting their code.
 */
export const FEATURES = {
  /**
   * Shielded (private) mode. OFF by default (mainnet/production builds); enabled
   * ONLY when the build's env sets FEATURES_SHIELDED=true (the devnet test build,
   * `.env.devnet`). The A0 pool exists on devnet only, so a shielded build must
   * also be a devnet build (asserted below). In M1b only the shield (deposit) side
   * is wired; the unshield side and the shielded transfer have no route until
   * their plans land (spec §12).
   */
  shielded: Config.FEATURES_SHIELDED === 'true',
  /**
   * On-device ZK proving. OFF by default. A0 proves only on the device (the Rust
   * core); there is no hosted prover. Shielded mode requires it (asserted below).
   */
  localProving: Config.LOCAL_PROVING === 'true',
} as const;

// Fail-closed at import. Shielded mode without local proving is refused (A0 has no
// hosted prover, and the check keeps any future one from being reached silently), and
// shielded mode on any chain but devnet is refused (the A0 pool is a devnet deployment:
// a shielded build pointed at mainnet would show mainnet labels over devnet facts).
assertShieldedRequiresLocalProving(FEATURES.shielded, FEATURES.localProving);
assertShieldedRequiresDevnet(FEATURES.shielded, NETWORK);

/** Whether shielded mode is enabled in this build. */
export function isShieldedEnabled(): boolean {
  return FEATURES.shielded;
}

/** Whether shielded proofs are generated on-device. */
export function isLocalProvingEnabled(): boolean {
  return FEATURES.localProving;
}
