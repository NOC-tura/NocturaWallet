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
  /**
   * Private p2p shielded transfer. OFF — and it must stay off until the circuits
   * are redesigned.
   *
   * Confirmed from `transfer.circom` by the program side on 2026-08-08: no
   * circuit imposes any spend authorization. Spend authority is knowledge of
   * `noteSecret` alone, and in a transfer the SENDER generates the recipient's
   * `out_noteSecret`. The sender therefore holds the entire withdraw witness for
   * the note they just sent (`pkRecipientHash` is derivable from the public
   * `noc1…` address, `leafIndex` and the Merkle path are public on-chain), and
   * the nullifier is identical for both parties. Whoever proves first spends it.
   * A sent note is permanently co-owned by its sender — this is fund loss, not a
   * privacy weakness.
   *
   * Shield/unshield are NOT affected: there the depositor generates their own
   * `noteSecret` and no counterparty ever learns it.
   *
   * Re-enable only once the nullifier keys off a secret the sender never learns.
   */
  shieldedTransfer: Config.SHIELDED_TRANSFER === 'true',
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

/**
 * Whether private p2p transfer is available. Requires BOTH shielded mode and the
 * dedicated transfer flag, so a single stray env var cannot re-enable a flow that
 * currently lets the sender reclaim the note they sent (see FEATURES.shieldedTransfer).
 */
export function isShieldedTransferEnabled(): boolean {
  return FEATURES.shielded && FEATURES.shieldedTransfer;
}
