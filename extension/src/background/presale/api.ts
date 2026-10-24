import type {Ext} from '../../ext';
import type {WalletDeps} from '../deps';
import type {GeoAnswer} from '../geo/gate';
import type {PresaleHost} from '../presaleHost';
import type {Result} from '../walletApi';
import {getSession} from '../session';
import {isAddress} from '../prepare';
import {isOpen, readPending, viewOf, type PendingView} from '../pendingStore';
import {usdMicros} from '../reauthPolicy';
import {readPresaleConfig, readPresaleState, type PresaleSnapshot, type PresaleState, type StageFacts, type UnavailableCode} from './state';
import {PRESALE_CURRENCIES, quote, type PresaleBalances, type PresaleCurrency, type QuoteLine} from './quote';
import {PRESALE_BUY_KIND, PurchaseRefused, gateAnswer, parsePurchaseIntent, preparePurchase} from './buy';
import {CHALLENGE_ID} from '../reauthChallenges';
import {SendRefused} from '../sendTypes';
import {MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../core/presale/addresses';
import {SPL_TOKEN_PROGRAM} from '../../../../core/solana/encoding';
import {RpcForbidden, type SolanaReader} from '../../../../core/solana/rpc';

/**
 * B1d §1.1, §1.2, §1.4: the background's presale entry — the one module of `presale/` that shared code imports (index.ts
 * calls `registerPresale`, messages.ts adds `PRESALE_MESSAGE_TYPES` to the privileged partition, for the popup and the
 * full tab only). The build without presale resolves it to `src/presale-off/background.ts`. Every payload is untrusted
 * and parsed strictly (C3); the background alone decides — the popup renders what these answer.
 */
export const PRESALE_MESSAGE_TYPES: readonly string[] = ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy'];

/** `presale.quote` answers from the last view's snapshot of the account at most this old (§1.4). */
const QUOTE_MAX_AGE_MS = 30_000;
/** `presale.banner` answers from the last config snapshot at most this old, else reads the config (§1.4). */
const BANNER_MAX_AGE_MS = 60_000;

/** §2.5. Every amount is a decimal string of a bigint; `stage` is the program's 0-indexed `current_stage`. */
export interface StageView {
  stage: number;
  priceTicks: string;
  nextPriceTicks: string | null;
  stageSoldBase: string;
  stageCapBase: string;
  raisedCents: string;
}
export interface LimitsView {
  minCents: string;
  maxTxCents: string;
  userRemainingCents: string;
  firstPurchase: boolean;
}
export interface AllocationView {
  exists: boolean;
  totalBase: string;
  bonusBase: string;
}
export interface BalancesView {
  SOL: string;
  USDC: {largest: string; total: string};
  USDT: {largest: string; total: string};
}
/**
 * §2.5 — `referral` joins the open variant in B1d-2. `pending` is in every variant (C30). The open variant carries the
 * country the gate detected, or null when it named none (D22: #50b's open variant shows it).
 */
export type PresaleView =
  | {open: false; why: 'unavailable'; code: UnavailableCode; pending: PendingView | null}
  | {open: false; why: 'inactive' | 'blocked'; state: StageView; pending: PendingView | null}
  | {open: false; why: 'geo'; geo: GeoAnswer; state: StageView | null; pending: PendingView | null}
  | {open: true; state: StageView; limits: LimitsView; allocation: AllocationView; balances: BalancesView; solUsdMicros: string | null; countryCode: string | null; pending: PendingView | null};
/** §3.2. `cents` and `nocBase` are null only with `line: 'no-sol-price'`. */
export interface Quote {
  amount: string;
  cents: string | null;
  nocBase: string | null;
  line: QuoteLine | null;
}
/** §1.4, §4.5: #11's banner. */
export interface BannerView {
  stage: number;
  priceTicks: string;
  stagePercent: number;
}

const MALFORMED: Result = {ok: false, error: 'malformed'};
const AMOUNT = /^[1-9]\d{0,19}$/;
const MAX_U64 = 2n ** 64n - 1n;
const LAMPORTS_PER_SOL = 1_000_000_000n;

/** What the last open view of an account saw (per background instance): its snapshot from `at`, its balances and price. */
interface Seen {
  at: number;
  snapshot: PresaleSnapshot;
  balances: PresaleBalances;
  solUsd: number | null;
}
const views = new WeakMap<WalletDeps, Map<string, Seen>>();
/** The last config read of a background instance, from a view or the banner's own read. */
const configs = new WeakMap<WalletDeps, {at: number; active: boolean; stage: StageFacts}>();

function seenOf(deps: WalletDeps): Map<string, Seen> {
  let m = views.get(deps);
  if (m === undefined) {
    m = new Map();
    views.set(deps, m);
  }
  return m;
}

const fresh = (at: number, now: number, maxAge: number): boolean => now >= at && now - at <= maxAge;
const onlyKeys = (msg: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean => Object.keys(msg).every(k => keys.includes(k));
const isCurrency = (x: unknown): x is PresaleCurrency => typeof x === 'string' && (PRESALE_CURRENCIES as readonly string[]).includes(x);

function parseAmount(x: unknown): bigint | 'max' | null {
  if (x === 'max') return 'max';
  if (typeof x !== 'string' || !AMOUNT.test(x)) return null;
  const v = BigInt(x);
  return v <= MAX_U64 ? v : null;
}

/** `locked` or `unknown-account`, or null when the account is in the unlocked session. */
async function sessionRefusal(ext: Ext, account: string): Promise<Result | null> {
  const session = await getSession(ext);
  if (session === null) return {ok: false, error: 'locked'};
  return session.some(a => a.publicKey === account) ? null : {ok: false, error: 'unknown-account'};
}

/** C30: the account's open purchase, from v1_pending — no network. */
async function openPurchase(ext: Ext, account: string): Promise<PendingView | null> {
  const r = (await readPending(ext)).find(x => x.account === account && x.origin === null && isOpen(x) && x.extra?.kind === PRESALE_BUY_KIND);
  return r === undefined ? null : viewOf(r);
}

/** SOL, and each stablecoin's largest holding account and total, of `account` — two reads. Another owner's entry counts for nothing. */
async function readBalances(reader: SolanaReader, account: string): Promise<PresaleBalances> {
  const [sol, holdings] = await Promise.all([reader.getBalance(account), reader.getTokenAccountsByOwner(account, {programId: SPL_TOKEN_PROGRAM})]);
  const of = (mint: string) => {
    let largest = 0n;
    let total = 0n;
    for (const h of holdings) {
      if (h.mint !== mint || h.owner !== account) continue;
      total += h.amount;
      if (h.amount > largest) largest = h.amount;
    }
    return {largest, total};
  };
  return {SOL: sol, USDC: of(MAINNET_USDC_MINT), USDT: of(MAINNET_USDT_MINT)};
}

/** USD per SOL from /wallet/prices, or null (C8: never an invented price). A 403 is never swallowed. */
async function solPrice(deps: WalletDeps): Promise<number | null> {
  try {
    const p = (await deps.prices()).solana;
    return typeof p === 'number' && Number.isFinite(p) && p > 0 ? p : null;
  } catch (e) {
    if (e instanceof RpcForbidden) throw e;
    return null;
  }
}

function stageView(s: StageFacts): StageView {
  return {
    stage: s.stage,
    priceTicks: s.priceTicks.toString(),
    nextPriceTicks: s.nextPriceTicks === null ? null : s.nextPriceTicks.toString(),
    stageSoldBase: s.stageSoldBase.toString(),
    stageCapBase: s.stageCapBase.toString(),
    raisedCents: s.raisedCents.toString(),
  };
}

function balancesView(b: PresaleBalances): BalancesView {
  return {
    SOL: b.SOL.toString(),
    USDC: {largest: b.USDC.largest.toString(), total: b.USDC.total.toString()},
    USDT: {largest: b.USDT.largest.toString(), total: b.USDT.total.toString()},
  };
}

/** The stage a state read carries, if it read one. */
const stageOf = (s: PresaleState): StageFacts | null => (s.kind === 'open' ? s.snapshot.stage : s.kind === 'unavailable' ? null : s.stage);

/** A view's state read is also the banner's config snapshot; a failed one drops it. */
function rememberConfig(deps: WalletDeps, at: number, s: PresaleState): void {
  const stage = stageOf(s);
  if (stage === null) configs.delete(deps);
  else configs.set(deps, {at, active: s.kind !== 'inactive', stage});
}

/**
 * presale.view {account, refresh?: 'gate'} (§1.4, C12, C30, C35): the open record first, then a fresh state read and a
 * fresh gate answer, then — only when both are open — the balances and the SOL price. With `refresh: 'gate'` the
 * balances and price are the last full view's, when there is one. The gate closed decides first (the stage alongside,
 * when it was read); then an unavailable, inactive or blocked state. A view that is not open forgets the account's
 * snapshot, so no quote is made from it.
 */
async function view(ext: Ext, deps: WalletDeps, msg: Readonly<Record<string, unknown>>): Promise<Result> {
  if (!onlyKeys(msg, ['type', 'account', 'refresh'])) return MALFORMED;
  const {account, refresh} = msg;
  if (!isAddress(account) || (refresh !== undefined && refresh !== 'gate')) return MALFORMED;
  const refused = await sessionRefusal(ext, account);
  if (refused !== null) return refused;
  const pending = await openPurchase(ext, account);
  const seen = seenOf(deps);
  const last = refresh === 'gate' ? seen.get(account) : undefined;
  // The snapshot's age is measured from the read's start.
  const at = deps.now();
  const [state, geo] = await Promise.all([readPresaleState(deps.reader, account, at), gateAnswer(deps)]);
  rememberConfig(deps, at, state);
  const closed = (v: PresaleView): Result => {
    seen.delete(account);
    return {ok: true, data: v};
  };
  if (!geo.open) {
    const s = stageOf(state);
    return closed({open: false, why: 'geo', geo, state: s === null ? null : stageView(s), pending});
  }
  if (state.kind === 'unavailable') return closed({open: false, why: 'unavailable', code: state.code, pending});
  if (state.kind !== 'open') return closed({open: false, why: state.kind, state: stageView(state.stage), pending});
  let balances: PresaleBalances;
  let solUsd: number | null;
  if (last !== undefined) ({balances, solUsd} = last);
  else {
    try {
      [balances, solUsd] = await Promise.all([readBalances(deps.reader, account), solPrice(deps)]);
    } catch (e) {
      return closed({open: false, why: 'unavailable', code: e instanceof RpcForbidden ? 'refused' : 'read-failed', pending});
    }
  }
  const snapshot = state.snapshot;
  seen.set(account, {at, snapshot, balances, solUsd});
  const micros = solUsd === null ? null : usdMicros(LAMPORTS_PER_SOL, 9, solUsd);
  return {
    ok: true,
    data: {
      open: true,
      state: stageView(snapshot.stage),
      limits: {
        minCents: snapshot.limits.minCents.toString(),
        maxTxCents: snapshot.limits.maxTxCents.toString(),
        userRemainingCents: snapshot.limits.userRemainingCents.toString(),
        firstPurchase: snapshot.limits.firstPurchase,
      },
      allocation: {exists: snapshot.allocation.exists, totalBase: snapshot.allocation.totalBase.toString(), bonusBase: snapshot.allocation.bonusBase.toString()},
      balances: balancesView(balances),
      solUsdMicros: micros === null ? null : micros.toString(),
      countryCode: geo.countryCode,
      pending,
    } satisfies PresaleView,
  };
}

/** presale.quote {account, currency, amount} (§1.4, §3.2): from the account's last view snapshot ≤ 30 s old; no network. */
async function quoteMessage(ext: Ext, deps: WalletDeps, msg: Readonly<Record<string, unknown>>): Promise<Result> {
  if (!onlyKeys(msg, ['type', 'account', 'currency', 'amount'])) return MALFORMED;
  const {account, currency} = msg;
  const amount = parseAmount(msg.amount);
  if (!isAddress(account) || !isCurrency(currency) || amount === null) return MALFORMED;
  const refused = await sessionRefusal(ext, account);
  if (refused !== null) return refused;
  const last = seenOf(deps).get(account);
  if (last === undefined || !fresh(last.at, deps.now(), QUOTE_MAX_AGE_MS)) return {ok: true, data: {stale: true}};
  const q = quote({snapshot: last.snapshot, balances: last.balances, solUsd: last.solUsd}, currency, amount);
  const data: Quote = {amount: q.amount.toString(), cents: q.cents === null ? null : q.cents.toString(), nocBase: q.nocBase === null ? null : q.nocBase.toString(), line: q.line};
  return {ok: true, data};
}

/** presale.banner {} (§1.4, §4.5): the last config snapshot ≤ 60 s old, else one config-only read; no gate; null when not live. */
async function banner(ext: Ext, deps: WalletDeps, msg: Readonly<Record<string, unknown>>): Promise<Result> {
  if (!onlyKeys(msg, ['type'])) return MALFORMED;
  if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};
  const at = deps.now();
  let c = configs.get(deps);
  if (c === undefined || !fresh(c.at, at, BANNER_MAX_AGE_MS)) {
    const read = await readPresaleConfig(deps.reader, at);
    if (read.kind === 'unavailable') configs.delete(deps);
    else configs.set(deps, {at, active: read.kind === 'active', stage: read.stage});
    c = configs.get(deps);
  }
  if (c === undefined || !c.active) return {ok: true, data: null};
  const data: BannerView = {stage: c.stage.stage, priceTicks: c.stage.priceTicks.toString(), stagePercent: Number((100n * c.stage.stageSoldBase) / c.stage.stageCapBase)};
  return {ok: true, data};
}

/**
 * presale.prepareBuy {account, intent: {currency, amount, stage}, challengeId?} (§1.4, §3.3): a PurchaseView, or the
 * refusal's code (§5) with its detail. Nothing is signed.
 */
async function prepareBuy(ext: Ext, deps: WalletDeps, msg: Readonly<Record<string, unknown>>): Promise<Result> {
  if (!onlyKeys(msg, ['type', 'account', 'intent', 'challengeId'])) return MALFORMED;
  const {account, challengeId} = msg;
  const intent = parsePurchaseIntent(msg.intent);
  if (!isAddress(account) || intent === null || (challengeId !== undefined && (typeof challengeId !== 'string' || !CHALLENGE_ID.test(challengeId)))) return MALFORMED;
  const refused = await sessionRefusal(ext, account);
  if (refused !== null) return refused;
  try {
    return {ok: true, data: await preparePurchase(ext, deps, account, intent, challengeId === undefined ? {} : {challengeId})};
  } catch (e) {
    if (e instanceof PurchaseRefused || e instanceof SendRefused) return e.detail === '' ? {ok: false, error: e.code} : {ok: false, error: e.code, data: {detail: e.detail}};
    throw e;
  }
}

/** A handler's unexpected failure (a storage error) is `failed`, never a thrown error across the message boundary. */
const guarded =
  (h: (ext: Ext, deps: WalletDeps, msg: Readonly<Record<string, unknown>>) => Promise<Result>) =>
  async (ext: Ext, deps: WalletDeps, msg: Readonly<Record<string, unknown>>): Promise<Result> => {
    try {
      return await h(ext, deps, msg);
    } catch {
      return {ok: false, error: 'failed'};
    }
  };

export function registerPresale(host: PresaleHost): void {
  host.handle('presale.view', guarded(view));
  host.handle('presale.banner', guarded(banner));
  host.handle('presale.quote', guarded(quoteMessage));
  host.handle('presale.prepareBuy', guarded(prepareBuy));
}
