import {groupInteger} from './parseTokenAmount';

/** Format a USD number into a grouped whole part ("$14,881") + cents (".19"). */
export function formatUsd(value: number): {whole: string; cents: string} {
  const safe = Number.isFinite(value) ? value : 0;
  const fixed = safe.toFixed(2);
  const [w, c] = fixed.split('.');
  return {whole: '$' + groupInteger(w), cents: `.${c ?? '00'}`};
}

/** Flat "$14,881.19" string. */
export function formatUsdString(value: number): string {
  const {whole, cents} = formatUsd(value);
  return whole + cents;
}
