import {SESSION_KEY} from '../session';
import {
  EXPIRY_MARGIN_BLOCKS, NOT_CONFIRMED, PENDING_ALARM, PENDING_ALARM_MINUTES, POLL_INTERVAL_MS, RESEND_MIN_INTERVAL_MS, STUCK_AFTER_MS,
  onPendingAlarm, pollOnce, resend, startPoller, submitSigned,
} from '../pending';
import {PENDING_KEY, readPending, type PendingRecord} from '../pendingStore';
import {knownRecipients} from '../knownRecipients';
import {lock} from '../autolock';
import type {WalletDeps} from '../deps';
import {BroadcastRejected, BroadcastSubstituted, BroadcastUnavailable, firstSignature} from '../../../../core/solana/broadcast';
import {RpcCoolingDown, RpcForbidden} from '../../../../core/solana/rpc';
import type {SignatureStatus} from '../../../../core/solana/rpc';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, pendingRecord, signedWire, unlocked} from './fixtures';

const INTENT = {token: 'SOL' as const, recipient: RECIPIENT, amount: '1'};
const confirmed: SignatureStatus = {err: null, confirmationStatus: 'confirmed'};
const processed: SignatureStatus = {err: null, confirmationStatus: 'processed'};
const processedWithErr: SignatureStatus = {err: {InstructionError: [0, 'x']}, confirmationStatus: 'processed'};
/** Past lastValidBlockHeight (1000) by more than the 32-block margin — literal, so a changed margin shows. */
const EXPIRED_HEIGHT = 1033;

/** Deps whose broadcast route accepts and echoes the signature, recording the bytes. */
function depsWith(over: Partial<WalletDeps> = {}) {
  const d = fakeDeps(over);
  if (over.broadcast === undefined) {
    d.broadcast = async wire => {
      d.broadcasts.push(wire);
      return firstSignature(wire);
    };
  }
  return d;
}

async function submitted(over: Partial<WalletDeps> = {}) {
  const ext = fakeExt();
  await unlocked(ext);
  const deps = depsWith(over);
  const view = await submitSigned(ext, deps, {account: ACCOUNT.publicKey, wire: signedWire(), lastValidBlockHeight: 1000, intent: INTENT});
  return {ext, deps, view};
}

/** A reader where the transaction is never seen and the chain is at `height`; records the history flag of each status call. */
function unseenAt(height: number, asked: (boolean | undefined)[] = []) {
  return fakeReader({
    getSignatureStatuses: async (sigs, history) => (asked.push(history), sigs.map(() => null)),
    getBlockHeight: async () => height,
  });
}

describe('submitSigned', () => {
  it('writes the record (storage.local) before broadcasting, then leaves it pending (positive control)', async () => {
    const ext = fakeExt();
    const seen: number[] = [];
    const deps = depsWith();
    deps.broadcast = async wire => {
      seen.push((await readPending(ext)).length);
      return firstSignature(wire);
    };
    const view = await submitSigned(ext, deps, {account: ACCOUNT.publicKey, wire: signedWire(), lastValidBlockHeight: 1000, intent: INTENT});
    expect(seen).toEqual([1]);
    expect(await ext.local.get(PENDING_KEY)).toHaveLength(1);
    expect(view).toMatchObject({state: 'pending', detail: null, expiryNullSeenAt: null, signature: firstSignature(signedWire())});
    expect('wire' in view).toBe(false);
  });

  it('arms the 30 s pending alarm', async () => {
    const {ext} = await submitted();
    expect(ext.alarmsSet.get(PENDING_ALARM)).toBe(PENDING_ALARM_MINUTES);
  });

  it('allows one open send per account — a second is refused and never broadcast', async () => {
    const {ext, deps} = await submitted();
    await expect(submitSigned(ext, deps, {account: ACCOUNT.publicKey, wire: signedWire(2n), lastValidBlockHeight: 1000, intent: INTENT})).rejects.toMatchObject({code: 'in-flight'});
    expect(deps.broadcasts).toHaveLength(1);
  });

  it('two racing sends for one account: exactly one is written and broadcast', async () => {
    const ext = fakeExt();
    const deps = depsWith();
    const results = await Promise.allSettled([
      submitSigned(ext, deps, {account: ACCOUNT.publicKey, wire: signedWire(), lastValidBlockHeight: 1000, intent: INTENT}),
      submitSigned(ext, deps, {account: ACCOUNT.publicKey, wire: signedWire(2n), lastValidBlockHeight: 1000, intent: INTENT}),
    ]);
    expect(results.map(r => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(results.find(r => r.status === 'rejected')).toMatchObject({reason: {code: 'in-flight'}});
    expect(deps.broadcasts).toHaveLength(1);
    expect(await readPending(ext)).toHaveLength(1);
  });

  it('a first broadcast refused by the route is failed — nothing was forwarded', async () => {
    const {view} = await submitted({
      broadcast: async () => {
        throw new BroadcastRejected('rejected', 'Blockhash not found');
      },
    });
    expect(view.state).toBe('failed');
    expect(view.detail).toContain('No funds moved');
  });

  it('a broadcast that is not acknowledged stays pending and says so', async () => {
    const {view} = await submitted({
      broadcast: async () => {
        throw new BroadcastUnavailable(502);
      },
    });
    expect(view.state).toBe('pending');
    expect(view.detail).toContain('same transaction');
  });
});

describe('submitSigned — what a refused first broadcast means (route contract)', () => {
  it('a 403 RESPONSE is not acknowledged: pending, detail only, and polling still resolves it', async () => {
    const {ext, deps, view} = await submitted({
      broadcast: async () => {
        throw new RpcForbidden('broadcast');
      },
    });
    expect(view.state).toBe('pending');
    expect(view.detail).toContain('403');
    deps.reader = fakeReader({getSignatureStatuses: async () => [confirmed], getBlockHeight: async () => 900});
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]?.state).toBe('confirmed');
  });

  it('refused by the cool-down before any request: failed — nothing was sent', async () => {
    const {view} = await submitted({
      broadcast: async () => {
        throw new RpcCoolingDown('broadcast');
      },
    });
    expect(view.state).toBe('failed');
    expect(view.detail).toContain('No funds moved');
  });

  it('a substituted signature: pending, watching our own signature', async () => {
    const {view} = await submitted({
      broadcast: async wire => {
        throw new BroadcastSubstituted(firstSignature(wire), 'other');
      },
    });
    expect(view.state).toBe('pending');
    expect(view.detail).toContain('another signature');
  });
});

describe('submitSigned — the poller survives a failure after the record is written', () => {
  it('an alarm that cannot be armed does not stop the broadcast: sent exactly once, pending, with a poller', async () => {
    const ext = fakeExt();
    const sleeps: number[] = [];
    const deps = depsWith({sleep: ms => (sleeps.push(ms), new Promise<void>(() => undefined))});
    ext.alarms.create = () => {
      throw new Error('alarms down');
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const view = await submitSigned(ext, deps, {account: ACCOUNT.publicKey, wire: signedWire(), lastValidBlockHeight: 1000, intent: INTENT});
    expect(deps.broadcasts).toHaveLength(1);
    expect([...deps.broadcasts[0]!]).toEqual([...signedWire()]);
    expect(view.state).toBe('pending');
    expect(await readPending(ext)).toHaveLength(1);
    expect(sleeps).toEqual([POLL_INTERVAL_MS]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('the alarm is already armed when the bytes go out (a worker stopped mid-broadcast still wakes)', async () => {
    const ext = fakeExt();
    const armedAtBroadcast: boolean[] = [];
    const deps = depsWith({sleep: () => new Promise<void>(() => undefined)});
    deps.broadcast = async wire => {
      armedAtBroadcast.push(ext.alarmsSet.has(PENDING_ALARM));
      deps.broadcasts.push(wire);
      return firstSignature(wire);
    };
    await submitSigned(ext, deps, {account: ACCOUNT.publicKey, wire: signedWire(), lastValidBlockHeight: 1000, intent: INTENT});
    expect(armedAtBroadcast).toEqual([true]);
  });

  it("a storage failure in the broadcast's own record update still leaves a poller running", async () => {
    const ext = fakeExt();
    const sleeps: number[] = [];
    const deps = depsWith({sleep: ms => (sleeps.push(ms), new Promise<void>(() => undefined))});
    const set = ext.local.set;
    let writes = 0;
    ext.local.set = async (k, v) => {
      writes += 1;
      if (writes > 1) throw new Error('quota');
      await set(k, v);
    };
    await expect(submitSigned(ext, deps, {account: ACCOUNT.publicKey, wire: signedWire(), lastValidBlockHeight: 1000, intent: INTENT})).rejects.toThrow('quota');
    expect(deps.broadcasts).toHaveLength(1);
    expect(sleeps).toEqual([POLL_INTERVAL_MS]);
  });
});

describe('pollOnce', () => {
  it('an err at processed is not final (a minority fork): still pending', async () => {
    const {ext, deps} = await submitted();
    deps.reader = fakeReader({getSignatureStatuses: async () => [processedWithErr], getBlockHeight: async () => 900});
    expect(await pollOnce(ext, deps)).toBe(true);
    expect((await readPending(ext))[0]).toMatchObject({state: 'pending', detail: null});
  });

  it('an err at finalized is failed', async () => {
    const {ext, deps} = await submitted();
    deps.reader = fakeReader({getSignatureStatuses: async () => [{err: {InstructionError: [0, 'x']}, confirmationStatus: 'finalized'}], getBlockHeight: async () => 900});
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]?.state).toBe('failed');
  });

  it('past the margin, a processed status in both rounds is never a null round: not expired', async () => {
    const {ext, deps} = await submitted();
    for (const s of [processed, processedWithErr]) {
      deps.reader = fakeReader({getSignatureStatuses: async () => [s], getBlockHeight: async () => EXPIRED_HEIGHT});
      expect(await pollOnce(ext, deps)).toBe(true);
      deps.clock.t += POLL_INTERVAL_MS;
      expect(await pollOnce(ext, deps)).toBe(true);
      expect((await readPending(ext))[0]).toMatchObject({state: 'pending', expiryNullSeenAt: null});
    }
  });

  it('past the margin, a processed status in the plain check is not a null round even if the full history says null', async () => {
    const {ext, deps} = await submitted();
    deps.reader = fakeReader({
      getSignatureStatuses: async (sigs, history) => (history === true ? sigs.map(() => null) : [processed]),
      getBlockHeight: async () => EXPIRED_HEIGHT,
    });
    await pollOnce(ext, deps);
    deps.clock.t += POLL_INTERVAL_MS;
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]).toMatchObject({state: 'pending', expiryNullSeenAt: null});
  });

  it('past the margin, a processed full-history answer between two null rounds resets the count', async () => {
    const {ext, deps} = await submitted();
    deps.reader = unseenAt(EXPIRED_HEIGHT);
    await pollOnce(ext, deps);
    deps.clock.t += POLL_INTERVAL_MS;
    deps.reader = fakeReader({
      getSignatureStatuses: async (sigs, history) => (history === true ? [processed] : sigs.map(() => null)),
      getBlockHeight: async () => EXPIRED_HEIGHT,
    });
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]).toMatchObject({state: 'pending', expiryNullSeenAt: null});
    deps.clock.t += POLL_INTERVAL_MS;
    deps.reader = unseenAt(EXPIRED_HEIGHT);
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]).toMatchObject({state: 'pending', expiryNullSeenAt: deps.now()});
  });

  it('confirmed: the state, and the recipient becomes known', async () => {
    const {ext, deps} = await submitted();
    deps.reader = fakeReader({getSignatureStatuses: async () => [confirmed], getBlockHeight: async () => 900});
    expect(await pollOnce(ext, deps)).toBe(false);
    expect((await readPending(ext))[0]?.state).toBe('confirmed');
    expect((await knownRecipients(ext)).has(RECIPIENT)).toBe(true);
  });

  it('landed but failed: failed, and the fee was paid', async () => {
    const {ext, deps} = await submitted();
    deps.reader = fakeReader({getSignatureStatuses: async () => [{err: {InstructionError: [0, 'x']}, confirmationStatus: 'confirmed'}], getBlockHeight: async () => 900});
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]).toMatchObject({state: 'failed'});
    expect((await readPending(ext))[0]?.detail).toContain('network fee was paid');
  });

  it('within the margin past lastValidBlockHeight: no expiry check at all', async () => {
    const {ext, deps} = await submitted();
    const asked: (boolean | undefined)[] = [];
    expect(EXPIRY_MARGIN_BLOCKS).toBe(32);
    deps.reader = unseenAt(1032, asked);
    expect(await pollOnce(ext, deps)).toBe(true);
    expect(asked).toEqual([undefined]);
    expect((await readPending(ext))[0]).toMatchObject({state: 'pending', expiryNullSeenAt: null});
  });

  it('past the margin: the first null full-history answer only marks it; a second ≥ 2 s later expires it — no funds moved', async () => {
    const {ext, deps} = await submitted();
    const asked: (boolean | undefined)[] = [];
    deps.reader = unseenAt(EXPIRED_HEIGHT, asked);
    expect(await pollOnce(ext, deps)).toBe(true);
    expect(asked).toEqual([undefined, true]);
    expect((await readPending(ext))[0]).toMatchObject({state: 'pending', expiryNullSeenAt: deps.now()});
    deps.clock.t += POLL_INTERVAL_MS - 1;
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]?.state).toBe('pending');
    deps.clock.t += 1;
    expect(await pollOnce(ext, deps)).toBe(false);
    expect((await readPending(ext))[0]).toMatchObject({state: 'expired', detail: NOT_CONFIRMED});
  });

  it('past the margin but found in the full history on the second round: confirmed, not expired', async () => {
    const {ext, deps} = await submitted();
    deps.reader = unseenAt(EXPIRED_HEIGHT);
    await pollOnce(ext, deps);
    deps.clock.t += POLL_INTERVAL_MS;
    deps.reader = fakeReader({
      getSignatureStatuses: async (sigs, history) => (history === true ? [confirmed] : sigs.map(() => null)),
      getBlockHeight: async () => EXPIRED_HEIGHT,
    });
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]?.state).toBe('confirmed');
  });

  it('a getBlockHeight failure skips the expiry check for that round', async () => {
    const {ext, deps} = await submitted();
    let statusCalls = 0;
    deps.reader = fakeReader({
      getSignatureStatuses: async sigs => (statusCalls++, sigs.map(() => null)),
      getBlockHeight: async () => {
        throw new Error('hiccup');
      },
    });
    expect(await pollOnce(ext, deps)).toBe(true);
    expect((await readPending(ext))[0]).toMatchObject({state: 'pending', expiryNullSeenAt: null});
    expect(statusCalls).toBe(1);
  });

  it('a status failure changes nothing', async () => {
    const {ext, deps} = await submitted();
    deps.reader = fakeReader({
      getSignatureStatuses: async () => {
        throw new Error('down');
      },
    });
    expect(await pollOnce(ext, deps)).toBe(true);
    expect((await readPending(ext))[0]?.state).toBe('pending');
  });

  it('stuck after 90 s, still watched — and a stuck send can still confirm', async () => {
    const {ext, deps} = await submitted();
    deps.reader = unseenAt(900);
    deps.clock.t += STUCK_AFTER_MS;
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]?.state).toBe('pending');
    deps.clock.t += 1;
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]?.state).toBe('stuck');
    deps.reader = fakeReader({getSignatureStatuses: async () => [confirmed], getBlockHeight: async () => 900});
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]?.state).toBe('confirmed');
  });
});

describe('resend', () => {
  it('re-sends exactly the same bytes — same signature — never a new transaction', async () => {
    const {ext, deps, view} = await submitted();
    deps.clock.t += RESEND_MIN_INTERVAL_MS;
    const again = await resend(ext, deps, view.id);
    expect(deps.broadcasts).toHaveLength(2);
    expect([...deps.broadcasts[1]!]).toEqual([...deps.broadcasts[0]!]);
    expect(again.signature).toBe(view.signature);
  });

  it('refuses a resend within 2 s, after the send closed, and for an unknown id', async () => {
    const {ext, deps, view} = await submitted();
    await expect(resend(ext, deps, view.id)).rejects.toMatchObject({code: 'too-soon'});
    await expect(resend(ext, deps, 'nope')).rejects.toMatchObject({code: 'unknown'});
    deps.reader = unseenAt(EXPIRED_HEIGHT);
    await pollOnce(ext, deps);
    deps.clock.t += POLL_INTERVAL_MS;
    await pollOnce(ext, deps);
    await expect(resend(ext, deps, view.id)).rejects.toMatchObject({code: 'not-open'});
    expect(deps.broadcasts).toHaveLength(1);
  });

  it('a RE-send answered 403, or refused by the cool-down, leaves the send pending', async () => {
    for (const refusal of [new RpcForbidden('broadcast'), new RpcCoolingDown('broadcast')]) {
      const {ext, deps, view} = await submitted();
      deps.broadcast = async () => {
        throw refusal;
      };
      deps.clock.t += RESEND_MIN_INTERVAL_MS;
      const again = await resend(ext, deps, view.id);
      expect(again.state).toBe('pending');
      expect(again.detail).toContain('403');
    }
  });

  it('a refused RE-send does not mark the send failed — the first copy may already have landed', async () => {
    const {ext, deps, view} = await submitted();
    deps.broadcast = async () => {
      throw new BroadcastRejected('rejected', 'already processed');
    };
    deps.clock.t += RESEND_MIN_INTERVAL_MS;
    expect((await resend(ext, deps, view.id)).state).toBe('pending');
  });
});

describe('startPoller and the alarm', () => {
  it('polls every 2 s until nothing is open, and never runs twice at once', async () => {
    const sleeps: number[] = [];
    let round = 0;
    const {ext, deps} = await submitted({
      sleep: async ms => void sleeps.push(ms),
      reader: fakeReader({getSignatureStatuses: async sigs => (round++ === 0 ? sigs.map(() => null) : [confirmed]), getBlockHeight: async () => 900}),
    });
    const a = startPoller(ext, deps);
    expect(startPoller(ext, deps)).toBe(a);
    await a;
    expect(POLL_INTERVAL_MS).toBe(2_000);
    expect(sleeps.every(ms => ms === POLL_INTERVAL_MS)).toBe(true);
    expect(sleeps.length).toBeGreaterThanOrEqual(2);
    expect((await readPending(ext))[0]?.state).toBe('confirmed');
  });

  it('the alarm polls while no loop runs, re-arms while anything is open, and clears itself after', async () => {
    // A service worker that restarted with a record open: nothing is polling in this context.
    const ext = fakeExt();
    await ext.local.set(PENDING_KEY, [pendingRecord({account: ACCOUNT.publicKey, signature: firstSignature(signedWire())})]);
    const deps = depsWith({reader: unseenAt(900)});
    await onPendingAlarm(ext, deps);
    expect(ext.alarmsSet.get(PENDING_ALARM)).toBe(PENDING_ALARM_MINUTES);
    deps.reader = fakeReader({getSignatureStatuses: async () => [confirmed], getBlockHeight: async () => 900});
    await onPendingAlarm(ext, deps);
    expect((await readPending(ext))[0]?.state).toBe('confirmed');
    expect(ext.alarmsSet.has(PENDING_ALARM)).toBe(false);
  });
});

describe('the alarm and a send written meanwhile', () => {
  it('a record written and alarmed while the alarm decides to clear is not left without its alarm', async () => {
    const ext = fakeExt();
    await ext.local.set(PENDING_KEY, [pendingRecord({account: ACCOUNT.publicKey, signature: firstSignature(signedWire())})]);
    const deps = depsWith({reader: fakeReader({getSignatureStatuses: async () => [confirmed], getBlockHeight: async () => 900})});
    const clear = ext.alarms.clear;
    ext.alarms.clear = async name => {
      // A send for another account lands between the decision and the clear, arming the alarm itself.
      const now = (await ext.local.get(PENDING_KEY)) as PendingRecord[];
      await ext.local.set(PENDING_KEY, [...now, pendingRecord({id: 'r2', account: 'B', signature: 's2', createdAt: deps.now()})]);
      await ext.alarms.create(PENDING_ALARM, {delayInMinutes: PENDING_ALARM_MINUTES});
      return clear(name);
    };
    await onPendingAlarm(ext, deps);
    expect(ext.alarmsSet.get(PENDING_ALARM)).toBe(PENDING_ALARM_MINUTES);
  });
});

describe('lock and pending sends (owner decision A)', () => {
  it('a lock clears storage.session and leaves v1_pending in storage.local intact', async () => {
    const {ext} = await submitted();
    await ext.session.set('v1_prepared', [{id: 'x'}]);
    const before = await ext.local.get(PENDING_KEY);
    await lock(ext);
    expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
    expect(await ext.session.get('v1_prepared')).toBeUndefined();
    expect(await ext.local.get(PENDING_KEY)).toEqual(before);
  });
});
