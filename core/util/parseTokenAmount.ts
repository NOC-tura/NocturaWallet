export function parseTokenAmount(input: string, decimals: number): bigint {
  if (!input || input.trim() === '') return 0n;
  const trimmed = input.trim();
  if (trimmed.startsWith('-')) throw new Error('Negative amounts not allowed');
  if (!/^\d*\.?\d*$/.test(trimmed)) throw new Error('Invalid amount format');
  const parts = trimmed.split('.');
  const wholePart = parts[0] || '0';
  const fracPart = parts[1] || '';
  if (fracPart.length > decimals) throw new Error(`Too many decimal places (max ${decimals})`);
  const paddedFrac = fracPart.padEnd(decimals, '0');
  return BigInt(wholePart) * 10n ** BigInt(decimals) + BigInt(paddedFrac);
}

/**
 * Insert thousands separators into a non-negative integer string.
 * Implemented manually because Hermes `Number.toLocaleString('en-US')` does
 * NOT group digits on-device (it works in Node/jest, which hides the bug).
 */
export function groupInteger(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatTokenAmount(amount: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const remainder = amount % divisor;
  if (remainder === 0n) return whole.toString();
  let remStr = remainder.toString().padStart(decimals, '0');
  remStr = remStr.replace(/0+$/, '');
  return `${whole}.${remStr}`;
}

export function formatBalanceForDisplay(
  raw: string,
  decimals: number,
  maxDisplayDecimals = 4,
): string {
  if (!raw || raw.trim() === '') return '0';
  let big: bigint;
  try {
    big = BigInt(raw);
  } catch {
    return '0';
  }
  if (big === 0n) return '0';
  // final review m3: a negative amount is the same figure with a sign (never "-1.-4999" or "<0.0001")
  if (big < 0n) return '-' + formatBalanceForDisplay((-big).toString(), decimals, maxDisplayDecimals);

  // Sub-display threshold: a non-zero amount below 10^-maxDisplayDecimals reads
  // "<0.0001" (the wallet convention; never scientific notation). Skip when
  // maxDisplayDecimals===0 (caller asked for integer-only display) or when
  // decimals <= maxDisplay (no fractional truncation needed).
  if (maxDisplayDecimals > 0 && decimals > maxDisplayDecimals) {
    const subThreshold = 10n ** BigInt(decimals - maxDisplayDecimals);
    if (big > 0n && big < subThreshold) { // review m1: a negative is never "<0.0001"
      return '<0.' + '0'.repeat(maxDisplayDecimals - 1) + '1';
    }
  }

  // Stay in bigint until the very end so balances above Number.MAX_SAFE_INTEGER
  // (e.g. whole-token treasury holdings on 9-decimal tokens) stay exact.
  const divisor = 10n ** BigInt(decimals);
  const whole = big / divisor;
  const remainder = big % divisor;

  if (remainder === 0n || maxDisplayDecimals === 0) {
    // maxDisplayDecimals===0 case: round-half-up the fractional part into whole.
    if (maxDisplayDecimals === 0 && remainder >= divisor / 2n) {
      return groupInteger((whole + 1n).toString());
    }
    return groupInteger(whole.toString());
  }

  // Round fractional to maxDisplayDecimals using bigint division (round-half-up).
  const shift = decimals - maxDisplayDecimals;
  let fracBig: bigint;
  if (shift > 0) {
    const shiftBy = 10n ** BigInt(shift);
    fracBig = (remainder + shiftBy / 2n) / shiftBy;
  } else if (shift === 0) {
    fracBig = remainder;
  } else {
    fracBig = remainder * 10n ** BigInt(-shift);
  }

  // Rounding may overflow into whole (e.g. 1.99995 → carry → 2).
  const maxFrac = 10n ** BigInt(maxDisplayDecimals);
  if (fracBig >= maxFrac) {
    return groupInteger((whole + 1n).toString());
  }

  let fracStr = fracBig.toString().padStart(maxDisplayDecimals, '0');
  fracStr = fracStr.replace(/0+$/, '');
  if (fracStr === '') return groupInteger(whole.toString());

  return `${groupInteger(whole.toString())}.${fracStr}`;
}
