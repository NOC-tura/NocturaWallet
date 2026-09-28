import {base64} from '@scure/base';

export const b64 = (bytes: Uint8Array): string => base64.encode(bytes);
export const unb64 = (s: string): Uint8Array<ArrayBuffer> => new Uint8Array(base64.decode(s));
export const utf8 = (s: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(s);

// Narrows without copying: WebCrypto's BufferSource requires an ArrayBuffer-backed view, but a
// bare `Uint8Array` (as the public vault interface uses throughout) types as ArrayBufferLike,
// which also admits SharedArrayBuffer. Every Uint8Array this module ever produces (getRandomValues,
// TextEncoder, base64 decode, subtle.exportKey/deriveBits) is ArrayBuffer-backed in practice, so
// this only narrows the type — it never allocates, and so never leaves an unzeroed copy of a key.
export function assertArrayBufferBacked(x: Uint8Array): asserts x is Uint8Array<ArrayBuffer> {
  if (!(x.buffer instanceof ArrayBuffer)) throw new TypeError('expected an ArrayBuffer-backed Uint8Array');
}
