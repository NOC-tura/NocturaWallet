import {parseNextLeafIndex} from '../poolState';

describe('parseNextLeafIndex', () => {
  it('reads next_leaf_index (u64 LE) after the 8-byte anchor discriminator', () => {
    const data = new Uint8Array(48);
    // 8-byte disc, then next_leaf_index = 5 at [8..16)
    data[8] = 5;
    expect(parseNextLeafIndex(data)).toBe(5);
  });
  it('throws on too-short account data', () => {
    expect(() => parseNextLeafIndex(new Uint8Array(8))).toThrow();
  });
});
