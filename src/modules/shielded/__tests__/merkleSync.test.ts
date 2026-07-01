import {parseRootHistory} from '../merkleSync';

const hex = (n: number) => (n).toString(16).padStart(64, '0');

describe('parseRootHistory', () => {
  it('reads the 64 roots at offset 1296 (disc+next_leaf_index+zeros+filled_subtrees)', () => {
    const OFFSET = 8 + 8 + 640 + 640; // = 1296
    const data = Buffer.alloc(OFFSET + 64 * 32 + 8);
    Buffer.from(hex(42), 'hex').copy(data, OFFSET + 2 * 32);
    const roots = parseRootHistory(data);
    expect(roots.length).toBe(64);
    expect(roots[2]).toBe(hex(42));
    expect(roots[0]).toBe('0'.repeat(64));
  });
  it('throws when the account is too small', () => {
    expect(() => parseRootHistory(Buffer.alloc(100))).toThrow();
  });
});
