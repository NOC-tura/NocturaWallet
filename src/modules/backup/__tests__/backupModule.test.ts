import {BackupManager} from '../backupModule';
import {mmkvPublic} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';

describe('BackupManager', () => {
  let backup: BackupManager;

  beforeEach(() => {
    mmkvPublic.clearAll();
    backup = new BackupManager();
  });

  it('isCloudBackupEnabled returns false by default', () => {
    expect(backup.isCloudBackupEnabled()).toBe(false);
  });

  it('enableCloudBackup sets BACKUP_CLOUD_ENABLED flag in MMKV', () => {
    backup.enableCloudBackup();
    expect(mmkvPublic.getString(MMKV_KEYS.BACKUP_CLOUD_ENABLED)).toBe('true');
  });

  it('disableCloudBackup clears BACKUP_CLOUD_ENABLED flag', () => {
    backup.enableCloudBackup();
    backup.disableCloudBackup();
    expect(mmkvPublic.getString(MMKV_KEYS.BACKUP_CLOUD_ENABLED)).toBeUndefined();
  });

  it('lastCloudBackupAt returns null initially', () => {
    expect(backup.lastCloudBackupAt()).toBeNull();
  });

  it('performCloudBackup updates BACKUP_LAST_AT timestamp', async () => {
    const before = Date.now();
    await backup.performCloudBackup();
    const ts = backup.lastCloudBackupAt();
    expect(ts).not.toBeNull();
    expect(ts!).toBeGreaterThanOrEqual(before);
  });

  it('exportToFile returns a Uint8Array (encrypted data)', async () => {
    const data = await backup.exportToFile('test-password');
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBeGreaterThan(0);
  });

  it('importFromFile returns a RestoreResult', async () => {
    const exported = await backup.exportToFile('test-password');
    const result = await backup.importFromFile(exported, 'test-password');
    expect(result).toHaveProperty('notesRestored');
    expect(result).toHaveProperty('tokensFound');
    expect(result).toHaveProperty('transparentBalanceFound');
    expect(result).toHaveProperty('shieldedBalanceRestored');
  });

  it('getBackupIdentifier returns SHA-256 hash (not raw publicKey)', () => {
    const publicKeyHex = 'deadbeef01234567';
    const identifier = backup.getBackupIdentifier(publicKeyHex);
    // Must be a 64-char hex string (SHA-256 = 32 bytes = 64 hex chars)
    expect(identifier).toMatch(/^[0-9a-f]{64}$/);
    // Must NOT equal the raw input
    expect(identifier).not.toBe(publicKeyHex);
  });
});
