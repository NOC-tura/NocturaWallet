jest.mock('../../keychain/keychainModule', () => ({
  keychainManager: {retrieveSeed: jest.fn().mockResolvedValue('mnemonic words here')},
}));
jest.mock('../../keyDerivation/mnemonicUtils', () => ({
  mnemonicToSeed: jest.fn().mockResolvedValue(new Uint8Array(64).fill(3)),
}));
jest.mock('../../../store/mmkv/instances', () => ({
  initSecureMmkv: jest.fn(),
  mmkvSecure: jest.fn(() => null),
}));
import {unlockSecureStorage} from '../secureStorageSession';
import {initSecureMmkv} from '../../../store/mmkv/instances';

describe('unlockSecureStorage', () => {
  it('retrieves the seed and initializes the secure MMKV with the derived key', async () => {
    await unlockSecureStorage();
    expect(initSecureMmkv).toHaveBeenCalledWith(expect.any(String));
    const key = (initSecureMmkv as jest.Mock).mock.calls[0][0];
    expect(key).toHaveLength(32); // 16-byte hex
  });
});
