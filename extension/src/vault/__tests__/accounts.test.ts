import {deriveSessionAccounts} from '../accounts';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('deriveSessionAccounts', () => {
  it('gives the Android app addresses for slip10 accounts 0 and 1', async () => {
    const [a0, a1] = await deriveSessionAccounts(MNEMONIC, 'slip10', [0, 1]);
    // base58 of the pinned hex vectors in core/keys/__tests__/transparent.test.ts
    expect(a0?.publicKey).toBe('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
    expect(a1?.index).toBe(1);
    expect(a0?.secretKey).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('cli has exactly one account', async () => {
    await expect(deriveSessionAccounts(MNEMONIC, 'cli', [0, 1])).rejects.toThrow(/cli wallet has one account/);
  });
});
