// Small, dependency-free conversions between the field-element representations
// the shielded pipeline uses: decimal strings (prover params), 64-char hex
// (Merkle leaves/roots), and 32-byte big-endian arrays (on-chain ix args).

/** Decimal field-element string -> 32-byte big-endian Uint8Array. */
export function decToBe32(dec: string): Uint8Array {
  let v = BigInt(dec);
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) { out[i] = Number(v & 0xffn); v >>= 8n; }
  return out;
}

/** 32-byte big-endian Uint8Array -> decimal string. */
export function be32ToDec(bytes: Uint8Array): string {
  let acc = 0n;
  for (let i = 0; i < bytes.length; i++) acc = acc * 256n + BigInt(bytes[i]!);
  return acc.toString();
}

/** Hex string (any even length) -> decimal string. */
export function hexToDec(hex: string): string {
  return BigInt('0x' + hex).toString();
}

/** Decimal field-element string -> 64-char (32-byte) hex, zero-padded. */
export function decToHex64(dec: string): string {
  return BigInt(dec).toString(16).padStart(64, '0');
}

/** Hex string -> Uint8Array. */
export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Uint8Array -> hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i]!.toString(16).padStart(2, '0');
  return s;
}
