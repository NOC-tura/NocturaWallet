/**
 * Base units in, human string out, staying in bigint the whole way.
 *
 * Grouping is done by hand rather than with Number.toLocaleString: the app learned on
 * a device that Hermes does not group digits with it while Node does, so the tidy
 * version is a bug that only appears for users. Same reasoning applies here, where a
 * float would also quietly lose precision above 2^53.
 */
export function formatBaseUnits(base: bigint, decimals: number, symbol: string): string {
  const unit = 10n ** BigInt(decimals);
  const whole = (base / unit).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = (base % unit).toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac} ${symbol}` : `${whole} ${symbol}`;
}

/** Percent of a stage sold, as a bigint ratio rendered with one decimal. */
export function percentOf(part: bigint, whole: bigint): number {
  if (whole === 0n) return 0;
  return Number((part * 1000n) / whole) / 10;
}
