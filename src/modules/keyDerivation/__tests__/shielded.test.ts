import {deriveShieldedViewKey, deriveDisclosureKey} from '../shielded';
import {mnemonicToSeed} from '../mnemonicUtils';

describe('shielded key derivation (BLS12-381 EIP-2333)', () => {
  const TEST_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  let seed: Uint8Array;

  beforeAll(async () => {
    seed = await mnemonicToSeed(TEST_MNEMONIC);
  });

  describe('deriveShieldedViewKey', () => {
    it('derives a 32-byte view key', () => {
      const viewKey = deriveShieldedViewKey(seed);
      expect(viewKey).toBeInstanceOf(Uint8Array);
      expect(viewKey.length).toBe(32);
    });

    it('derivation is deterministic', () => {
      const vk1 = deriveShieldedViewKey(seed);
      const vk2 = deriveShieldedViewKey(seed);
      expect(Buffer.from(vk1).equals(Buffer.from(vk2))).toBe(true);
    });

    it('matches pinned test vector for m/12381/371/2/0', () => {
      const viewKey = deriveShieldedViewKey(seed);
      const hex = Buffer.from(viewKey).toString('hex');
      expect(hex).toBe('30171f354d910bcd87d1a0573900419e17e04c1015c4aa6ea127be66fdccd6dc');
    });

    it('different seeds produce different view keys', async () => {
      const otherMnemonic = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';
      const otherSeed = await mnemonicToSeed(otherMnemonic);
      const vk1 = deriveShieldedViewKey(seed);
      const vk2 = deriveShieldedViewKey(otherSeed);
      expect(Buffer.from(vk1).equals(Buffer.from(vk2))).toBe(false);
    });
  });

  describe('deriveDisclosureKey', () => {
    it('derives a 32-byte disclosure key', () => {
      const dk = deriveDisclosureKey(seed, 0);
      expect(dk).toBeInstanceOf(Uint8Array);
      expect(dk.length).toBe(32);
    });

    it('different indices produce different keys', () => {
      const dk0 = deriveDisclosureKey(seed, 0);
      const dk1 = deriveDisclosureKey(seed, 1);
      expect(Buffer.from(dk0).equals(Buffer.from(dk1))).toBe(false);
    });

    it('same index is deterministic', () => {
      const dk1 = deriveDisclosureKey(seed, 42);
      const dk2 = deriveDisclosureKey(seed, 42);
      expect(Buffer.from(dk1).equals(Buffer.from(dk2))).toBe(true);
    });
  });

  describe('security boundary', () => {
    it('does NOT export any spend key derivation function', () => {
      const moduleExports = require('../shielded');
      const exportNames = Object.keys(moduleExports);
      const forbidden = exportNames.filter(
        name => name.toLowerCase().includes('spend'),
      );
      expect(forbidden).toEqual([]);
    });
  });
});
