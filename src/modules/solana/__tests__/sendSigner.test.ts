/**
 * M1d spec §3.3 (plan A16): a Send signs from the scheme it names, and only when that key derives
 * the account's address. The addresses are the repo's offline vectors
 * (src/modules/shielded/a0/__tests__/fixtures/a0-account-vectors.json, "abandon … about"), not
 * computed by the code under test. Review r1 m8/m9: the seed and the secret are captured where they
 * are made (the real functions, wrapped) and their CONTENTS are checked after the call.
 */
import {Keypair, PublicKey} from '@solana/web3.js';
import {SendSignerMismatchError, submitTransparentTransfer} from '../sendTransaction';
import {KeychainManager} from '../../keychain/keychainModule';

const ABANDON = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'; // slip10:0
const A1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb'; // slip10:1

const mockSendRaw = jest.fn(async () => 'SIG');
const mockBlockhash = jest.fn(async () => ({blockhash: 'bh', lastValidBlockHeight: 1}));
jest.mock('../connection', () => ({
  getConnection: () => ({getLatestBlockhash: mockBlockhash, sendRawTransaction: mockSendRaw}),
}));
const mockSeeds: Uint8Array[] = [];
jest.mock('../../keyDerivation/mnemonicUtils', () => {
  const actual = jest.requireActual<typeof import('../../keyDerivation/mnemonicUtils')>('../../keyDerivation/mnemonicUtils');
  return {
    ...actual,
    mnemonicToSeed: async (m: string) => {
      const seed = await actual.mnemonicToSeed(m);
      mockSeeds.push(seed);
      return seed;
    },
  };
});
const mockSecrets: Uint8Array[] = [];
const mockDerive = {throws: false};
jest.mock('../../keyDerivation/transparent', () => {
  const actual = jest.requireActual<typeof import('../../keyDerivation/transparent')>('../../keyDerivation/transparent');
  return {
    ...actual,
    deriveTransparentKeypair: (seed: Uint8Array, scheme: Parameters<typeof actual.deriveTransparentKeypair>[1]) => {
      if (mockDerive.throws) {
        throw new Error('derivation failed');
      }
      const kp = actual.deriveTransparentKeypair(seed, scheme);
      mockSecrets.push(kp.secretKey);
      return kp;
    },
  };
});

const sol = (account: number, expectedSigner: string) => ({
  kind: 'sol' as const,
  recipient: new PublicKey(MAIN),
  lamports: 1_000n,
  priorityFee: 0,
  scheme: {kind: 'slip10' as const, account},
  expectedSigner,
});
const allZero = (b: Uint8Array): boolean => b.every(x => x === 0);

beforeEach(() => {
  mockSendRaw.mockClear();
  mockBlockhash.mockClear();
  (Keypair.fromSecretKey as jest.Mock).mockClear();
  mockSeeds.length = 0;
  mockSecrets.length = 0;
  mockDerive.throws = false;
  jest.spyOn(KeychainManager.prototype, 'retrieveSeed').mockResolvedValue(ABANDON);
});
afterEach(() => jest.restoreAllMocks());

it('signs from the named scheme when its key derives the account\'s address (slip10:1 → Hh8Q…)', async () => {
  await expect(submitTransparentTransfer(sol(1, A1))).resolves.toEqual({signature: 'SIG', lastValidBlockHeight: 1});
  expect(mockSendRaw).toHaveBeenCalledTimes(1);
});

it('Review Focus 2: a key that does not derive the address → E_SEND_SIGNER_MISMATCH; no key object, nothing built, signed or sent', async () => {
  const run = submitTransparentTransfer(sol(1, MAIN));
  await expect(run).rejects.toBeInstanceOf(SendSignerMismatchError);
  await expect(submitTransparentTransfer(sol(1, MAIN))).rejects.toMatchObject({code: 'E_SEND_SIGNER_MISMATCH'});
  expect(Keypair.fromSecretKey).not.toHaveBeenCalled();
  expect(mockBlockhash).not.toHaveBeenCalled();
  expect(mockSendRaw).not.toHaveBeenCalled();
});

it('the seed and the secret key are zero-filled — their contents, on the refusal as on the send', async () => {
  await expect(submitTransparentTransfer(sol(1, MAIN))).rejects.toBeInstanceOf(SendSignerMismatchError);
  expect(mockSeeds).toHaveLength(1);
  expect(mockSecrets).toHaveLength(1);
  expect(allZero(mockSeeds[0]!) && mockSeeds[0]!.length === 64).toBe(true);
  expect(allZero(mockSecrets[0]!) && mockSecrets[0]!.length === 64).toBe(true);
  await submitTransparentTransfer(sol(1, A1));
  expect(mockSeeds.every(allZero) && mockSecrets.every(allZero)).toBe(true);
});

it('review r1 m8: a derivation that throws still zero-fills the seed; nothing is sent', async () => {
  mockDerive.throws = true;
  await expect(submitTransparentTransfer(sol(1, A1))).rejects.toThrow('derivation failed');
  expect(mockSeeds).toHaveLength(1);
  expect(allZero(mockSeeds[0]!)).toBe(true);
  expect(mockSendRaw).not.toHaveBeenCalled();
});
