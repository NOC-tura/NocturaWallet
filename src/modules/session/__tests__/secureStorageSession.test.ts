jest.mock('../../keychain/keychainModule', () => ({
  keychainManager: {retrieveSeed: jest.fn().mockResolvedValue('mnemonic words here')},
}));
jest.mock('../../keyDerivation/mnemonicUtils', () => ({
  mnemonicToSeed: jest.fn().mockResolvedValue(new Uint8Array(64).fill(3)),
}));
jest.mock('../../../store/mmkv/instances', () => ({
  initSecureMmkv: jest.fn(),
  mmkvSecure: jest.fn(() => null),
  mmkvPublic: {set: jest.fn()},
}));
jest.mock('../../shielded/a0/startup', () => ({ensureA0Startup: jest.fn(async () => ({phase: 'ready'}))}));
jest.mock('../../zkProver/nativeProverBridge', () => ({isProverSupported: jest.fn(() => true)}));
jest.mock('../../solana/connection', () => ({getConnection: jest.fn(() => 'the-connection')}));
jest.mock('../../../constants/features', () => ({isShieldedEnabled: jest.fn(() => false)}));
import {unlockSecureStorage, unlockSecureStorageWithSeed} from '../secureStorageSession';
import {initSecureMmkv} from '../../../store/mmkv/instances';
import {ensureA0Startup} from '../../shielded/a0/startup';
import {isProverSupported} from '../../zkProver/nativeProverBridge';
import {isShieldedEnabled} from '../../../constants/features';
import {mnemonicToSeed} from '../../keyDerivation/mnemonicUtils';

beforeEach(() => {
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
