import {NativeModules} from 'react-native';

/**
 * Native bridge for shielded signing operations.
 *
 * The real implementation lives in:
 *   iOS:     native/ios/NocturaSecureEnclave.swift (BLST via C interop)
 *   Android: native/android/NocturaKeyStore.kt (BLST via JNI)
 *
 * sk_spend NEVER leaves the native boundary. This bridge receives only:
 *   - Payload bytes to sign
 *   - Returns signature bytes or public key bytes
 *
 * The native module is registered as 'NocturaKeyModule'.
 * Before native integration, all methods throw with a clear message.
 */

interface NocturaKeyModuleInterface {
  /** Derive sk_spend and sign payload. Returns BLS12-381 signature. */
  signShieldedOp(payloadHex: string): Promise<string>;

  /** Derive pk_shielded (G1 point) from sk_spend. Returns 48-byte compressed hex. */
  getShieldedPublicKey(): Promise<string>;

  /** Store encrypted seed in Secure Enclave (iOS) / Keystore (Android). */
  storeSeed(mnemonicEncrypted: string): Promise<void>;

  /** Retrieve and decrypt seed. Requires biometric auth. */
  retrieveSeed(): Promise<string>;

  /** Check if seed exists in secure storage. */
  hasSeed(): Promise<boolean>;

  /** Delete seed from secure storage. */
  deleteSeed(): Promise<void>;
}

const NATIVE_NOT_READY =
  'Native module NocturaKeyModule not available. Build the native project with BLST integration.';

const NativeModule = NativeModules.NocturaKeyModule as
  | NocturaKeyModuleInterface
  | undefined;

function requireNative(): NocturaKeyModuleInterface {
  if (!NativeModule) {
    throw new Error(NATIVE_NOT_READY);
  }
  return NativeModule;
}

export const NocturaKeyBridge: NocturaKeyModuleInterface = {
  signShieldedOp: async (payloadHex: string) =>
    requireNative().signShieldedOp(payloadHex),

  getShieldedPublicKey: async () =>
    requireNative().getShieldedPublicKey(),

  storeSeed: async (mnemonicEncrypted: string) =>
    requireNative().storeSeed(mnemonicEncrypted),

  retrieveSeed: async () =>
    requireNative().retrieveSeed(),

  hasSeed: async () =>
    requireNative().hasSeed(),

  deleteSeed: async () =>
    requireNative().deleteSeed(),
};
