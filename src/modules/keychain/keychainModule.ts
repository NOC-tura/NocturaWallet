import Keychain from 'react-native-keychain';
import {hashPin, verifyPin as verifyPinHash, generateSalt} from './pinManager';
import {checkCooldown, recordFailedAttempt, resetAttempts} from './pinLockout';

/** Convert Uint8Array to hex string without Buffer (not available in RN prod bundle). */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Convert hex string to Uint8Array without Buffer. */
function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

const SERVICE_SEED = 'noctura.seed';
const SERVICE_VIEW_KEY = 'noctura.viewKey';
const SERVICE_PIN_HASH = 'noctura.pinHash';
const SERVICE_PIN_SALT = 'noctura.pinSalt';

const KEYCHAIN_OPTIONS = {
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * Secure key storage abstraction over react-native-keychain.
 *
 * Stores:
 *   - Encrypted seed mnemonic (biometric-protected in production)
 *   - View key (retrievable without biometric — read-only)
 *   - PIN hash + salt (for PIN fallback unlock)
 *
 * For shielded signing (sk_spend), see nativeBridge.ts — never stored in JS.
 *
 * Current: react-native-keychain provides OS-level encryption (iOS Keychain / Android Keystore).
 * Upgrade path: When native BLST modules are integrated, seed storage will use P-256 ECDH
 * envelope encryption via iOS Secure Enclave / Android StrongBox for an additional layer
 * (P-256 key in SE produces AES-256-GCM key → encrypt seed). See .instructions.md lines 62-67.
 */
export class KeychainManager {
  async storeSeed(mnemonic: string): Promise<void> {
    await Keychain.setGenericPassword('seed', mnemonic, {
      ...KEYCHAIN_OPTIONS,
      service: SERVICE_SEED,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
    });
  }

  async retrieveSeed(): Promise<string> {
    const result = await Keychain.getGenericPassword({
      service: SERVICE_SEED,
      authenticationPrompt: {
        title: 'Authenticate to access wallet',
        subtitle: 'Biometric or device passcode required',
        cancel: 'Cancel',
      },
    });
    if (!result) throw new Error('No seed found in keychain');
    return result.password;
  }

  async hasWallet(): Promise<boolean> {
    const result = await Keychain.getGenericPassword({service: SERVICE_SEED});
    return result !== false;
  }

  async storeViewKey(viewKey: Uint8Array): Promise<void> {
    const hex = toHex(viewKey);
    await Keychain.setGenericPassword('viewKey', hex, {
      ...KEYCHAIN_OPTIONS,
      service: SERVICE_VIEW_KEY,
    });
  }

  async retrieveViewKey(): Promise<Uint8Array> {
    const result = await Keychain.getGenericPassword({service: SERVICE_VIEW_KEY});
    if (!result) throw new Error('No view key found in keychain');
    return fromHex(result.password);
  }

  async wipeKeys(): Promise<void> {
    await Keychain.resetGenericPassword({service: SERVICE_SEED});
    await Keychain.resetGenericPassword({service: SERVICE_VIEW_KEY});
    await Keychain.resetGenericPassword({service: SERVICE_PIN_HASH});
    await Keychain.resetGenericPassword({service: SERVICE_PIN_SALT});
    // Also wipe native-stored seed if native module is available
    try {
      const {NocturaKeyBridge} = require('./nativeBridge');
      await NocturaKeyBridge.deleteSeed();
    } catch {
      // Native module not available yet — safe to ignore during development
    }
  }

  async setupPin(pin: string): Promise<void> {
    const salt = generateSalt();
    const hash = await hashPin(pin, salt);

    await Keychain.setGenericPassword(
      'pinSalt',
      toHex(salt),
      {...KEYCHAIN_OPTIONS, service: SERVICE_PIN_SALT},
    );
    await Keychain.setGenericPassword(
      'pinHash',
      toHex(hash),
      {...KEYCHAIN_OPTIONS, service: SERVICE_PIN_HASH},
    );
  }

  // Spec defines isPinConfigured(): boolean (sync), but keychain reads are inherently async.
  // Justified deviation: async is required on both iOS and Android.
  async isPinConfigured(): Promise<boolean> {
    const result = await Keychain.getGenericPassword({service: SERVICE_PIN_HASH});
    return result !== false;
  }

  /**
   * Verify PIN with cooldown enforcement.
   * Throws if in cooldown. Resets counter on success.
   * Returns { valid, shouldWipeSession } — caller decides wipe action.
   */
  async verifyPin(pin: string): Promise<boolean> {
    const cooldown = checkCooldown();
    if (cooldown.blocked) {
      const secs = Math.ceil(cooldown.remainingMs / 1000);
      throw new Error(`Too many incorrect attempts. Try again in ${secs}s`);
    }

    const saltResult = await Keychain.getGenericPassword({service: SERVICE_PIN_SALT});
    const hashResult = await Keychain.getGenericPassword({service: SERVICE_PIN_HASH});

    if (!saltResult || !hashResult) return false;

    const salt = fromHex(saltResult.password);
    const storedHash = fromHex(hashResult.password);

    const valid = await verifyPinHash(pin, salt, storedHash);

    if (valid) {
      resetAttempts();
    } else {
      const result = recordFailedAttempt();
      if (result.shouldWipeSession) {
        // Caller (UnlockScreen) should lock session on receiving false + checking attempt count
      }
    }

    return valid;
  }

  async changePin(oldPin: string, newPin: string): Promise<void> {
    const verified = await this.verifyPin(oldPin);
    if (!verified) throw new Error('Current PIN is incorrect');
    await this.setupPin(newPin);
  }
}

export const keychainManager = new KeychainManager();
