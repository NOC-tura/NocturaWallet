/**
 * Fail-closed configuration guards.
 *
 * These exist because every misconfiguration in this app previously failed
 * OPEN, and in the expensive direction:
 *
 *  - `Config.NETWORK as 'devnet' | 'mainnet-beta'` was an unchecked cast whose
 *    default branch was MAINNET. A missing dotenv wiring — a documented hazard in
 *    this project — therefore selected real money silently. NETWORK is the build's
 *    chain identity (constants/chain.ts: the network the screens name, the
 *    explorer cluster, whether presale exists), so an unknown or missing value is
 *    refused, never read as mainnet.
 *  - Shielded mode without `LOCAL_PROVING=true` would reach a hosted prover with
 *    the private witness, with no UI difference.
 *  - Shielded mode on mainnet: the A0 pool is a devnet deployment; a shielded build
 *    with NETWORK=mainnet-beta would name mainnet over devnet facts (spec S13).
 *
 * A guard that throws at import is noisy and unmissable. A default that picks
 * mainnet is quiet and wrong, which is the worse failure for a wallet.
 */

const KNOWN_NETWORKS = ['devnet', 'mainnet-beta'] as const;
export type KnownNetwork = (typeof KNOWN_NETWORKS)[number];

/** Throw unless `value` is exactly one of the supported cluster identifiers. */
export function assertKnownNetwork(value: string | undefined): asserts value is KnownNetwork {
  if (!KNOWN_NETWORKS.includes(value as KnownNetwork)) {
    throw new Error(
      `[NOCTURA] NETWORK is ${value === undefined ? 'not set' : `"${value}"`} — ` +
        `expected one of ${KNOWN_NETWORKS.join(' | ')}. Refusing to start: the ` +
        'network decides what the app shows and links to, and it is never guessed.',
    );
  }
}

/** Shielded mode must never fall back to hosted proving. */
export function assertShieldedRequiresLocalProving(
  shielded: boolean,
  localProving: boolean,
): void {
  if (shielded && !localProving) {
    throw new Error(
      '[NOCTURA] FEATURES_SHIELDED=true requires LOCAL_PROVING=true: shielded ' +
        'proofs are made on this device only, never by a hosted prover.',
    );
  }
}

/** Shielded mode exists only on devnet (the A0 pool is a devnet deployment). */
export function assertShieldedRequiresDevnet(shielded: boolean, network: KnownNetwork): void {
  if (shielded && network !== 'devnet') {
    throw new Error(
      `[NOCTURA] FEATURES_SHIELDED=true requires NETWORK=devnet (it is "${network}"): ` +
        'the shielded pool is a devnet deployment, and the build would name the wrong network.',
    );
  }
}
