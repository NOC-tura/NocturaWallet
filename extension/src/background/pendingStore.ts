import type {Ext} from '../ext';
import {createMutex} from './mutex';
import {KIND_NAME} from './intents';
import type {SendIntent} from './sendTypes';

/**
 * storage.local, written only by the background (owner decision A, 2026-09-29): a pending send must
 * survive a lock and a browser restart, or a second transaction could be built while the first may
 * still land. Signed bytes only — public once broadcast; at most MAX_RECORDS records.
 */
export const PENDING_KEY = 'v1_pending';

export type PendingState = 'pending' | 'stuck' | 'confirmed' | 'failed' | 'expired';
/**
 * Why a `failed` record failed (spec B1b-2a E8), set where the engine writes each `failed`: `landed`
 * — on chain with an error, the network fee was paid; `not-sent` — refused before anything reached the
 * network. Null in every other state (and on a record from before E8). #44 chooses its state from
 * this, never from `detail`.
 */
export type PendingFailure = 'landed' | 'not-sent';
/**
 * What `detail` says about the last broadcast, as a code (plan 3, Task 10 fix-round ruling): `forbidden` — the
 * coordinator answered HTTP 403; `cooling` — not sent, the cool-down after an earlier 403; `unacked` — no
 * acknowledgement (no answer, or a refusal on a re-send); `substituted` — answered with another signature. Null when
 * the last broadcast was acknowledged, and whenever `detail` is about something else (a landing, expiry, a refusal of a
 * first broadcast by the route). Written beside `detail` every time; screens choose on this, never on the text.
 */
export type DetailCode = 'forbidden' | 'cooling' | 'unacked' | 'substituted';
/** See PendingRecord.firstBroadcast. */
export type FirstBroadcast = 'held' | 'due' | 'done';
export const DETAIL_CODES: readonly DetailCode[] = ['forbidden', 'cooling', 'unacked', 'substituted'];

/** A signed send, from before its broadcast until confirmed, failed or expired (spec §4 "No double spend"). */
export interface PendingRecord {
  id: string;
  account: string;
  signature: string;
  /** The signed wire bytes, base64: "send again" re-sends exactly these. */
  wire: string;
  lastValidBlockHeight: number;
  createdAt: number;
  lastSentAt: number;
  state: PendingState;
  detail: string | null;
  /** See DetailCode. A stored value that is missing (a record from before it) or unknown reads as null; the record is kept. */
  detailCode: DetailCode | null;
  /**
   * What the user sent (#12's intent); null for a dApp's transaction (B1c-2: `origin` set — the dApp built it) and for
   * the wallet's own transaction of another kind than a send (B1d §1.3: `origin` null, what it was in `extra`).
   */
  intent: SendIntent | null;
  /**
   * B1c-2 (spec B1c §1.5, §3.3): the site whose `signAndSendTransaction` this is — its signed bytes recorded here before
   * the broadcast, watched by the same poller, re-sent as the same bytes — or null for the wallet's own send. A dApp's
   * record never reaches the popup (wallet.pending lists the wallet's own sends) and never blocks one (inFlightFor).
   */
  origin: string | null;
  /**
   * B1c-2 (plan 2 review 1 M1): a dApp record's first broadcast. `held` — recorded, the page not yet promised the
   * signature (if the request ends otherwise the bytes are never sent); `due` — the page is promised it (a restart, a
   * lock or a dead effect answered it from the entry's recorded bytes) and nobody has handed the bytes to the route yet:
   * the poller's next round does, once; `done` — handed to the route (claimed atomically, so exactly once). The
   * wallet's own send is `done` from the start (submitSigned broadcasts at once). A stored value that is missing or
   * unknown reads as `done`: nothing is ever broadcast on a record that does not say it is owed.
   */
  firstBroadcast: FirstBroadcast;
  /** When a full-history status check past expiry first came back null; `expired` needs a second one ≥ 2 s later. */
  expiryNullSeenAt: number | null;
  failure: PendingFailure | null;
  /**
   * What the transaction pays, in two parts, base units (plan 3; follow-up ruling): the network fee
   * (5 000 per signature plus the priority fee — exact, the compute-unit price and limit are signed) and the
   * Noctura fee ('0' when none is charged), as prepared. Kept apart because a transaction that lands and
   * fails still pays the network fee while its markup transfer is rolled back: a single sum cannot be shown
   * truthfully for it (display rule: spec §4.5, "Fee paid"). Required, typed `| null`, so no writer can leave
   * it out by accident. Null on a record from before plan 3, and for any stored value that is not exactly two
   * digit strings: a display field never drops a record (a pending send must never be hidden).
   */
  fee: PendingFee | null;
  /**
   * B1d §1.3 (review H1): what the wallet's own transaction of another kind than a send was — its kind and that kind's
   * display data, never used to decide anything. Null for a send and a dApp record, and for any stored value that is
   * not an object with a kind name: a display field never drops a record. Written only when set, so a send's and a dApp
   * record's stored form is what it was before kinds existed.
   */
  extra: PendingExtra | null;
}

/** See PendingRecord.extra. `data` is the kind's, as stored. */
export interface PendingExtra {
  kind: string;
  data: unknown;
}

/** The two parts of what a pending send pays, base-unit decimal strings. */
export interface PendingFee {
  networkLamports: string;
  markupLamports: string;
}

/** What leaves the background: everything but the signed bytes (and the first-broadcast bookkeeping, which is the background's). */
export type PendingView = Omit<PendingRecord, 'wire' | 'firstBroadcast'>;

export const MAX_RECORDS = 20;

export const isOpen = (r: PendingRecord): boolean => r.state === 'pending' || r.state === 'stuck';

const serial = createMutex();

const STATES: readonly string[] = ['pending', 'stuck', 'confirmed', 'failed', 'expired'];
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

const ORIGIN = /^https:\/\/[^\s/?#@]+$/;
/** A dApp record's origin (B1c-2): an https origin, with its intent null; the wallet's own send has no origin and an intent. */
const isDappOrigin = (x: unknown): x is string => typeof x === 'string' && ORIGIN.test(x);

/**
 * A stored element is a claim: only an exact record shape is read; anything else is dropped. Three shapes: a dApp's (an
 * https origin, no intent), the wallet's send (no origin, a send intent) and the wallet's other kinds (B1d §1.3: no
 * origin, no intent). `failure`, `fee` and `extra` are checked by recordOf.
 */
function isRecord(x: unknown): x is Omit<PendingRecord, 'failure' | 'fee' | 'detailCode' | 'origin' | 'firstBroadcast' | 'extra'> & {failure?: unknown; fee?: unknown; detailCode?: unknown; origin?: unknown; firstBroadcast?: unknown; extra?: unknown} {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
  const r = x as Record<string, unknown>;
  const i = r.intent as Record<string, unknown> | null;
  const dapp = isDappOrigin(r.origin) && i === null;
  const own = r.origin === undefined || r.origin === null;
  return (
    typeof r.id === 'string' &&
    typeof r.account === 'string' &&
    typeof r.signature === 'string' &&
    typeof r.wire === 'string' &&
    typeof r.state === 'string' &&
    STATES.includes(r.state) &&
    isNum(r.lastValidBlockHeight) &&
    isNum(r.createdAt) &&
    isNum(r.lastSentAt) &&
    (r.detail === null || typeof r.detail === 'string') &&
    (r.expiryNullSeenAt === null || isNum(r.expiryNullSeenAt)) &&
    (dapp || (own && i === null) || (own && typeof i === 'object' && i !== null && typeof i.token === 'string' && typeof i.recipient === 'string' && typeof i.amount === 'string'))
  );
}

/**
 * A record from before E8 has no `failure`: it reads as null, so no migration is needed. Any other value drops the
 * record. `fee` (plan 3) reads as null when it is missing or not two digit strings — the record itself is kept; so does
 * `extra` (B1d §1.3), which only the wallet's own record without an intent can carry.
 */
function recordOf(x: unknown): PendingRecord | null {
  if (!isRecord(x)) return null;
  const fee = feeOf(x.fee);
  const detailCode = DETAIL_CODES.find(c => c === x.detailCode) ?? null;
  const origin = isDappOrigin(x.origin) ? x.origin : null;
  // Only a dApp record can be owed a first broadcast; anything else (the wallet's own, missing, unknown) is `done`.
  const firstBroadcast: FirstBroadcast = origin !== null && (x.firstBroadcast === 'held' || x.firstBroadcast === 'due') ? x.firstBroadcast : 'done';
  const extra = origin === null && x.intent === null ? extraOf(x.extra) : null;
  const f = x.failure;
  if (f === undefined || f === null) return {...x, failure: null, fee, detailCode, origin, firstBroadcast, extra};
  return f === 'landed' || f === 'not-sent' ? {...x, failure: f, fee, detailCode, origin, firstBroadcast, extra} : null;
}

/** An object whose `kind` is a kind name, its `data` as stored (missing → null); anything else is null. */
function extraOf(x: unknown): PendingExtra | null {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null;
  const {kind, data} = x as Record<string, unknown>;
  if (typeof kind !== 'string' || !KIND_NAME.test(kind)) return null;
  return {kind, data: data === undefined ? null : data};
}

const DIGITS = /^\d{1,20}$/;

/** Exactly two base-unit digit strings, copied (never the stored object itself); anything else is null. */
function feeOf(x: unknown): PendingFee | null {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null;
  const {networkLamports, markupLamports} = x as Record<string, unknown>;
  if (typeof networkLamports !== 'string' || typeof markupLamports !== 'string' || !DIGITS.test(networkLamports) || !DIGITS.test(markupLamports)) return null;
  return {networkLamports, markupLamports};
}

export async function readPending(ext: Ext): Promise<PendingRecord[]> {
  const v = await ext.local.get(PENDING_KEY);
  if (!Array.isArray(v)) return [];
  const out: PendingRecord[] = [];
  for (const x of v as unknown[]) {
    const r = recordOf(x);
    if (r !== null) out.push(r);
  }
  return out;
}

/** The wallet's own open send of this account (B1c-2: a dApp's transaction, origin set, is not the wallet's send to guard). */
export function inFlightFor(records: readonly PendingRecord[], account: string): PendingRecord | undefined {
  return records.find(r => r.account === account && isOpen(r) && r.origin === null);
}

export function viewOf(r: PendingRecord): PendingView {
  return {
    id: r.id,
    account: r.account,
    signature: r.signature,
    lastValidBlockHeight: r.lastValidBlockHeight,
    createdAt: r.createdAt,
    lastSentAt: r.lastSentAt,
    state: r.state,
    detail: r.detail,
    detailCode: r.detailCode,
    intent: r.intent,
    origin: r.origin,
    expiryNullSeenAt: r.expiryNullSeenAt,
    failure: r.failure,
    fee: r.fee === null ? null : {networkLamports: r.fee.networkLamports, markupLamports: r.fee.markupLamports},
    extra: r.extra === null ? null : {kind: r.extra.kind, data: r.extra.data},
  };
}

/** What is written: `extra` only when set (see PendingRecord.extra). */
function storedForm(r: PendingRecord): PendingRecord | Omit<PendingRecord, 'extra'> {
  if (r.extra !== null) return r;
  const {extra: _none, ...rest} = r;
  return rest;
}

/** Every open record, plus the newest closed ones up to MAX_RECORDS in all. */
function trim(records: PendingRecord[]): PendingRecord[] {
  const openCount = records.filter(isOpen).length;
  const closed = records.filter(r => !isOpen(r));
  const keepClosed = new Set(closed.slice(Math.max(0, closed.length - Math.max(0, MAX_RECORDS - openCount))));
  return records.filter(r => isOpen(r) || keepClosed.has(r));
}

/**
 * The one way records change: read, change, trim, write — serialised. Records are kept oldest
 * first: `change` appends a new record at the end, so trimming drops the oldest closed ones.
 * Open records are never trimmed, even past MAX_RECORDS (one per account can be open).
 */
export async function updatePending(ext: Ext, change: (records: PendingRecord[]) => PendingRecord[]): Promise<PendingRecord[]> {
  return serial(async () => {
    const next = trim(change(await readPending(ext)));
    await ext.local.set(PENDING_KEY, next.map(storedForm));
    return next;
  });
}

/**
 * Review 1 M1: the page is being promised these signatures (a restart, a lock or a dead effect answers a send from the
 * entry's recorded bytes): each one's record, while still `held`, becomes `due` — written BEFORE the answer is stored
 * (the callers run it inside their section), so a page never holds a signature whose bytes no one will send. The
 * poller's next round hands a `due` record to the route, once.
 */
export async function markDue(ext: Ext, signatures: readonly string[]): Promise<void> {
  if (signatures.length === 0) return;
  await updatePending(ext, records => records.map(r => (r.origin !== null && r.firstBroadcast === 'held' && isOpen(r) && signatures.includes(r.signature) ? {...r, firstBroadcast: 'due'} : r)));
}
