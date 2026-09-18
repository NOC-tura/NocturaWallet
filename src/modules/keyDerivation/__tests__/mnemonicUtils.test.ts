import {generateMnemonic, validateMnemonic, mnemonicToSeed, normalizeMnemonicInput} from '../mnemonicUtils';

describe('mnemonicUtils', () => {
  it('generates a valid 24-word mnemonic', () => {
    const mnemonic = generateMnemonic();
    const words = mnemonic.split(' ');
    expect(words.length).toBe(24);
  });

  it('generated mnemonic passes validation', () => {
    const mnemonic = generateMnemonic();
    expect(validateMnemonic(mnemonic)).toBe(true);
  });

  it('rejects invalid mnemonic', () => {
    expect(validateMnemonic('not a valid mnemonic phrase')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateMnemonic('')).toBe(false);
  });

  it('derives 64-byte seed from mnemonic', async () => {
    const mnemonic = generateMnemonic();
    const seed = await mnemonicToSeed(mnemonic);
    expect(seed).toBeInstanceOf(Uint8Array);
    expect(seed.length).toBe(64);
  });

  it('same mnemonic produces same seed (deterministic)', async () => {
    const mnemonic = generateMnemonic();
    const seed1 = await mnemonicToSeed(mnemonic);
    const seed2 = await mnemonicToSeed(mnemonic);
    expect(Buffer.from(seed1).equals(Buffer.from(seed2))).toBe(true);
  });

  // BIP-39 test vector
  it('matches BIP-39 test vector', async () => {
    const testMnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    expect(validateMnemonic(testMnemonic)).toBe(true);
    const seed = await mnemonicToSeed(testMnemonic);
    const expectedSeedHex =
      '5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4';
    expect(Buffer.from(seed).toString('hex')).toBe(expectedSeedHex);
  });
});

/**
 * Input normalization (2026-09-18).
 *
 * A user transcribing a phrase on a phone got "24 words · checksum failed" for a
 * phrase proven correct on the desktop. @scure/bip39 accepts ONLY the canonical
 * form: any capital, any stray punctuation, any zero-width character makes a
 * correct phrase look wrong, and the zero-width case is invisible on screen.
 * Every one of these is a keyboard artifact, never part of a BIP-39 word.
 */
describe('mnemonicUtils — input normalization', () => {
  const VALID =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  it('accepts the canonical phrase (control)', () => {
    expect(validateMnemonic(VALID)).toBe(true);
  });

  it.each([
    ['capitalized first word', 'Abandon' + VALID.slice(7)],
    ['all caps', VALID.toUpperCase()],
    ['trailing period (Gboard double-space)', VALID + '.'],
    ['period between words', VALID.replace('about', '. about')],
    ['zero-width space inside a word', VALID.replace('about', 'ab​out')],
    ['non-breaking spaces', VALID.replace(/ /g, ' ')],
    ['double spaces', VALID.replace(/ /g, '  ')],
    ['leading and trailing whitespace', `  ${VALID}\n`],
    ['NFC-composed lookalike untouched', VALID],
  ])('accepts a correct phrase with %s', (_label, input) => {
    expect(validateMnemonic(input)).toBe(true);
  });

  it('still rejects a genuinely wrong word', () => {
    expect(validateMnemonic(VALID.replace('about', 'abandon'))).toBe(false);
  });

  it('still rejects a phrase of the wrong length', () => {
    expect(validateMnemonic(VALID.split(' ').slice(0, 11).join(' '))).toBe(false);
  });

  it('normalizeMnemonicInput returns the canonical form used for derivation', () => {
    expect(normalizeMnemonicInput(`  ABANDON​  about.\n`)).toBe('abandon about');
  });

  it('the normalized phrase derives the same seed as the canonical one', async () => {
    const dirty = 'Abandon' + VALID.slice(7) + '.';
    const a = await mnemonicToSeed(dirty);
    const b = await mnemonicToSeed(VALID);
    expect(Buffer.from(a).toString('hex')).toBe(Buffer.from(b).toString('hex'));
  });
});
