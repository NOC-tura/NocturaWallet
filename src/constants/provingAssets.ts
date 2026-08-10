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
//
// CONTENT-ADDRESSED. The bytes at these URLs cannot change, because the URL names
// them: `/h/<sha256>/<file>` serves only if the request digest equals the actual
// one, and only that route carries `immutable, max-age=1y`. The mutable
// `/v1/<file>` pointer is `max-age=300` and is NOT pinned here.
//
// This matters beyond tidiness. Rotating a zkey at an unversioned immutable URL
// would break every installed wallet at once: `ensureOne` deletes the file and
// throws on a hash mismatch, so proving would stop with no action by the user.
// What content-addressing buys is that installs which do NOT take a release keep
// working. It does NOT buy over-the-air circuit rotation — the pins below are
// compiled into the binary, and must be: pins fetched at runtime would let a
// compromised host serve any zkey with a matching hash, and the check would
// become decoration.
const BASE = 'https://api.noc-tura.io/api/v1/zk-assets';

/** Build a pinned asset. The URL is DERIVED from the digest, so a URL that
 *  disagrees with its pin cannot be written down here at all. */
const at = (sha256: string, file: string): PinnedAsset => ({
  url: `${BASE}/h/${sha256}/${file}`,
  sha256,
});
export const ZKEY_ASSETS: Record<CircuitId, CircuitAssets> = {
  deposit: {
    zkey: at('f11fec5007f7039ce6897689e4d6061b7276f82014c04600a006bfb9e7ffa821', 'deposit_final.zkey'),
    wasm: at('b05ef3f39b7a839f7d063e3c3db8ca355053733b2817eaa5773a562f3b572984', 'deposit.wasm'),
  },
  withdraw: {
    zkey: at('abc7ef8345eaa247f83d5fb148a3670b9a201d4a5e2d068b9459db1acc319557', 'withdraw_final.zkey'),
    wasm: at('1af3b9f8abb9ebd5007bcdc71817bce52192d23f53adbcc7d7cd7bedaf9a111c', 'withdraw.wasm'),
  },
  withdraw_change: {
    zkey: at('e67f948a5b2e5d812dc8966a0ed0255689a8a0cebf41768cacc2dda5f19ca7e3', 'withdraw_change_final.zkey'),
    wasm: at('36fd887f047b5d2a0a647780ed46e97138fdf57969c0892e3f91d6a8d939b15a', 'withdraw_change.wasm'),
  },
  transfer: {
    zkey: at('858429d01b51fc801fe2e814fd292ea0901f84b19c349656ee5f3243f30d77ce', 'transfer_final.zkey'),
    wasm: at('2a7213170759b01d265f7df01ad76fc87a3de8ef28e34a9596ba6094b6a9f118', 'transfer.wasm'),
  },
};

// Fail-closed at import: the pinned zkeys must target the program we transact with.
//
// NOTE ON WHAT THIS DOES AND DOESN'T CATCH. Both operands are hardcoded literals
// with no env input, so this fires only if a developer edits one string and not
// the other. It detects no runtime or environment misconfiguration, which is
// what the coherence check below is for.
if (ZKEY_PROGRAM_ID !== SHIELDED_POOL_PROGRAM_ID) {
  throw new Error(
    `ZKEY_PROGRAM_ID (${ZKEY_PROGRAM_ID}) != SHIELDED_POOL_PROGRAM_ID (${SHIELDED_POOL_PROGRAM_ID})`,
  );
}

// NOT asserted: ZKEY_CLUSTER === NETWORK. That comparison looks right and is
// wrong for this app. `.env.devnet` deliberately sets NETWORK=mainnet-beta —
// the transparent side (RPC, presale, NOC mint) is mainnet while the shielded
// pool is a devnet deployment. The two clusters legitimately differ, so the
// meaningful binding is artifacts→pool, which the ZKEY_PROGRAM_ID check above
// already enforces. Asserting against NETWORK would break the real devnet build.

/**
 * A pinned URL must NAME the bytes it points at. `at()` guarantees that by
 * construction; this catches a literal written by hand later, which would
 * silently reintroduce a mutable pointer under an immutable promise — the exact
 * failure content-addressing was adopted to remove.
 *
 * Exported so it can be tested against a deliberately bad input. A guard whose
 * only evidence is that it passes on good input has not been shown to guard.
 */
export function assertContentAddressed(assets: Record<string, CircuitAssets>): void {
  for (const [id, circuit] of Object.entries(assets)) {
    for (const [kind, asset] of Object.entries(circuit) as Array<[string, PinnedAsset]>) {
      if (!asset.url.includes(`/h/${asset.sha256}/`)) {
        throw new Error(
          `${id}.${kind} is pinned to a URL that does not name its digest: ${asset.url}`,
        );
      }
    }
  }
}
assertContentAddressed(ZKEY_ASSETS);

/** Pinned zkey+wasm for a circuit. Throws if either url/sha256 is unset (fail-closed
 *  — an undelivered circuit is not provable). */
export function circuitAssets(id: CircuitId): CircuitAssets {
  const a = ZKEY_ASSETS[id];
  if (!a || !a.zkey.url || !a.zkey.sha256 || !a.wasm.url || !a.wasm.sha256) {
    throw new Error(`circuit assets for '${id}' are not configured`);
  }
  return a;
}
