import {sha256} from '@noble/hashes/sha2.js';

/**
 * Generate a deterministic referral code from a wallet address.
 * Uses SHA-256 (from @noble/hashes, already in project) truncated to 6 alphanumeric chars.
 * Format: NOC-XXXXXX (base-36, ~2.2 billion possible values — negligible collision risk).
 */
export function generateReferralCode(walletAddress: string): string {
  const hash = sha256(new TextEncoder().encode(walletAddress));
  // Take first 4 bytes of SHA-256 hash → 32-bit number → base-36 → uppercase → pad to 6
  const num =
    (hash[0] << 24) | (hash[1] << 16) | (hash[2] << 8) | hash[3];
  const code = Math.abs(num)
    .toString(36)
    .toUpperCase()
    .padStart(6, '0')
    .slice(0, 6);
  return `NOC-${code}`;
}
