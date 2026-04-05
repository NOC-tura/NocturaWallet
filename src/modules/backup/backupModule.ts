import {sha256} from '@noble/hashes/sha2.js';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import type {RestoreResult} from './types';

// Simple XOR-based encryption for the scaffold. Real AES-256-GCM will use
// @noble/ciphers when the full backup pipeline (cloud upload/download) is wired.
// This provides a working encrypt/decrypt round-trip with password-derived key.
function deriveKey(password: string, salt: Uint8Array): Uint8Array {
  const input = new Uint8Array([...new TextEncoder().encode(password), ...salt]);
  return sha256(input);
}

function xorEncrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

const BACKUP_MAGIC = 'NOCTURA_BACKUP_V1';

export class BackupManager {
  async enableCloudBackup(): Promise<void> {
    mmkvPublic.set(MMKV_KEYS.BACKUP_CLOUD_ENABLED, 'true');
  }

  async disableCloudBackup(): Promise<void> {
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
    if (!this.isCloudBackupEnabled()) return;
    // Collect shielded notes → encrypt → upload (upload stubbed, requires native SDK)
    mmkvPublic.set(MMKV_KEYS.BACKUP_LAST_AT, String(Date.now()));
  }

  async restoreFromCloud(): Promise<RestoreResult> {
    // Stubbed — requires native iCloud/GDrive SDK for download + decrypt
    return {
      notesRestored: 0,
      tokensFound: [],
      transparentBalanceFound: false,
      shieldedBalanceRestored: '0',
    };
  }

  /**
   * Export wallet backup as encrypted .noctura file.
   * Double-layer: password + mnemonic-derived key (mnemonic key deferred to integration).
   * NEVER contains raw mnemonic or private keys.
   */
  async exportToFile(password: string): Promise<Uint8Array> {
    const payload = JSON.stringify({
      version: 1,
      notes: [],
      metadata: {},
      exportedAt: Date.now(),
    });
    const plaintext = new TextEncoder().encode(payload);
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    const key = deriveKey(password, salt);
    const encrypted = xorEncrypt(plaintext, key);

    // Format: MAGIC + salt(16) + encrypted data
    const magic = new TextEncoder().encode(BACKUP_MAGIC);
    const result = new Uint8Array(magic.length + salt.length + encrypted.length);
    result.set(magic, 0);
    result.set(salt, magic.length);
    result.set(encrypted, magic.length + salt.length);
    return result;
  }

  /**
   * Import wallet backup from encrypted .noctura file.
   * Decrypts with password, returns restore result.
   */
  async importFromFile(data: Uint8Array, password: string): Promise<RestoreResult> {
    const magic = new TextEncoder().encode(BACKUP_MAGIC);

    // Validate magic header
    const header = data.slice(0, magic.length);
    if (new TextDecoder().decode(header) !== BACKUP_MAGIC) {
      throw new Error('Invalid backup file format');
    }

    const salt = data.slice(magic.length, magic.length + 16);
    const encrypted = data.slice(magic.length + 16);
    const key = deriveKey(password, salt);
    const decrypted = xorEncrypt(encrypted, key); // XOR is symmetric

    try {
      const payload = JSON.parse(new TextDecoder().decode(decrypted));
      return {
        notesRestored: payload.notes?.length ?? 0,
        tokensFound: [],
        transparentBalanceFound: false,
        shieldedBalanceRestored: '0',
      };
    } catch {
      throw new Error('Decryption failed — wrong password or corrupted file');
    }
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
