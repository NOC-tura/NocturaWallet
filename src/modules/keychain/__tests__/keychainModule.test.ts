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
