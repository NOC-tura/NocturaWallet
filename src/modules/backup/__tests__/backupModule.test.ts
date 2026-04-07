import {sha256} from '@noble/hashes/sha2.js';
import {gcm} from '@noble/ciphers/aes.js';
import {randomBytes} from '@noble/ciphers/utils.js';
import {BackupManager} from '../backupModule';
import {mmkvPublic} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';

// PBKDF2-SHA512 with 600 K iterations is intentionally expensive.
// Each call takes ~1–3 s in Node; allow 60 s per test to avoid flakiness.
jest.setTimeout(60_000);

// ---------------------------------------------------------------------------
// Helpers to build a V1 backup manually (mirrors the old single-SHA-256 logic)
// ---------------------------------------------------------------------------

function aesEncryptV1(plaintext: Uint8Array, key: Uint8Array): Uint8Array {
  const nonce = randomBytes(12);
  const cipher = gcm(key, nonce);
  const ciphertext = cipher.encrypt(plaintext);
  const result = new Uint8Array(nonce.length + ciphertext.length);
  result.set(nonce, 0);
  result.set(ciphertext, nonce.length);
  return result;
}

function buildV1Backup(password: string): Uint8Array {
  const MAGIC_V1 = 'NOCTURA_BACKUP_V1';
  const payload = JSON.stringify({version: 1, notes: [], metadata: {}, exportedAt: 0});
  const plaintext = new TextEncoder().encode(payload);
  const salt = randomBytes(16);
  // Old single-pass SHA-256 KDF
  const input = new Uint8Array([...new TextEncoder().encode(password), ...salt]);
  const key = sha256(input);
  const encrypted = aesEncryptV1(plaintext, key);
  const magic = new TextEncoder().encode(MAGIC_V1);
  const result = new Uint8Array(magic.length + salt.length + encrypted.length);
  result.set(magic, 0);
  result.set(salt, magic.length);
  result.set(encrypted, magic.length + salt.length);
  return result;
}

// ---------------------------------------------------------------------------

describe('BackupManager', () => {
  let backup: BackupManager;

  beforeEach(() => {
    mmkvPublic.clearAll();
    backup = new BackupManager();
  });

  it('isCloudBackupEnabled returns false by default', () => {
    expect(backup.isCloudBackupEnabled()).toBe(false);
  });

  it('enableCloudBackup sets BACKUP_CLOUD_ENABLED flag in MMKV', async () => {
    await backup.enableCloudBackup();
    expect(mmkvPublic.getString(MMKV_KEYS.BACKUP_CLOUD_ENABLED)).toBe('true');
  });

  it('disableCloudBackup clears BACKUP_CLOUD_ENABLED flag', async () => {
    await backup.enableCloudBackup();
    await backup.disableCloudBackup();
    expect(mmkvPublic.getString(MMKV_KEYS.BACKUP_CLOUD_ENABLED)).toBeUndefined();
  });

  it('lastCloudBackupAt returns null initially', () => {
    expect(backup.lastCloudBackupAt()).toBeNull();
  });

  it('performCloudBackup updates BACKUP_LAST_AT when enabled', async () => {
    await backup.enableCloudBackup();
    const before = Date.now();
    await backup.performCloudBackup();
    const ts = backup.lastCloudBackupAt();
    expect(ts).not.toBeNull();
    expect(ts!).toBeGreaterThanOrEqual(before);
  });

  it('performCloudBackup does nothing when disabled', async () => {
    await backup.performCloudBackup();
    expect(backup.lastCloudBackupAt()).toBeNull();
  });

  it('exportToFile returns encrypted Uint8Array with V2 magic header', async () => {
    const data = await backup.exportToFile('test-password');
    expect(data).toBeInstanceOf(Uint8Array);
    // 'NOCTURA_BACKUP_V2' is 17 bytes
    const header = new TextDecoder().decode(data.slice(0, 17));
    expect(header).toBe('NOCTURA_BACKUP_V2');
  });

  it('export → import round-trip (V2) succeeds with correct password', async () => {
    const exported = await backup.exportToFile('my-password');
    const result = await backup.importFromFile(exported, 'my-password');
    expect(result.notesRestored).toBe(0);
    expect(result.tokensFound).toEqual([]);
    expect(result.shieldedBalanceRestored).toBe('0');
  });

  it('importFromFile throws on wrong password (V2)', async () => {
    const exported = await backup.exportToFile('correct-password');
    await expect(backup.importFromFile(exported, 'wrong-password')).rejects.toThrow(
      /wrong password|corrupted/i,
    );
  });

  it('importFromFile throws on invalid file format', async () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5]);
    await expect(backup.importFromFile(garbage, 'password')).rejects.toThrow(
      /invalid backup/i,
    );
  });

  it('imports V1 backup with legacy KDF', async () => {
    const v1Data = buildV1Backup('legacy-password');
    // Sanity check: V1 magic in the raw bytes
    const header = new TextDecoder().decode(v1Data.slice(0, 17));
    expect(header).toBe('NOCTURA_BACKUP_V1');
    // importFromFile must transparently handle V1
    const result = await backup.importFromFile(v1Data, 'legacy-password');
    expect(result.notesRestored).toBe(0);
    expect(result.tokensFound).toEqual([]);
    expect(result.shieldedBalanceRestored).toBe('0');
  });

  it('imports V1 backup throws on wrong password', async () => {
    const v1Data = buildV1Backup('correct-v1-password');
    await expect(backup.importFromFile(v1Data, 'wrong-password')).rejects.toThrow(
      /wrong password|corrupted/i,
    );
  });

  it('getBackupIdentifier returns SHA-256 hash (not raw publicKey)', () => {
    const publicKeyHex = 'deadbeef01234567';
    const identifier = backup.getBackupIdentifier(publicKeyHex);
    expect(identifier).toMatch(/^[0-9a-f]{64}$/);
    expect(identifier).not.toBe(publicKeyHex);
  });
});
