import {
  generateMnemonic as generate,
  validateMnemonic as validate,
  mnemonicToSeed as mnemonicToSeedAsync,
} from '@scure/bip39';
import {wordlist} from '@scure/bip39/wordlists/english.js';

/**
 * Generate a 24-word BIP-39 mnemonic (256 bits of entropy).
 * Uses crypto.getRandomValues() via polyfill (loaded in index.js).
 */
export function generateMnemonic(): string {
  return generate(wordlist, 256);
}

/**
 * Validate a BIP-39 mnemonic (checksum + wordlist).
 * Accepts both 12-word (128-bit) and 24-word (256-bit) mnemonics.
 */
export function validateMnemonic(mnemonic: string): boolean {
  if (!mnemonic || mnemonic.trim().length === 0) return false;
  try {
    return validate(mnemonic, wordlist);
  } catch {
    return false;
  }
}

/**
 * Derive a 512-bit (64-byte) seed from a mnemonic via PBKDF2-HMAC-SHA512.
 * No passphrase — standard BIP-39 derivation.
 * Uses the async version to avoid blocking the JS thread on low-end devices.
 */
export async function mnemonicToSeed(mnemonic: string): Promise<Uint8Array> {
  return mnemonicToSeedAsync(mnemonic);
}
