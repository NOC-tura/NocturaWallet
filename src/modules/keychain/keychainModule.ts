import Keychain from 'react-native-keychain';
import {hashPin, verifyPin as verifyPinHash, generateSalt} from './pinManager';

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
 */
export class KeychainManager {
  async storeSeed(mnemonic: string): Promise<void> {
    await Keychain.setGenericPassword('seed', mnemonic, {
      ...KEYCHAIN_OPTIONS,
      service: SERVICE_SEED,
    });
  }

  async retrieveSeed(): Promise<string> {
    const result = await Keychain.getGenericPassword({service: SERVICE_SEED});
    if (!result) throw new Error('No seed found in keychain');
    return result.password;
  }

  async hasWallet(): Promise<boolean> {
    const result = await Keychain.getGenericPassword({service: SERVICE_SEED});
    return result !== false;
  }

  async storeViewKey(viewKey: Uint8Array): Promise<void> {
    const hex = Buffer.from(viewKey).toString('hex');
    await Keychain.setGenericPassword('viewKey', hex, {
      ...KEYCHAIN_OPTIONS,
      service: SERVICE_VIEW_KEY,
    });
  }

  async retrieveViewKey(): Promise<Uint8Array> {
    const result = await Keychain.getGenericPassword({service: SERVICE_VIEW_KEY});
    if (!result) throw new Error('No view key found in keychain');
    return new Uint8Array(Buffer.from(result.password, 'hex'));
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
      Buffer.from(salt).toString('hex'),
      {...KEYCHAIN_OPTIONS, service: SERVICE_PIN_SALT},
    );
    await Keychain.setGenericPassword(
      'pinHash',
      Buffer.from(hash).toString('hex'),
      {...KEYCHAIN_OPTIONS, service: SERVICE_PIN_HASH},
    );
  }

  // Spec defines isPinConfigured(): boolean (sync), but keychain reads are inherently async.
  // Justified deviation: async is required on both iOS and Android.
  async isPinConfigured(): Promise<boolean> {
    const result = await Keychain.getGenericPassword({service: SERVICE_PIN_HASH});
    return result !== false;
  }

  async verifyPin(pin: string): Promise<boolean> {
    const saltResult = await Keychain.getGenericPassword({service: SERVICE_PIN_SALT});
    const hashResult = await Keychain.getGenericPassword({service: SERVICE_PIN_HASH});

    if (!saltResult || !hashResult) return false;

    const salt = new Uint8Array(Buffer.from(saltResult.password, 'hex'));
    const storedHash = new Uint8Array(Buffer.from(hashResult.password, 'hex'));

    return verifyPinHash(pin, salt, storedHash);
  }

  async changePin(oldPin: string, newPin: string): Promise<void> {
    const verified = await this.verifyPin(oldPin);
    if (!verified) throw new Error('Current PIN is incorrect');
    await this.setupPin(newPin);
  }
}
