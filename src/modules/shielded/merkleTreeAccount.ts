/**
 * One definition of "is this actually a MerkleTree account, laid out the way we
 * think it is", shared by every reader that indexes into it by byte offset.
 *
 * Both readers here — root_history and next_leaf_index — use hardcoded offsets,
 * and `data.length >= needed` is a PROXY for the layout being right. It fails in
 * one direction only: a shorter account throws, while a longer or reordered one
 * returns entirely plausible values read from the wrong place. The failure then
 * surfaces as "our root is not in the ring" or as a wrong anonymity count, and
 * points at the wrong problem.
 *
 * The A0 program change rewrites `Pool` three times over. The coordinator has
 * confirmed `MerkleTree` itself is unchanged and `ROOT_HISTORY_OFFSET = 1296`
 * still holds — but "unchanged this time" is exactly the assumption worth
 * asserting rather than carrying.
 */

/** disc + next_leaf_index + zeros + filled_subtrees + root_history + head:u16 + 6 pad. */
export const MERKLE_TREE_SIZE = 8 + 8 + 640 + 640 + 64 * 32 + 2 + 6; // 3352

/**
 * Anchor discriminator: sha256('account:MerkleTree')[0..8]. Read off the live
 * devnet account 5wUcszpMDY9skjrL85daN9dmhfHwJTcffkX29eZwMwrR rather than
 * derived from a guessed type name, then confirmed to match the derivation.
 */
export const MERKLE_TREE_DISCRIMINATOR = '623333e2a21449d4';

/**
 * Distinguishable on purpose. A caller that treats every failure the same turns
 * "the program was redeployed with a different layout" into "the network is
 * flaky", and nobody investigates the second.
 */
export class MerkleTreeLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MerkleTreeLayoutError';
  }
}

const toHex8 = (d: Uint8Array): string =>
  Array.from(d.subarray(0, 8), b => b.toString(16).padStart(2, '0')).join('');

/** Throws `MerkleTreeLayoutError` unless the account is exactly what we parse. */
export function assertMerkleTreeAccount(data: Uint8Array): void {
  const disc = toHex8(data);
  if (data.length < 8 || disc !== MERKLE_TREE_DISCRIMINATOR) {
    throw new MerkleTreeLayoutError(
      `account discriminator ${disc} != MerkleTree ${MERKLE_TREE_DISCRIMINATOR} — ` +
        'this is not a MerkleTree account, or the program defines it differently now',
    );
  }
  if (data.length !== MERKLE_TREE_SIZE) {
    throw new MerkleTreeLayoutError(
      `MerkleTree account layout changed — expected exactly ${MERKLE_TREE_SIZE} bytes, got ${data.length}. ` +
        'The hardcoded offsets are no longer trustworthy; re-derive them from the deployed IDL before reading.',
    );
  }
}
