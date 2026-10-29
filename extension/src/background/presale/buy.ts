import {MessageV0, PublicKey, TransactionMessage, VersionedMessage, VersionedTransaction} from '@solana/web3.js';
import {base64} from '@scure/base';
import type {Ext} from '../../ext';
import type {WalletDeps} from '../deps';
import type {GeoAnswer} from '../geo/gate';
import {getSession} from '../session';
import {inFlightFor, readPending} from '../pendingStore';
import {readSettings} from '../settings';
import {REAUTH_PERCENT, usdMicros} from '../reauthPolicy';
import {challengeInfo, challengeSatisfied, issueChallenge, rebaseKindChallenge} from '../reauthChallenges';
import {randomId} from '../digest';
import {intentDigest, registerIntentKind, type IntentKind, type KindAbout, type KindHost} from '../intents';
import {PREPARED_TTL_MS, newestPrepared, preparedIntegrity, rentRefusal, storePrepared, type PreparedEntry} from '../prepare';
import {SendRefused} from '../sendTypes';
import {COMPUTE_BUDGET_PROGRAM} from '../dapp/decode/decode';
import {tokenAccountInfo} from '../dapp/tokenState';
import {readPresaleStateAt, referrerAllocationOf, type PresaleSnapshot, type PresaleState} from './state';
import {PRESALE_CURRENCIES, PRESALE_FEE_BOUND_LAMPORTS, quote, type BalanceCode, type PresaleBalances, type PresaleCurrency} from './quote';
import {PRESALE_ALLOCATION_LAYOUT, USER_ACCOUNT_LAYOUT} from './layouts';
import {recordConfirmedPurchase} from './record';
import {
  MAINNET_PROGRAM_ID,
  MAINNET_SOL_TREASURY,
  MAINNET_USDC_MINT,
  MAINNET_USDT_MINT,
  MAINNET_VAULT_USDC_ATA,
  MAINNET_VAULT_USDT_ATA,
  PYTH_SOL_USD_ACCOUNT,
} from '../../../../core/presale/addresses';
import {derivePresalePdas, readU64LE} from '../../../../core/presale/allocation';
import {COMPUTE_UNIT_LIMIT, buildBuyInstructions, buildStablecoinBuyInstructions, encodeU64LE} from '../../../../core/presale/buyInstructions';
import {
  PRESALE_ALLOCATION_RENT_LAMPORTS,
  PRESALE_USER_ACCOUNT_RENT_LAMPORTS,
  STAGE_PRICE_TICKS,
  checkLimits,
  tokensFor,
  usdCentsForStable,
  type LimitCode,
} from '../../../../core/presale/limits';
import {SPL_TOKEN_PROGRAM} from '../../../../core/solana/encoding';
import {estimatePriorityFee} from '../../../../core/solana/priorityFee';
import {networkFeeLamports, priorityFeeLamports, selectSourceTokenAccount} from '../../../../core/solana/transfer';
import {isGeoRefusal} from '../../../../core/geo/fetch';
import {RequestUnreachable, RpcHttpError, RpcMalformed, RpcResponseError, SYSTEM_PROGRAM_ID, type SimulatedAccount, type SimulationOutcome, type TokenAccountEntry} from '../../../../core/solana/rpc';
import type {Prices} from '../../../../core/portfolio/value';

/**
 * B1d §3.3, §3.4 (approach A): a presale purchase as an intent of B1b's send pipeline — kind `presale-buy`. This module
 * owns the kind: its intent and digest, #10's description of its challenge, and the prepare — build with core/presale,
 * simulate, check the simulation exactly, decide re-authentication, store the prepared entry. Signing is the shared
 * pipeline's (send.ts), reached only through presale.buy (D17).
 */
export const PRESALE_BUY_KIND = 'presale-buy';

/** §1.4: what the user asked for — the currency, the amount in its base units (decimal string) and the stage they saw (C27). */
export interface PurchaseIntent {
  currency: PresaleCurrency;
  amount: string;
  stage: number;
}

/** §5: the refusals of a purchase (presale/ only — the shared SendRefusal is unchanged). */
export type PurchaseRefusal =
  | 'locked'
  | 'unknown-account'
  | 'in-flight'
  | 'presale-unavailable'
  | 'coordinator-refused'
  | 'presale-closed'
  | 'blocked'
  | 'geo-closed'
  | 'price-changed'
  | 'state-changed'
  | LimitCode
  | 'above-limit'
  | BalanceCode
  | 'no-sol-price'
  | 'simulation-failed'
  | 'simulation-mismatch'
  | 'presale-busy';

export class PurchaseRefused extends Error {
  readonly code: PurchaseRefusal;
  readonly detail: string;
  constructor(code: PurchaseRefusal, detail = '') {
    super(detail === '' ? code : `${code}: ${detail}`);
    this.name = 'PurchaseRefused';
    this.code = code;
    this.detail = detail;
  }
}

const AMOUNT = /^[1-9]\d{0,19}$/;
const MAX_U64 = 2n ** 64n - 1n;
const INTENT_KEYS = ['currency', 'amount', 'stage'];

/** Untrusted or stored input → the intent rebuilt key by key, or null: exactly three keys, a known currency, a positive u64, a stage 0–9. */
export function parsePurchaseIntent(x: unknown): PurchaseIntent | null {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (Object.keys(o).length !== INTENT_KEYS.length || !INTENT_KEYS.every(k => Object.hasOwn(o, k))) return null;
  const {currency, amount, stage} = o;
  if (typeof currency !== 'string' || !(PRESALE_CURRENCIES as readonly string[]).includes(currency)) return null;
  if (typeof amount !== 'string' || !AMOUNT.test(amount) || BigInt(amount) > MAX_U64) return null;
  if (typeof stage !== 'number' || !Number.isInteger(stage) || stage < 0 || stage >= STAGE_PRICE_TICKS.length) return null;
  return {currency: currency as PresaleCurrency, amount, stage};
}

/** §3.3 step 6: a purchase's re-authentication is bound to who buys what at which stage (B1d-2 adds the referrer). */
function purchaseDigestValue(account: string, intent: PurchaseIntent): {account: string; currency: string; amount: string; stage: number} {
  return {account, currency: intent.currency, amount: intent.amount, stage: intent.stage};
}

/** §3.4 (D3): B1b's 5 % and dollar rules plus the first purchase; B1b's first-send and whole-balance-to-new do not apply (C5). */
export type PresaleReauthReason = 'first-purchase' | 'over-5-percent' | 'over-usd-threshold';
const REASONS: readonly PresaleReauthReason[] = ['first-purchase', 'over-5-percent', 'over-usd-threshold'];

/** C36: the larger of two valuations in micro-dollars; unknown only when both are. */
export function largerValue(a: bigint | null, b: bigint | null): bigint | null {
  if (a === null) return b;
  if (b === null) return a;
  return a > b ? a : b;
}

/**
 * Which re-authentication triggers a purchase meets. Fail closed as B1b: a zero balance is above 5 %, an unknown value
 * above the threshold. `balance` is the paying token's total held; `usdMicros` the larger valuation (largerValue).
 */
export function presaleReauthReasons(i: {firstPurchase: boolean; amount: bigint; balance: bigint; usdMicros: bigint | null; thresholdCents: number}): PresaleReauthReason[] {
  if (i.amount < 0n) throw new RangeError('presaleReauthReasons: negative amount');
  const out: PresaleReauthReason[] = [];
  if (i.firstPurchase) out.push('first-purchase');
  if (i.balance <= 0n || i.amount * 100n > i.balance * REAUTH_PERCENT) out.push('over-5-percent');
  if (i.usdMicros === null || i.usdMicros > BigInt(i.thresholdCents) * 10_000n) out.push('over-usd-threshold');
  return out;
}

/**
 * §1.3 `describe` (E3's rule for a send, kept): what #10 shows for a purchase challenge, written by the prepare that binds
 * the digest, from the same values. Amounts are base-unit decimal strings; `stage` is the program's 0-indexed stage.
 */
export interface PurchaseAbout {
  kind: typeof PRESALE_BUY_KIND;
  account: string;
  currency: PresaleCurrency;
  amount: string;
  stage: number;
  priceTicks: string;
  /** The simulated NOC (Δtotal_tokens) and cents (Δtotal_spent_cents). */
  nocBase: string;
  spentCents: string;
  /** The pinned treasury (SOL) or the pinned vault ATA (a stablecoin) the payment lands on. */
  destination: string;
  networkLamports: string;
  priorityLamports: string;
  rentLamports: string;
  reasons: PresaleReauthReason[];
  thresholdCents: number;
}
const ABOUT_KEYS = ['kind', 'account', 'currency', 'amount', 'stage', 'priceTicks', 'nocBase', 'spentCents', 'destination', 'networkLamports', 'priorityLamports', 'rentLamports', 'reasons', 'thresholdCents'];
const DIGITS = /^\d{1,20}$/;
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** The exact shape this module issues: a stored description with any other shape is dropped by the challenge store. */
export function isPurchaseAbout(x: KindAbout): boolean {
  const a = x as Record<string, unknown>;
  if (Object.keys(a).length !== ABOUT_KEYS.length || !ABOUT_KEYS.every(k => Object.hasOwn(a, k))) return false;
  if (a.kind !== PRESALE_BUY_KIND || parsePurchaseIntent({currency: a.currency, amount: a.amount, stage: a.stage}) === null) return false;
  if (typeof a.account !== 'string' || !ADDRESS.test(a.account) || typeof a.destination !== 'string' || !ADDRESS.test(a.destination)) return false;
  const numbers = [a.priceTicks, a.nocBase, a.spentCents, a.networkLamports, a.priorityLamports, a.rentLamports];
  if (!numbers.every(v => typeof v === 'string' && DIGITS.test(v))) return false;
  // The priority is a part of the network fee, never more.
  if (BigInt(a.priorityLamports as string) > BigInt(a.networkLamports as string)) return false;
  const reasons = a.reasons;
  if (!Array.isArray(reasons) || reasons.length === 0 || new Set(reasons).size !== reasons.length) return false;
  if (!(reasons as unknown[]).every(r => typeof r === 'string' && (REASONS as readonly string[]).includes(r))) return false;
  return typeof a.thresholdCents === 'number' && Number.isSafeInteger(a.thresholdCents);
}

/** A re-prepare of the same purchase: the identity fields from the stored description, everything recomputed from `fresh`. */
function rebasePurchaseAbout(stored: KindAbout, fresh: KindAbout): KindAbout | null {
  if (!isPurchaseAbout(stored) || !isPurchaseAbout(fresh)) return null;
  const s = stored as unknown as PurchaseAbout;
  const f = fresh as unknown as PurchaseAbout;
  if (s.account !== f.account || s.currency !== f.currency || s.amount !== f.amount || s.stage !== f.stage || s.destination !== f.destination) return null;
  const about: PurchaseAbout = {
    kind: PRESALE_BUY_KIND,
    account: s.account,
    currency: s.currency,
    amount: s.amount,
    stage: s.stage,
    priceTicks: f.priceTicks,
    nocBase: f.nocBase,
    spentCents: f.spentCents,
    destination: s.destination,
    networkLamports: f.networkLamports,
    priorityLamports: f.priorityLamports,
    rentLamports: f.rentLamports,
    reasons: f.reasons,
    thresholdCents: f.thresholdCents,
  };
  return about as unknown as KindAbout;
}

/** §2.3: a purchase record's `extra.data` — display only, every value a string (decimal strings for numbers). */
export interface PurchasePendingData {
  currency: PresaleCurrency;
  amount: string;
  /** The program's 0-indexed stage the purchase was simulated at. */
  stage: string;
  priceTicks: string;
  /** The simulated NOC (Δtotal_tokens) and cents (Δtotal_spent_cents). */
  nocBase: string;
  spentCents: string;
  destination: string;
  /** The effective referrer, or null. */
  referrer: string | null;
}

/** The destination the state pins for each currency (C5, C28): the treasury for SOL, its vault ATA for a stablecoin. */
const PINNED_DESTINATION: Record<PresaleCurrency, string> = {SOL: MAINNET_SOL_TREASURY, USDC: MAINNET_VAULT_USDC_ATA, USDT: MAINNET_VAULT_USDT_ATA};
const exactKeys = (o: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k));
const record = (x: unknown): Record<string, unknown> | null => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null);
const digits = (x: unknown): x is string => typeof x === 'string' && DIGITS.test(x);
const count = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const SHOWN_VIEW_KEYS = ['currency', 'amount', 'stage', 'priceTicks', 'nocBase', 'spentCents', 'destination', 'referrer', 'fees', 'reasons'];

/**
 * What prepare kept beside the bound fields, read back for this intent — `shown` is not in the integrity, so it is a
 * claim like any stored value: exactly the shape preparePurchase writes, the intent's own currency, amount and stage,
 * the stage's price and the destination the state pins for the currency. Rebuilt key by key (a fresh object), or null.
 */
function shownOf(entry: PreparedEntry, intent: PurchaseIntent): PreparedPurchase['shown'] | null {
  const shown = record(entry.shown);
  const fees = record(shown?.fees);
  const sim = record(shown?.simulation);
  const view = record(shown?.view);
  const basis = record(shown?.basis);
  if (shown === null || fees === null || sim === null || view === null || basis === null || !exactKeys(shown, ['fees', 'simulation', 'view', 'basis'])) return null;
  if (!exactKeys(fees, ['networkLamports', 'markupLamports']) || !digits(fees.networkLamports) || fees.markupLamports !== '0') return null;
  const programs = sim.programs;
  if (!exactKeys(sim, ['slot', 'elapsedMs', 'programs', 'instructionCount']) || !count(sim.slot) || !count(sim.elapsedMs) || sim.instructionCount !== 3) return null;
  if (!Array.isArray(programs) || programs.length !== 2 || programs[0] !== 'compute-budget' || programs[1] !== 'presale') return null;
  if (!exactKeys(view, SHOWN_VIEW_KEYS) || view.currency !== intent.currency || view.amount !== intent.amount || view.stage !== intent.stage) return null;
  if (view.priceTicks !== (STAGE_PRICE_TICKS[intent.stage] as bigint).toString() || !digits(view.nocBase) || !digits(view.spentCents) || view.destination !== PINNED_DESTINATION[intent.currency]) return null;
  const referrer = view.referrer === null ? null : record(view.referrer);
  if (view.referrer !== null && (referrer === null || !exactKeys(referrer, ['address', 'registers']) || typeof referrer.address !== 'string' || !ADDRESS.test(referrer.address) || referrer.registers !== false)) return null;
  const vf = record(view.fees);
  if (vf === null || !exactKeys(vf, ['networkLamports', 'priorityLamports', 'rentLamports']) || vf.networkLamports !== fees.networkLamports || !digits(vf.priorityLamports) || !digits(vf.rentLamports)) return null;
  const reasons = view.reasons;
  if (!Array.isArray(reasons) || new Set(reasons).size !== reasons.length || !(reasons as unknown[]).every(r => typeof r === 'string' && (REASONS as readonly string[]).includes(r))) return null;
  if (!exactKeys(basis, ['allocationExists', 'purchaseCount', 'referrer', 'userAccountExists']) || typeof basis.allocationExists !== 'boolean' || !count(basis.purchaseCount) || typeof basis.userAccountExists !== 'boolean') return null;
  if (basis.referrer !== null && (typeof basis.referrer !== 'string' || !ADDRESS.test(basis.referrer))) return null;
  return {
    fees: {networkLamports: fees.networkLamports, markupLamports: '0'},
    simulation: {slot: sim.slot, elapsedMs: sim.elapsedMs, programs: ['compute-budget', 'presale'], instructionCount: 3},
    view: {
      currency: intent.currency,
      amount: intent.amount,
      stage: intent.stage,
      priceTicks: view.priceTicks,
      nocBase: view.nocBase,
      spentCents: view.spentCents,
      destination: view.destination,
      referrer: referrer === null ? null : {address: referrer.address as string, registers: false},
      fees: {networkLamports: vf.networkLamports, priorityLamports: vf.priorityLamports, rentLamports: vf.rentLamports},
      reasons: [...(reasons as PresaleReauthReason[])],
    },
    basis: {allocationExists: basis.allocationExists, purchaseCount: basis.purchaseCount, referrer: basis.referrer, userAccountExists: basis.userAccountExists},
  };
}

/**
 * §3.3 (C12, C22, C10; C29 — sendPrepared runs this after the challenge check and before the single-use take, so a
 * refusal burns neither the entry nor the proof): what must still hold when the user signs. Refused with §5's code: the
 * entry's facts do not read back (`prepared-invalid`); a transaction of the account recorded since (`in-flight`); the gate
 * not open (`geo-closed`) — decided first, as at prepare; the state (one read of the whole §2.1 snapshot) unavailable,
 * refused, closed, blocked or at another stage; the signed bytes not this purchase to the pinned destination crediting
 * the referrer allocation the program would credit now (signedPurchase); the account's presale accounts not as prepared
 * (`state-changed`); the prepared cents outside the limits now (`below-min`, `above-max-tx`, `above-user-limit`).
 */
async function purchaseBeforeSign({ext, deps}: KindHost, entry: PreparedEntry, intent: PurchaseIntent): Promise<void> {
  const shown = shownOf(entry, intent);
  if (shown === null) throw new SendRefused('prepared-invalid', 'the prepared purchase does not read back');
  // Refused here, before the take, rather than by submitSigned's own in-flight guard after it.
  if (inFlightFor(await readPending(ext), entry.account) !== undefined) throw new PurchaseRefused('in-flight');
  const [read, geo] = await Promise.all([readPresaleStateAt(deps.reader, entry.account, deps.now()), gateAnswer(deps)]);
  if (!geo.open) throw new PurchaseRefused('geo-closed', geo.reason ?? '');
  const snapshot = openSnapshot(read.state, intent);
  await signedPurchase(entry, intent, snapshot, shown.fees.networkLamports);
  const b = shown.basis;
  if (snapshot.allocation.exists !== b.allocationExists || snapshot.allocation.purchaseCount !== b.purchaseCount || snapshot.allocation.referrer !== b.referrer || snapshot.userAccountExists !== b.userAccountExists) {
    throw new PurchaseRefused('state-changed', 'the account’s presale accounts are not as prepared');
  }
  const limit = checkLimits({cents: BigInt(shown.view.spentCents), ...snapshot.limits});
  if (limit !== null) throw new PurchaseRefused(limit);
}

/**
 * Review 1 M1: the sign-time check rests on the bytes that will be signed, not on `shown`. The entry must read back under
 * its integrity (so the message checked is the one sendPrepared signs after the take), and its message must be exactly
 * the purchase of this intent to the destination the state pins, crediting the referrer allocation the fresh snapshot
 * resolves — `state-changed` when only that allocation differs (a referrer registered since prepare), `prepared-invalid`
 * for anything else. Its compute budget too (review I1): exactly COMPUTE_UNIT_LIMIT units at a price whose network fee is
 * within PRESALE_FEE_BOUND_LAMPORTS and is the prepared fee (`shownFee`, which the record shows).
 */
async function signedPurchase(entry: PreparedEntry, intent: PurchaseIntent, snapshot: PresaleSnapshot, shownFee: string): Promise<void> {
  const invalid = new SendRefused('prepared-invalid', 'the prepared purchase is not this purchase');
  let message: MessageV0;
  try {
    if (preparedIntegrity(entry) !== entry.integrity) throw invalid;
    const m = VersionedMessage.deserialize(base64.decode(entry.message));
    if (!(m instanceof MessageV0)) throw invalid;
    message = m;
  } catch {
    throw invalid;
  }
  const fee = signedNetworkFee(message);
  if (fee === null || fee > PRESALE_FEE_BOUND_LAMPORTS || fee !== BigInt(shownFee)) throw invalid;
  const keys = message.staticAccountKeys.map(k => k.toBase58());
  const named = (message.compiledInstructions[2]?.accountKeyIndexes ?? []).map(k => keys[k]);
  // A stablecoin's paying account is taken from the message's own bytes, by design: nothing bound names it (the intent
  // has none; prepare chose it from the holdings and the simulation proved its loss), and the program refuses a wrong one.
  const expected = {account: entry.account, currency: intent.currency, destination: PINNED_DESTINATION[intent.currency], source: intent.currency === 'SOL' ? null : (named[4] ?? null), amount: BigInt(intent.amount)};
  const matches = (referrerAllocation: string): boolean => {
    try {
      assertPurchaseMessage(message, {...expected, referrerAllocation});
      return true;
    } catch {
      return false;
    }
  };
  if (matches((await referrerAllocationOf(snapshot, entry.account)).referrerAllocation.toBase58())) return;
  const built = named[3];
  if (built !== undefined && matches(built)) throw new PurchaseRefused('state-changed', 'the referrer allocation the purchase credits changed');
  throw invalid;
}

/**
 * Review I1: the network fee the message's compute budget pays — ix 0 exactly `[2, u32 LE units]` with units ===
 * COMPUTE_UNIT_LIMIT, ix 1 exactly `[3, u64 LE µlamports per CU]`, neither naming an account (their program ids are
 * assertPurchaseMessage's, as its one signer) — or null for any other data, length or limit.
 */
function signedNetworkFee(message: MessageV0): bigint | null {
  const [limit, price] = message.compiledInstructions;
  if (limit === undefined || price === undefined || limit.accountKeyIndexes.length !== 0 || price.accountKeyIndexes.length !== 0) return null;
  if (limit.data.length !== 5 || limit.data[0] !== 2 || price.data.length !== 9 || price.data[0] !== 3) return null;
  const units = new DataView(limit.data.buffer, limit.data.byteOffset, limit.data.byteLength).getUint32(1, true);
  const microLamports = readU64LE(price.data, 1);
  if (units !== COMPUTE_UNIT_LIMIT || microLamports > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return networkFeeLamports(1, Number(microLamports), COMPUTE_UNIT_LIMIT);
}

/** §2.3: the record's display data, from the entry the pipeline signs — null when its facts do not read back (shown generically, Q42). */
function purchasePendingData(entry: PreparedEntry, intent: PurchaseIntent): PurchasePendingData | null {
  const shown = shownOf(entry, intent);
  if (shown === null) return null;
  const v = shown.view;
  return {currency: v.currency, amount: v.amount, stage: String(v.stage), priceTicks: v.priceTicks, nocBase: v.nocBase, spentCents: v.spentCents, destination: v.destination, referrer: v.referrer === null ? null : v.referrer.address};
}

/**
 * B1d §1.3 (C19, D17): the purchase kind, registered when this module loads — only the presale entry module imports it,
 * so the build without presale has no such kind. It is signed only through presale.buy, which names it; once confirmed,
 * it is recorded with the coordinator (B1d-2, §2.4: record.ts).
 */
export const PRESALE_BUY_INTENT: IntentKind<PurchaseIntent> = {
  kind: PRESALE_BUY_KIND,
  parseIntent: parsePurchaseIntent,
  digestValue: purchaseDigestValue,
  beforeSign: purchaseBeforeSign,
  pendingData: purchasePendingData,
  isAbout: isPurchaseAbout,
  rebaseAbout: rebasePurchaseAbout,
  onConfirmed: recordConfirmedPurchase,
};
registerIntentKind(PRESALE_BUY_INTENT);

/** The gate never throws (deps.ts); if it ever did, that is no check — closed. */
export async function gateAnswer(deps: WalletDeps): Promise<GeoAnswer> {
  try {
    const g = await deps.geo();
    return {open: g.open, reason: g.reason, countryCode: g.countryCode};
  } catch {
    return {open: false, reason: 'no_check', countryCode: null};
  }
}

/** A failed network read: a 403 (or the latch's cool-down) is the coordinator refusing; any other RPC failure, unavailable. */
function readFailure(e: unknown): PurchaseRefused | null {
  if (isGeoRefusal(e)) return new PurchaseRefused('coordinator-refused');
  if (e instanceof RequestUnreachable || e instanceof RpcHttpError || e instanceof RpcResponseError || e instanceof RpcMalformed) return new PurchaseRefused('presale-unavailable', e.message);
  return null;
}
async function read<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    throw readFailure(e) ?? e;
  }
}

/** /wallet/prices for the re-authentication's valuation and the SOL limit, or null (C8: never an invented price). A 403 is never swallowed. */
async function pricesOrNull(deps: WalletDeps): Promise<Prices | null> {
  try {
    return await deps.prices();
  } catch (e) {
    if (isGeoRefusal(e)) throw new PurchaseRefused('coordinator-refused');
    return null;
  }
}
const usable = (p: number | undefined): number | null => (typeof p === 'number' && Number.isFinite(p) && p > 0 ? p : null);
const priceOf = (prices: Prices | null, currency: PresaleCurrency): number | null =>
  prices === null ? null : usable(currency === 'SOL' ? prices.solana : currency === 'USDC' ? prices.usdc : prices.usdt);

/** A state read as a purchase needs it: open, at the stage the user saw — else the refusal its answer means (§5). */
function openSnapshot(state: PresaleState, intent: PurchaseIntent): PresaleSnapshot {
  if (state.kind === 'unavailable') throw new PurchaseRefused(state.code === 'refused' ? 'coordinator-refused' : 'presale-unavailable', state.code);
  if (state.kind !== 'open') throw new PurchaseRefused(state.kind === 'blocked' ? 'blocked' : 'presale-closed');
  if (state.snapshot.stage.stage !== intent.stage) throw new PurchaseRefused('price-changed', `stage ${state.snapshot.stage.stage}, the intent's ${intent.stage}`);
  return state.snapshot;
}

const MINTS: Record<'USDC' | 'USDT', string> = {USDC: MAINNET_USDC_MINT, USDT: MAINNET_USDT_MINT};
const PURCHASE_DISCRIMINATORS: Record<PresaleCurrency, readonly number[]> = {
  SOL: [161, 153, 65, 238, 160, 236, 43, 165],
  USDC: [150, 34, 181, 239, 229, 123, 187, 128],
  USDT: [209, 3, 170, 172, 219, 182, 149, 89],
};

/** What the purchase instruction must name, in the IDL's order (§3.3, C37) — the destination the state pinned, never one derived here. */
export function expectedPurchaseAccounts(i: {account: string; currency: PresaleCurrency; referrerAllocation: string; destination: string; source: string | null}): string[] {
  const pdas = derivePresalePdas(new PublicKey(i.account));
  const head = [pdas.config.toBase58(), pdas.userAccount.toBase58(), pdas.userAllocation.toBase58(), i.referrerAllocation];
  if (i.currency === 'SOL') return [...head, PYTH_SOL_USD_ACCOUNT, i.account, i.destination, SYSTEM_PROGRAM_ID];
  if (i.source === null) throw new Error('a stablecoin purchase without its paying account');
  return [...head, i.source, i.destination, MINTS[i.currency], i.account, SPL_TOKEN_PROGRAM, SYSTEM_PROGRAM_ID];
}

/**
 * The compiled message is exactly the purchase this module meant: one signer (the account, the payer), the two
 * compute-budget instructions, then the purchase — its discriminator, its amount and its accounts as
 * expectedPurchaseAccounts names them. Anything else is an engine bug: thrown, never shown or simulated.
 */
export function assertPurchaseMessage(message: MessageV0, i: Parameters<typeof expectedPurchaseAccounts>[0] & {amount: bigint}): number {
  const keys = message.staticAccountKeys.map(k => k.toBase58());
  if (keys[0] !== i.account || message.header.numRequiredSignatures !== 1 || message.addressTableLookups.length !== 0) throw new Error('the purchase message is not signed by the account alone');
  const ixs = message.compiledInstructions;
  const programs = ixs.map(ix => keys[ix.programIdIndex]);
  if (ixs.length !== 3 || programs[0] !== COMPUTE_BUDGET_PROGRAM || programs[1] !== COMPUTE_BUDGET_PROGRAM || programs[2] !== MAINNET_PROGRAM_ID) {
    throw new Error(`the purchase message has unexpected instructions: ${programs.join(', ')}`);
  }
  const purchase = ixs[2] as (typeof ixs)[number];
  const named = purchase.accountKeyIndexes.map(k => keys[k]);
  const expected = expectedPurchaseAccounts(i);
  if (named.length !== expected.length || named.some((k, n) => k !== expected[n])) throw new Error(`the purchase names ${named.join(', ')}; expected ${expected.join(', ')}`);
  const data = [...PURCHASE_DISCRIMINATORS[i.currency], ...encodeU64LE(i.amount)];
  if (purchase.data.length !== data.length || purchase.data.some((b, n) => b !== data[n])) throw new Error('the purchase instruction data is not this purchase');
  return 2;
}

/** §3.3 step 5 (C23): the program's own refusal of the purchase instruction → its code. */
function programRefusal(err: unknown, purchaseIndex: number): PurchaseRefusal | null {
  if (typeof err !== 'object' || err === null || Array.isArray(err)) return null;
  const ie = (err as Record<string, unknown>).InstructionError;
  if (!Array.isArray(ie) || ie.length !== 2 || ie[0] !== purchaseIndex) return null;
  const custom = typeof ie[1] === 'object' && ie[1] !== null ? (ie[1] as Record<string, unknown>).Custom : undefined;
  if (custom === 6022) return 'below-min';
  if (custom === 6023) return 'above-limit';
  if (custom === 6002) return 'blocked';
  if (custom === 6020 || custom === 6021 || custom === 6024) return 'presale-closed';
  return null;
}

/** Bytes of a layout's account: the program's, exactly its length, its discriminator. */
function isLayout(a: SimulatedAccount | null, layout: {readonly length: number; readonly discriminator: readonly number[]}): a is SimulatedAccount {
  return a !== null && a.owner === MAINNET_PROGRAM_ID && a.data.length === layout.length && layout.discriminator.every((b, i) => a.data[i] === b);
}

/** An initialized SPL Token account's mint, owner and amount, or null. */
function tokenOf(a: SimulatedAccount | null): {mint: string; owner: string; amount: bigint} | null {
  if (a === null) return null;
  const info = tokenAccountInfo(a.data, a.owner);
  return info === null || info.program !== 'token' || info.state !== 'initialized' ? null : {mint: info.mint, owner: info.owner, amount: info.amount};
}

const A = PRESALE_ALLOCATION_LAYOUT.fields;
const u32At = (d: Uint8Array, offset: number): number => ((d[offset] as number) | ((d[offset + 1] as number) << 8) | ((d[offset + 2] as number) << 16)) + (d[offset + 3] as number) * 2 ** 24;

/** What prepare simulated against: the snapshot and the reads beside it. */
interface Basis {
  account: string;
  currency: PresaleCurrency;
  amount: bigint;
  snapshot: PresaleSnapshot;
  solBefore: bigint;
  source: {address: string; before: bigint} | null;
  destination: string;
  networkLamports: bigint;
  purchaseIndex: number;
  keys: readonly string[];
}

/** The simulation's verdict: every check passed (with what it measured), a refusal, or only the destination's Δ differs. */
type Verdict = {kind: 'ok'; rent: bigint; nocBase: bigint; spentCents: bigint} | {kind: 'refuse'; code: PurchaseRefusal; detail: string} | {kind: 'destination'; detail: string};
const refuse = (code: PurchaseRefusal, detail: string): Verdict => ({kind: 'refuse', code, detail});

/** The simulation's accounts, in this order (§3.3 step 5): payer, allocation, destination, the paying token account, the user account when absent. */
function simulationAccounts(b: Pick<Basis, 'account' | 'snapshot' | 'destination' | 'source'>): string[] {
  const pdas = derivePresalePdas(new PublicKey(b.account));
  return [b.account, pdas.userAllocation.toBase58(), b.destination, ...(b.source === null ? [] : [b.source.address]), ...(b.snapshot.userAccountExists ? [] : [pdas.userAccount.toBase58()])];
}

/** A created PDA's post-state: the program's, its layout, rent > 0 and ≤ its §2.1 upper bound — its lamports, or null. */
function createdRent(a: SimulatedAccount | null, layout: {readonly length: number; readonly discriminator: readonly number[]}, bound: bigint): bigint | null {
  return isLayout(a, layout) && a.lamports > 0n && a.lamports <= bound ? a.lamports : null;
}

/** §3.3 step 5: every check, on one simulation, against one snapshot. */
function judge(sim: SimulationOutcome, b: Basis): Verdict {
  if (sim.err !== null) {
    const program = programRefusal(sim.err, b.purchaseIndex);
    if (program !== null) return refuse(program, JSON.stringify(sim.err));
    if (rentRefusal(sim.err, b.keys, b.account, b.destination, false) === 'sender-below-rent') return refuse('sender-below-rent', JSON.stringify(sim.err));
    return refuse('simulation-failed', JSON.stringify(sim.err));
  }
  const wanted = simulationAccounts(b).length;
  const accounts = sim.accounts;
  if (accounts === null || accounts.length !== wanted) return refuse('simulation-mismatch', 'the simulation does not show the purchase accounts');
  const [payer, allocation, destination] = accounts as (SimulatedAccount | null)[];
  const sourceAfter = b.source === null ? null : (accounts[3] ?? null);
  const userAfter = b.snapshot.userAccountExists ? null : (accounts[wanted - 1] ?? null);
  const s = b.snapshot;

  // The rent of each PDA this purchase creates, from the simulation (§2.1 rent ruling) — within its bound, never 0.
  let rent = 0n;
  if (!s.allocation.exists) {
    const r = createdRent(allocation ?? null, PRESALE_ALLOCATION_LAYOUT, PRESALE_ALLOCATION_RENT_LAMPORTS);
    if (r === null) return refuse('simulation-mismatch', 'the new allocation is not a PresaleAllocation with its rent within the bound');
    rent += r;
  }
  if (!s.userAccountExists) {
    const r = createdRent(userAfter, USER_ACCOUNT_LAYOUT, PRESALE_USER_ACCOUNT_RENT_LAMPORTS);
    if (r === null) return refuse('simulation-mismatch', 'the new user account is not a UserAccount with its rent within the bound');
    rent += r;
  }

  // SOL out: the amount (SOL), the created PDAs' rent and the network fee — or that without the fee (B1b's two readings).
  if (payer === null || payer === undefined) return refuse('simulation-mismatch', 'the simulation does not show the paying account');
  const spent = b.solBefore - payer.lamports;
  const expected = (b.currency === 'SOL' ? b.amount : 0n) + rent + b.networkLamports;
  if (spent !== expected && spent !== expected - b.networkLamports) return refuse('simulation-mismatch', `the account pays ${spent} lamports; this purchase costs ${expected}`);

  // The paying token account loses exactly the amount and stays the account's.
  if (b.source !== null) {
    const t = tokenOf(sourceAfter);
    if (t === null || t.mint !== MINTS[b.currency as 'USDC' | 'USDT'] || t.owner !== b.account || b.source.before - t.amount !== b.amount) {
      return refuse('simulation-mismatch', `the paying account does not lose exactly ${b.amount}`);
    }
  }

  // The allocation: this account's PresaleAllocation, one more purchase, the cents and the NOC the program computes.
  if (!isLayout(allocation ?? null, PRESALE_ALLOCATION_LAYOUT)) return refuse('simulation-mismatch', 'the allocation after is not a PresaleAllocation');
  const d = (allocation as SimulatedAccount).data;
  const claimed = d[A.claimed.offset];
  if (new PublicKey(d.subarray(A.user.offset, A.user.offset + 32)).toBase58() !== b.account || (claimed !== 0 && claimed !== 1)) {
    return refuse('simulation-mismatch', 'the allocation after is not this account’s');
  }
  const count = u32At(d, A.purchase_count.offset) - s.allocation.purchaseCount;
  const spentCents = readU64LE(d, A.total_spent_cents.offset) - s.allocation.spentCents;
  const nocBase = readU64LE(d, A.total_tokens.offset) - s.allocation.totalBase;
  if (count !== 1) return refuse('simulation-mismatch', `the allocation records ${count} purchases`);
  if (b.currency !== 'SOL' && spentCents !== usdCentsForStable(b.amount)) return refuse('simulation-mismatch', `the allocation records ${spentCents} cents for ${b.amount}`);
  // The program's own limits on its own valuation — and with them Δc > 0 (the minimum is never 0, limits.ts).
  const limit = checkLimits({cents: spentCents, ...s.limits});
  if (limit !== null) return refuse('simulation-mismatch', `the simulated purchase is ${limit}`);
  if (nocBase !== tokensFor(spentCents, s.stage.stage)) {
    // Review L3: NOC at another stage's price is the stage moving between the read and the simulation.
    const other = STAGE_PRICE_TICKS.findIndex((_, stage) => stage !== s.stage.stage && nocBase === tokensFor(spentCents, stage));
    if (other !== -1) return refuse('price-changed', `the simulation priced at stage ${other}`);
    return refuse('simulation-mismatch', `the allocation gains ${nocBase} NOC base units for ${spentCents} cents`);
  }

  // C28: the payment lands on the pinned destination, exactly.
  if (destination === null || destination === undefined) return refuse('simulation-mismatch', 'the simulation does not show the destination');
  if (b.currency === 'SOL') {
    if (destination.owner !== SYSTEM_PROGRAM_ID || destination.data.length !== 0) return refuse('simulation-mismatch', 'the treasury after is not a system account');
    const gained = destination.lamports - s.treasuryLamports;
    if (gained !== b.amount) return {kind: 'destination', detail: `the treasury gains ${gained} lamports, not ${b.amount}`};
  } else {
    const t = tokenOf(destination);
    if (t === null || t.mint !== MINTS[b.currency] || t.owner !== MAINNET_SOL_TREASURY) return refuse('simulation-mismatch', 'the vault after is not the treasury’s token account of this mint');
    const gained = t.amount - s.vaults[b.currency].amount;
    if (gained !== b.amount) return {kind: 'destination', detail: `the vault gains ${gained}, not ${b.amount}`};
  }
  return {kind: 'ok', rent, nocBase, spentCents};
}

/** The reads a quote line needs, from this prepare's own reads (§3.2's rule, the same as presale.quote's). */
function balancesOf(solBefore: bigint, currency: PresaleCurrency, own: readonly TokenAccountEntry[]): PresaleBalances {
  const empty = {largest: 0n, total: 0n};
  const held = {largest: 0n, total: 0n};
  for (const h of own) {
    held.total += h.amount;
    if (h.amount > held.largest) held.largest = h.amount;
  }
  return {SOL: solBefore, USDC: currency === 'USDC' ? held : empty, USDT: currency === 'USDT' ? held : empty};
}

/** §3.3 step 7. Every amount a base-unit decimal string. */
export interface PurchaseView {
  id: string;
  currency: PresaleCurrency;
  amount: string;
  stage: number;
  priceTicks: string;
  nocBase: string;
  spentCents: string;
  destination: string;
  /** The on-chain referrer the purchase credits; `registers` is B1d-2's (always false here). */
  referrer: {address: string; registers: boolean} | null;
  fees: {networkLamports: string; priorityLamports: string; rentLamports: string};
  reauth: {challengeId: string; reasons: PresaleReauthReason[]; proven: boolean} | null;
  validUntil: number;
  simulation: {slot: number; elapsedMs: number; programs: ['compute-budget', 'presale']; instructionCount: number};
}

/** A prepared purchase: B1b's entry of kind `presale-buy`; `shown` keeps the view and the facts the sign-time re-read compares (C22). */
export interface PreparedPurchase extends PreparedEntry {
  kind: typeof PRESALE_BUY_KIND;
  intent: PurchaseIntent;
  shown: {
    fees: {networkLamports: string; markupLamports: '0'};
    simulation: PurchaseView['simulation'];
    view: Omit<PurchaseView, 'id' | 'reauth' | 'validUntil' | 'simulation'> & {reasons: PresaleReauthReason[]};
    basis: {allocationExists: boolean; purchaseCount: number; referrer: string | null; userAccountExists: boolean};
  };
}

/**
 * presale.prepareBuy (§3.3 steps 1–7): the session, the account and C10; a fresh state read and gate answer; the stage
 * the user saw; the limits and balances (§3.2's lines); the build; the simulation with every check and the one retry
 * (C39); re-authentication (§3.4); the prepared entry. Nothing is signed. `opts.challengeId`: a live challenge of the
 * same intent is renewed instead of issuing a new one (as prepareSend).
 */
export async function preparePurchase(ext: Ext, deps: WalletDeps, account: string, intent: PurchaseIntent, opts: {challengeId?: string} = {}): Promise<PurchaseView> {
  // 1. The session, the account, and one in-flight transaction per account — a send or a purchase (C10).
  const session = await getSession(ext);
  if (session === null) throw new PurchaseRefused('locked');
  if (!session.some(a => a.publicKey === account)) throw new PurchaseRefused('unknown-account');
  if (inFlightFor(await readPending(ext), account) !== undefined) throw new PurchaseRefused('in-flight');

  // 2. A fresh snapshot and a fresh gate answer; the gate closed decides first, as the view.
  const [first, geo] = await Promise.all([readPresaleStateAt(deps.reader, account, deps.now()), gateAnswer(deps)]);
  if (!geo.open) throw new PurchaseRefused('geo-closed', geo.reason ?? '');
  let snapshot = openSnapshot(first.state, intent);
  let snapshotSlot = first.slot;

  // 3. Limits and balances: the quote's lines with this prepare's own reads. A stablecoin pays from the account that
  // holds it (C2): the largest holding of that mint owned by the account.
  const amount = BigInt(intent.amount);
  const currency = intent.currency;
  const mint = currency === 'SOL' ? null : MINTS[currency];
  const [solBefore, holdings, prices] = await Promise.all([
    read(deps.reader.getBalance(account)),
    mint === null ? Promise.resolve<TokenAccountEntry[]>([]) : read(deps.reader.getTokenAccountsByOwner(account, {mint})),
    pricesOrNull(deps),
  ]);
  const own = holdings.filter(h => h.mint === mint && h.owner === account);
  const balances = balancesOf(solBefore, currency, own);
  const line = (s: PresaleSnapshot) => quote({snapshot: s, balances, solUsd: priceOf(prices, 'SOL')}, currency, amount).line;
  const limitLine = line(snapshot);
  if (limitLine !== null) throw new PurchaseRefused(limitLine);
  const sourceAddress = mint === null ? null : selectSourceTokenAccount(own, amount);
  if (mint !== null && sourceAddress === null) throw new PurchaseRefused('insufficient-token');
  const source = sourceAddress === null ? null : {address: sourceAddress, before: own.find(h => h.pubkey === sourceAddress)?.amount ?? 0n};

  // 4. Build at the normal tier (its fee within PRESALE_FEE_BOUND_LAMPORTS, which the quote assumed). The destination is
  // the one the state pinned; the referrer allocation is the snapshot's (the state accepted this account).
  const destination = currency === 'SOL' ? MAINNET_SOL_TREASURY : snapshot.vaults[currency].address;
  const resolved = await referrerAllocationOf(snapshot, account);
  if (resolved.registerReferrer !== null) throw new Error('B1d-1b registers no referrer');
  const [price, latest] = await Promise.all([read(estimatePriorityFee(deps.reader, 'normal')), read(deps.reader.getLatestBlockhash())]);
  const user = new PublicKey(account);
  const treasury = new PublicKey(MAINNET_SOL_TREASURY);
  const instructions =
    currency === 'SOL'
      ? buildBuyInstructions(user, amount, price, resolved, treasury)
      : buildStablecoinBuyInstructions(user, currency, amount, price, resolved, treasury, new PublicKey((source as {address: string}).address));
  const message = new TransactionMessage({payerKey: user, recentBlockhash: latest.blockhash, instructions}).compileToV0Message();
  const referrerAllocation = resolved.referrerAllocation.toBase58();
  const purchaseIndex = assertPurchaseMessage(message, {account, currency, referrerAllocation, destination, source: source?.address ?? null, amount});
  const networkLamports = networkFeeLamports(message.header.numRequiredSignatures, price, COMPUTE_UNIT_LIMIT);
  const priorityLamports = priorityFeeLamports(price, COMPUTE_UNIT_LIMIT);
  if (networkLamports > PRESALE_FEE_BOUND_LAMPORTS) throw new Error(`the purchase's network fee ${networkLamports} exceeds its bound`);

  // 5. Simulate the bytes, check everything; one retry, the same bytes, for a destination-only mismatch (C39).
  const wire = base64.encode(new VersionedTransaction(message).serialize());
  const keys = message.staticAccountKeys.map(k => k.toBase58());
  const basisOf = (s: PresaleSnapshot): Basis => ({account, currency, amount, snapshot: s, solBefore, source, destination, networkLamports, purchaseIndex, keys});
  const simulate = async (s: PresaleSnapshot) => {
    const started = deps.now();
    const sim = await read(deps.reader.simulateTransaction(wire, {accounts: simulationAccounts(basisOf(s))}));
    return {sim, elapsedMs: Math.max(0, deps.now() - started)};
  };
  let run = await simulate(snapshot);
  let verdict = judge(run.sim, basisOf(snapshot));
  if (verdict.kind === 'destination') {
    // A simulation older than the snapshot is a stale answer, not a race (review 2 L1).
    if (snapshotSlot === null || run.sim.slot < snapshotSlot) throw new PurchaseRefused('simulation-mismatch', `${verdict.detail}; simulated at slot ${run.sim.slot}, read at ${snapshotSlot}`);
    const again = await readPresaleStateAt(deps.reader, account, deps.now());
    const fresh = openSnapshot(again.state, intent);
    // The fresh snapshot replaces the first for everything; what the bytes were built from must not have moved.
    if (fresh.userAccountExists !== snapshot.userAccountExists || fresh.allocation.exists !== snapshot.allocation.exists) throw new PurchaseRefused('state-changed', 'the accounts this purchase creates changed');
    if ((await referrerAllocationOf(fresh, account)).referrerAllocation.toBase58() !== referrerAllocation) throw new PurchaseRefused('state-changed', 'the referrer changed');
    const freshLine = line(fresh);
    if (freshLine !== null) throw new PurchaseRefused(freshLine);
    snapshot = fresh;
    snapshotSlot = again.slot;
    run = await simulate(snapshot);
    verdict = judge(run.sim, basisOf(snapshot));
    if (verdict.kind === 'destination') throw new PurchaseRefused('presale-busy', verdict.detail);
  }
  if (verdict.kind === 'refuse') throw new PurchaseRefused(verdict.code, verdict.detail);
  const measured = verdict;

  // 6. Re-authentication (§3.4) and its challenge, bound to the intent digest (the kind, account, currency, amount, stage).
  const settings = await readSettings(ext);
  const decimals = currency === 'SOL' ? 9 : 6;
  const reasons = presaleReauthReasons({
    firstPurchase: snapshot.limits.firstPurchase,
    amount,
    balance: currency === 'SOL' ? solBefore : balances[currency].total,
    usdMicros: largerValue(usdMicros(amount, decimals, priceOf(prices, currency) ?? undefined), measured.spentCents * 10_000n),
    thresholdCents: settings.reauthUsdCents,
  });
  const digest = intentDigest(PRESALE_BUY_INTENT, account, intent);
  const view = {
    currency,
    amount: intent.amount,
    stage: intent.stage,
    priceTicks: snapshot.stage.priceTicks.toString(),
    nocBase: measured.nocBase.toString(),
    spentCents: measured.spentCents.toString(),
    destination,
    referrer: snapshot.allocation.referrer === null ? null : {address: snapshot.allocation.referrer, registers: false},
    fees: {networkLamports: networkLamports.toString(), priorityLamports: priorityLamports.toString(), rentLamports: measured.rent.toString()},
  };
  let challengeId: string | null = null;
  if (reasons.length > 0) {
    const about: PurchaseAbout = {
      kind: PRESALE_BUY_KIND,
      account,
      currency,
      amount: intent.amount,
      stage: intent.stage,
      priceTicks: view.priceTicks,
      nocBase: view.nocBase,
      spentCents: view.spentCents,
      destination,
      networkLamports: view.fees.networkLamports,
      priorityLamports: view.fees.priorityLamports,
      rentLamports: view.fees.rentLamports,
      reasons,
      thresholdCents: settings.reauthUsdCents,
    };
    const fresh = about as unknown as KindAbout;
    const carried = opts.challengeId;
    const renewed = carried !== undefined && (await rebaseKindChallenge(ext, deps.now(), carried, digest, fresh));
    challengeId = renewed ? (carried as string) : await issueChallenge(ext, deps, digest, fresh);
  }

  // 7. The prepared entry (B1b's shape, this kind), replacing every entry of the account.
  const simulation: PurchaseView['simulation'] = {slot: run.sim.slot, elapsedMs: run.elapsedMs, programs: ['compute-budget', 'presale'], instructionCount: message.compiledInstructions.length};
  const bound = {
    id: randomId(deps.randomBytes),
    account,
    kind: PRESALE_BUY_KIND,
    intent,
    message: base64.encode(message.serialize()),
    lastValidBlockHeight: latest.lastValidBlockHeight,
    createdAt: deps.now(),
    intentDigest: digest,
    challengeId,
  };
  const prepared: PreparedPurchase = {
    ...bound,
    kind: PRESALE_BUY_KIND,
    integrity: preparedIntegrity(bound),
    shown: {
      fees: {networkLamports: view.fees.networkLamports, markupLamports: '0'},
      simulation,
      view: {...view, reasons},
      basis: {allocationExists: snapshot.allocation.exists, purchaseCount: snapshot.allocation.purchaseCount, referrer: snapshot.allocation.referrer, userAccountExists: snapshot.userAccountExists},
    },
  };
  await storePrepared(ext, deps, prepared);
  const proven = challengeId !== null && (await challengeSatisfied(ext, deps.now(), challengeId, digest));
  return {
    id: prepared.id,
    ...view,
    reauth: challengeId === null ? null : {challengeId, reasons, proven},
    validUntil: prepared.createdAt + PREPARED_TTL_MS,
    simulation,
  };
}

/** presale.preparedFor (§1.4, §4.2): the account's prepared purchase as prepare showed it, with `expired` as B1b's wallet.preparedFor. */
export type ResumablePurchase = PurchaseView & {expired: boolean};

/**
 * The resume of §4.2 (review M5): a popup closed during #10 reopens on #20 for this entry. Reported while its challenge
 * can live (CHALLENGE_TTL_MS from its prepare); `expired` — no longer signable, prepare again carrying the challenge id —
 * past PREPARED_TTL_MS or once its challenge is gone (B1b's plan-3 review M1). `proven`: the vault page proved it and it
 * is still live for this intent. An entry whose facts do not read back is not resumed.
 */
export async function purchasePreparedFor(ext: Ext, deps: Pick<WalletDeps, 'now'>, account: string): Promise<ResumablePurchase | null> {
  const now = deps.now();
  const entry = await newestPrepared(ext, now, account, PRESALE_BUY_KIND);
  const intent = entry === null ? null : parsePurchaseIntent(entry.intent);
  const shown = entry === null || intent === null ? null : shownOf(entry, intent);
  if (entry === null || intent === null || shown === null) return null;
  const {reasons, ...view} = shown.view;
  const id = entry.challengeId;
  const proven = id !== null && (await challengeSatisfied(ext, now, id, intentDigest(PRESALE_BUY_INTENT, entry.account, intent)));
  const dead = id !== null && (await challengeInfo(ext, now, id)) === null;
  return {
    id: entry.id,
    ...view,
    reauth: id === null ? null : {challengeId: id, reasons, proven},
    validUntil: entry.createdAt + PREPARED_TTL_MS,
    simulation: shown.simulation,
    expired: dead || now - entry.createdAt >= PREPARED_TTL_MS,
  };
}
