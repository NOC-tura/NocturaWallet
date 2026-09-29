import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex, utf8ToBytes} from '@noble/hashes/utils.js';

/**
 * JSON.stringify rewrites some values without a word: `undefined` (dropped from an object, `null`
 * in an array), NaN and ±Infinity (`null`); it throws on a bigint; functions and symbols vanish.
 * Two different actions could then hash alike, so any of these, at any depth, is refused.
 */
function assertPlainJson(v: unknown, path: string): void {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new TypeError(`digestOf: non-finite number at ${path}`);
    return;
  }
  if (Array.isArray(v)) {
    v.forEach((x, i) => assertPlainJson(x, `${path}[${i}]`));
    return;
  }
  if (typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) assertPlainJson(x, `${path}.${k}`);
    return;
  }
  throw new TypeError(`digestOf: ${typeof v} at ${path} has no exact JSON form`);
}

/**
 * sha256 hex of the JSON text of `{kind, value}`. The kind separates domains (a send and a
 * settings change never share a digest); callers build `value` key by key, so the text is
 * canonical. Amounts cross as decimal strings (a bigint is refused).
 */
export function digestOf(kind: string, value: unknown): string {
  if (kind.length === 0) throw new TypeError('digestOf: empty kind');
  assertPlainJson(value, 'value');
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify({kind, value}))));
}

/** 16 random bytes as 32 hex characters: prepared-send, pending and challenge ids. */
export function randomId(randomBytes: (n: number) => Uint8Array): string {
  return bytesToHex(randomBytes(16));
}
