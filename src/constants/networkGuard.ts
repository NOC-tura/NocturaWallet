/**
 * Fail-closed configuration guards.
 *
 * These exist because every misconfiguration in this app previously failed
 * OPEN, and in the expensive direction:
 *
 *  - `Config.NETWORK as 'devnet' | 'mainnet-beta'` is an unchecked cast, and
 *    `IS_DEVNET = NETWORK === 'devnet'` makes MAINNET the default branch of five
 *    ternaries (NOC_MINT, PROGRAM_ID, ADMIN_ADDRESS, SOL_TREASURY,
 *    NOCTURA_FEE_TREASURY). A missing dotenv wiring — a documented hazard in
 *    this project — therefore selected real money silently.
 *  - Shielded mode without `LOCAL_PROVING=true` routes the full private witness
 *    to the hosted prover, handing over spend authority with no UI difference.
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
        `expected one of ${KNOWN_NETWORKS.join(' | ')}. Refusing to start: an ` +
        'unrecognised value would select the mainnet mint, program and treasuries.',
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
      '[NOCTURA] FEATURES_SHIELDED=true requires LOCAL_PROVING=true. Without it ' +
        'the full private witness — including the note secret, which is the ' +
        'entire spend authority — is sent to the hosted prover.',
    );
  }
}


