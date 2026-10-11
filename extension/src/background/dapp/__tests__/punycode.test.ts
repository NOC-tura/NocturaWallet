import {decodeLabel, decodePunycode} from '../punycode';

const cps = (s: string | null) => (s === null ? null : [...s].map(c => (c.codePointAt(0) ?? 0).toString(16)).join(' '));

// Spec §2.5: our own RFC 3492 decoder — against the RFC's sample strings (§7.1) and the labels the classifier meets.
describe('RFC 3492 Punycode decoder', () => {
  it('decodes the RFC 3492 §7.1 samples (A), (B), (L), (M), (O) and (S)', () => {
    expect(cps(decodePunycode('egbpdaj6bu4bxfgehfvwxn'))).toBe('644 64a 647 645 627 628 62a 643 644 645 648 634 639 631 628 64a 61f');
    expect(cps(decodePunycode('ihqwcrb4cv8a8dqg056pqjye'))).toBe('4ed6 4eec 4e3a 4ec0 4e48 4e0d 8bf4 4e2d 6587');
    expect(decodePunycode('3B-ww4c5e180e575a65lsy2b')).toBe('3\u5E74B\u7D44\u91D1\u516B\u5148\u751F');
    expect(decodePunycode('-with-SUPER-MONKEYS-pc58ag80a8qai00g7n9n')).toBe('\u5B89\u5BA4\u5948\u7F8E\u6075-with-SUPER-MONKEYS');
    expect(decodePunycode('2-u9tlzr9756bt3uc0v')).toBe('\u3072\u3068\u3064\u5C4B\u6839\u306E\u4E0B2');
    expect(decodePunycode('-> $1.00 <--')).toBe('-> $1.00 <-');
  });

  it('decodes host labels: b\u00FCcher, the Cyrillic ph\u0430ntom, a marked j\u00F9p; plain labels pass through', () => {
    expect(decodeLabel('xn--bcher-kva')).toBe('b\u00FCcher');
    expect(decodeLabel('xn--phntom-4nf')).toBe('ph\u0430ntom');
    expect(decodeLabel('xn--jp-oka')).toBe('j\u00F9p');
    expect(decodeLabel('jup')).toBe('jup');
  });

  it('an invalid label is null, never a throw: a bad digit, a truncated delta, a code point past U+10FFFF, a surrogate', () => {
    for (const bad of ['xn--a\u00E9', 'xn--a!b', 'xn--99999999999', 'xn--zzzzzzz', 'xn--ab-']) expect(() => decodeLabel(bad)).not.toThrow();
    expect(decodeLabel('xn--a!b')).toBeNull();
    expect(decodeLabel('xn--a\u00E9')).toBeNull();
    expect(decodePunycode('99999999999')).toBeNull();
    expect(decodePunycode('z')).toBeNull();
  });
});
