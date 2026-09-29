/** Fill a byte array with zeros — best effort; JavaScript cannot guarantee no copies remain. */
export function zeroize(data: Uint8Array | null | undefined): void {
  if (!data) return;
  data.fill(0);
}
