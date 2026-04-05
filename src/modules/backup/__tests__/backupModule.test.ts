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

  it('exportToFile returns encrypted Uint8Array with magic header', async () => {
    const data = await backup.exportToFile('test-password');
    expect(data).toBeInstanceOf(Uint8Array);
    const header = new TextDecoder().decode(data.slice(0, 17));
    expect(header).toBe('NOCTURA_BACKUP_V1');
  });

  it('export → import round-trip succeeds with correct password', async () => {
    const exported = await backup.exportToFile('my-password');
    const result = await backup.importFromFile(exported, 'my-password');
    expect(result.notesRestored).toBe(0);
    expect(result.tokensFound).toEqual([]);
    expect(result.shieldedBalanceRestored).toBe('0');
  });

  it('importFromFile throws on wrong password', async () => {
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

  it('getBackupIdentifier returns SHA-256 hash (not raw publicKey)', () => {
    const publicKeyHex = 'deadbeef01234567';
    const identifier = backup.getBackupIdentifier(publicKeyHex);
    expect(identifier).toMatch(/^[0-9a-f]{64}$/);
    expect(identifier).not.toBe(publicKeyHex);
  });
});
