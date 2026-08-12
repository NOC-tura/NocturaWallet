import {
  MERKLE_TREE_DISCRIMINATOR,
  MERKLE_TREE_SIZE,
  MerkleTreeLayoutError,
  assertMerkleTreeAccount,
} from '../merkleTreeAccount';

const account = (size = MERKLE_TREE_SIZE, disc = MERKLE_TREE_DISCRIMINATOR): Uint8Array => {
  const data = new Uint8Array(size);
  const bytes = disc.match(/../g)!.map(h => parseInt(h, 16));
  data.set(bytes.slice(0, Math.min(bytes.length, size)), 0);
  return data;
};

describe('assertMerkleTreeAccount', () => {
  it('accepts the account shape the deployed program actually has', () => {
    // 3352 bytes, disc 623333e2a21449d4 — read off the live devnet account
    // 5wUcszpMDY9skjrL85daN9dmhfHwJTcffkX29eZwMwrR.
    expect(MERKLE_TREE_SIZE).toBe(3352);
    expect(() => assertMerkleTreeAccount(account())).not.toThrow();
  });

  it('rejects an account that is LONGER — the case a length check misses', () => {
    // The whole reason this exists. `length >= needed` fails only downwards; a
    // longer or reordered account yields entirely plausible values read from the
    // wrong offset, and the failure then surfaces as a wrong root or a wrong
    // leaf count rather than as "the layout moved".
    expect(() => assertMerkleTreeAccount(account(MERKLE_TREE_SIZE + 32))).toThrow(
      MerkleTreeLayoutError,
    );
  });

  it('rejects an account that is shorter', () => {
    expect(() => assertMerkleTreeAccount(account(100))).toThrow(MerkleTreeLayoutError);
  });

  it('rejects a different account type by its discriminator', () => {
    expect(() =>
      assertMerkleTreeAccount(account(MERKLE_TREE_SIZE, '0011223344556677')),
    ).toThrow(/discriminator/i);
  });

  it('names the layout as the cause, so the reader does not go hunting in the roots', () => {
    let msg = '';
    try {
      assertMerkleTreeAccount(account(MERKLE_TREE_SIZE + 8));
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toMatch(/layout/i);
    expect(msg).toContain(String(MERKLE_TREE_SIZE));
  });
});
