import {base64} from '@scure/base';
import type {Ext} from '../ext';
import type {WalletDeps} from './deps';
import {addKnownRecipient} from './knownRecipients';
import {randomId} from './digest';
import {inFlightFor, isOpen, readPending, updatePending, viewOf, type PendingRecord, type PendingView} from './pendingStore';
import {ResendRefused, SendRefused, type ResendRefusal, type SendIntent} from './sendTypes';
import {BroadcastRejected, BroadcastSubstituted, firstSignature} from '../../../core/solana/broadcast';
import {RpcCoolingDown, RpcForbidden, type SignatureStatus} from '../../../core/solana/rpc';

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
 * Hand the signed bytes to the broadcast route. On a first attempt, only the route's refusal (400)
 * or the latch refusing during its cool-down (nothing was sent at all) means nothing was forwarded:
 * failed. A 403 RESPONSE is "not acknowledged" (route contract): the request reached the
 * coordinator, so the record stays pending and polling decides. On a re-send the first copy may
 * already have landed, so only the detail changes.
 */
async function deliver(ext: Ext, deps: WalletDeps, record: PendingRecord, attempt: 'first' | 'again'): Promise<void> {
  try {
    await deps.broadcast(base64.decode(record.wire));
    await patch(ext, record.id, r => ({...r, detail: null}));
  } catch (e) {
    if (attempt === 'first' && e instanceof BroadcastRejected) {
      await patch(ext, record.id, r => ({...r, state: 'failed', detail: `The network refused this transaction (${e.reason}: ${e.detail}). No funds moved.`}));
    } else if (attempt === 'first' && e instanceof RpcCoolingDown) {
      await patch(ext, record.id, r => ({...r, state: 'failed', detail: 'Not sent: the coordinator is cooling down after an earlier HTTP 403. No funds moved.'}));
    } else if (e instanceof RpcCoolingDown) {
      await patch(ext, record.id, r => ({...r, detail: 'Not sent again: cooling down after an earlier HTTP 403; still watching the first copy.'}));
    } else if (e instanceof RpcForbidden) {
      await patch(ext, record.id, r => ({...r, detail: 'The coordinator answered HTTP 403: not acknowledged; still watching, not retried automatically.'}));
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
  // From here on the record exists, so whatever throws, a poller (and, if it can be armed, the
  // alarm) is left watching it. The alarm is armed BEFORE the broadcast, so a service worker
  // stopped mid-broadcast still wakes to poll; a failure to arm is swallowed, because it must
  // never keep the signed bytes from being sent.
  await armPendingAlarm(ext).catch((e: unknown) => console.warn('pending alarm not armed; the poller still runs', e));
  try {
    await deliver(ext, deps, record, 'first');
  } finally {
    void startPoller(ext, deps);
  }
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

/**
 * Final only at confirmed/finalized (the app's findLandedSignature rule): a `processed` status —
 * with or without err — may be a minority fork, and the same bytes can still land. At a final
 * commitment err is checked first: a landed-but-failed transaction is failed, never confirmed.
 */
function landed(s: SignatureStatus | null): 'confirmed' | 'failed' | null {
  if (s === null) return null;
  if (s.confirmationStatus !== 'confirmed' && s.confirmationStatus !== 'finalized') return null;
  return s.err !== null ? 'failed' : 'confirmed';
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
      // Only a literal null in both answers is a null round; any status seen (processed, with or
      // without err) means the network knows the transaction: restart the count, keep watching.
      else if (last !== null || s !== null) updates.set(r.id, {expiryNullSeenAt: null});
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

const anyOpen = async (ext: Ext): Promise<boolean> => (await readPending(ext)).some(isOpen);

/**
 * The 30 s alarm: poll once if no loop is running (a running loop already polls every 2 s — two
 * pollers would break the ≥ 2 s rule), then re-arm while anything is open, or clear the alarm.
 * A send written meanwhile arms the alarm itself after writing its record; the clear could land
 * after that arm, so the store is read again after clearing and the alarm re-armed if needed.
 */
export async function onPendingAlarm(ext: Ext, deps: WalletDeps): Promise<void> {
  let open = true;
  if (loops.has(ext)) open = await anyOpen(ext);
  else {
    try {
      open = await pollOnce(ext, deps);
    } catch {
      open = true;
    }
  }
  if (open || (await anyOpen(ext))) {
    await armPendingAlarm(ext);
    return;
  }
  await ext.alarms.clear(PENDING_ALARM);
  if (await anyOpen(ext)) await armPendingAlarm(ext);
}
