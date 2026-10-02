import type {Ext} from '../ext';
import {createMutex} from './mutex';
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
  intent: SendIntent;
  /** When a full-history status check past expiry first came back null; `expired` needs a second one ≥ 2 s later. */
  expiryNullSeenAt: number | null;
  failure: PendingFailure | null;
  /**
   * What the transaction pays if it lands, base units (plan 3): its network fee plus the Noctura fee when
   * charged, as prepared — exact, the compute-unit price and limit are signed. #21's "Fee paid". Null on a
   * record from before plan 3, and for any stored value that is not digits: a display field never drops a
   * record (a pending send must never be hidden).
   */
  feeLamports: string | null;
}

/** What leaves the background: everything but the signed bytes. */
export type PendingView = Omit<PendingRecord, 'wire'>;

export const MAX_RECORDS = 20;

export const isOpen = (r: PendingRecord): boolean => r.state === 'pending' || r.state === 'stuck';

const serial = createMutex();

const STATES: readonly string[] = ['pending', 'stuck', 'confirmed', 'failed', 'expired'];
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** A stored element is a claim: only an exact record shape is read; anything else is dropped. `failure` and `feeLamports` are checked by recordOf. */
function isRecord(x: unknown): x is Omit<PendingRecord, 'failure' | 'feeLamports'> & {failure?: unknown; feeLamports?: unknown} {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
  const r = x as Record<string, unknown>;
  const i = r.intent as Record<string, unknown> | null;
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
    typeof i === 'object' &&
    i !== null &&
    typeof i.token === 'string' &&
    typeof i.recipient === 'string' &&
    typeof i.amount === 'string'
  );
}

/**
 * A record from before E8 has no `failure`: it reads as null, so no migration is needed. Any other value drops the
 * record. `feeLamports` (plan 3) reads as null when it is missing or not digits — the record itself is kept.
 */
function recordOf(x: unknown): PendingRecord | null {
  if (!isRecord(x)) return null;
  const fee = typeof x.feeLamports === 'string' && /^\d{1,20}$/.test(x.feeLamports) ? x.feeLamports : null;
  const f = x.failure;
  if (f === undefined || f === null) return {...x, failure: null, feeLamports: fee};
  return f === 'landed' || f === 'not-sent' ? {...x, failure: f, feeLamports: fee} : null;
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

export function inFlightFor(records: readonly PendingRecord[], account: string): PendingRecord | undefined {
  return records.find(r => r.account === account && isOpen(r));
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
    intent: r.intent,
    expiryNullSeenAt: r.expiryNullSeenAt,
    failure: r.failure,
    feeLamports: r.feeLamports,
  };
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
    await ext.local.set(PENDING_KEY, next);
    return next;
  });
}
