import {base58} from '@scure/base';
import {ed25519} from '@noble/curves/ed25519.js';

/**
 * True when `address` is a valid base58-encoded 32-byte ed25519 point — i.e. an
 * address that can actually own and move SOL.
 *
 * Why not `PublicKey.isOnCurve`: `@solana/web3.js` is replaced wholesale by a
 * hand-written mock in jest (jest.config.js moduleNameMapper), and that mock's
 * `PublicKey` performs no base58 validation at all. Using it here would make the
 * check untestable and give false confidence. `@noble/curves` is a real
 * dependency in both environments and its point decompression agrees with
 * `PublicKey.isOnCurve` (verified against a real PDA, the wSOL mint, and the
 * System Program address).
 *
 * A `false` result means the address is a PDA, a wrong-length key, or not base58
 * — SOL sent there is unrecoverable unless the owning program can withdraw it.
 *
 * NOTE: this does NOT tell you the address is a *wallet*. A token mint or token
 * account is on-curve as often as not; distinguishing those requires reading the
 * account owner from the chain.
 */
export function isOnCurveAddress(address: string): boolean {
  let bytes: Uint8Array;
  try {
    bytes = base58.decode(address);
  } catch {
    return false;
  }
  if (bytes.length !== 32) return false;

  try {
    ed25519.Point.fromBytes(bytes);
    return true;
  } catch {
    return false;
  }
}
