/**
 * Token amounts as text, exactly (cardinal rule 2): base units are a bigint, never a float. Pure, and
 * stand-alone (scripts/check-vault-isolation.mjs STANDALONE): the vault page imports it too, so it
 * may import nothing.
 */

/** "12.5" with 6 decimals → 12 500 000n. Null for anything but digits with at most `decimals` places. */
export function parseAmount(text: string, decimals: number): bigint | null {
  if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 18) return null;
  const pattern = decimals === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{0,${decimals}})?$`);
  if (!pattern.test(text)) return null;
  const [whole = '0', frac = ''] = text.split('.');
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((frac + '0'.repeat(decimals)).slice(0, decimals) || '0');
}

/**
 * Base units → "4,200.00". The fraction keeps between `min` and `max` digits and is TRUNCATED, never
 * rounded: a balance is never shown as more than it is. Thousands are grouped with ",".
 */
export function formatAmount(base: bigint, decimals: number, opts: {min: number; max: number}): string {
  const negative = base < 0n;
  const abs = negative ? -base : base;
  const scale = 10n ** BigInt(decimals);
  const whole = (abs / scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  let frac = (abs % scale).toString().padStart(decimals, '0').slice(0, Math.min(opts.max, decimals));
  while (frac.length > opts.min && frac.endsWith('0')) frac = frac.slice(0, -1);
  return `${negative ? '-' : ''}${whole}${frac.length > 0 ? `.${frac}` : ''}`;
}
