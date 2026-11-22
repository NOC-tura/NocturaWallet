/**
 * M1d spec §4.5 (UX part C; D2–D4; plan A9–A12; 2026-11-22 addendum): the value of each side. Public =
 * the selected account's public value, Private = the wallet's private balance (the unspent total, as
 * the dashboard's hero). The dashboard's split row inside the balance card reads `splitValue` (one
 * line per asset, "+N more"); the Accounts sheet's rows read `formatSide` (one string, "+N"). Both
 * share one core (`sideCore`): each side is USD only when every non-zero asset of THAT side has a
 * price; otherwise its token amounts. The two sides are never summed, and an unknown side is "—",
 * never 0. Amounts stay BigInt; the USD figure is a display float only (as computePortfolio).
 */
import {formatBalanceForDisplay} from '../../utils/parseTokenAmount';
import {formatUsdString} from '../../utils/formatUsd';
import {NOC_DECIMALS, NOC_MINT} from '../../constants/programs';
import {A0_TOKEN} from '../shielded/a0/screenSupport';
import {BELOW_ONE_CENT, VALUE_HIDDEN, VALUE_UNKNOWN, moreAssets} from '../../copy/accounts';
import {WSOL_MINT} from '../swap/jupiter';
import type {TokenPrice} from '../prices/priceModule';
import type {AccountPublicData} from '../../hooks/useAccountPublicData';
import type {A0ShieldedView} from '../../hooks/useA0Shielded';

export interface SideAsset {
  /** 'native' for SOL, else the mint */
  mint: string;
  symbol: string;
  amountRaw: bigint;
  decimals: number;
}

export type SideValue = {kind: 'unknown'} | {kind: 'known'; assets: readonly SideAsset[]; zeroSymbol: string};

/** At most this many token amounts per side, then "+N" (the sheet) or "+N more" (the split row) */
export const LISTED_ASSETS = 2;

const DIGITS = /^\d+$/;
const NORMALISED_DECIMALS = 18;

/** The public side: SOL, NOC and the account's listed tokens (the dashboard's holdings, plan A11). */
export function publicSide(data: AccountPublicData): SideValue {
  // post-M1d §3.2: a stale figure is a known side (the screen dims it and says "not updated")
  if ((data.status !== 'ready' && data.status !== 'stale') || data.syncedAt === null) {
    return {kind: 'unknown'};
  }
  // wrapped SOL is SOL: folded into the SOL amount (priced as SOL, one "SOL" in the line)
  const wrapped = data.tokenBalances[WSOL_MINT] ?? '0';
  if (!DIGITS.test(wrapped)) {
    return {kind: 'unknown'}; // re-review N2: a malformed wrapped amount is not a value, never silently dropped
  }
  const solAmount = DIGITS.test(data.solBalance) ? (BigInt(data.solBalance) + BigInt(wrapped)).toString() : data.solBalance;
  const raw: {mint: string; symbol: string; amount: string; decimals: number}[] = [
    {mint: 'native', symbol: 'SOL', amount: solAmount, decimals: 9},
    {mint: NOC_MINT, symbol: 'NOC', amount: data.tokenBalances[NOC_MINT] ?? data.nocBalance, decimals: NOC_DECIMALS},
    ...data.tokens
      .filter(t => t.mint !== NOC_MINT && t.mint !== 'native' && t.mint !== WSOL_MINT)
      .map(t => ({mint: t.mint, symbol: t.symbol, amount: data.tokenBalances[t.mint] ?? '0', decimals: t.decimals})),
  ];
  const assets: SideAsset[] = [];
  for (const r of raw) {
    if (!DIGITS.test(r.amount)) {
      return {kind: 'unknown'}; // a malformed amount is not a value: never shown as one
    }
    assets.push({mint: r.mint, symbol: r.symbol, amountRaw: BigInt(r.amount), decimals: r.decimals});
  }
  return {kind: 'known', assets, zeroSymbol: 'SOL'};
}

/** The private side: the unspent total once the restore is ready; any other state is unknown. */
export function privateSide(view: A0ShieldedView): SideValue {
  if (view.kind !== 'ready') {
    return {kind: 'unknown'};
  }
  return {
    kind: 'known',
    assets: [{mint: A0_TOKEN.mint, symbol: A0_TOKEN.symbol, amountRaw: view.unspent, decimals: A0_TOKEN.decimals}],
    zeroSymbol: A0_TOKEN.symbol,
  };
}

function normalised(a: SideAsset): bigint {
  return a.decimals >= NORMALISED_DECIMALS
    ? a.amountRaw / 10n ** BigInt(a.decimals - NORMALISED_DECIMALS)
    : a.amountRaw * 10n ** BigInt(NORMALISED_DECIMALS - a.decimals);
}

/** One side, formatted once: a single text (unknown, nothing held, USD) or the listed token amounts. */
type SideCore = {kind: 'text'; text: string} | {kind: 'assets'; shown: string[]; more: number};

function sideCore(side: SideValue, prices: Record<string, TokenPrice> | null): SideCore {
  if (side.kind === 'unknown') {
    return {kind: 'text', text: VALUE_UNKNOWN};
  }
  const held = side.assets.filter(a => a.amountRaw > 0n);
  if (held.length === 0) {
    return {kind: 'text', text: `0 ${side.zeroSymbol}`};
  }
  if (prices !== null && held.every(a => prices[a.mint] !== undefined)) {
    let usd = 0;
    for (const a of held) {
      usd += (Number(a.amountRaw) / 10 ** a.decimals) * prices[a.mint]!.usd;
    }
    if (Number.isFinite(usd) && usd >= 0.005) {
      return {kind: 'text', text: formatUsdString(usd)};
    }
    // a held side worth under half a cent (or not finite) never reads "$0.00": the token form below, or "<$0.01"
    if (Number.isFinite(usd)) {
      return {kind: 'text', text: BELOW_ONE_CENT};
    }
  }
  const sorted = [...held].sort((x, y) => {
    const d = normalised(y) - normalised(x);
    if (d !== 0n) {
      return d > 0n ? 1 : -1;
    }
    return x.symbol < y.symbol ? -1 : x.symbol > y.symbol ? 1 : 0;
  });
  return {
    kind: 'assets',
    shown: sorted.slice(0, LISTED_ASSETS).map(a => `${formatBalanceForDisplay(a.amountRaw.toString(), a.decimals)} ${a.symbol}`),
    more: sorted.length - LISTED_ASSETS,
  };
}

/** The Accounts sheet's row: one string, the amounts joined by `sep`, then "+N" (plan r1-6). */
export function formatSide(side: SideValue, prices: Record<string, TokenPrice> | null, sep: string): string {
  const c = sideCore(side, prices);
  if (c.kind === 'text') {
    return c.text;
  }
  const shown = c.shown.join(sep);
  return c.more > 0 ? `${shown} +${c.more}` : shown;
}

/** One column of the split row: one line per listed asset, then "+N more"; a single text is one line. */
export function sideLines(side: SideValue, prices: Record<string, TokenPrice> | null): string[] {
  const c = sideCore(side, prices);
  if (c.kind === 'text') {
    return [c.text];
  }
  return c.more > 0 ? [...c.shown, moreAssets(c.more)] : c.shown;
}

export interface SplitValue {
  publicLines: string[];
  privateLines: string[];
}

/** The dashboard's split row (2026-11-22 addendum): each side apart, never summed; hidden → one "•••" each (r1-8). */
export function splitValue(
  pub: SideValue,
  priv: SideValue,
  prices: Record<string, TokenPrice> | null,
  hidden: boolean,
): SplitValue {
  if (hidden) {
    return {publicLines: [VALUE_HIDDEN], privateLines: [VALUE_HIDDEN]};
  }
  return {publicLines: sideLines(pub, prices), privateLines: sideLines(priv, prices)};
}
