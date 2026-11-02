import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex, utf8ToBytes} from '@noble/hashes/utils.js';

/**
 * B1e §2.3, §2.4: the text of a stored v1_vault value — JSON.stringify of the value storage.local hands back, keys in
 * their stored order — which "Save the damaged data" downloads and the damaged-vault removal's digest hashes.
 * `undefined` (no wallet) has no text and throws: it is never damaged.
 */
export function storedText(raw: unknown): string {
  const text: unknown = JSON.stringify(raw);
  if (typeof text !== 'string') throw new TypeError('storedText: the value has no JSON text');
  return text;
}

/** sha256, lowercase hex, of the UTF-8 bytes of storedText(raw): the token a damaged-vault removal is bound to (§2.4). */
export function storedDigest(raw: unknown): string {
  return bytesToHex(sha256(utf8ToBytes(storedText(raw))));
}
