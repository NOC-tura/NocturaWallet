/** Bytes ↔ base64 and base58 → bytes, without a dependency (the provider carries only @wallet-standard, §1.1). */
export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** A Solana address's 32 bytes, or null for anything that is not one. */
export function addressBytes(address: string): Uint8Array | null {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return null;
  return base58Bytes(address, 32);
}

/** B1c-2: a transaction signature's 64 bytes (base58, 64–88 characters), or null for anything that is not one. */
export function signatureBytes(signature: string): Uint8Array | null {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) return null;
  return base58Bytes(signature, 64);
}

/** base58 → exactly `length` bytes (leading '1's are zero bytes), or null. The caller checked the alphabet. */
function base58Bytes(address: string, length: number): Uint8Array | null {
  let n = 0n;
  for (const c of address) n = n * 58n + BigInt(ALPHABET.indexOf(c));
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const c of address) {
    if (c !== '1') break;
    bytes.unshift(0);
  }
  return bytes.length === length ? Uint8Array.from(bytes) : null;
}
