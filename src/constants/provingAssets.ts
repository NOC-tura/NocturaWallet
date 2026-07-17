import {SHIELDED_POOL_PROGRAM_ID} from './programs';

export type CircuitId = 'deposit' | 'withdraw' | 'withdraw_change' | 'transfer';

export interface PinnedAsset {
  /** Pinned download URL. */
  url: string;
  /** Lowercase hex SHA-256, verified before use. */
  sha256: string;
}
export interface CircuitAssets {
  zkey: PinnedAsset;
  wasm: PinnedAsset;
}

/**
 * The program these zkeys were built for. The wallet must transact with the same
 * program for an on-device proof to verify against its on-chain VK. Asserted at
 * import (below) against the wallet's configured shielded program — fail-closed.
 */
export const ZKEY_PROGRAM_ID = 'NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES';
export const ZKEY_CLUSTER = 'devnet';

/** Public-input count per circuit (from the deployed circuits' vk.json). Asserted
 *  against each returned proof so a wrong circuit/artifact fails closed. */
export const EXPECTED_NPUBLIC: Record<CircuitId, number> = {
  deposit: 3,
  withdraw: 5,
  withdraw_change: 6,
  transfer: 6,
};

// Source of truth: noc-presale zk/scripts/gen-zkey-manifest.mjs (drift-guarded in CI).
// circuitSetVersion=devnet-1 cluster=devnet programId=NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES
// SHA-256s pinned from the ICO hand-off (2026-07-17); verified against the hosted
// manifest at integration time. ensureCircuitAssets re-verifies every download.
const BASE = 'https://api.noc-tura.io/api/v1/zk-assets/v1';
export const ZKEY_ASSETS: Record<CircuitId, CircuitAssets> = {
  deposit: {
    zkey: {
      url: `${BASE}/deposit_final.zkey`,
      sha256: 'f11fec5007f7039ce6897689e4d6061b7276f82014c04600a006bfb9e7ffa821',
    },
    wasm: {
      url: `${BASE}/deposit.wasm`,
      sha256: 'b05ef3f39b7a839f7d063e3c3db8ca355053733b2817eaa5773a562f3b572984',
    },
  },
  withdraw: {
    zkey: {
      url: `${BASE}/withdraw_final.zkey`,
      sha256: 'abc7ef8345eaa247f83d5fb148a3670b9a201d4a5e2d068b9459db1acc319557',
    },
    wasm: {
      url: `${BASE}/withdraw.wasm`,
      sha256: '1af3b9f8abb9ebd5007bcdc71817bce52192d23f53adbcc7d7cd7bedaf9a111c',
    },
  },
  withdraw_change: {
    zkey: {
      url: `${BASE}/withdraw_change_final.zkey`,
      sha256: 'e67f948a5b2e5d812dc8966a0ed0255689a8a0cebf41768cacc2dda5f19ca7e3',
    },
    wasm: {
      url: `${BASE}/withdraw_change.wasm`,
      sha256: '36fd887f047b5d2a0a647780ed46e97138fdf57969c0892e3f91d6a8d939b15a',
    },
  },
  transfer: {
    zkey: {
      url: `${BASE}/transfer_final.zkey`,
      sha256: '858429d01b51fc801fe2e814fd292ea0901f84b19c349656ee5f3243f30d77ce',
    },
    wasm: {
      url: `${BASE}/transfer.wasm`,
      sha256: '2a7213170759b01d265f7df01ad76fc87a3de8ef28e34a9596ba6094b6a9f118',
    },
  },
};

// Fail-closed at import: the pinned zkeys must target the program we transact with.
if (ZKEY_PROGRAM_ID !== SHIELDED_POOL_PROGRAM_ID) {
  throw new Error(
    `ZKEY_PROGRAM_ID (${ZKEY_PROGRAM_ID}) != SHIELDED_POOL_PROGRAM_ID (${SHIELDED_POOL_PROGRAM_ID})`,
  );
}

/** Pinned zkey+wasm for a circuit. Throws if either url/sha256 is unset (fail-closed
 *  — an undelivered circuit is not provable). */
export function circuitAssets(id: CircuitId): CircuitAssets {
  const a = ZKEY_ASSETS[id];
  if (!a || !a.zkey.url || !a.zkey.sha256 || !a.wasm.url || !a.wasm.sha256) {
    throw new Error(`circuit assets for '${id}' are not configured`);
  }
  return a;
}
