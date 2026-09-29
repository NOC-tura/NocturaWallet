import {digestOf, randomId} from '../digest';

describe('digest', () => {
  it('is the sha256 hex of the JSON, stable and input-sensitive', () => {
    expect(digestOf({a: 1})).toBe(digestOf({a: 1}));
    expect(digestOf({a: 1})).not.toBe(digestOf({a: 2}));
    // The input is the JSON text: '""' for the empty string, '{"a":1}' for the object.
    expect(digestOf('')).toBe('12ae32cb1ec02d01eda3581b127c1fee3b0dc53572ed6baf239721a03d82e126');
    expect(digestOf({a: 1})).toBe('015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862');
    expect(digestOf({a: 1})).toMatch(/^[0-9a-f]{64}$/);
  });

  it('randomId is 16 random bytes as 32 hex characters', () => {
    expect(randomId(n => new Uint8Array(n).fill(171))).toBe('ab'.repeat(16));
  });
});
