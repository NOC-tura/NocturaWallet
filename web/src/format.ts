/**
 * Base units in, human string out, staying in bigint the whole way.
 *
 * Grouping is done by hand rather than with Number.toLocaleString: the app learned on
 * a device that Hermes does not group digits with it while Node does, so the tidy
 * version is a bug that only appears for users. Same reasoning applies here, where a
 * float would also quietly lose precision above 2^53.
 */
export function formatBaseUnits(
  base: bigint,
  decimals: number,
  symbol: string,
  options: {maxFractionDigits?: number} = {},
): string {
  const unit = 10n ** BigInt(decimals);
  const whole = (base / unit).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  let frac = (base % unit).toString().padStart(decimals, '0');
  const {maxFractionDigits} = options;
  if (maxFractionDigits !== undefined) {
    // TRUNCATED, never rounded. This is used for aggregates like "sold of capacity",
    // and rounding up would let the page claim a stage is fuller than it is. Down is
    // the direction that can only understate.
    frac = frac.slice(0, maxFractionDigits);
  }
  frac = frac.replace(/0+$/, '');

  return frac ? `${whole}.${frac} ${symbol}` : `${whole} ${symbol}`;
}

/** Percent of a stage sold, as a bigint ratio rendered with one decimal. */
export function percentOf(part: bigint, whole: bigint): number {
  if (whole === 0n) return 0;
  return Number((part * 1000n) / whole) / 10;
}

/**
 * A readable amount, with the exact one kept for the `title`.
 *
 * Nine decimals is what the chain stores; it is not what a person reads. "1,964.890655947
 * NOC" reads as a value that leaked rather than one that was written, and its last digits
 * are meaningless — a billionth of a NOC is fifteen-hundred-millionths of a cent.
 *
 * TRUNCATED, not rounded, and that is the whole reason this is a function rather than
 * toFixed. Rounding 1,964.890655947 to four places gives 1,964.8907 — a number LARGER
 * than the holding, displayed as the holding. Down can only ever understate.
 *
 * The one case truncation gets wrong is dust: a real balance below the cutoff would print
 * as a flat "0", which is a different claim entirely. Those keep their full precision
 * instead, because a number too small to round is exactly the one a reader needs to see
 * in full.
 */
export function formatAmount(
  base: bigint,
  decimals: number,
  symbol: string,
  displayDecimals = 4,
): {text: string; exact: string} {
  const exact = formatBaseUnits(base, decimals, symbol);
  const short = formatBaseUnits(base, decimals, symbol, {maxFractionDigits: displayDecimals});
  const truncatedToNothing = base > 0n && short === `0 ${symbol}`;
  return {text: truncatedToNothing ? exact : short, exact};
}
