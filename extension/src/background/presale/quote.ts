import {COMPUTE_UNIT_LIMIT} from '../../../../core/presale/buyInstructions';
import {checkLimits, tokensFor, usdCentsForStable, type LimitCode} from '../../../../core/presale/limits';
import {CEILING} from '../../../../core/solana/priorityFee';
import {BASE_FEE_LAMPORTS_PER_SIGNATURE, SYSTEM_ACCOUNT_RENT_LAMPORTS} from '../../../../core/solana/transfer';
import {scaledUsdPrice} from '../reauthPolicy';
import type {PresaleSnapshot} from './state';

/**
 * B1d §3.2 (C8, C9, D7): the estimate, MAX and the limit or balance line of a purchase, from the last view's snapshot —
 * no network. Integer arithmetic only (cardinal rule 2), every division floored as the program's; the SOL price is the
 * one float, read once into B1b's 1e-12-dollar scale. One limit rule for SOL, USDC and USDT: the snapshot's, which is
 * the config's (`min_purchase_usd`, `max_per_user_usd`) or the program's fallback — there is no client-side floor.
 */
export type PresaleCurrency = 'SOL' | 'USDC' | 'USDT';
export const PRESALE_CURRENCIES: readonly PresaleCurrency[] = ['SOL', 'USDC', 'USDT'];

/**
 * An UPPER BOUND on a purchase's network fee: one signature plus the normal tier's priority ceiling over the purchase's
 * compute-unit limit (`buildBuyInstructions` / `buildStablecoinBuyInstructions`). A purchase is priced at the normal
 * tier, which `estimatePriorityFee` clamps to that ceiling, so its fee never exceeds this.
 */
export const PRESALE_FEE_BOUND_LAMPORTS = BASE_FEE_LAMPORTS_PER_SIGNATURE + (BigInt(CEILING.normal) * BigInt(COMPUTE_UNIT_LIMIT) + 999_999n) / 1_000_000n;

/** What one purchase can spend: SOL in lamports; a stablecoin's largest holding account and its total, base units. */
export interface PresaleBalances {
  SOL: bigint;
  USDC: {largest: bigint; total: bigint};
  USDT: {largest: bigint; total: bigint};
}

export type BalanceCode = 'insufficient-sol' | 'insufficient-token' | 'split-balance' | 'sender-below-rent';
export type QuoteLine = LimitCode | BalanceCode | 'no-sol-price';

/** `cents` and `nocBase` are null only for `no-sol-price`: without a price there is no estimate. */
export interface QuoteFacts {
  amount: bigint;
  cents: bigint | null;
  nocBase: bigint | null;
  line: QuoteLine | null;
}

export interface QuoteInput {
  snapshot: Pick<PresaleSnapshot, 'stage' | 'limits' | 'newPdaRent'>;
  balances: PresaleBalances;
  /** USD per SOL from /wallet/prices, or null: then SOL is not quoted (C8). */
  solUsd: number | null;
}

// lamports (10⁹ a SOL) × the price scale (10¹² a dollar) ÷ 100 cents a dollar.
const SOL_CENTS_DIVISOR = 10n ** 19n;
/** Stablecoin base units (6 decimals) per cent. */
const STABLE_PER_CENT = 10_000n;

/** SOL's value in cents at a scaled price, floored — usdMicros(lamports, 9, price) / 10 000 in one division. */
export function solCents(lamports: bigint, scaled: bigint): bigint {
  return (lamports * scaled) / SOL_CENTS_DIVISOR;
}

/** The most lamports whose solCents is at most `cents`. */
export function lamportsForCents(cents: bigint, scaled: bigint): bigint {
  return ((cents + 1n) * SOL_CENTS_DIVISOR - 1n) / scaled;
}

const atLeastZero = (x: bigint): bigint => (x > 0n ? x : 0n);
const least = (a: bigint, b: bigint): bigint => (a < b ? a : b);

/**
 * The SOL line: what leaves the account — the bounds of the fee and of the rent included — must leave it at least
 * rent-exempt. An exact 0 left cannot be known before the simulation (both bounds exceed the runtime's charge), so here
 * it counts as below rent.
 */
function solLine(sol: bigint, out: bigint): BalanceCode | null {
  const left = sol - out;
  if (left < 0n) return 'insufficient-sol';
  return left < SYSTEM_ACCOUNT_RENT_LAMPORTS ? 'sender-below-rent' : null;
}

/**
 * The quote for `requested` base units of `currency`, or for MAX (C9): for SOL the balance less the fee bound, the
 * new-PDA rent bound and 890 880; for a stablecoin the largest holding account; both capped by the per-transaction and
 * per-user limits converted back (SOL at our price, the most lamports worth the cap; a stablecoin at exact cents).
 * The line: `no-sol-price`, else the first limit broken (checkLimits' order), else the first balance line.
 */
export function quote(i: QuoteInput, currency: PresaleCurrency, requested: bigint | 'max'): QuoteFacts {
  const {stage, limits, newPdaRent} = i.snapshot;
  const reserve = PRESALE_FEE_BOUND_LAMPORTS + newPdaRent;
  const cap = least(limits.maxTxCents, limits.userRemainingCents);
  if (currency === 'SOL') {
    const balanceMax = atLeastZero(i.balances.SOL - reserve - SYSTEM_ACCOUNT_RENT_LAMPORTS);
    const scaled = scaledUsdPrice(i.solUsd ?? undefined);
    if (scaled === null) return {amount: requested === 'max' ? balanceMax : requested, cents: null, nocBase: null, line: 'no-sol-price'};
    const amount = requested === 'max' ? least(balanceMax, lamportsForCents(cap, scaled)) : requested;
    const cents = solCents(amount, scaled);
    return {amount, cents, nocBase: tokensFor(cents, stage.stage), line: checkLimits({cents, ...limits}) ?? solLine(i.balances.SOL, amount + reserve)};
  }
  const held = i.balances[currency];
  const amount = requested === 'max' ? least(held.largest, cap * STABLE_PER_CENT) : requested;
  const cents = usdCentsForStable(amount);
  const tokenLine: BalanceCode | null = amount <= held.largest ? null : held.total >= amount ? 'split-balance' : 'insufficient-token';
  return {amount, cents, nocBase: tokensFor(cents, stage.stage), line: checkLimits({cents, ...limits}) ?? tokenLine ?? solLine(i.balances.SOL, reserve)};
}
