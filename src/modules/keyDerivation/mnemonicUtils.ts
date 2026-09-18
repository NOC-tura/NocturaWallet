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
 * Canonical form of a user-typed BIP-39 phrase.
 *
 * `@scure/bip39` accepts only the canonical form, and a phone keyboard rarely
 * produces it: Gboard's "double-space = period" leaves a `.` that counts as an
 * extra word, auto-capitalization survives `autoCapitalize="none"` on some IMEs,
 * and a zero-width character is INVISIBLE on screen while breaking the checksum.
 * None of these can ever be part of a BIP-39 word — the wordlist is 2048 strings
 * of lowercase a-z — so removing them cannot mask a real transcription error.
 *
 * NFKD first (so composed forms decompose the way BIP-39 specifies), then lower
 * case, then drop every character that is not a-z or whitespace, then collapse
 * whitespace. Applied to BOTH validation and seed derivation: an input that
 * validates must derive from exactly the string that was validated, or the user
 * silently lands in a different wallet.
 */
export function normalizeMnemonicInput(input: string): string {
  return input
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0)
    .join(' ');
}

/**
 * Validate a BIP-39 mnemonic (checksum + wordlist). Input is normalized first
 * (see normalizeMnemonicInput) so keyboard artifacts do not reject a correct
 * phrase.
 * Accepts both 12-word (128-bit) and 24-word (256-bit) mnemonics.
 */
export function validateMnemonic(mnemonic: string): boolean {
  if (!mnemonic || mnemonic.trim().length === 0) return false;
  try {
    return validate(normalizeMnemonicInput(mnemonic), wordlist);
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
  return mnemonicToSeedAsync(normalizeMnemonicInput(mnemonic));
}
