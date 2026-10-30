import type {Ext} from '../../ext';
import {latchStore, type PostAnswer, type WalletDeps} from '../deps';
import type {KindHost} from '../intents';
import {isOpen, readPending, type PendingRecord} from '../pendingStore';
import {readWalletView} from '../accountsStore';
import {PENDING_ALARM_MINUTES} from '../pending';
import {PRESALE_RECORDS_KEY, presaleRecordsSection} from '../presaleRecordsKey';
import {PRESALE_CURRENCIES, type PresaleCurrency} from './quote';
import {STAGE_PRICE_TICKS} from '../../../../core/presale/limits';
import type {PresalePurchaseRecord} from '../../../../core/presale/record';
import {formatTokenAmount} from '../../../../core/util/parseTokenAmount';
import {RpcForbidden} from '../../../../core/solana/rpc';

/**
 * B1d §2.4 (C24, D28–D30): the coordinator record of each confirmed purchase — written when the poller sees a
 * `presale-buy` record reach `confirmed` (the kind's `onConfirmed`), POSTed at once and then retried on C24's schedule
 * until the coordinator accepts it, refuses it or 72 h have passed. The purchase stands on chain whatever happens here:
 * this decides nothing about it. The retry is harmless only because the coordinator records once by signature (P2a).
 */
export const PRESALE_RECORD_ALARM = 'presale-record';
/** The route, a bare path under API_BASE (which already ends in /api/v1). */
export const PRESALE_RECORD_PATH = '/solana/purchase';
export const MAX_PRESALE_RECORDS = 50;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** C24: when each attempt is due, from `confirmedAt` — at once, 1 min, 5 min, 30 min, 2 h, 12 h, then every 24 h to 72 h. */
export const PRESALE_RECORD_SLOTS_MS: readonly number[] = [0, MINUTE, 5 * MINUTE, 30 * MINUTE, 2 * HOUR, 12 * HOUR, 24 * HOUR, 48 * HOUR, 72 * HOUR];

/** `due` — owed an attempt at `nextAt`; `done` — accepted (D30); `refused` — the route's 400, final (D29); `given-up` — no slot left. */
export type PresaleRecordState = 'due' | 'done' | 'refused' | 'given-up';
const STATES: readonly PresaleRecordState[] = ['due', 'done', 'refused', 'given-up'];

/** D28: §2.4's payload — `paymentAmount` a decimal string in display units; `nocAmount` / `usdValue` numbers, made here only. */
export type PresaleRecordPayload = PresalePurchaseRecord & {paymentAmount: string};

export interface PresaleRecordEntry {
  signature: string;
  account: string;
  payload: PresaleRecordPayload;
  confirmedAt: number;
  attempts: number;
  nextAt: number;
  state: PresaleRecordState;
}

const DECIMALS: Record<PresaleCurrency, number> = {SOL: 9, USDC: 6, USDT: 6};
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
const POSITIVE = /^[1-9]\d{0,19}$/;
const DIGITS = /^\d{1,20}$/;
const DATA_KEYS = ['currency', 'amount', 'stage', 'priceTicks', 'nocBase', 'spentCents', 'destination', 'referrer'];
const ENTRY_KEYS = ['signature', 'account', 'payload', 'confirmedAt', 'attempts', 'nextAt', 'state'];
const PAYLOAD_KEYS = ['txHash', 'buyerAddress', 'paymentToken', 'paymentAmount', 'nocAmount', 'usdValue', 'stage'];

const objectOf = (x: unknown): Record<string, unknown> | null => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null);
const exactKeys = (o: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k));
const isCurrency = (x: unknown): x is PresaleCurrency => typeof x === 'string' && (PRESALE_CURRENCIES as readonly string[]).includes(x);
const isTime = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const isPositiveNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;

/**
 * §2.4 / D28: the payload of a confirmed purchase record, from its `extra.data` (§2.3) — read as a claim, exactly the
 * shape the kind writes — or null when it does not read back (nothing is recorded then). The amounts are the
 * simulation's (`nocBase`, `spentCents`); the coordinator stores what it derives from the chain and logs a disagreement.
 */
export function purchasePayload(record: PendingRecord): PresaleRecordPayload | null {
  if (record.extra?.kind !== 'presale-buy' || !SIGNATURE.test(record.signature) || !ADDRESS.test(record.account)) return null;
  const d = objectOf(record.extra.data);
  if (d === null || !exactKeys(d, DATA_KEYS)) return null;
  const {currency, amount, stage, priceTicks, nocBase, spentCents, destination, referrer} = d;
  if (!isCurrency(currency) || typeof amount !== 'string' || !POSITIVE.test(amount)) return null;
  if (typeof stage !== 'string' || !/^\d$/.test(stage) || Number(stage) >= STAGE_PRICE_TICKS.length) return null;
  if (typeof priceTicks !== 'string' || !DIGITS.test(priceTicks) || typeof nocBase !== 'string' || !POSITIVE.test(nocBase) || typeof spentCents !== 'string' || !POSITIVE.test(spentCents)) return null;
  if (typeof destination !== 'string' || !ADDRESS.test(destination) || (referrer !== null && (typeof referrer !== 'string' || !ADDRESS.test(referrer)))) return null;
  return {
    txHash: record.signature,
    buyerAddress: record.account,
    paymentToken: currency,
    paymentAmount: formatTokenAmount(BigInt(amount), DECIMALS[currency]),
    nocAmount: Number(formatTokenAmount(BigInt(nocBase), 9)),
    usdValue: Number(formatTokenAmount(BigInt(spentCents), 2)),
    // §2.3: the record keeps the program's 0-indexed stage; the route's is 1-indexed.
    stage: Number(stage) + 1,
    ...(referrer === null ? {} : {referrerAddress: referrer}),
  };
}

/** A stored payload, rebuilt key by key, or null. */
function storedPayload(x: unknown): PresaleRecordPayload | null {
  const p = objectOf(x);
  if (p === null) return null;
  const referred = Object.hasOwn(p, 'referrerAddress');
  if (!exactKeys(p, referred ? [...PAYLOAD_KEYS, 'referrerAddress'] : PAYLOAD_KEYS)) return null;
  const {txHash, buyerAddress, paymentToken, paymentAmount, nocAmount, usdValue, stage, referrerAddress} = p;
  if (typeof txHash !== 'string' || !SIGNATURE.test(txHash) || typeof buyerAddress !== 'string' || !ADDRESS.test(buyerAddress) || !isCurrency(paymentToken)) return null;
  if (typeof paymentAmount !== 'string' || !/^\d+(\.\d+)?$/.test(paymentAmount) || !isPositiveNumber(nocAmount) || !isPositiveNumber(usdValue)) return null;
  if (typeof stage !== 'number' || !Number.isInteger(stage) || stage < 1 || stage > STAGE_PRICE_TICKS.length) return null;
  if (referred && (typeof referrerAddress !== 'string' || !ADDRESS.test(referrerAddress))) return null;
  return {txHash, buyerAddress, paymentToken, paymentAmount, nocAmount, usdValue, stage, ...(referred ? {referrerAddress: referrerAddress as string} : {})};
}

/** A stored entry is a claim: exactly the shape written, its payload naming its own signature and account — or null. */
function entryOf(x: unknown): PresaleRecordEntry | null {
  const e = objectOf(x);
  if (e === null || !exactKeys(e, ENTRY_KEYS)) return null;
  const {signature, account, confirmedAt, attempts, nextAt, state} = e;
  const payload = storedPayload(e.payload);
  if (payload === null || signature !== payload.txHash || account !== payload.buyerAddress || typeof signature !== 'string' || typeof account !== 'string') return null;
  if (!isTime(confirmedAt) || !isTime(nextAt) || !isTime(attempts) || typeof state !== 'string' || !(STATES as readonly string[]).includes(state)) return null;
  return {signature, account, payload, confirmedAt, attempts, nextAt, state: state as PresaleRecordState};
}

/** Every entry that reads back, oldest first; anything else is dropped. Fresh objects. */
export async function readPresaleRecords(ext: Ext): Promise<PresaleRecordEntry[]> {
  const v = await ext.local.get(PRESALE_RECORDS_KEY);
  if (!Array.isArray(v)) return [];
  const out: PresaleRecordEntry[] = [];
  for (const x of v as unknown[]) {
    const e = entryOf(x);
    if (e !== null) out.push(e);
  }
  return out;
}

/**
 * What goes first when there are more than MAX_PRESALE_RECORDS: an accepted record (dropping it changes nothing shown),
 * then the oldest of the others in this order. A held entry (another wallet's) is no exception: it counts toward the 50
 * and goes by the same order.
 */
const DROP_ORDER: readonly PresaleRecordState[] = ['done', 'given-up', 'refused', 'due'];

/**
 * Final review Minor 1: an entry whose signature is still in v1_pending (`kept`) is never dropped, whatever its state —
 * the reconcile would write it again at the next wake (a confirmed purchase of the stored wallet with no entry) and POST
 * a purchase already settled: a `done` entry dropped for the next purchase's came back `due` and was POSTed at every
 * wake, the two dropping each other in turn. The next entry in the order goes instead (a held `due` one, as §2.4 lets
 * go). v1_pending keeps at most 20 closed records (MAX_RECORDS; open ones, never trimmed, can take it past 20), and an
 * entry is only ever a confirmed — closed — purchase's, so at most 20 entries are kept and over 50 there is always one to
 * drop.
 */
function trim(entries: PresaleRecordEntry[], kept: ReadonlySet<string>): PresaleRecordEntry[] {
  const out = [...entries];
  for (const state of DROP_ORDER) {
    while (out.length > MAX_PRESALE_RECORDS) {
      const i = out.findIndex(e => e.state === state && !kept.has(e.signature));
      if (i < 0) break;
      out.splice(i, 1);
    }
  }
  return out;
}

/**
 * The one way entries change: read, change, trim, write — inside the records' section (presaleRecordsKey.ts). A change
 * that returns the entries it was given writes nothing.
 */
async function updateRecords(ext: Ext, change: (entries: PresaleRecordEntry[]) => PresaleRecordEntry[]): Promise<void> {
  await presaleRecordsSection(async () => {
    const entries = await readPresaleRecords(ext);
    const changed = change(entries);
    if (changed === entries) return;
    const kept = changed.length > MAX_PRESALE_RECORDS ? new Set((await readPending(ext)).map(r => r.signature)) : new Set<string>();
    await ext.local.set(PRESALE_RECORDS_KEY, trim(changed, kept));
  });
}

/** The first slot after `now`, or null when none is left. */
export function slotAfter(confirmedAt: number, now: number): number | null {
  for (const s of PRESALE_RECORD_SLOTS_MS) if (confirmedAt + s > now) return confirmedAt + s;
  return null;
}

/**
 * The kind's `onConfirmed` (§1.3): the entry, once per signature, due at once — then the first attempt, not awaited (the
 * poller goes on). A record whose display data does not read back is not recorded.
 */
export async function recordConfirmedPurchase({ext, deps}: KindHost, record: PendingRecord): Promise<void> {
  const payload = purchasePayload(record);
  if (payload === null) return;
  const now = deps.now();
  const entry: PresaleRecordEntry = {signature: record.signature, account: record.account, payload, confirmedAt: now, attempts: 0, nextAt: now, state: 'due'};
  await updateRecords(ext, entries => (entries.some(e => e.signature === record.signature) ? entries : [...entries, entry]));
  void runPresaleRecords(ext, deps);
}

/** The last slot: a purchase confirmed longer ago than this has no attempt left. */
const LAST_SLOT_MS = PRESALE_RECORD_SLOTS_MS[PRESALE_RECORD_SLOTS_MS.length - 1] as number;

/**
 * Controller ruling (B1d-2 Task 1): what a worker stopped between the poller's `confirmed` write and the hook's entry left
 * unrecorded, written when the worker wakes (each start, the `presale-record` alarm) — every confirmed `presale-buy`
 * record in v1_pending of an account of the wallet stored now that has no entry gets the hook's entry. A record carries no
 * confirmation time, so `confirmedAt` is its `createdAt`: the signed bytes can land only within their blockhash's life
 * after it. One confirmed more than 72 h before now is written `given-up` and never POSTed.
 */
export async function reconcilePresaleRecords(ext: Ext, deps: WalletDeps): Promise<void> {
  const own = new Set((await readWalletView(ext))?.accounts.map(a => a.publicKey) ?? []);
  // Which of them is a purchase is purchasePayload's to say (only a `presale-buy` record's display data reads back).
  const confirmed = (await readPending(ext)).filter(r => r.state === 'confirmed' && own.has(r.account));
  if (confirmed.length === 0) return;
  const now = deps.now();
  await updateRecords(ext, entries => {
    const missing: PresaleRecordEntry[] = [];
    for (const r of confirmed) {
      const payload = purchasePayload(r);
      if (payload === null || entries.some(e => e.signature === r.signature) || missing.some(e => e.signature === r.signature)) continue;
      const late = now > r.createdAt + LAST_SLOT_MS;
      missing.push({signature: r.signature, account: r.account, payload, confirmedAt: r.createdAt, attempts: 0, nextAt: now, state: late ? 'given-up' : 'due'});
    }
    return missing.length === 0 ? entries : [...entries, ...missing];
  });
}

/** What the worker does when it wakes (§2.4 and the ruling above): reconcile, then send what is due. */
export async function wakePresaleRecords(ext: Ext, deps: WalletDeps): Promise<void> {
  await reconcilePresaleRecords(ext, deps);
  await runPresaleRecords(ext, deps);
}

/**
 * Review 1 I2 (rev 2): whom the worker POSTs for, and when. Only an entry of an account of the wallet stored now: another
 * account's entry (a replaced wallet's — a restore keeps the records, like the rest of WALLET_DATA_KEYS) is held — never
 * dropped for being another wallet's, but it counts toward the 50 and goes by trim's order like any other — and goes out
 * when that wallet is stored again. And nothing while a send or purchase of the stored wallet is
 * open (`pending` or `stuck`, a site's included): the shared latch serialises every coordinator request, so a POST the
 * route holds until REQUEST_TIMEOUT_MS would hold that transaction's reads behind it.
 */
async function postable(ext: Ext): Promise<{own: ReadonlySet<string>; open: boolean}> {
  const own = new Set((await readWalletView(ext))?.accounts.map(a => a.publicKey) ?? []);
  return {own, open: (await readPending(ext)).some(r => isOpen(r) && own.has(r.account))};
}

type Outcome = 'done' | 'refused' | 'forbidden' | 'retry';

/**
 * D29 / D30: `200 {success: true}` is done whatever else it says; a 400 that is the route's own refusal (`{success:
 * false, error}`) is final; anything else — a 400 without that body (a proxy's), 429, 5xx, no answer — is retried.
 */
function outcomeOf(a: PostAnswer): Outcome {
  const body = objectOf(a.body);
  if (a.status === 200 && body?.success === true) return 'done';
  if (a.status === 400 && body?.success === false && typeof body.error === 'string') return 'refused';
  return 'retry';
}

/**
 * One due entry, claimed before its POST: its next slot (or `given-up` when none is left) is written first, so a worker
 * stopped mid-request never POSTs it twice within a slot. Then its answer. False when nothing was due.
 */
async function sendNext(ext: Ext, deps: WalletDeps): Promise<boolean> {
  const {own, open} = await postable(ext);
  if (open) return false;
  const now = deps.now();
  const out: {claimed: PresaleRecordEntry | null} = {claimed: null};
  await updateRecords(ext, entries => {
    const i = entries.findIndex(e => e.state === 'due' && e.nextAt <= now && own.has(e.account));
    const e = entries[i];
    if (e === undefined) return entries;
    const slot = slotAfter(e.confirmedAt, now);
    const claimed: PresaleRecordEntry = {...e, attempts: e.attempts + 1, ...(slot === null ? {state: 'given-up' as const} : {nextAt: slot})};
    out.claimed = claimed;
    return entries.map((x, j) => (j === i ? claimed : x));
  });
  const claimed = out.claimed;
  if (claimed === null) return false;
  let answered: Outcome;
  try {
    answered = outcomeOf(await deps.postJson(PRESALE_RECORD_PATH, claimed.payload));
  } catch (e) {
    // A 403 now, or the cool-down after an earlier one (nothing sent): the entry waits until the cool-down ends.
    answered = e instanceof RpcForbidden ? 'forbidden' : 'retry';
  }
  const outcome = answered;
  if (outcome === 'retry') return true;
  const until = outcome === 'forbidden' ? await latchStore(ext).load() : 0;
  // Final review Minor 2: an answer for an entry no longer there (a delete wiped the records while the POST was out)
  // writes nothing — the key stays gone.
  await updateRecords(ext, entries => {
    const i = entries.findIndex(e => e.signature === claimed.signature);
    const e = entries[i];
    if (e === undefined) return entries;
    const next: PresaleRecordEntry = outcome === 'done' || outcome === 'refused' ? {...e, state: outcome} : e.state === 'due' ? {...e, nextAt: Math.max(e.nextAt, until)} : e;
    return next === e ? entries : entries.map((x, j) => (j === i ? next : x));
  });
  return true;
}

/**
 * The alarm at the earliest due entry's time (never sooner than the browsers' 30 s), or cleared when nothing is due. With
 * no entry at all there is nothing to arm or clear (a start with no purchase recorded touches no alarm). A held entry
 * (another wallet's) arms nothing; one deferred behind an open send is already due, so the alarm looks again in 30 s.
 */
async function armRecordAlarm(ext: Ext, now: number): Promise<void> {
  const stored = await readPresaleRecords(ext);
  if (stored.length === 0) return;
  const {own} = await postable(ext);
  const due = stored.filter(e => e.state === 'due' && own.has(e.account));
  if (due.length === 0) {
    await ext.alarms.clear(PRESALE_RECORD_ALARM);
    return;
  }
  const at = Math.min(...due.map(e => e.nextAt));
  await ext.alarms.create(PRESALE_RECORD_ALARM, {delayInMinutes: Math.max(PENDING_ALARM_MINUTES, (at - now) / MINUTE)});
}

const runs = new WeakMap<Ext, {run: Promise<void>; again: boolean}>();

/**
 * Every due entry, one POST at a time (never more than one in flight per background), then the alarm re-armed. A call
 * while a run is going returns that run and makes it look once more before it ends — even one that arrives while the
 * alarm is being armed. Never rejects.
 */
export function runPresaleRecords(ext: Ext, deps: WalletDeps): Promise<void> {
  const running = runs.get(ext);
  if (running !== undefined) {
    running.again = true;
    return running.run;
  }
  const me = {run: Promise.resolve(), again: false};
  me.run = (async () => {
    try {
      for (;;) {
        me.again = false;
        while (await sendNext(ext, deps));
        await armRecordAlarm(ext, deps.now());
        if (!me.again) break;
      }
    } catch (e) {
      console.warn('presale records not sent; the alarm or the next start resumes them', e);
    } finally {
      runs.delete(ext);
    }
  })();
  runs.set(ext, me);
  return me.run;
}

/** A purchase the coordinator has not accepted, and why: still owed attempts, out of them, or refused by the route (D29). */
export interface UnrecordedPurchase {
  signature: string;
  state: Exclude<PresaleRecordState, 'done'>;
}

/**
 * `presale.unrecorded` (§1.4): this account's confirmed purchases the coordinator has not accepted, each with its state —
 * #27 says Q34 for `due` and `given-up`, Q60 for `refused` (D29, rev 3.6).
 */
export async function unrecordedFor(ext: Ext, account: string): Promise<UnrecordedPurchase[]> {
  const out: UnrecordedPurchase[] = [];
  for (const e of await readPresaleRecords(ext)) if (e.account === account && e.state !== 'done') out.push({signature: e.signature, state: e.state});
  return out;
}
