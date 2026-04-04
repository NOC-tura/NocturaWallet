/**
 * Securely zero out a Uint8Array by filling with 0x00.
 * Used to clear sensitive key material from memory after use.
 */
export function zeroize(data: Uint8Array | null | undefined): void {
  if (!data) return;
  data.fill(0);
}
