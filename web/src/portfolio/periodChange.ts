/**
 * Percent move from the first point of a series to the last.
 *
 * Taken from the same points the sparkline draws, so the figure and the line beside it
 * cannot describe different periods. Until 2026-09-24 the row printed CoinGecko's 24 h
 * change under a "7 days" label: a day's move, presented as a week's.
 *
 * Null when there is nothing honest to say — fewer than two points, or a zero start that
 * would make any percentage infinite.
 */
export function periodChangePct(points: readonly number[]): number | null {
  if (points.length < 2) return null;
  const first = points[0] as number;
  const last = points[points.length - 1] as number;
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}
