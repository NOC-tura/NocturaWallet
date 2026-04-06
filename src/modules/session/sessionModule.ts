import {zeroize} from './zeroize';

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * In-memory session key manager.
 *
 * Holds the Ed25519 keypair (Uint8Array) in memory after biometric unlock.
 * The keypair is NEVER written to disk or MMKV.
 *
 * Lifecycle:
 *   1. Biometric unlock → seed decrypted → derive Ed25519 keypair → unlock(keypair)
 *   2. All transparent tx signed with in-memory keypair
 *   3. Shielded tx → native bridge (BLS12-381 key never in JS)
 *   4. Timeout or manual lock → zeroize keypair → set to null
 *
 * Zeroization: lock() fills the Uint8Array with 0x00 then sets reference to null.
 */
export class SessionManager {
  private keypair: Uint8Array | null = null;
  private expiresAt: number = 0;
  private timeoutMs: number = DEFAULT_TIMEOUT_MS;

  /**
   * Activate session with a derived Ed25519 keypair (64 bytes).
   * The session holds a reference to the SAME Uint8Array — it will be zeroized on lock.
   */
  unlock(keypair: Uint8Array): void {
    this.keypair = keypair;
    this.expiresAt = Date.now() + this.timeoutMs;
  }

  /**
   * Deactivate session and securely erase the keypair from memory.
   */
  lock(): void {
    if (this.keypair) {
      zeroize(this.keypair);
    }
    this.keypair = null;
    this.expiresAt = 0;
  }

  /**
   * Check if an active, non-expired session exists.
   * Auto-locks if the timeout has passed (defense-in-depth).
   */
  isActive(): boolean {
    if (!this.keypair) return false;
    if (Date.now() >= this.expiresAt) {
      this.lock();
      return false;
    }
    return true;
  }

  /**
   * Get the in-memory keypair for signing transparent transactions.
   * Returns null if session is not active.
   */
  getKeypair(): Uint8Array | null {
    return this.keypair;
  }

  /**
   * Seconds remaining until session expires. 0 if not active.
   */
  sessionExpiresIn(): number {
    if (!this.keypair) return 0;
    const remaining = Math.max(0, this.expiresAt - Date.now());
    return Math.ceil(remaining / 1000);
  }

  /**
   * Reset the inactivity timer (sliding window).
   * Called on every user interaction.
   */
  touchActivity(): void {
    if (this.keypair) {
      this.expiresAt = Date.now() + this.timeoutMs;
    }
  }

  /**
   * Update the timeout duration (from settings).
   */
  setTimeoutMinutes(minutes: number): void {
    this.timeoutMs = minutes * 60 * 1000;
  }
}

export const sessionManager = new SessionManager();
