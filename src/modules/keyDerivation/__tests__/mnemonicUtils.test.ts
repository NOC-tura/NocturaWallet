import {generateMnemonic, validateMnemonic, mnemonicToSeed} from '../mnemonicUtils';

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
