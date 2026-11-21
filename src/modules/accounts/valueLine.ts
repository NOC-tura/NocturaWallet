/**
 * M1d spec §4.5 (UX part C; D2–D4; plan A9–A12): "Public X · Private Y". X is the selected
 * account's public value, Y the wallet's private balance (the unspent total, as the dashboard's
 * hero). Each side is USD only when every non-zero asset of THAT side has a price; otherwise its
 * token amounts. The two sides are never summed, and an unknown side is "—", never 0.
 * Amounts stay BigInt; the USD figure is a display float only (as computePortfolio).
 */
import {formatBalanceForDisplay} from '../../utils/parseTokenAmount';
import {formatUsdString} from '../../utils/formatUsd';
import {NOC_DECIMALS, NOC_MINT} from '../../constants/programs';
import {A0_TOKEN} from '../shielded/a0/screenSupport';
import {BELOW_ONE_CENT, VALUE_HIDDEN, VALUE_UNKNOWN, combinedLine} from '../../copy/accounts';
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

/** At most this many token amounts per side, then "+N" */
export const LISTED_ASSETS = 2;

const DIGITS = /^\d+$/;
/** Wrapped SOL is SOL: folded into the SOL amount (priced as SOL, one "SOL" in the line) */
const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const NORMALISED_DECIMALS = 18;

/** The public side: SOL, NOC and the account's listed tokens (the dashboard's holdings, plan A11). */
export function publicSide(data: AccountPublicData): SideValue {
  if (data.status !== 'ready' || data.syncedAt === null) {
    return {kind: 'unknown'};
  }
  const wrapped = data.tokenBalances[WSOL_MINT] ?? '0';
  const solAmount = DIGITS.test(data.solBalance) && DIGITS.test(wrapped) ? (BigInt(data.solBalance) + BigInt(wrapped)).toString() : data.solBalance;
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

export function formatSide(side: SideValue, prices: Record<string, TokenPrice> | null, sep: string): string {
  if (side.kind === 'unknown') {
    return VALUE_UNKNOWN;
  }
  const held = side.assets.filter(a => a.amountRaw > 0n);
  if (held.length === 0) {
    return `0 ${side.zeroSymbol}`;
  }
  if (prices !== null && held.every(a => prices[a.mint] !== undefined)) {
    let usd = 0;
    for (const a of held) {
      usd += (Number(a.amountRaw) / 10 ** a.decimals) * prices[a.mint]!.usd;
    }
    if (Number.isFinite(usd) && usd >= 0.005) {
      return formatUsdString(usd);
    }
    // a held side worth under half a cent (or not finite) never reads "$0.00": the token form below, or "<$0.01"
    if (Number.isFinite(usd)) {
      return BELOW_ONE_CENT;
    }
  }
  const sorted = [...held].sort((x, y) => {
    const d = normalised(y) - normalised(x);
    if (d !== 0n) {
      return d > 0n ? 1 : -1;
    }
    return x.symbol < y.symbol ? -1 : x.symbol > y.symbol ? 1 : 0;
  });
  const shown = sorted
    .slice(0, LISTED_ASSETS)
    .map(a => `${formatBalanceForDisplay(a.amountRaw.toString(), a.decimals)} ${a.symbol}`)
    .join(sep);
  const more = sorted.length - LISTED_ASSETS;
  return more > 0 ? `${shown} +${more}` : shown;
}

export function combinedValueLine(
  pub: SideValue,
  priv: SideValue,
  prices: Record<string, TokenPrice> | null,
  hidden: boolean,
): string {
  if (hidden) {
    return combinedLine(VALUE_HIDDEN, VALUE_HIDDEN);
  }
  return combinedLine(formatSide(pub, prices, ', '), formatSide(priv, prices, ', '));
}
