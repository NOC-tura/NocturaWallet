import {base58} from '@scure/base';

/** The one external link (spec §6.5, D37): Solscan, as the design names it. A link only — nothing is fetched. */
export const EXPLORER_PREFIX = 'https://solscan.io/tx/';

/** A signature is checked (base58, 64 bytes) before it is put in the URL; anything else has no link. */
export function explorerUrl(signature: string): string | null {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) return null;
  try {
    return base58.decode(signature).length === 64 ? `${EXPLORER_PREFIX}${signature}` : null;
  } catch {
    return null;
  }
}
