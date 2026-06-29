import {bls12_381} from '@noble/curves/bls12-381.js';
import {deriveShieldedViewKey} from '../keyDerivation/shielded';
import {pkRecipientHash} from './noteCrypto';

/**
 * Derive the shielded VIEW public key (compressed 48-byte BLS12-381 G1) from the
 * BIP-39 seed. sk_view (EIP-2333 path m/12381/371/2/0) is JS-allowed (read-only;
 * cannot authorize spends). The note recipient identity is this view key — the
 * deployed circuits impose no key model, and spend authorization is knowledge of
 * noteSecret alone, so binding the note to the view key keeps sk_spend off the
 * proof path. See project_shielded_c2_contract memory.
 *
 * API note: @noble/curves v2 exposes BLS12-381 via two signature schemes:
 *   - longSignatures: G1 keys (48 bytes) + G2 sigs (96 bytes)  ← used here
 *   - shortSignatures: G2 keys (96 bytes) + G1 sigs (48 bytes)
 * `bls12_381.longSignatures.getPublicKey(sk)` returns a WeierstrassPoint<Fp>
 * (G1 point). `.toBytes(true)` serialises it as 48-byte compressed G1 (big-endian
 * x-coordinate with MSB flags per IETF BLS draft / ZCash compressed-point format).
 * There is no top-level `bls12_381.getPublicKey()` and no `G1.ProjectivePoint`;
 * the class is exposed as `bls12_381.G1.Point`.
 */
export function getViewPublicKey(seed: Uint8Array): Uint8Array {
  const skView = deriveShieldedViewKey(seed);
  // longSignatures uses G1 as the key group (48 bytes compressed).
  return bls12_381.longSignatures.getPublicKey(skView).toBytes(true);
}

/** pkRecipientHash = poseidon3(0x05, be(viewG1[0:24]), be(viewG1[24:48])). */
export function getPkRecipientHash(seed: Uint8Array): bigint {
  return pkRecipientHash(getViewPublicKey(seed));
}
