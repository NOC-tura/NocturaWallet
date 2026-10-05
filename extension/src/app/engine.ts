import {send as runtimeSend} from '../ui/send';

/**
 * The popup's and the tab's one way to the background (spec B1b-2a §1.5): one typed function per
 * engine message. Every reply is shape-checked before a screen sees it — numbers are numbers,
 * base-unit amounts match ^\d+$ and become bigint, addresses are base58, enums are known — and a
 * reply of any other shape is `failed`. A thrown sendMessage (the service worker restarting) is
 * retried once after 300 ms, then `failed`. No screen ever handles a raw reply.
 */

export type Token = 'SOL' | 'NOC' | 'USDC' | 'USDT';
export type Reply<T, C extends string> = {ok: true; data: T} | {ok: false; error: C | 'failed'; data?: unknown};

export interface Account {
  index: number;
  name: string;
  publicKey: string;
}
export interface WalletState {
  hasWallet: boolean;
  unlocked: boolean;
  scheme: 'slip10' | 'cli' | null;
  accounts: Account[];
  selected: number | null;
}
export interface Balances {
  sol: bigint;
  noc: bigint;
  usdc: bigint;
  usdt: bigint;
}
export interface Prices {
  sol: number | null;
  usdc: number | null;
  usdt: number | null;
  noc: number | null;
  at: number;
}
export interface Cached {
  balances: (Balances & {at: number}) | null;
  prices: Prices | null;
}
export type FeeReason = 'pre-tge' | 'zero-fee-eligible' | 'status-unknown' | 'charged';
export type ReauthReason = 'first-send' | 'over-5-percent' | 'over-usd-threshold' | 'whole-balance-to-new';
export interface Intent {
  token: Token;
  recipient: string;
  amount: bigint;
}
export interface Simulation {
  slot: number;
  elapsedMs: number;
  instructions: number;
  programs: ('compute-budget' | 'system' | 'token' | 'associated-token')[];
  recipient: 'wallet' | 'new' | 'program' | 'other';
  sol: {before: bigint; after: bigint};
  token: {symbol: 'NOC' | 'USDC' | 'USDT'; before: bigint; after: bigint} | null;
}
export interface Prepared {
  id: string;
  fees: {networkLamports: bigint; priorityLamports: bigint; rentLamports: bigint; markupLamports: bigint; markupReason: FeeReason};
  solRequiredLamports: bigint;
  /** `proven`: the vault page proved this challenge and it is live — a tap on #20 may send now (the engine still checks). */
  reauth: {challengeId: string; reasons: ReauthReason[]; proven: boolean} | null;
  /** Epoch ms after which this prepared send is no longer sendable: #20's "Quote valid N s". */
  validUntil: number;
  simulation: Simulation;
}
export type Resumable = Prepared & {intent: Intent; expired: boolean};
export type PendingState = 'pending' | 'stuck' | 'confirmed' | 'failed' | 'expired';
export type DetailCode = 'forbidden' | 'cooling' | 'unacked' | 'substituted';
export interface Pending {
  id: string;
  account: string;
  signature: string;
  lastValidBlockHeight: number;
  createdAt: number;
  lastSentAt: number;
  state: PendingState;
  detail: string | null;
  /** What `detail` says about the last broadcast, as a code (background DetailCode): screens choose on this, never on the text. */
  detailCode: DetailCode | null;
  intent: Intent;
  expiryNullSeenAt: number | null;
  failure: 'landed' | 'not-sent' | null;
  /**
   * What it pays, in two parts, lamports: the network fee and the Noctura fee (0 when none is charged). Null
   * for a record from before plan 3. Shown only through feePaidLamports, never summed by a screen.
   */
  fee: {networkLamports: bigint; markupLamports: bigint} | null;
}
export type HistoryKind = 'sent' | 'received' | 'purchase' | 'other';
export interface HistoryItem {
  signature: string;
  blockTime: number | null;
  kind: HistoryKind;
  token: Token | null;
  mint: string | null;
  amount: bigint | null;
  counterparty: string | null;
  feeLamports: bigint;
  failed: boolean;
}
/**
 * `next` is the cursor for the next `history()` call (the getSignaturesForAddress page's own last
 * signature, review fix round 1 #1) — not derivable from `items.length` or the last item's signature,
 * because a signature not yet indexed is dropped from `items` without shrinking the underlying page.
 * `null` means there is no further page.
 */
export interface HistoryPage {
  items: HistoryItem[];
  next: string | null;
}
export interface Settings {
  autoLockMinutes: number;
  reauthUsdCents: number;
  selectedAccount: number;
}
export interface RecipientInfo {
  known: boolean;
  lastSentAt: number | null;
  label: {kind: 'own'; index: number; name: string} | {kind: 'treasury'} | null;
  self: boolean;
}

type Network = 'unreachable' | 'coordinator-refused';
type SendRefusal =
  | 'locked'
  | 'unknown-account'
  | 'self-send'
  | 'in-flight'
  | 'split-balance'
  | 'insufficient-token'
  | 'insufficient-sol'
  | 'simulation-failed'
  | 'simulation-mismatch'
  | 'sender-below-rent'
  | 'recipient-below-rent'
  | 'malformed'
  | Network;

export interface Engine {
  state(): Promise<Reply<WalletState, never>>;
  balances(account: string): Promise<Reply<Balances, 'malformed' | Network>>;
  prices(): Promise<Reply<Prices, Network>>;
  cached(account: string): Promise<Reply<Cached, 'malformed' | 'locked'>>;
  prepareSend(account: string, intent: Intent, challengeId?: string): Promise<Reply<Prepared, SendRefusal>>;
  preparedFor(account: string): Promise<Reply<Resumable | null, 'malformed'>>;
  send(id: string): Promise<Reply<Pending, 'malformed' | 'locked' | 'unknown-account' | 'unknown-prepared' | 'prepared-expired' | 'prepared-invalid' | 'reauth-required' | 'in-flight' | 'check-pending' | Network>>;
  resend(id: string): Promise<Reply<Pending, 'malformed' | 'unknown' | 'not-open' | 'too-soon' | Network>>;
  pending(): Promise<Reply<Pending[], never>>;
  history(account: string, before?: string): Promise<Reply<HistoryPage, 'malformed' | Network>>;
  recipientInfo(account: string, recipient: string): Promise<Reply<RecipientInfo, 'malformed' | 'locked'>>;
  discardPrepared(account: string): Promise<Reply<null, 'malformed'>>;
  rename(index: number, name: string): Promise<Reply<null, 'malformed' | 'unknown-account' | 'busy'>>;
  select(index: number): Promise<Reply<null, 'malformed' | 'unknown-account'>>;
  settings(): Promise<Reply<Settings, never>>;
  lock(): Promise<Reply<null, never>>;
  ping(): Promise<Reply<null, never>>;
}

// ── Shape checks ──────────────────────────────────────────────────────────────────────────────
// Each returns the typed value or undefined (→ 'failed'). A value that passes is rebuilt field by
// field, so nothing the background did not promise reaches a screen.

type J = Record<string, unknown>;
const obj = (x: unknown): J | undefined => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as J) : undefined);
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
const HEX32 = /^[0-9a-f]{32}$/;
const UNITS = /^\d{1,20}$/;
const TOKENS: readonly string[] = ['SOL', 'NOC', 'USDC', 'USDT'];
const isAddress = (x: unknown): x is string => typeof x === 'string' && ADDRESS.test(x);
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const isTime = isInt;
const isToken = (x: unknown): x is Token => typeof x === 'string' && TOKENS.includes(x);
const units = (x: unknown): bigint | undefined => (typeof x === 'string' && UNITS.test(x) ? BigInt(x) : undefined);
const price = (x: unknown): number | null | undefined => (x === null ? null : typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : undefined);
const oneOf = <T extends string>(x: unknown, values: readonly T[]): T | undefined => (typeof x === 'string' && (values as readonly string[]).includes(x) ? (x as T) : undefined);
function all<T>(xs: unknown, each: (x: unknown) => T | undefined): T[] | undefined {
  if (!Array.isArray(xs)) return undefined;
  const out: T[] = [];
  for (const x of xs as unknown[]) {
    const v = each(x);
    if (v === undefined) return undefined;
    out.push(v);
  }
  return out;
}

function account(x: unknown): Account | undefined {
  const o = obj(x);
  if (o === undefined || !isInt(o.index) || typeof o.name !== 'string' || !isAddress(o.publicKey)) return undefined;
  return {index: o.index, name: o.name, publicKey: o.publicKey};
}

export function walletStateOf(x: unknown): WalletState | undefined {
  const o = obj(x);
  if (o === undefined || typeof o.hasWallet !== 'boolean' || typeof o.unlocked !== 'boolean') return undefined;
  const scheme = o.scheme === null ? null : oneOf(o.scheme, ['slip10', 'cli'] as const);
  const accounts = all(o.accounts, account);
  const selected = o.selected === null ? null : isInt(o.selected) ? o.selected : undefined;
  if (scheme === undefined || accounts === undefined || selected === undefined) return undefined;
  return {hasWallet: o.hasWallet, unlocked: o.unlocked, scheme, accounts, selected};
}

function balancesOf(x: unknown): Balances | undefined {
  const o = obj(x);
  if (o === undefined) return undefined;
  const [sol, noc, usdc, usdt] = [units(o.sol), units(o.noc), units(o.usdc), units(o.usdt)];
  if (sol === undefined || noc === undefined || usdc === undefined || usdt === undefined) return undefined;
  return {sol, noc, usdc, usdt};
}

function pricesOf(x: unknown): Prices | undefined {
  const o = obj(x);
  if (o === undefined) return undefined;
  const [sol, usdc, usdt, noc] = [price(o.sol), price(o.usdc), price(o.usdt), price(o.noc)];
  if (sol === undefined || usdc === undefined || usdt === undefined || noc === undefined || !isTime(o.at)) return undefined;
  return {sol, usdc, usdt, noc, at: o.at};
}

function cachedOf(x: unknown): Cached | undefined {
  const o = obj(x);
  if (o === undefined) return undefined;
  let balances: Cached['balances'] = null;
  if (o.balances !== null) {
    const b = balancesOf(o.balances);
    const at = obj(o.balances)?.at;
    if (b === undefined || !isTime(at)) return undefined;
    balances = {...b, at};
  }
  const prices = o.prices === null ? null : pricesOf(o.prices);
  if (prices === undefined) return undefined;
  return {balances, prices};
}

function intentOf(x: unknown): Intent | undefined {
  const o = obj(x);
  const amount = units(o?.amount);
  if (o === undefined || !isToken(o.token) || !isAddress(o.recipient) || amount === undefined) return undefined;
  return {token: o.token, recipient: o.recipient, amount};
}

const PROGRAMS = ['compute-budget', 'system', 'token', 'associated-token'] as const;
function simulationOf(x: unknown): Simulation | undefined {
  const o = obj(x);
  if (o === undefined || !isInt(o.slot) || !isInt(o.elapsedMs) || !isInt(o.instructions)) return undefined;
  const programs = all(o.programs, p => oneOf(p, PROGRAMS));
  const recipient = oneOf(o.recipient, ['wallet', 'new', 'program', 'other'] as const);
  const sol = obj(o.sol);
  const [before, after] = [units(sol?.before), units(sol?.after)];
  if (programs === undefined || recipient === undefined || before === undefined || after === undefined) return undefined;
  let token: Simulation['token'] = null;
  if (o.token !== null) {
    const t = obj(o.token);
    const symbol = oneOf(t?.symbol, ['NOC', 'USDC', 'USDT'] as const);
    const [tb, ta] = [units(t?.before), units(t?.after)];
    if (symbol === undefined || tb === undefined || ta === undefined) return undefined;
    token = {symbol, before: tb, after: ta};
  }
  return {slot: o.slot, elapsedMs: o.elapsedMs, instructions: o.instructions, programs, recipient, sol: {before, after}, token};
}

const REASONS = ['first-send', 'over-5-percent', 'over-usd-threshold', 'whole-balance-to-new'] as const;
const FEE_REASONS = ['pre-tge', 'zero-fee-eligible', 'status-unknown', 'charged'] as const;
function preparedOf(x: unknown): Prepared | undefined {
  const o = obj(x);
  const f = obj(o?.fees);
  if (o === undefined || f === undefined || typeof o.id !== 'string' || !HEX32.test(o.id)) return undefined;
  const fees = {
    networkLamports: units(f.networkLamports),
    priorityLamports: units(f.priorityLamports),
    rentLamports: units(f.rentLamports),
    markupLamports: units(f.markupLamports),
    markupReason: oneOf(f.markupReason, FEE_REASONS),
  };
  const solRequiredLamports = units(o.solRequiredLamports);
  const simulation = simulationOf(o.simulation);
  let reauth: Prepared['reauth'] = null;
  if (o.reauth !== null) {
    const r = obj(o.reauth);
    const reasons = all(r?.reasons, v => oneOf(v, REASONS));
    if (r === undefined || typeof r.challengeId !== 'string' || !HEX32.test(r.challengeId) || reasons === undefined || typeof r.proven !== 'boolean') return undefined;
    reauth = {challengeId: r.challengeId, reasons, proven: r.proven};
  }
  if (Object.values(fees).some(v => v === undefined) || solRequiredLamports === undefined || simulation === undefined || !isTime(o.validUntil)) return undefined;
  return {id: o.id, fees: fees as Prepared['fees'], solRequiredLamports, reauth, validUntil: o.validUntil, simulation};
}

function resumableOf(x: unknown): Resumable | null | undefined {
  if (x === null) return null;
  const p = preparedOf(x);
  const o = obj(x);
  const intent = intentOf(o?.intent);
  if (p === undefined || intent === undefined || typeof o?.expired !== 'boolean') return undefined;
  return {...p, intent, expired: o.expired};
}

const STATES = ['pending', 'stuck', 'confirmed', 'failed', 'expired'] as const;
const DETAIL_CODES = ['forbidden', 'cooling', 'unacked', 'substituted'] as const;
function pendingOf(x: unknown): Pending | undefined {
  const o = obj(x);
  if (o === undefined || typeof o.id !== 'string' || !isAddress(o.account) || typeof o.signature !== 'string' || !SIGNATURE.test(o.signature)) return undefined;
  const state = oneOf(o.state, STATES);
  const intent = intentOf(o.intent);
  const failure = o.failure === null ? null : oneOf(o.failure, ['landed', 'not-sent'] as const);
  const expiry = o.expiryNullSeenAt === null ? null : isTime(o.expiryNullSeenAt) ? o.expiryNullSeenAt : undefined;
  const fee = feeOf(o.fee);
  const detailCode = o.detailCode === null ? null : oneOf(o.detailCode, DETAIL_CODES);
  if (state === undefined || intent === undefined || failure === undefined || expiry === undefined || fee === undefined || detailCode === undefined) return undefined;
  if (!isInt(o.lastValidBlockHeight) || !isTime(o.createdAt) || !isTime(o.lastSentAt) || !(o.detail === null || typeof o.detail === 'string')) return undefined;
  return {
    id: o.id,
    account: o.account,
    signature: o.signature,
    lastValidBlockHeight: o.lastValidBlockHeight,
    createdAt: o.createdAt,
    lastSentAt: o.lastSentAt,
    state,
    detail: o.detail,
    detailCode,
    intent,
    expiryNullSeenAt: expiry,
    failure,
    fee,
  };
}

/** `null`, or exactly two base-unit strings; a missing field or any other value is undefined (failed). */
function feeOf(x: unknown): Pending['fee'] | undefined {
  if (x === null) return null;
  const f = obj(x);
  const networkLamports = units(f?.networkLamports);
  const markupLamports = units(f?.markupLamports);
  if (networkLamports === undefined || markupLamports === undefined) return undefined;
  return {networkLamports, markupLamports};
}

/**
 * What a pending send has paid, by its state (spec §4.5, "Fee paid" display rule; plan 3 follow-up ruling):
 * `confirmed` → network fee + Noctura fee; `failed` with `failure: 'landed'` → the network fee only (the
 * transaction was included, so its fee was paid, but its markup transfer was rolled back with it);
 * `not-sent`, `expired`, a `failed` record from an older build (`failure: null`), and anything not yet
 * settled → null: nothing is claimed as paid. Null too for a record without a fee.
 */
export function feePaidLamports(p: Pick<Pending, 'state' | 'failure' | 'fee'>): bigint | null {
  if (p.fee === null) return null;
  if (p.state === 'confirmed') return p.fee.networkLamports + p.fee.markupLamports;
  if (p.state === 'failed' && p.failure === 'landed') return p.fee.networkLamports;
  return null;
}

function historyOf(x: unknown): HistoryItem | undefined {
  const o = obj(x);
  if (o === undefined || typeof o.signature !== 'string' || !SIGNATURE.test(o.signature)) return undefined;
  const kind = oneOf(o.kind, ['sent', 'received', 'purchase', 'other'] as const);
  const token = o.token === null ? null : isToken(o.token) ? o.token : undefined;
  const amount = o.amount === null ? null : units(o.amount);
  const feeLamports = units(o.feeLamports);
  const blockTime = o.blockTime === null ? null : isInt(o.blockTime) ? o.blockTime : undefined;
  const mint = o.mint === null ? null : isAddress(o.mint) ? o.mint : undefined;
  const counterparty = o.counterparty === null ? null : isAddress(o.counterparty) ? o.counterparty : undefined;
  if (kind === undefined || token === undefined || amount === undefined || feeLamports === undefined || blockTime === undefined || mint === undefined || counterparty === undefined || typeof o.failed !== 'boolean') return undefined;
  return {signature: o.signature, blockTime, kind, token, mint, amount, counterparty, feeLamports, failed: o.failed};
}

/** `next`: null, or a string that passes the same signature check as an item's own `signature` (review fix round 1 #1). */
function historyPageOf(x: unknown): HistoryPage | undefined {
  const o = obj(x);
  if (o === undefined) return undefined;
  const items = all(o.items, historyOf);
  const next = o.next === null ? null : typeof o.next === 'string' && SIGNATURE.test(o.next) ? o.next : undefined;
  if (items === undefined || next === undefined) return undefined;
  return {items, next};
}

function settingsOf(x: unknown): Settings | undefined {
  const o = obj(x);
  if (o === undefined || !isInt(o.autoLockMinutes) || !isInt(o.reauthUsdCents) || !isInt(o.selectedAccount)) return undefined;
  return {autoLockMinutes: o.autoLockMinutes, reauthUsdCents: o.reauthUsdCents, selectedAccount: o.selectedAccount};
}

function recipientInfoOf(x: unknown): RecipientInfo | undefined {
  const o = obj(x);
  if (o === undefined || typeof o.known !== 'boolean' || typeof o.self !== 'boolean') return undefined;
  const lastSentAt = o.lastSentAt === null ? null : isTime(o.lastSentAt) ? o.lastSentAt : undefined;
  let label: RecipientInfo['label'] | undefined = null;
  if (o.label !== null) {
    const l = obj(o.label);
    if (l?.kind === 'treasury') label = {kind: 'treasury'};
    else if (l?.kind === 'own' && isInt(l.index) && typeof l.name === 'string') label = {kind: 'own', index: l.index, name: l.name};
    else label = undefined;
  }
  if (lastSentAt === undefined || label === undefined) return undefined;
  return {known: o.known, lastSentAt, label, self: o.self};
}

const nothing = (x: unknown): null | undefined => (x === undefined ? null : undefined);

// ── The transport ─────────────────────────────────────────────────────────────────────────────

export type Transport = (message: unknown) => Promise<unknown>;
export const RETRY_AFTER_MS = 300;

export function createEngine(transport: Transport = runtimeSend, sleep: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms))): Engine {
  /**
   * One retry is safe for every message, `wallet.send` included (review L5): a prepared id is single
   * use, so if the first attempt did reach the background, the retry answers `unknown-prepared`, and
   * the send screen's R2-M2 rule (spec §4.5) then looks in `wallet.pending` for the record the first
   * attempt wrote. Nothing is ever signed twice. Do not "fix" this by skipping the retry for sends.
   */
  async function ask(message: unknown): Promise<unknown> {
    try {
      return await transport(message);
    } catch {
      // The service worker was restarting: once more, then give up.
      await sleep(RETRY_AFTER_MS);
      return transport(message);
    }
  }

  async function call<T, C extends string>(message: J, codes: readonly C[], parse: (data: unknown) => T | undefined): Promise<Reply<T, C>> {
    let raw: unknown;
    try {
      raw = await ask(message);
    } catch {
      return {ok: false, error: 'failed'};
    }
    const r = obj(raw);
    if (r?.ok === true) {
      const data = parse(r.data);
      return data === undefined ? {ok: false, error: 'failed'} : {ok: true, data};
    }
    if (r?.ok === false && typeof r.error === 'string' && (codes as readonly string[]).includes(r.error)) {
      return r.data === undefined ? {ok: false, error: r.error as C} : {ok: false, error: r.error as C, data: r.data};
    }
    return {ok: false, error: 'failed'};
  }

  const NET = ['unreachable', 'coordinator-refused'] as const;
  const SEND_PREPARE = [
    'locked', 'unknown-account', 'self-send', 'in-flight', 'split-balance', 'insufficient-token', 'insufficient-sol', 'simulation-failed',
    'simulation-mismatch', 'sender-below-rent', 'recipient-below-rent', 'malformed', ...NET,
  ] as const;
  const SEND = ['malformed', 'locked', 'unknown-account', 'unknown-prepared', 'prepared-expired', 'prepared-invalid', 'reauth-required', 'in-flight', 'check-pending', ...NET] as const;
  const wire = (i: Intent) => ({token: i.token, recipient: i.recipient, amount: i.amount.toString()});

  return {
    state: () => call({type: 'wallet.state'}, [], walletStateOf),
    balances: account => call({type: 'wallet.balances', account}, ['malformed', ...NET], balancesOf),
    prices: () => call({type: 'wallet.prices'}, NET, pricesOf),
    cached: account => call({type: 'wallet.cached', account}, ['malformed', 'locked'], cachedOf),
    prepareSend: (account, intent, challengeId) =>
      call({type: 'wallet.prepareSend', account, intent: wire(intent), ...(challengeId === undefined ? {} : {challengeId})}, SEND_PREPARE, preparedOf),
    preparedFor: account => call({type: 'wallet.preparedFor', account}, ['malformed'], resumableOf),
    send: id => call({type: 'wallet.send', id}, SEND, pendingOf),
    resend: id => call({type: 'wallet.resend', id}, ['malformed', 'unknown', 'not-open', 'too-soon', ...NET], pendingOf),
    pending: () => call({type: 'wallet.pending'}, [], d => all(d, pendingOf)),
    history: (account, before) => call({type: 'wallet.history', account, ...(before === undefined ? {} : {before})}, ['malformed', ...NET], historyPageOf),
    recipientInfo: (account, recipient) => call({type: 'wallet.recipientInfo', account, recipient}, ['malformed', 'locked'], recipientInfoOf),
    discardPrepared: account => call({type: 'wallet.discardPrepared', account}, ['malformed'], nothing),
    rename: (index, name) => call({type: 'accounts.rename', index, name}, ['malformed', 'unknown-account', 'busy'], nothing),
    select: index => call({type: 'accounts.select', index}, ['malformed', 'unknown-account'], nothing),
    settings: () => call({type: 'settings.get'}, [], settingsOf),
    lock: () => call({type: 'vault.lock'}, [], nothing),
    ping: () => call({type: 'activity.ping'}, [], nothing),
  };
}
