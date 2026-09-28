import {deriveTransparentKeypair, schemeFromString, schemeToString} from '../transparent';
import {mnemonicToSeed} from '../mnemonic';

// The same pinned vectors as the app's src/modules/keyDerivation/__tests__/transparent.test.ts:
// the extension must derive the Android app's addresses from the same seed.
const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

describe('core/keys/transparent', () => {
  let seed: Uint8Array;
  beforeAll(async () => {
    seed = await mnemonicToSeed(MNEMONIC);
  });

  it("slip10 account 0 matches Phantom/Solflare (m/44'/501'/0'/0')", () => {
    expect(hex(deriveTransparentKeypair(seed).publicKey)).toBe(
      'f036276246a75b9de3349ed42b15e232f6518fc20f5fcd4f1d64e81f9bd258f7',
    );
  });

  it('slip10 account 1 matches the pinned vector', () => {
    expect(hex(deriveTransparentKeypair(seed, {kind: 'slip10', account: 1}).publicKey)).toBe(
      'f8029acf5cbcbdd5ac46ec147f3b78a3df6e5022ef0411db2bab650d329a4cd4',
    );
  });

  it('cli matches solana-keygen raw seed', () => {
    expect(hex(deriveTransparentKeypair(seed, {kind: 'cli'}).publicKey)).toBe(
      'c5785e1865b708938aff8161d573006496663b1aa10834e396dc566869a2c66a',
    );
  });

  it('secretKey is private (32) + public (32)', () => {
    const kp = deriveTransparentKeypair(seed);
    expect(kp.secretKey.length).toBe(64);
    expect(hex(kp.secretKey.subarray(32))).toBe(hex(kp.publicKey));
  });

  it('scheme strings round-trip', () => {
    expect(schemeFromString(schemeToString({kind: 'slip10', account: 3}))).toEqual({kind: 'slip10', account: 3});
    expect(schemeFromString('cli')).toEqual({kind: 'cli'});
    expect(schemeFromString('garbage')).toEqual({kind: 'slip10', account: 0});
  });
});
