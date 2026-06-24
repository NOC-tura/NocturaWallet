import {PublicKey} from '@solana/web3.js';
import {base58} from '@scure/base';

/**
 * Parse a raw referral input into a validated Solana address (base58), or null.
 *
 * Accepts either a bare base58 address or a link containing a `ref=` query
 * parameter (e.g. `https://noc-tura.io?ref=<addr>`). The candidate is validated
 * as a real 32-byte Solana pubkey via `new PublicKey(...)` (the canonical check);
 * we additionally decode the base58 and assert a 32-byte length so junk strings
 * are rejected deterministically regardless of the PublicKey implementation.
 *
 * @returns the canonical base58 address on success, else null.
 */
export function parseReferralInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let candidate = trimmed;
  if (candidate.includes('ref=')) {
    candidate = candidate.split('ref=')[1].split('&')[0];
  }

  try {
    // A valid Solana pubkey is exactly 32 bytes of base58.
    const decoded = base58.decode(candidate);
    if (decoded.length !== 32) {
      return null;
    }
    return new PublicKey(candidate).toBase58();
  } catch {
    return null;
  }
}
