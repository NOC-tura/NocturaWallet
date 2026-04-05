import {sha256} from '@noble/hashes/sha2.js';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import type {RestoreResult} from './types';

export class BackupManager {
  enableCloudBackup(): void {
    mmkvPublic.set(MMKV_KEYS.BACKUP_CLOUD_ENABLED, 'true');
  }

  disableCloudBackup(): void {
    mmkvPublic.remove(MMKV_KEYS.BACKUP_CLOUD_ENABLED);
  }

  isCloudBackupEnabled(): boolean {
    return mmkvPublic.getString(MMKV_KEYS.BACKUP_CLOUD_ENABLED) === 'true';
  }

  lastCloudBackupAt(): number | null {
    const ts = mmkvPublic.getString(MMKV_KEYS.BACKUP_LAST_AT);
    return ts ? Number(ts) : null;
  }

  async performCloudBackup(): Promise<void> {
    // Collect shielded notes + metadata → encrypt → upload (stubbed)
    // For now: just update the timestamp
    mmkvPublic.set(MMKV_KEYS.BACKUP_LAST_AT, String(Date.now()));
  }

  async restoreFromCloud(): Promise<RestoreResult> {
    // Stubbed — real cloud download + decrypt requires native iCloud/GDrive SDK
    return {
      notesRestored: 0,
      tokensFound: [],
      transparentBalanceFound: false,
      shieldedBalanceRestored: '0',
    };
  }

  async exportToFile(password: string): Promise<Uint8Array> {
    // Collect data → double-layer encrypt (password + mnemonic-derived key)
    // Stub: return a minimal encrypted blob
    const data = JSON.stringify({
      version: 1,
      notes: [],
      metadata: {},
      exportedAt: Date.now(),
      _passwordHint: password.length > 0 ? 'set' : 'unset',
    });
    const encoded = new TextEncoder().encode(data);
    // Real encryption with AES-256-GCM would go here
    return encoded;
  }

  async importFromFile(data: Uint8Array, _password: string): Promise<RestoreResult> {
    // Decrypt → parse → return results
    // Stub: return empty result
    void data;
    return {
      notesRestored: 0,
      tokensFound: [],
      transparentBalanceFound: false,
      shieldedBalanceRestored: '0',
    };
  }

  /**
   * Get backup identifier: SHA-256(publicKey bytes), not raw address.
   * Used as cloud storage key so the public address is never in cloud metadata.
   */
  getBackupIdentifier(publicKeyHex: string): string {
    const bytes = new Uint8Array(
      publicKeyHex.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) ?? [],
    );
    const hash = sha256(bytes);
    return Buffer.from(hash).toString('hex');
  }
}
