/**
 * The A0 proving-key files as the app obtains them (spec §1 "A0 proving keys", R4): downloaded
 * from the content-addressed route, verified by sha256 before every use, cached on disk.
 *
 * TWO PINS, ON PURPOSE. Rust pins the same four files by sha256 AND length
 * (`native/noctura-prover/src/a0/keyfiles.rs`) and refuses any other bytes whatever JS hands it —
 * that is the control (a pin living only in the layer being attacked would not be one). The JS
 * pins below exist so the app downloads the right bytes and never hands native a file it has not
 * itself checked; `keyAssets.test.ts` reads `keyfiles.rs` and fails when the two disagree.
 *
 * NO HOSTED PROVING. The prover is the on-device Rust core (`a0Prove`); `/zk/prove` answers 410
 * (§1) and nothing here or in the deposit flow sends a witness anywhere.
 *
 * The URL is DERIVED from the digest (`/h/<sha256>/a0/<file>`), so a URL that disagrees with its
 * pin cannot be written down here, and the mutable `/a0/zkey-manifest.json` pointer is never
 * consulted at run time: pins fetched at run time would let a compromised host choose the zkey.
 */
import {
  assertContentAddressed,
  ensurePinnedAssets,
  type AssetIO,
  type CircuitAssets,
  type PinnedAsset,
} from '../../zkProver/provingAssets';
import type {A0Circuit} from '../../zkProver/nativeProverBridge';

const BASE = 'https://api.noc-tura.io/api/v1/zk-assets';

const at = (sha256: string, file: string): PinnedAsset => ({
  url: `${BASE}/h/${sha256}/a0/${file}`,
  sha256,
});

/** circuitSetVersion `devnet-a0-1` — single-party dev keys, devnet only (§1). */
export const A0_KEY_ASSETS: Readonly<Record<A0Circuit, CircuitAssets>> = {
  deposit: {
    zkey: at('fef08f0217a44c8c1629f5f8d670047461205c1fced83d7ea6fe763420e53fe9', 'deposit_final.zkey'),
    wasm: at('1d69d7f89792a31d4c7780afa52b2f11707a4347f61382e7b294f4848d7dfff1', 'deposit.wasm'),
  },
  withdraw_change: {
    zkey: at('ec55bdbbbfedb9823a57e5a3131c457a259fe8a690c087b82ad8b7efd3d756f2', 'withdraw_change_final.zkey'),
    wasm: at('01b0ec1f28dec05e712b2fa0524c7b212409abf330b3380119d8e64d9845e0b9', 'withdraw_change.wasm'),
  },
};

assertContentAddressed(A0_KEY_ASSETS);

/** The circuit's public-input count (the zkey's nPublic, §14 m-5): deposit 4, withdraw_change 7. */
export const A0_NPUBLIC: Readonly<Record<A0Circuit, number>> = {deposit: 4, withdraw_change: 7};

/**
 * Local paths of the circuit's zkey and wasm, each re-verified against its pin on this call
 * (downloaded first when missing; a mismatch deletes the file and throws). The cache files are
 * keyed `a0-<circuit>` (`noctura-a0-deposit.zkey`, …) so they never collide with an older install's `noctura-deposit.zkey`.
 */
export function ensureA0KeyFiles(
  circuit: A0Circuit,
  io: AssetIO,
): Promise<{zkeyPath: string; wasmPath: string}> {
  return ensurePinnedAssets(`a0-${circuit}`, A0_KEY_ASSETS[circuit], io);
}
