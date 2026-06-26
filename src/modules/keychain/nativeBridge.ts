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
  /**
   * Derive sk_spend (EIP-2333) from the seed and sign payload IN NATIVE.
   * Returns a 96-byte G2 compressed BLS12-381 signature (hex). sk_spend is
   * zeroized after the op and never crosses to JS. (C1 passes the seed; the
   * circuit-specific spend-auth payload is finalized in C2.)
   */
  signShieldedOp(seedHex: string, payloadHex: string): Promise<string>;

  /**
   * Derive pk_shielded (G1) from sk_spend (EIP-2333) IN NATIVE.
   * Returns the 48-byte G1 compressed public key (hex).
   */
  getShieldedPublicKey(seedHex: string): Promise<string>;

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
  signShieldedOp: async (seedHex: string, payloadHex: string) =>
    requireNative().signShieldedOp(seedHex, payloadHex),

  getShieldedPublicKey: async (seedHex: string) =>
    requireNative().getShieldedPublicKey(seedHex),

  storeSeed: async (mnemonicEncrypted: string) =>
    requireNative().storeSeed(mnemonicEncrypted),

  retrieveSeed: async () =>
    requireNative().retrieveSeed(),

  hasSeed: async () =>
    requireNative().hasSeed(),

  deleteSeed: async () =>
    requireNative().deleteSeed(),
};
