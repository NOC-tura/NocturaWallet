import {computeMerkleRoot, computeMerklePath, MERKLE_TREE_DEPTH} from '../merkleModule';

const leaf = (n: number) => n.toString(16).padStart(64, '0');

describe('computeMerklePath', () => {
  it('depth-20 path whose folded root equals computeMerkleRoot (multi-leaf)', () => {
    const leaves = [leaf(11), leaf(22), leaf(33), leaf(44), leaf(55)];
    for (let idx = 0; idx < leaves.length; idx++) {
      const {root, siblings, pathIndices} = computeMerklePath(leaves, idx);
      expect(siblings.length).toBe(MERKLE_TREE_DEPTH);
      expect(pathIndices.length).toBe(MERKLE_TREE_DEPTH);
      expect(root).toBe(computeMerkleRoot(leaves));
      for (let i = 0; i < MERKLE_TREE_DEPTH; i++) {
        expect(pathIndices[i]).toBe((idx >> i) & 1);
      }
    }
  });
  it('single-leaf tree, index 0', () => {
    const leaves = [leaf(7)];
    const {root, pathIndices} = computeMerklePath(leaves, 0);
    expect(root).toBe(computeMerkleRoot(leaves));
    expect(pathIndices.every(b => b === 0)).toBe(true);
  });
  it('throws on out-of-range index', () => {
    expect(() => computeMerklePath([leaf(1)], 5)).toThrow();
  });
});
