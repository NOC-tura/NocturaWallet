import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex, utf8ToBytes} from '@noble/hashes/utils.js';

/** sha256 hex of the JSON text. Callers build the object key by key, so the text is canonical. */
export function digestOf(value: unknown): string {
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify(value))));
}

/** 16 random bytes as 32 hex characters: prepared-send, pending and challenge ids. */
export function randomId(randomBytes: (n: number) => Uint8Array): string {
  return bytesToHex(randomBytes(16));
}
