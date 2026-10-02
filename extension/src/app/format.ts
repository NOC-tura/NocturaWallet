import {formatAmount} from '../shared/amount';
import type {Token} from './engine';

/** Decimals and display precision per token (the design: "62.4821 SOL", "4,200.00 NOC", "740.21 USDC"). */
export const TOKEN_INFO: Record<Token, {decimals: number; name: string; min: number; max: number}> = {
  SOL: {decimals: 9, name: 'Solana', min: 4, max: 4},
  NOC: {decimals: 9, name: 'Noctura', min: 2, max: 2},
  USDC: {decimals: 6, name: 'USD Coin', min: 2, max: 2},
  USDT: {decimals: 6, name: 'Tether', min: 2, max: 2},
};

/** A balance as the design shows it: truncated, never rounded up. */
export const showAmount = (token: Token, base: bigint): string => formatAmount(base, TOKEN_INFO[token].decimals, TOKEN_INFO[token].min === 4 ? {min: 4, max: 4} : {min: 2, max: 2});
/** Lamports shown in full precision ("0.000005"), for fees. */
export const showSol = (lamports: bigint): string => formatAmount(lamports, 9, {min: 0, max: 9});

/**
 * #27's fee line only, as index.html draws it ("0.000 005 SOL", lines 12136, 12197): full precision,
 * the fraction digits in groups of three from the point. The separator is the design's own character,
 * a plain U+0020 space (checked byte for byte); every other amount keeps showSol / showAmount.
 */
export function showFee(lamports: bigint): string {
  const [whole, fraction] = showSol(lamports).split('.');
  if (fraction === undefined) return whole ?? '';
  return `${whole}.${(fraction.match(/.{1,3}/g) ?? []).join(' ')}`;
}

/** A fee's dollars ("$0.0007", 12136): four places, truncated, below a cent; "—" with no price. */
export function feeUsd(usd: number | null): string {
  if (usd === null) return '—';
  if (usd >= 0.01) return showUsd(usd);
  return `$${(Math.floor(usd * 10_000 + 1e-9) / 10_000).toFixed(4)}`;
}

/** "$14,881.19" split as the hero draws it: whole part and cents. */
export function usdParts(usd: number): {whole: string; cents: string} {
  const cents = Math.floor(usd * 100 + 1e-9);
  const whole = Math.floor(cents / 100).toLocaleString('en-US');
  return {whole: `$${whole}`, cents: `.${String(cents % 100).padStart(2, '0')}`};
}
export const showUsd = (usd: number): string => {
  const p = usdParts(usd);
  return `${p.whole}${p.cents}`;
};

/**
 * "≈ 67.41 SOL": a USD value in SOL, truncated to the cent of a SOL — never rounded up (review L6).
 * The inputs are floats (USD is display-only), so at an exact boundary the result can read up to one
 * cent of a SOL low (2.3 may show 2.29) — never high.
 */
export const approxSol = (usd: number, solUsd: number): string => `≈ ${(Math.floor((usd / solUsd) * 100) / 100).toFixed(2)} SOL`;

/** The first four and the last four characters, at equal weight — a scanning aid in lists only (spec §11.7). */
export const shortAddress = (a: string): string => `${a.slice(0, 4)}…${a.slice(-4)}`;
/** The first two groups of four, then "…" (the account switcher). */
export const twoGroups = (a: string): string => `${a.slice(0, 4)} ${a.slice(4, 8)}…`;

/** "2 s ago", "2 min ago", "2 h ago", "3 d ago". */
export function ago(at: number, now: number): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** "2 min 18 s ago" — the sustained-offline line; from an hour on, the short form ("2 h ago", "3 d ago"). */
export function agoLong(at: number, now: number): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 60) return `${s} s ago`;
  if (s < 3_600) return `${Math.floor(s / 60)} min ${s % 60} s ago`;
  return ago(at, now);
}

/** Local wall-clock time "09:41:13" (UTC stored, local only at the UI layer — cardinal rule 3). */
export const clock = (at: number): string => {
  const d = new Date(at);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
};

/** A sync time: the clock alone when it is today ("09:41:13"), with the day otherwise ("Jan 2, 09:41:13"), local. */
export function stamp(at: number, now: number): string {
  const a = new Date(at);
  const n = new Date(now);
  const today = a.getFullYear() === n.getFullYear() && a.getMonth() === n.getMonth() && a.getDate() === n.getDate();
  return today ? clock(at) : `${a.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}, ${clock(at)}`;
}

/** "9:14 AM", local. */
export const timeOfDay = (at: number): string => new Date(at).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});

/** "May 6", local — an older #26 row's day. */
export const shortDay = (at: number): string => new Date(at).toLocaleDateString('en-US', {month: 'short', day: 'numeric'});

/** "May 8 2026 · 9:14 AM", local. */
export function fullDate(at: number): string {
  const d = new Date(at);
  return `${d.toLocaleDateString('en-US', {month: 'short'})} ${d.getDate()} ${d.getFullYear()} · ${timeOfDay(at)}`;
}

const startOfDay = (t: number): number => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * The activity list's section headers (#26), local time: "TODAY · MAY 8", "YESTERDAY · MAY 7",
 * "THIS WEEK", "THIS MONTH", then "APRIL 2026"-style month headers. A transaction with no block time
 * yet is "TODAY".
 */
export function dateSection(at: number | null, now: number): string {
  if (at === null) return `TODAY · ${new Date(now).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}).toUpperCase()}`;
  const day = startOfDay(at);
  const today = startOfDay(now);
  const label = (t: number) => new Date(t).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}).toUpperCase();
  if (day === today) return `TODAY · ${label(at)}`;
  // Calendar days, not 24 h steps: a daylight-saving day is 23 or 25 hours long.
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === yesterday.getTime()) return `YESTERDAY · ${label(at)}`;
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  if (day >= weekAgo.getTime()) return 'THIS WEEK';
  const a = new Date(at);
  const n = new Date(now);
  if (a.getFullYear() === n.getFullYear() && a.getMonth() === n.getMonth()) return 'THIS MONTH';
  return a.toLocaleDateString('en-US', {month: 'long', year: 'numeric'}).toUpperCase();
}
