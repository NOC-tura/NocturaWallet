import {mmkvPublic, mmkvSecure, initSecureMmkv, clearAllStores} from '../instances';

describe('MMKV instances', () => {
  it('mmkvPublic is always available', () => {
    expect(mmkvPublic).toBeDefined();
    mmkvPublic.set('test_key', 'test_value');
    expect(mmkvPublic.getString('test_key')).toBe('test_value');
    mmkvPublic.remove('test_key');
  });

  it('mmkvSecure is null before initialization', () => {
    expect(mmkvSecure()).toBeNull();
  });

  it('mmkvSecure is available after initSecureMmkv', () => {
    initSecureMmkv('test-encryption-key-32chars!!!!!');
    const secure = mmkvSecure();
    expect(secure).not.toBeNull();
    secure!.set('secure_key', 'secure_value');
    expect(secure!.getString('secure_key')).toBe('secure_value');
    secure!.remove('secure_key');
  });
});

describe('clearAllStores — "wipe wallet" must actually wipe', () => {
  it('clears BOTH instances, not just the keychain', () => {
    // WipeWalletScreen reset the keychain and four Zustand stores and never
    // touched MMKV, so shielded notes, the merkle sync cache, the address book,
    // the derivation scheme and the PIN-lockout counters all survived a wipe —
    // with the decrypted secure handle still open in memory.
    initSecureMmkv('0123456789abcdef0123456789abcdef');
    mmkvPublic.set('public.key', 'v');
    mmkvSecure()!.set('secure.key', 'v');

    clearAllStores();

    expect(mmkvPublic.getString('public.key')).toBeUndefined();
    expect(mmkvSecure()).toBeNull();
  });

  it('is safe to call when the secure store was never opened', () => {
    expect(() => clearAllStores()).not.toThrow();
  });
});
