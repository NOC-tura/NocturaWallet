import {
  deriveTransparentKeypair,
  schemeToString,
  schemeFromString,
} from '../transparent';
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

  it("matches pinned SLIP-0010 vector for m/44'/501'/0'/0' (Phantom/Solflare-compatible)", () => {
    const keypair = deriveTransparentKeypair(seed);
    const pubkeyHex = Buffer.from(keypair.publicKey).toString('hex');
    // SLIP-0010 ed25519 derivation — the scheme used by Phantom, Solflare and
    // `solana-keygen --derivation-path`. The "abandon…about" mnemonic at
    // m/44'/501'/0'/0' resolves to HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk.
    expect(pubkeyHex).toBe('f036276246a75b9de3349ed42b15e232f6518fc20f5fcd4f1d64e81f9bd258f7');
  });

  it('different seeds produce different keys', async () => {
    const otherMnemonic =
      'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';
    const otherSeed = await mnemonicToSeed(otherMnemonic);
    const kp1 = deriveTransparentKeypair(seed);
    const kp2 = deriveTransparentKeypair(otherSeed);
    expect(Buffer.from(kp1.publicKey).equals(Buffer.from(kp2.publicKey))).toBe(false);
  });

  it('cli scheme matches solana-keygen raw-seed vector', () => {
    const kp = deriveTransparentKeypair(seed, {kind: 'cli'});
    expect(Buffer.from(kp.publicKey).toString('hex')).toBe(
      'c5785e1865b708938aff8161d573006496663b1aa10834e396dc566869a2c66a',
    );
  });

  it('slip10 account 1 matches pinned vector', () => {
    const kp = deriveTransparentKeypair(seed, {kind: 'slip10', account: 1});
    expect(Buffer.from(kp.publicKey).toString('hex')).toBe(
      'f8029acf5cbcbdd5ac46ec147f3b78a3df6e5022ef0411db2bab650d329a4cd4',
    );
  });

  it('default scheme equals slip10 account 0', () => {
    const a = deriveTransparentKeypair(seed);
    const b = deriveTransparentKeypair(seed, {kind: 'slip10', account: 0});
    expect(Buffer.from(a.publicKey).equals(Buffer.from(b.publicKey))).toBe(true);
  });

  it('scheme serialization round-trips', () => {
    expect(schemeToString({kind: 'cli'})).toBe('cli');
    expect(schemeToString({kind: 'slip10', account: 3})).toBe('slip10:3');
    expect(schemeFromString('cli')).toEqual({kind: 'cli'});
    expect(schemeFromString('slip10:3')).toEqual({kind: 'slip10', account: 3});
    expect(schemeFromString(null)).toEqual({kind: 'slip10', account: 0});
    expect(schemeFromString('garbage')).toEqual({kind: 'slip10', account: 0});
  });
});
