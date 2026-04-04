import {deriveTransparentKeypair} from '../transparent';
import {mnemonicToSeed} from '../mnemonicUtils';

describe('transparent key derivation (Ed25519 BIP-44)', () => {
  const TEST_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  let seed: Uint8Array;

  beforeAll(async () => {
    seed = await mnemonicToSeed(TEST_MNEMONIC);
  });

  it('derives a keypair from seed', () => {
    const keypair = deriveTransparentKeypair(seed);
    expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
    expect(keypair.secretKey).toBeInstanceOf(Uint8Array);
  });

  it('public key is 32 bytes (Ed25519)', () => {
    const keypair = deriveTransparentKeypair(seed);
    expect(keypair.publicKey.length).toBe(32);
  });

  it('secret key is 64 bytes (Ed25519 expanded)', () => {
    const keypair = deriveTransparentKeypair(seed);
    expect(keypair.secretKey.length).toBe(64);
  });

  it('derivation is deterministic', () => {
    const kp1 = deriveTransparentKeypair(seed);
    const kp2 = deriveTransparentKeypair(seed);
    expect(Buffer.from(kp1.publicKey).equals(Buffer.from(kp2.publicKey))).toBe(true);
    expect(Buffer.from(kp1.secretKey).equals(Buffer.from(kp2.secretKey))).toBe(true);
  });

  it("matches pinned test vector for m/44'/501'/0'/0'", () => {
    const keypair = deriveTransparentKeypair(seed);
    const pubkeyHex = Buffer.from(keypair.publicKey).toString('hex');
    expect(pubkeyHex).toBe('382aaa068581d37e9851a0711fc43750f8b6688dd3855a98a4a6b7dabc60a426');
  });

  it('different seeds produce different keys', async () => {
    const otherMnemonic =
      'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';
    const otherSeed = await mnemonicToSeed(otherMnemonic);
    const kp1 = deriveTransparentKeypair(seed);
    const kp2 = deriveTransparentKeypair(otherSeed);
    expect(Buffer.from(kp1.publicKey).equals(Buffer.from(kp2.publicKey))).toBe(false);
  });
});
