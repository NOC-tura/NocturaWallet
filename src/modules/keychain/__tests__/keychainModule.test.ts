import {KeychainManager} from '../keychainModule';
import Keychain from 'react-native-keychain';

jest.setTimeout(60_000); // PIN tests involve PBKDF2 600K iterations

const mockKeychain = Keychain as typeof Keychain & {__reset: () => void};

describe('KeychainManager', () => {
  let manager: KeychainManager;

  beforeEach(() => {
    mockKeychain.__reset();
    manager = new KeychainManager();
  });

  describe('storeSeed / retrieveSeed', () => {
    it('stores and retrieves a mnemonic', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      await manager.storeSeed(mnemonic);
      const retrieved = await manager.retrieveSeed();
      expect(retrieved).toBe(mnemonic);
    });

    it('hasWallet returns false when no seed stored', async () => {
      expect(await manager.hasWallet()).toBe(false);
    });

    it('hasWallet returns true after storing seed', async () => {
      await manager.storeSeed('test mnemonic words');
      expect(await manager.hasWallet()).toBe(true);
    });
  });

  describe('storeViewKey / retrieveViewKey', () => {
    it('stores and retrieves a view key', async () => {
      const viewKey = new Uint8Array(32);
      viewKey.fill(0xab);
      await manager.storeViewKey(viewKey);
      const retrieved = await manager.retrieveViewKey();
      expect(Buffer.from(retrieved).equals(Buffer.from(viewKey))).toBe(true);
    });
  });

  describe('wipeKeys', () => {
    it('clears all stored keys', async () => {
      await manager.storeSeed('test mnemonic');
      await manager.storeViewKey(new Uint8Array(32));
      await manager.wipeKeys();
      expect(await manager.hasWallet()).toBe(false);
    });
  });

  describe('PIN management', () => {
    it('isPinConfigured returns false initially', async () => {
      expect(await manager.isPinConfigured()).toBe(false);
    });

    it('setupPin stores PIN hash', async () => {
      await manager.setupPin('123456');
      expect(await manager.isPinConfigured()).toBe(true);
    });

    it('verifyPin returns true for correct PIN', async () => {
      await manager.setupPin('123456');
      expect(await manager.verifyPin('123456')).toBe(true);
    });

    it('verifyPin returns false for wrong PIN', async () => {
      await manager.setupPin('123456');
      expect(await manager.verifyPin('000000')).toBe(false);
    });

    it('changePin updates to new PIN', async () => {
      await manager.setupPin('123456');
      await manager.changePin('123456', '654321');
      expect(await manager.verifyPin('654321')).toBe(true);
      expect(await manager.verifyPin('123456')).toBe(false);
    });

    it('changePin rejects wrong old PIN', async () => {
      await manager.setupPin('123456');
      await expect(manager.changePin('wrong1', '654321')).rejects.toThrow();
    });
  });
});

describe('testBiometric — must not claim biometrics the device does not have', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns false when the device reports no enrolled biometry', async () => {
    // Without this check the sentinel write/read succeeds through a NON-auth
    // Keystore cipher (react-native-keychain skips every auth-backed variant
    // when nothing is enrolled), so the round-trip "passes" and the app records
    // biometric protection that does not exist.
    (Keychain.getSupportedBiometryType as jest.Mock).mockResolvedValue(null);
    (Keychain.setGenericPassword as jest.Mock).mockResolvedValue(true);
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValue({password: 'ok'});

    await expect(new KeychainManager().testBiometric()).resolves.toBe(false);
    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
  });

  it('still exercises the real prompt when biometry IS enrolled', async () => {
    (Keychain.getSupportedBiometryType as jest.Mock).mockResolvedValue('Fingerprint');
    (Keychain.setGenericPassword as jest.Mock).mockResolvedValue(true);
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValue({password: 'ok'});

    await expect(new KeychainManager().testBiometric()).resolves.toBe(true);
    expect(Keychain.setGenericPassword).toHaveBeenCalled();
  });
});

describe('verifyPin — the 10-attempt escalation must actually escalate', () => {
  it('locks the session when the wipe threshold is reached', async () => {
    // recordFailedAttempt() has returned shouldWipeSession since it was written,
    // and the branch consuming it was an empty block with a comment saying the
    // caller would handle it. No caller did: grep found no consumer outside
    // pinLockout.ts and its own tests. So the documented escalation from
    // cooldown to session-wipe never happened, and a brute-forcer got unlimited
    // attempts at ~1 per cooldown window.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const lockout = require('../pinLockout');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {useSessionStore} = require('../../../store/zustand/sessionStore');
    jest.spyOn(lockout, 'checkCooldown').mockReturnValue({blocked: false, remainingMs: 0});
    jest
      .spyOn(lockout, 'recordFailedAttempt')
      .mockReturnValue({shouldWipeSession: true, cooldownStarted: false});
    const lock = jest.spyOn(useSessionStore.getState(), 'lock');

    const m = new KeychainManager();
    await m.setupPin('123456');
    await expect(m.verifyPin('999999')).resolves.toBe(false);

    expect(lock).toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
