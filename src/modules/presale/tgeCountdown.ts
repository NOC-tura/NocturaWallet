/**
 * Format a friendly, relative TGE countdown string — NO hard date (consistent
 * with the C1 "no fixed date" preference). Pure: takes the on-chain TGE unix
 * seconds (or null if not yet loaded) and the current unix seconds.
 *
 * - null / non-finite → '' (caller falls back to the static "Claimable after TGE").
 * - already at/past TGE → 'now'.
 * - otherwise a coarse bucket: months (>=60d) / weeks (>=14d) / days (>=2d) /
 *   'tomorrow' (>=1d) / 'today'.
 */
export function tgeCountdownDisplay(tgeSeconds: number | null, nowSeconds: number): string {
  if (tgeSeconds == null || !Number.isFinite(tgeSeconds)) {
    return '';
  }
  const diff = tgeSeconds - nowSeconds;
  if (diff <= 0) {
    return 'now';
  }
  const days = diff / 86400;
  if (days >= 60) {
    return `in ~${Math.round(days / 30)} months`;
  }
  if (days >= 14) {
    return `in ~${Math.round(days / 7)} weeks`;
  }
  if (days >= 2) {
    return `in ${Math.round(days)} days`;
  }
  if (days >= 1) {
    return 'tomorrow';
  }
  return 'today';
}
