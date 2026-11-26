jest.mock('../../keychain/keychainModule', () => ({
  keychainManager: {
    retrieveSeed: jest.fn().mockResolvedValue('mnemonic words here'),
    dropV1ViewKey: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../keyDerivation/mnemonicUtils', () => ({
  mnemonicToSeed: jest.fn().mockResolvedValue(new Uint8Array(64).fill(3)),
}));
jest.mock('../../../store/mmkv/instances', () => ({
  initSecureMmkv: jest.fn(),
  mmkvSecure: jest.fn(() => null),
  mmkvPublic: {
    set: jest.fn(),
    remove: jest.fn(),
    getAllKeys: jest.fn(() => [
      'v1_wallet.publicKey',
      'shielded.syncCache.AtjVK2z561wDYo5EvougJKAo9AJ4KdduxSbiF173aiAe',
      'noctura.noteScanCursor.AtjVK2z561wDYo5EvougJKAo9AJ4KdduxSbiF173aiAe',
      'v1_settings.explorer',
    ]),
  },
}));
jest.mock('../../shielded/a0/startup', () => ({ensureA0Startup: jest.fn(async () => ({phase: 'ready'}))}));
jest.mock('../../zkProver/nativeProverBridge', () => ({isProverSupported: jest.fn(() => true)}));
jest.mock('../../solana/connection', () => ({getConnection: jest.fn(() => 'the-connection')}));
jest.mock('../../../constants/features', () => ({isShieldedEnabled: jest.fn(() => false)}));
// post-M1d R2: the link queue, observed here
const mockDrain = jest.fn(() => 0);
jest.mock('../../accounts/linkQueue', () => ({drainLinkQueue: () => mockDrain()}));
import {unlockSecureStorage, unlockSecureStorageWithSeed} from '../secureStorageSession';
import {initSecureMmkv, mmkvPublic, mmkvSecure} from '../../../store/mmkv/instances';
import {ensureA0Startup} from '../../shielded/a0/startup';
import {isProverSupported} from '../../zkProver/nativeProverBridge';
import {isShieldedEnabled} from '../../../constants/features';
import {mnemonicToSeed} from '../../keyDerivation/mnemonicUtils';
import {keychainManager} from '../../keychain/keychainModule';

beforeEach(() => {
  mockDrain.mockImplementation(() => 0); // review nit: a failing throwing-drain test never leaks into the next
  jest.clearAllMocks();
});

describe('unlockSecureStorage', () => {
  it('retrieves the seed and initializes the secure MMKV with the derived key', async () => {
    await unlockSecureStorage();
    expect(initSecureMmkv).toHaveBeenCalledWith(expect.any(String));
    const key = (initSecureMmkv as jest.Mock).mock.calls[0][0];
    expect(key).toHaveLength(32); // 16-byte hex
  });
});

describe('post-M1d R2: unlock drains the link queue once the encrypted store is open', () => {
  it('unlockSecureStorage: once, after the encrypted store is opened', async () => {
    await unlockSecureStorage();
    expect(mockDrain).toHaveBeenCalledTimes(1);
    expect(initSecureMmkv).toHaveBeenCalledTimes(1);
    expect((initSecureMmkv as jest.Mock).mock.invocationCallOrder[0]!).toBeLessThan(mockDrain.mock.invocationCallOrder[0]!);
  });

  it('unlockSecureStorageWithSeed (onboarding): once, after the store is opened', () => {
    unlockSecureStorageWithSeed(new Uint8Array(64).fill(9));
    expect(mockDrain).toHaveBeenCalledTimes(1);
    expect((initSecureMmkv as jest.Mock).mock.invocationCallOrder[0]!).toBeLessThan(mockDrain.mock.invocationCallOrder[0]!);
  });

  it('a drain that throws never fails the unlock: still resolves, still drops the v1 view key and starts A0', async () => {
    (isShieldedEnabled as jest.Mock).mockReturnValue(true);
    mockDrain.mockImplementation(() => {
      throw new Error('queue');
    });
    await expect(unlockSecureStorage()).resolves.toBeUndefined();
    expect(keychainManager.dropV1ViewKey).toHaveBeenCalledTimes(1);
    expect(ensureA0Startup).toHaveBeenCalledTimes(1);
    expect(() => unlockSecureStorageWithSeed(new Uint8Array(64).fill(9))).not.toThrow();
    expect(ensureA0Startup).toHaveBeenCalledTimes(2);
    mockDrain.mockImplementation(() => 0);
  });

  it('a store that is already open: nothing to drain here (the sheet drains when it opens)', async () => {
    (mmkvSecure as jest.Mock).mockReturnValueOnce({});
    await unlockSecureStorage();
    expect(mockDrain).not.toHaveBeenCalled();
  });
});

describe('the A0 startup step (restore when there is no A0 record) starts at unlock and onboarding', () => {
  it('shielded build + native prover → started with its OWN copy of the seed (the caller still wipes its own)', async () => {
    (isShieldedEnabled as jest.Mock).mockReturnValue(true);
    const own = new Uint8Array(64).fill(3);
    (mnemonicToSeed as jest.Mock).mockResolvedValueOnce(own);
    await unlockSecureStorage();
    expect([...own].every(b => b === 0)).toBe(true); // the session wiped its own seed
    expect(ensureA0Startup).toHaveBeenCalledTimes(1);
    const [connection, seed] = (ensureA0Startup as jest.Mock).mock.calls[0];
    expect(connection).toBe('the-connection');
    expect(seed).toBeInstanceOf(Uint8Array);
    expect(seed).toHaveLength(64);
    // unlockSecureStorage zeroizes its seed in its finally; the copy handed over is distinct
    expect([...seed].every((b: number) => b === 3)).toBe(true);
  });

  it('onboarding (seed in hand) starts it too', () => {
    (isShieldedEnabled as jest.Mock).mockReturnValue(true);
    const seed = new Uint8Array(64).fill(9);
    unlockSecureStorageWithSeed(seed);
    const handed = (ensureA0Startup as jest.Mock).mock.calls[0][1] as Uint8Array;
    expect(handed).not.toBe(seed);
    expect([...handed].every(b => b === 9)).toBe(true);
  });

  it('not in a build without shielded (production)', async () => {
    (isShieldedEnabled as jest.Mock).mockReturnValue(false);
    await unlockSecureStorage();
    expect(ensureA0Startup).not.toHaveBeenCalled();
  });

  it('not on a device without the native prover (non-arm64)', async () => {
    (isShieldedEnabled as jest.Mock).mockReturnValue(true);
    (isProverSupported as jest.Mock).mockReturnValueOnce(false);
    await unlockSecureStorage();
    expect(ensureA0Startup).not.toHaveBeenCalled();
  });
});

describe('the v1 shielded leftovers (spec §12 I9) are dropped, never written', () => {
  const removed = (): string[] => (mmkvPublic.remove as jest.Mock).mock.calls.map(c => c[0] as string).sort();

  it('unlock removes the stored v1 noc1… address and the v1 sync cache / scan cursors — nothing else', async () => {
    await unlockSecureStorage();
    expect(removed()).toEqual([
      'noctura.noteScanCursor.AtjVK2z561wDYo5EvougJKAo9AJ4KdduxSbiF173aiAe',
      'shielded.syncCache.AtjVK2z561wDYo5EvougJKAo9AJ4KdduxSbiF173aiAe',
      'v1_wallet.shieldedAddress',
    ]);
  });

  it('the v1 proof queue record (it held witnesses) is removed from the ENCRYPTED instance once it is open', async () => {
    const secureRemove = jest.fn();
    // unlockSecureStorage returns early while the store is already open (the first call); after
    // that, the opened instance is the one the cleanup reaches.
    (mmkvSecure as jest.Mock).mockReturnValueOnce(null).mockReturnValue({remove: secureRemove});
    await unlockSecureStorage();
    expect(secureRemove).toHaveBeenCalledWith('v1_proofQueue');
    expect(secureRemove).toHaveBeenCalledTimes(1);
    (mmkvSecure as jest.Mock).mockReset().mockReturnValue(null);
  });

  it('onboarding does the same', () => {
    unlockSecureStorageWithSeed(new Uint8Array(64).fill(1));
    expect(removed()).toContain('v1_wallet.shieldedAddress');
    expect(removed()).toContain('shielded.syncCache.AtjVK2z561wDYo5EvougJKAo9AJ4KdduxSbiF173aiAe');
  });

  it('the v1 view key is dropped from the keychain at unlock and at onboarding; a keychain failure does not block the unlock', async () => {
    await unlockSecureStorage();
    expect(keychainManager.dropV1ViewKey).toHaveBeenCalledTimes(1);
    unlockSecureStorageWithSeed(new Uint8Array(64).fill(1));
    expect(keychainManager.dropV1ViewKey).toHaveBeenCalledTimes(2);
    (keychainManager.dropV1ViewKey as jest.Mock).mockRejectedValueOnce(new Error('keystore busy'));
    await expect(unlockSecureStorage()).resolves.toBeUndefined();
    expect(initSecureMmkv).toHaveBeenCalledTimes(3);
  });

  it('no v1 shielded address is written (the v1 view-session priming is gone)', async () => {
    await unlockSecureStorage();
    unlockSecureStorageWithSeed(new Uint8Array(64).fill(1));
    expect(mmkvPublic.set).not.toHaveBeenCalled();
  });
});
