import {mmkvPublic, mmkvSecure, initSecureMmkv} from '../instances';

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
