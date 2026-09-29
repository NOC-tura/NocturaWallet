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
}

/** What leaves the background: everything but the signed bytes. */
export type PendingView = Omit<PendingRecord, 'wire'>;

export const MAX_RECORDS = 20;

export const isOpen = (r: PendingRecord): boolean => r.state === 'pending' || r.state === 'stuck';

const serial = createMutex();

export async function readPending(ext: Ext): Promise<PendingRecord[]> {
  const v = await ext.local.get(PENDING_KEY);
  return Array.isArray(v) ? (v as PendingRecord[]) : [];
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
  };
}

/** Every open record, plus the newest closed ones up to MAX_RECORDS in all. */
function trim(records: PendingRecord[]): PendingRecord[] {
  const openCount = records.filter(isOpen).length;
  const closed = records.filter(r => !isOpen(r));
  const keepClosed = new Set(closed.slice(Math.max(0, closed.length - Math.max(0, MAX_RECORDS - openCount))));
  return records.filter(r => isOpen(r) || keepClosed.has(r));
}

/** The one way records change: read, change, trim, write — serialised. */
export async function updatePending(ext: Ext, change: (records: PendingRecord[]) => PendingRecord[]): Promise<PendingRecord[]> {
  return serial(async () => {
    const next = trim(change(await readPending(ext)));
    await ext.local.set(PENDING_KEY, next);
    return next;
  });
}
