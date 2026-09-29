import {base64} from '@scure/base';
import type {Ext} from '../ext';
import type {WalletDeps} from './deps';
import {addKnownRecipient} from './knownRecipients';
import {randomId} from './digest';
import {inFlightFor, isOpen, readPending, updatePending, viewOf, type PendingRecord, type PendingView} from './pendingStore';
import {ResendRefused, SendRefused, type ResendRefusal, type SendIntent} from './sendTypes';
import {BroadcastRejected, BroadcastSubstituted, firstSignature} from '../../../core/solana/broadcast';
import {RpcForbidden, type SignatureStatus} from '../../../core/solana/rpc';

/** ≥ 2 s: the proxy's request budget, and CrowdSec (spec §4). */
export const POLL_INTERVAL_MS = 2_000;
/** Spec §4: pending past ~90 s goes to the stuck-transaction screen (#54). */
export const STUCK_AFTER_MS = 90_000;
/** "Send again" cannot be pressed twice in a row (spec §4, #54). */
export const RESEND_MIN_INTERVAL_MS = 2_000;
/**
 * Blocks past lastValidBlockHeight before expiry is even considered: the height comes from the
 * coordinator's RPC, and the node that would still accept the transaction may be a few blocks behind.
 */
export const EXPIRY_MARGIN_BLOCKS = 32;
export const NOT_CONFIRMED = 'Not confirmed — no funds moved.';
/** A service worker may be stopped between polls: this alarm (30 s, the browsers' minimum) picks it up. */
export const PENDING_ALARM = 'pending-poll';
export const PENDING_ALARM_MINUTES = 0.5;

type Update = Partial<Pick<PendingRecord, 'state' | 'detail' | 'expiryNullSeenAt'>>;

async function patch(ext: Ext, id: string, change: (r: PendingRecord) => PendingRecord): Promise<void> {
  await updatePending(ext, records => records.map(r => (r.id === id && isOpen(r) ? change(r) : r)));
}

export async function armPendingAlarm(ext: Ext): Promise<void> {
  await ext.alarms.create(PENDING_ALARM, {delayInMinutes: PENDING_ALARM_MINUTES});
}

/**
 * Hand the signed bytes to the broadcast route. On a first attempt, a refusal (400) or a 403 means
 * nothing was forwarded: failed. On a re-send the first copy may already have landed, so only the
 * detail changes. "Not acknowledged" is never failure: the poller decides.
 */
async function deliver(ext: Ext, deps: WalletDeps, record: PendingRecord, attempt: 'first' | 'again'): Promise<void> {
  try {
    await deps.broadcast(base64.decode(record.wire));
    await patch(ext, record.id, r => ({...r, detail: null}));
  } catch (e) {
    if (attempt === 'first' && e instanceof BroadcastRejected) {
      await patch(ext, record.id, r => ({...r, state: 'failed', detail: `The network refused this transaction (${e.reason}: ${e.detail}). No funds moved.`}));
    } else if (attempt === 'first' && e instanceof RpcForbidden) {
      await patch(ext, record.id, r => ({...r, state: 'failed', detail: 'The coordinator refused the broadcast (HTTP 403). No funds moved; not retried.'}));
    } else if (e instanceof BroadcastSubstituted) {
      await patch(ext, record.id, r => ({...r, detail: 'The coordinator answered with another signature; watching this transaction’s own signature.'}));
    } else {
      await patch(ext, record.id, r => ({...r, detail: 'Not acknowledged yet; still watching. "Send again" re-sends the same transaction.'}));
    }
  }
}

export async function submitSigned(
  ext: Ext,
  deps: WalletDeps,
  input: {account: string; wire: Uint8Array; lastValidBlockHeight: number; intent: SendIntent},
): Promise<PendingView> {
  const now = deps.now();
  const record: PendingRecord = {
    id: randomId(deps.randomBytes),
    account: input.account,
    signature: firstSignature(input.wire),
    wire: base64.encode(input.wire),
    lastValidBlockHeight: input.lastValidBlockHeight,
    createdAt: now,
    lastSentAt: now,
    state: 'pending',
    detail: null,
    intent: input.intent,
    expiryNullSeenAt: null,
  };
  const guard = {refused: false};
  await updatePending(ext, records => {
    if (inFlightFor(records, input.account) !== undefined) {
      guard.refused = true;
      return records;
    }
    return [...records, record];
  });
  if (guard.refused) throw new SendRefused('in-flight');
  // Written above BEFORE the broadcast below: a service worker stopped in between still knows it.
  await armPendingAlarm(ext);
  await deliver(ext, deps, record, 'first');
  void startPoller(ext, deps);
  return viewOf((await readPending(ext)).find(r => r.id === record.id) ?? record);
}

/** "Send again": the same signed bytes, so the same signature — it can land at most once. */
export async function resend(ext: Ext, deps: WalletDeps, id: string): Promise<PendingView> {
  const out: {record?: PendingRecord; refusal?: ResendRefusal} = {};
  await updatePending(ext, records =>
    records.map(r => {
      if (r.id !== id) return r;
      if (!isOpen(r)) {
        out.refusal = 'not-open';
        return r;
      }
      if (deps.now() - r.lastSentAt < RESEND_MIN_INTERVAL_MS) {
        out.refusal = 'too-soon';
        return r;
      }
      out.record = {...r, lastSentAt: deps.now()};
      return out.record;
    }),
  );
  if (out.record === undefined) throw new ResendRefused(out.refusal ?? 'unknown');
  await deliver(ext, deps, out.record, 'again');
  void startPoller(ext, deps);
  const current = (await readPending(ext)).find(r => r.id === id) ?? out.record;
  return viewOf(current);
}

/** Check err FIRST: a landed-but-failed transaction also carries a confirmationStatus. */
function landed(s: SignatureStatus | null): 'confirmed' | 'failed' | null {
  if (s === null) return null;
  if (s.err !== null) return 'failed';
  return s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized' ? 'confirmed' : null;
}

const failedDetail = (err: unknown): string => `Landed but failed (${JSON.stringify(err)}): the network fee was paid, nothing was sent.`;

/** One polling round over every open record. True while anything is still open. */
export async function pollOnce(ext: Ext, deps: WalletDeps): Promise<boolean> {
  const open = (await readPending(ext)).filter(isOpen);
  if (open.length === 0) return false;
  let statuses: (SignatureStatus | null)[];
  try {
    statuses = await deps.reader.getSignatureStatuses(open.map(r => r.signature));
  } catch {
    return true; // nothing learned this round; a 403 has tripped the latch, and the next round is ≥ 2 s away
  }
  let height: number | null;
  try {
    height = await deps.reader.getBlockHeight();
  } catch {
    height = null; // the app's rule: a hiccup skips the expiry check this round
  }
  const now = deps.now();
  const updates = new Map<string, Update>();
  for (const [i, r] of open.entries()) {
    const s = statuses[i] ?? null;
    const verdict = landed(s);
    if (verdict === 'confirmed') {
      updates.set(r.id, {state: 'confirmed', detail: null});
    } else if (verdict === 'failed') {
      updates.set(r.id, {state: 'failed', detail: failedDetail(s?.err)});
    } else if (height !== null && height > r.lastValidBlockHeight + EXPIRY_MARGIN_BLOCKS) {
      // Past the blockhash's life, with margin, so this transaction can no longer land — but it may
      // have landed before. Ask with the full status history, and say "no funds moved" only after
      // that answer is null in two rounds at least POLL_INTERVAL_MS apart.
      let last: SignatureStatus | null;
      try {
        last = (await deps.reader.getSignatureStatuses([r.signature], true))[0] ?? null;
      } catch {
        continue;
      }
      const final = landed(last);
      if (final === 'confirmed') updates.set(r.id, {state: 'confirmed', detail: null});
      else if (final === 'failed') updates.set(r.id, {state: 'failed', detail: failedDetail(last?.err)});
      else if (r.expiryNullSeenAt !== null && now - r.expiryNullSeenAt >= POLL_INTERVAL_MS) updates.set(r.id, {state: 'expired', detail: NOT_CONFIRMED});
      else updates.set(r.id, {expiryNullSeenAt: r.expiryNullSeenAt ?? now});
    } else if (r.state === 'pending' && now - r.createdAt > STUCK_AFTER_MS) {
      updates.set(r.id, {state: 'stuck'});
    }
  }
  const after = await updatePending(ext, records =>
    records.map(r => {
      const u = updates.get(r.id);
      return u !== undefined && isOpen(r) ? {...r, ...u} : r;
    }),
  );
  for (const r of open) {
    if (updates.get(r.id)?.state === 'confirmed') await addKnownRecipient(ext, r.intent.recipient);
  }
  return after.some(isOpen);
}

const loops = new WeakMap<Ext, Promise<void>>();

/**
 * One polling loop per extension context, every POLL_INTERVAL_MS until nothing is open; a running
 * loop is returned, never doubled. A worker stopped anyway is picked up by the 30 s alarm
 * (onPendingAlarm), on its next start (index.ts) or on the next wallet.* message.
 */
export function startPoller(ext: Ext, deps: WalletDeps): Promise<void> {
  const running = loops.get(ext);
  if (running !== undefined) return running;
  const loop = (async () => {
    try {
      for (;;) {
        await deps.sleep(POLL_INTERVAL_MS);
        if (!(await pollOnce(ext, deps))) return;
      }
    } catch {
      // A storage failure: the alarm, the next wallet.* message or a service-worker start resumes polling.
    } finally {
      loops.delete(ext);
    }
  })();
  loops.set(ext, loop);
  return loop;
}

/**
 * The 30 s alarm: poll once if no loop is running (a running loop already polls every 2 s — two
 * pollers would break the ≥ 2 s rule), then re-arm while anything is open, or clear the alarm.
 */
export async function onPendingAlarm(ext: Ext, deps: WalletDeps): Promise<void> {
  let open = true;
  if (loops.has(ext)) open = (await readPending(ext)).some(isOpen);
  else {
    try {
      open = await pollOnce(ext, deps);
    } catch {
      open = true;
    }
  }
  if (open) await armPendingAlarm(ext);
  else await ext.alarms.clear(PENDING_ALARM);
}
