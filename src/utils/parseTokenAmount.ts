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
  return BigInt(wholePart) * BigInt(10 ** decimals) + BigInt(paddedFrac);
}

export function formatTokenAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const remainder = amount % divisor;
  if (remainder === 0n) return whole.toString();
  let remStr = remainder.toString().padStart(decimals, '0');
  remStr = remStr.replace(/0+$/, '');
  return `${whole}.${remStr}`;
}
