import {pendingOf, type Engine, type Pending, type Reply} from '../engine';
import {buildReferralLink} from '../../../../core/referral/index';

/**
 * B1d §1.4, §2.5, §3.2, §3.3: the popup's client for the presale messages #23 asks — through the shared engine's
 * transport (`Engine.request`), so shared code names none of them. Every reply is shape-checked here before #23 sees
 * it, as engine.ts checks its own: amounts are decimal strings of bigints and become bigint, enums are known, addresses
 * are base58; a reply of any other shape is `failed`. The popup renders what these answer and decides nothing (C3).
 */

export type PresaleCurrency = 'SOL' | 'USDC' | 'USDT';
export const PRESALE_CURRENCIES: readonly PresaleCurrency[] = ['SOL', 'USDC', 'USDT'];
export type GeoReason = 'refused' | 'no_check' | 'stale_list' | 'unknown_country' | 'sanctioned';
export interface GeoAnswer {
  open: boolean;
  reason: GeoReason | null;
  countryCode: string | null;
}
/** §2.5. `stage` is the program's 0-indexed stage (display adds 1). */
export interface StageView {
  stage: number;
  priceTicks: bigint;
  nextPriceTicks: bigint | null;
  stageSoldBase: bigint;
  stageCapBase: bigint;
  raisedCents: bigint;
}
export interface PresaleBalances {
  SOL: bigint;
  USDC: {largest: bigint; total: bigint};
  USDT: {largest: bigint; total: bigint};
}
export type PresaleView =
  | {open: false; why: 'unavailable'; code: 'read-failed' | 'refused' | 'malformed'; pending: Pending | null}
  | {open: false; why: 'inactive' | 'blocked'; state: StageView; pending: Pending | null}
  | {open: false; why: 'geo'; geo: GeoAnswer; state: StageView | null; pending: Pending | null}
  | {
      open: true;
      state: StageView;
      limits: {minCents: bigint; maxTxCents: bigint; userRemainingCents: bigint; firstPurchase: boolean};
      allocation: {exists: boolean; totalBase: bigint; bonusBase: bigint};
      balances: PresaleBalances;
      solUsdMicros: bigint | null;
      /** The country the gate detected (D22), or null when it named none. */
      countryCode: string | null;
      /** B1d-2 (§2.5): the referrer on chain, or null; #23 offers the referral address only while `canRegister`. */
      referral: {onChain: string | null; canRegister: boolean};
      pending: Pending | null;
    };
export type LimitLine = 'below-min' | 'above-max-tx' | 'above-user-limit';
export type BalanceLine = 'insufficient-sol' | 'insufficient-token' | 'split-balance' | 'sender-below-rent';
export type QuoteLine = LimitLine | BalanceLine | 'no-sol-price';
/** §3.2: `cents` and `nocBase` are null only with `no-sol-price`. */
export interface Quote {
  amount: bigint;
  cents: bigint | null;
  nocBase: bigint | null;
  line: QuoteLine | null;
}
export type PresaleReauthReason = 'first-purchase' | 'over-5-percent' | 'over-usd-threshold';
/** §3.3 step 7. */
export interface PurchaseView {
  id: string;
  currency: PresaleCurrency;
  amount: bigint;
  stage: number;
  priceTicks: bigint;
  nocBase: bigint;
  spentCents: bigint;
  destination: string;
  referrer: {address: string; registers: boolean} | null;
  fees: {networkLamports: bigint; priorityLamports: bigint; rentLamports: bigint};
  reauth: {challengeId: string; reasons: PresaleReauthReason[]; proven: boolean} | null;
  validUntil: number;
  simulation: {slot: number; elapsedMs: number; programs: ['compute-budget', 'presale']; instructionCount: number};
}
/** §2.3: what a purchase record carries for display — every value as the background stored it, never used to decide. */
export interface PurchaseData {
  currency: PresaleCurrency;
  amount: bigint;
  stage: number;
  priceTicks: bigint;
  nocBase: bigint;
  spentCents: bigint;
  destination: string;
  referrer: string | null;
}

/** §1.4 presale.banner: #11's banner — the program's 0-indexed stage, its price, and the stage sold in whole percent. */
export interface BannerData {
  stage: number;
  priceTicks: bigint;
  stagePercent: number;
}

/**
 * §3.5, §4.4 (B1d-2): #24's data — the account's invite link, and each figure (base units, a count, cents) or null when
 * its source failed (shown "—").
 */
export interface ReferralData {
  link: string;
  earnedBase: bigint | null;
  referrals: bigint | null;
  referredCents: bigint | null;
}

/** §3.5 (B1d-2): the lines under #23's referral address — presale.checkReferrer's answers, and prepare's refusals of the address. */
export const REFERRER_LINES = ['referrer-invalid', 'referrer-self', 'referrer-not-applicable', 'referrer-no-allocation'] as const;
export type ReferrerLine = (typeof REFERRER_LINES)[number];

/** The refusals of presale.prepareBuy (§5) the popup translates; anything else is `failed`. */
export const PREPARE_REFUSALS = [
  'malformed',
  'locked',
  'unknown-account',
  'in-flight',
  'presale-unavailable',
  'coordinator-refused',
  'unreachable',
  'presale-closed',
  'blocked',
  'geo-closed',
  'price-changed',
  'state-changed',
  'below-min',
  'above-max-tx',
  'above-user-limit',
  'above-limit',
  'insufficient-sol',
  'insufficient-token',
  'split-balance',
  'sender-below-rent',
  'no-sol-price',
  'simulation-failed',
  'simulation-mismatch',
  'presale-busy',
  ...REFERRER_LINES,
] as const;
export type PrepareRefusal = (typeof PREPARE_REFUSALS)[number];
const SESSION = ['malformed', 'locked', 'unknown-account', 'unavailable'] as const;
type SessionRefusal = (typeof SESSION)[number];
const CHECK_REFUSALS = [...SESSION, 'presale-unavailable', 'coordinator-refused'] as const;
export type CheckRefusal = (typeof CHECK_REFUSALS)[number];
/** What #23 asks presale.prepareBuy to buy; `referrer` present only when the field holds one (B1d-2). */
export interface PurchaseIntent {
  currency: PresaleCurrency;
  amount: bigint;
  stage: number;
  referrer?: string;
}
/**
 * The refusals of presale.buy (§1.4, §3.3, §5) #20 translates: the purchase's sign-time codes and B1b's pipeline's;
 * anything else is `failed`. `reauth-required` carries `{challengeId}`, `check-pending` `{id, signature}`.
 */
export const BUY_REFUSALS = [
  'malformed',
  'locked',
  'unknown-account',
  'unavailable',
  'unknown-prepared',
  'prepared-expired',
  'prepared-invalid',
  'reauth-required',
  'in-flight',
  'check-pending',
  'unreachable',
  'coordinator-refused',
  'presale-unavailable',
  'presale-closed',
  'blocked',
  'geo-closed',
  'price-changed',
  'state-changed',
  'below-min',
  'above-max-tx',
  'above-user-limit',
  // B1d-2: the referral address re-checked at the signature (§3.5) — it became an account of this wallet, or its allocation went.
  'referrer-self',
  'referrer-no-allocation',
] as const;
export type BuyRefusal = (typeof BUY_REFUSALS)[number];
/** §1.4 presale.preparedFor: the account's prepared purchase as #20 shows it; `expired` past its 30 s (re-prepare it). */
export type ResumablePurchase = PurchaseView & {expired: boolean};

export interface PresaleClient {
  /** §1.4, §4.5: null — no banner (any failure or an inactive sale, the background's own answer). */
  banner(): Promise<Reply<BannerData | null, SessionRefusal>>;
  view(account: string, refresh?: 'gate'): Promise<Reply<PresaleView, SessionRefusal>>;
  /** `stale`: the account's last view is older than the quote's 30 s (§1.4) — ask a view, then again. */
  quote(account: string, currency: PresaleCurrency, amount: bigint | 'max'): Promise<Reply<Quote | 'stale', SessionRefusal>>;
  pending(account: string): Promise<Reply<Pending | null, SessionRefusal>>;
  /**
   * `challengeId`: the purchase's live challenge, carried into the new prepare (§3.3 step 6) — the background decides
   * whether it still applies. `referrer` (B1d-2): the referral address as entered, sent only when there is one.
   */
  prepareBuy(account: string, intent: PurchaseIntent, challengeId?: string): Promise<Reply<PurchaseView, PrepareRefusal>>;
  /** §3.5 (B1d-2): the line for this referral address, or null when the purchase would register it — the background's answer. */
  checkReferrer(account: string, referrer: string): Promise<Reply<ReferrerLine | null, CheckRefusal>>;
  preparedFor(account: string): Promise<Reply<ResumablePurchase | null, SessionRefusal>>;
  /** §3.5, §4.4 (B1d-2): #24's data for the account — its own link, each figure as the background read it or null. */
  referral(account: string): Promise<Reply<ReferralData, SessionRefusal>>;
  buy(id: string): Promise<Reply<Pending, BuyRefusal>>;
  discardPrepared(account: string): Promise<Reply<null, SessionRefusal>>;
}

type J = Record<string, unknown>;
const obj = (x: unknown): J | undefined => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as J) : undefined);
const UNITS = /^\d{1,20}$/;
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const HEX32 = /^[0-9a-f]{32}$/;
const units = (x: unknown): bigint | undefined => (typeof x === 'string' && UNITS.test(x) ? BigInt(x) : undefined);
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const isStage = (x: unknown): x is number => isInt(x) && x <= 9;
const isAddress = (x: unknown): x is string => typeof x === 'string' && ADDRESS.test(x);
const isCurrency = (x: unknown): x is PresaleCurrency => typeof x === 'string' && (PRESALE_CURRENCIES as readonly string[]).includes(x);
const oneOf = <T extends string>(x: unknown, values: readonly T[]): T | undefined => (typeof x === 'string' && (values as readonly string[]).includes(x) ? (x as T) : undefined);
/** Exactly these keys: a reply that carries more than the background promised is not this shape. */
const exactly = (o: J, keys: readonly string[]): boolean => Object.keys(o).length === keys.length && keys.every(k => k in o);

function stageOf(x: unknown): StageView | undefined {
  const o = obj(x);
  if (o === undefined || !exactly(o, ['stage', 'priceTicks', 'nextPriceTicks', 'stageSoldBase', 'stageCapBase', 'raisedCents']) || !isStage(o.stage)) return undefined;
  const [priceTicks, stageSoldBase, stageCapBase, raisedCents] = [units(o.priceTicks), units(o.stageSoldBase), units(o.stageCapBase), units(o.raisedCents)];
  const nextPriceTicks = o.nextPriceTicks === null ? null : units(o.nextPriceTicks);
  if (priceTicks === undefined || priceTicks === 0n || stageSoldBase === undefined || stageCapBase === undefined || stageCapBase === 0n || raisedCents === undefined || nextPriceTicks === undefined) return undefined;
  return {stage: o.stage, priceTicks, nextPriceTicks, stageSoldBase, stageCapBase, raisedCents};
}

const GEO_REASONS = ['refused', 'no_check', 'stale_list', 'unknown_country', 'sanctioned'] as const;
/** A country code as the gate gives one: two capital letters, or null. */
const countryOf = (x: unknown): string | null | undefined => (x === null ? null : typeof x === 'string' && /^[A-Z]{2}$/.test(x) ? x : undefined);

function geoOf(x: unknown): GeoAnswer | undefined {
  const o = obj(x);
  if (o === undefined || !exactly(o, ['open', 'reason', 'countryCode']) || typeof o.open !== 'boolean') return undefined;
  const reason = o.reason === null ? null : oneOf(o.reason, GEO_REASONS);
  const countryCode = countryOf(o.countryCode);
  // Open exactly when there is no reason (gate.ts): any other pairing is not an answer the gate gives.
  if (reason === undefined || countryCode === undefined || o.open !== (reason === null)) return undefined;
  return {open: o.open, reason, countryCode};
}

function pair(x: unknown): {largest: bigint; total: bigint} | undefined {
  const o = obj(x);
  const [largest, total] = [units(o?.largest), units(o?.total)];
  return o === undefined || !exactly(o, ['largest', 'total']) || largest === undefined || total === undefined || largest > total ? undefined : {largest, total};
}

/** The kind of a purchase record (§2.3). */
export const PURCHASE_KIND = 'presale-buy';

/** The open purchase record a view carries (C30): null, or a record of this kind. */
function pendingIn(x: unknown): Pending | null | undefined {
  if (x === null) return null;
  const p = pendingOf(x);
  return p === undefined || p.intent !== null || p.extra?.kind !== PURCHASE_KIND ? undefined : p;
}

export function presaleViewOf(x: unknown): PresaleView | undefined {
  const o = obj(x);
  if (o === undefined || !('pending' in o)) return undefined;
  const pending = pendingIn(o.pending);
  if (pending === undefined) return undefined;
  if (o.open === true) {
    if (!exactly(o, ['open', 'state', 'limits', 'allocation', 'balances', 'solUsdMicros', 'countryCode', 'referral', 'pending'])) return undefined;
    const state = stageOf(o.state);
    const l = obj(o.limits);
    const a = obj(o.allocation);
    const b = obj(o.balances);
    const r = obj(o.referral);
    if (state === undefined || l === undefined || a === undefined || b === undefined || r === undefined || !exactly(l, ['minCents', 'maxTxCents', 'userRemainingCents', 'firstPurchase']) || !exactly(a, ['exists', 'totalBase', 'bonusBase']) || !exactly(b, ['SOL', 'USDC', 'USDT']) || !exactly(r, ['onChain', 'canRegister'])) return undefined;
    const [minCents, maxTxCents, userRemainingCents] = [units(l.minCents), units(l.maxTxCents), units(l.userRemainingCents)];
    const [totalBase, bonusBase, sol] = [units(a.totalBase), units(a.bonusBase), units(b.SOL)];
    const [usdc, usdt] = [pair(b.USDC), pair(b.USDT)];
    const solUsdMicros = o.solUsdMicros === null ? null : units(o.solUsdMicros);
    const countryCode = countryOf(o.countryCode);
    if (minCents === undefined || maxTxCents === undefined || userRemainingCents === undefined || typeof l.firstPurchase !== 'boolean') return undefined;
    if (typeof a.exists !== 'boolean' || totalBase === undefined || bonusBase === undefined || sol === undefined || usdc === undefined || usdt === undefined || solUsdMicros === undefined || solUsdMicros === 0n || countryCode === undefined) return undefined;
    const onChain = r.onChain === null ? null : isAddress(r.onChain) ? r.onChain : undefined;
    // §2.5: canRegister is exactly "a first purchase and no referrer on chain" — any other pairing is not the background's.
    if (onChain === undefined || typeof r.canRegister !== 'boolean' || r.canRegister !== (l.firstPurchase && onChain === null)) return undefined;
    return {
      open: true,
      state,
      limits: {minCents, maxTxCents, userRemainingCents, firstPurchase: l.firstPurchase},
      allocation: {exists: a.exists, totalBase, bonusBase},
      balances: {SOL: sol, USDC: usdc, USDT: usdt},
      solUsdMicros,
      countryCode,
      referral: {onChain, canRegister: r.canRegister},
      pending,
    };
  }
  if (o.open !== false) return undefined;
  if (o.why === 'unavailable') {
    const code = oneOf(o.code, ['read-failed', 'refused', 'malformed'] as const);
    return exactly(o, ['open', 'why', 'code', 'pending']) && code !== undefined ? {open: false, why: 'unavailable', code, pending} : undefined;
  }
  if (o.why === 'inactive' || o.why === 'blocked') {
    const state = stageOf(o.state);
    return exactly(o, ['open', 'why', 'state', 'pending']) && state !== undefined ? {open: false, why: o.why, state, pending} : undefined;
  }
  if (o.why === 'geo') {
    const geo = geoOf(o.geo);
    const state = o.state === null ? null : stageOf(o.state);
    return exactly(o, ['open', 'why', 'geo', 'state', 'pending']) && geo !== undefined && !geo.open && state !== undefined ? {open: false, why: 'geo', geo, state, pending} : undefined;
  }
  return undefined;
}

export function bannerOf(x: unknown): BannerData | null | undefined {
  if (x === null) return null;
  const o = obj(x);
  if (o === undefined || !exactly(o, ['stage', 'priceTicks', 'stagePercent']) || !isStage(o.stage)) return undefined;
  const priceTicks = units(o.priceTicks);
  if (priceTicks === undefined || priceTicks === 0n || !isInt(o.stagePercent) || o.stagePercent > 100) return undefined;
  return {stage: o.stage, priceTicks, stagePercent: o.stagePercent};
}

const LINES = ['below-min', 'above-max-tx', 'above-user-limit', 'insufficient-sol', 'insufficient-token', 'split-balance', 'sender-below-rent', 'no-sol-price'] as const;
export function quoteOf(x: unknown): Quote | 'stale' | undefined {
  const o = obj(x);
  if (o === undefined) return undefined;
  if (exactly(o, ['stale'])) return o.stale === true ? 'stale' : undefined;
  if (!exactly(o, ['amount', 'cents', 'nocBase', 'line'])) return undefined;
  const amount = units(o.amount);
  const line = o.line === null ? null : oneOf(o.line, LINES);
  const cents = o.cents === null ? null : units(o.cents);
  const nocBase = o.nocBase === null ? null : units(o.nocBase);
  if (amount === undefined || line === undefined || cents === undefined || nocBase === undefined) return undefined;
  // §3.2: no estimate only without a SOL price, and then never one.
  if ((cents === null || nocBase === null) !== (line === 'no-sol-price') || (cents === null) !== (nocBase === null)) return undefined;
  return {amount, cents, nocBase, line};
}

export function purchaseDataOf(x: unknown): PurchaseData | undefined {
  const o = obj(x);
  if (o === undefined || !exactly(o, ['currency', 'amount', 'stage', 'priceTicks', 'nocBase', 'spentCents', 'destination', 'referrer']) || !isCurrency(o.currency)) return undefined;
  const [amount, stage, priceTicks, nocBase, spentCents] = [units(o.amount), units(o.stage), units(o.priceTicks), units(o.nocBase), units(o.spentCents)];
  const referrer = o.referrer === null ? null : isAddress(o.referrer) ? o.referrer : undefined;
  if (amount === undefined || stage === undefined || stage > 9n || priceTicks === undefined || nocBase === undefined || spentCents === undefined || !isAddress(o.destination) || referrer === undefined) return undefined;
  return {currency: o.currency, amount, stage: Number(stage), priceTicks, nocBase, spentCents, destination: o.destination, referrer};
}

const REASONS = ['first-purchase', 'over-5-percent', 'over-usd-threshold'] as const;
export function purchaseViewOf(x: unknown): PurchaseView | undefined {
  const o = obj(x);
  const f = obj(o?.fees);
  const s = obj(o?.simulation);
  if (o === undefined || f === undefined || s === undefined || typeof o.id !== 'string' || !HEX32.test(o.id) || !isCurrency(o.currency) || !isStage(o.stage) || !isAddress(o.destination) || !isInt(o.validUntil)) return undefined;
  const [amount, priceTicks, nocBase, spentCents] = [units(o.amount), units(o.priceTicks), units(o.nocBase), units(o.spentCents)];
  const [networkLamports, priorityLamports, rentLamports] = [units(f.networkLamports), units(f.priorityLamports), units(f.rentLamports)];
  if (amount === undefined || priceTicks === undefined || nocBase === undefined || spentCents === undefined || networkLamports === undefined || priorityLamports === undefined || rentLamports === undefined) return undefined;
  const programs = s.programs;
  if (!isInt(s.slot) || !isInt(s.elapsedMs) || !isInt(s.instructionCount) || !Array.isArray(programs) || programs.length !== 2 || programs[0] !== 'compute-budget' || programs[1] !== 'presale') return undefined;
  let referrer: PurchaseView['referrer'] = null;
  if (o.referrer !== null) {
    const r = obj(o.referrer);
    if (r === undefined || !isAddress(r.address) || typeof r.registers !== 'boolean') return undefined;
    referrer = {address: r.address, registers: r.registers};
  }
  let reauth: PurchaseView['reauth'] = null;
  if (o.reauth !== null) {
    const r = obj(o.reauth);
    const reasons: PresaleReauthReason[] = [];
    if (r === undefined || typeof r.challengeId !== 'string' || !HEX32.test(r.challengeId) || typeof r.proven !== 'boolean' || !Array.isArray(r.reasons)) return undefined;
    for (const v of r.reasons as unknown[]) {
      const reason = oneOf(v, REASONS);
      if (reason === undefined) return undefined;
      reasons.push(reason);
    }
    reauth = {challengeId: r.challengeId, reasons, proven: r.proven};
  }
  return {
    id: o.id,
    currency: o.currency,
    amount,
    stage: o.stage,
    priceTicks,
    nocBase,
    spentCents,
    destination: o.destination,
    referrer,
    fees: {networkLamports, priorityLamports, rentLamports},
    reauth,
    validUntil: o.validUntil,
    simulation: {slot: s.slot, elapsedMs: s.elapsedMs, programs: ['compute-budget', 'presale'], instructionCount: s.instructionCount},
  };
}

export function resumableOf(x: unknown): ResumablePurchase | undefined {
  const o = obj(x);
  if (o === undefined || typeof o.expired !== 'boolean') return undefined;
  const {expired, ...rest} = o;
  const view = purchaseViewOf(rest);
  return view === undefined ? undefined : {...view, expired};
}

/** presale.checkReferrer's answer (§1.4): `{ok: true}` → null, `{ok: false, line}` → the line. */
export function referrerCheckOf(x: unknown): ReferrerLine | null | undefined {
  const o = obj(x);
  if (o === undefined) return undefined;
  if (exactly(o, ['ok'])) return o.ok === true ? null : undefined;
  return exactly(o, ['ok', 'line']) && o.ok === false ? oneOf(o.line, REFERRER_LINES) : undefined;
}

/**
 * presale.referral's answer (§3.5) for `account`: exactly its four keys; the link is this account's invite link, whole
 * (never another address's, never shortened); each figure a decimal string of a bigint, or null.
 */
export function referralDataOf(x: unknown, account: string): ReferralData | undefined {
  const o = obj(x);
  if (o === undefined || !exactly(o, ['link', 'earnedBase', 'referrals', 'referredCents']) || o.link !== buildReferralLink(account)) return undefined;
  const figure = (v: unknown): bigint | null | undefined => (v === null ? null : units(v));
  const [earnedBase, referrals, referredCents] = [figure(o.earnedBase), figure(o.referrals), figure(o.referredCents)];
  if (earnedBase === undefined || referrals === undefined || referredCents === undefined) return undefined;
  return {link: o.link, earnedBase, referrals, referredCents};
}

/** The pending record presale.buy answers: the wallet's own purchase (`intent: null`, this kind), nothing else. */
const purchaseRecordOf = (x: unknown): Pending | undefined => {
  const p = pendingIn(x);
  return p === null ? undefined : p;
};

export function presaleClient(engine: Engine): PresaleClient {
  return {
    banner: () => engine.request({type: 'presale.banner'}, SESSION, bannerOf),
    view: (account, refresh) => engine.request({type: 'presale.view', account, ...(refresh === undefined ? {} : {refresh})}, SESSION, presaleViewOf),
    quote: (account, currency, amount) => engine.request({type: 'presale.quote', account, currency, amount: amount === 'max' ? 'max' : amount.toString()}, SESSION, quoteOf),
    pending: (account: string) => engine.request({type: 'presale.pending', account}, SESSION, x => (x === null ? null : pendingIn(x))),
    prepareBuy: (account, intent, challengeId) =>
      engine.request(
        {
          type: 'presale.prepareBuy',
          account,
          intent: {currency: intent.currency, amount: intent.amount.toString(), stage: intent.stage, ...(intent.referrer === undefined ? {} : {referrer: intent.referrer})},
          ...(challengeId === undefined ? {} : {challengeId}),
        },
        PREPARE_REFUSALS,
        purchaseViewOf,
      ),
    checkReferrer: (account, referrer) => engine.request({type: 'presale.checkReferrer', account, referrer}, CHECK_REFUSALS, referrerCheckOf),
    preparedFor: account => engine.request({type: 'presale.preparedFor', account}, SESSION, x => (x === null ? null : resumableOf(x))),
    referral: account => engine.request({type: 'presale.referral', account}, SESSION, x => referralDataOf(x, account)),
    buy: id => engine.request({type: 'presale.buy', id}, BUY_REFUSALS, purchaseRecordOf),
    discardPrepared: account => engine.request({type: 'presale.discardPrepared', account}, SESSION, x => (x === undefined ? null : undefined)),
  };
}
