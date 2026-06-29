import {parseDepositLeafIndex} from '../depositFlow';

describe('parseDepositLeafIndex', () => {
  it('reads leaf_index (u64 LE) from the Deposit event Program data log', () => {
    // Anchor event = 8-byte disc + commitment(32) + leaf_index(u64 LE) + root(32)
    const disc = new Uint8Array(8).fill(1);
    const commitment = new Uint8Array(32).fill(2);
    const leaf = new Uint8Array(8); leaf[0] = 5; // leaf_index = 5
    const root = new Uint8Array(32).fill(3);
    const buf = Buffer.concat([Buffer.from(disc), Buffer.from(commitment),
      Buffer.from(leaf), Buffer.from(root)]);
    const logs = [`Program data: ${buf.toString('base64')}`];
    expect(parseDepositLeafIndex(logs)).toBe(5);
  });
  it('throws when no Deposit event log is present', () => {
    expect(() => parseDepositLeafIndex(['Program log: hi'])).toThrow();
  });
});
