export type CircuitId = 'deposit' | 'withdraw' | 'withdraw_change' | 'transfer';

export interface ZkeyAsset {
  /** Pinned download URL for the circuit's proving key. */
  url: string;
  /** Lowercase hex SHA-256 of the .zkey file. Verified before use. */
  sha256: string;
}

/**
 * Proving-key assets per circuit. url + sha256 are delivered by the ZK/ICO team
 * (see spec §10). Empty = not yet delivered → zkeyAsset() throws → local proving
 * reports unsupported for that circuit (fail-closed). Populate on delivery.
 */
export const ZKEY_ASSETS: Record<CircuitId, ZkeyAsset> = {
  deposit: {url: '', sha256: ''},
  withdraw: {url: '', sha256: ''},
  withdraw_change: {url: '', sha256: ''},
  transfer: {url: '', sha256: ''},
};

export function zkeyAsset(id: CircuitId): ZkeyAsset {
  const a = ZKEY_ASSETS[id];
  if (!a || !a.url || !a.sha256) {
    throw new Error(`zkey asset for '${id}' is not configured`);
  }
  return a;
}
