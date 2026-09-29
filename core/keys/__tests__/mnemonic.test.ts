import {generateMnemonic, normalizeMnemonicInput, validateMnemonic} from '../mnemonic';

describe('core/keys/mnemonic', () => {
  it('generates 24 valid words', () => {
    const m = generateMnemonic();
    expect(m.split(' ')).toHaveLength(24);
    expect(validateMnemonic(m)).toBe(true);
  });

  it('accepts 12 words and keyboard artifacts', () => {
    const m = 'Abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about.';
    expect(validateMnemonic(m)).toBe(true);
    expect(normalizeMnemonicInput(m)).toBe(
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    );
  });

  it('rejects a bad checksum', () => {
    expect(
      validateMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon'),
    ).toBe(false);
  });
});
