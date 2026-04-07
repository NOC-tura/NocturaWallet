import {sha256} from '@noble/hashes/sha2.js';
import {sha512} from '@noble/hashes/sha2.js';
import {pbkdf2Async} from '@noble/hashes/pbkdf2.js';
import {gcm} from '@noble/ciphers/aes.js';
import {randomBytes} from '@noble/ciphers/utils.js';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import type {RestoreResult} from './types';

/**
 * KDF iterations for PBKDF2-SHA512.
 * 600 000 rounds per OWASP 2023 recommendation for SHA-512.
 */
const BACKUP_KDF_ITERATIONS = 600_000;

/**
 * Derive a 256-bit AES key from password + salt using PBKDF2-SHA512 (600 K iterations).
 * Async to avoid blocking the JS thread during the expensive KDF.
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  return pbkdf2Async(sha512, new TextEncoder().encode(password), salt, {
    c: BACKUP_KDF_ITERATIONS,
    dkLen: 32,
  });
}

/** AES-256-GCM encrypt. Returns nonce(12) + ciphertext + tag(16). */
function aesEncrypt(plaintext: Uint8Array, key: Uint8Array): Uint8Array {
  const nonce = randomBytes(12);
  const cipher = gcm(key, nonce);
  const ciphertext = cipher.encrypt(plaintext);
  // Prepend nonce so decryptor can extract it
  const result = new Uint8Array(nonce.length + ciphertext.length);
  result.set(nonce, 0);
  result.set(ciphertext, nonce.length);
  return result;
}

/** AES-256-GCM decrypt. Expects nonce(12) + ciphertext + tag(16). */
function aesDecrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  const nonce = data.slice(0, 12);
  const ciphertext = data.slice(12);
  const cipher = gcm(key, nonce);
  return cipher.decrypt(ciphertext);
}

/** Legacy V1 magic — single SHA-256 KDF (kept for migration read-back). */
const BACKUP_MAGIC_V1 = 'NOCTURA_BACKUP_V1';
/** Current V2 magic — PBKDF2-SHA512 600 K iterations. */
const BACKUP_MAGIC = 'NOCTURA_BACKUP_V2';

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
    const salt = randomBytes(16);
    const key = await deriveKey(password, salt);
    const encrypted = aesEncrypt(plaintext, key);

    // Format: MAGIC(17) + salt(16) + nonce(12) + ciphertext + tag(16)
    const magic = new TextEncoder().encode(BACKUP_MAGIC);
    const result = new Uint8Array(magic.length + salt.length + encrypted.length);
    result.set(magic, 0);
    result.set(salt, magic.length);
    result.set(encrypted, magic.length + salt.length);
    return result;
  }

  /**
   * Import wallet backup from encrypted .noctura file.
   * Supports V2 (PBKDF2-SHA512) and V1 (legacy single SHA-256) formats.
   * Decrypts with password, returns restore result.
   */
  async importFromFile(data: Uint8Array, password: string): Promise<RestoreResult> {
    const magicV2 = new TextEncoder().encode(BACKUP_MAGIC);
    const magicV1 = new TextEncoder().encode(BACKUP_MAGIC_V1);

    const headerV2 = new TextDecoder().decode(data.slice(0, magicV2.length));
    const headerV1 = new TextDecoder().decode(data.slice(0, magicV1.length));

    let key: Uint8Array;
    let magicLen: number;

    if (headerV2 === BACKUP_MAGIC) {
      magicLen = magicV2.length;
      const salt = data.slice(magicLen, magicLen + 16);
      key = await deriveKey(password, salt);
    } else if (headerV1 === BACKUP_MAGIC_V1) {
      magicLen = magicV1.length;
      const salt = data.slice(magicLen, magicLen + 16);
      // Legacy V1: single SHA-256 pass — no key stretching
      const input = new Uint8Array([...new TextEncoder().encode(password), ...salt]);
      key = sha256(input);
    } else {
      throw new Error('Invalid backup file format');
    }

    const encrypted = data.slice(magicLen + 16);

    try {
      const decrypted = aesDecrypt(encrypted, key);
      const payload = JSON.parse(new TextDecoder().decode(decrypted)) as {
        notes?: unknown[];
      };
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
