import {digestOf, randomId} from '../digest';

describe('digest', () => {
  it('is the sha256 hex of the JSON of {kind, value}, stable and input-sensitive', () => {
    expect(digestOf('send', {a: 1})).toBe(digestOf('send', {a: 1}));
    expect(digestOf('send', {a: 1})).not.toBe(digestOf('send', {a: 2}));
    // Vectors computed independently (node:crypto): sha256('{"kind":"k","value":""}') and
    // sha256('{"kind":"send","value":{"a":1}}').
    expect(digestOf('k', '')).toBe('71319c1957a61d9746b80861127a6a466675466f8e6d32b8b066bbad39a38653');
    expect(digestOf('send', {a: 1})).toBe('a6b87795437f049b5e770c64561ad7dd89f35f9ef345841049f8f570c4a5dd59');
    expect(digestOf('send', {a: 1})).toMatch(/^[0-9a-f]{64}$/);
  });

  it('separates domains: the same value under two kinds never collides', () => {
    expect(digestOf('send', {a: 1})).not.toBe(digestOf('settings', {a: 1}));
  });

  it('refuses an empty kind', () => {
    expect(() => digestOf('', {a: 1})).toThrow();
  });

  it('refuses values JSON would silently drop or rewrite, at any depth', () => {
    const bad: unknown[] = [
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      {a: undefined},
      {a: {b: Number.NaN}},
      [1, undefined],
      [Number.POSITIVE_INFINITY],
      1n,
      {a: 1n},
      () => 1,
      {f: () => 1},
      Symbol('s'),
    ];
    for (const v of bad) expect(() => digestOf('send', v)).toThrow();
    expect(() => digestOf('send', {a: null, b: [1, 'x', true], c: {d: -0.5}})).not.toThrow();
  });

  it('randomId is 16 random bytes as 32 hex characters', () => {
    expect(randomId(n => new Uint8Array(n).fill(171))).toBe('ab'.repeat(16));
  });
});
