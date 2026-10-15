import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {VersionedTransaction} from '@solana/web3.js';
import {AUTOLOCK_ALARM, lock} from '../../autolock';
import {handleMessage} from '../../messages';
import {inFlightFor, markDue, readPending, updatePending} from '../../pendingStore';
import {RESEND_MIN_INTERVAL_MS, pollOnce, recordDappSend} from '../../pending';
import {parseWire} from '../decode/wire';
import {signAll} from '../signTx';
import {BROADCAST_TIMEOUT_MS} from '../../deps';
import {GRANTS_KEY, type Grant} from '../grants';
import {DAPP_TXS_KEY} from '../dappTxs';
import {runtimeFor} from '../ports';
import {DAPP_SESSION_KEY, readDappSession} from '../store';
import {DECIDING_TTL_MS, REQUEST_TTL_MS, SEND_DECIDING_TTL_MS, promised} from '../queue';
import {BroadcastRejected, BroadcastUnavailable, firstSignature} from '../../../../../core/solana/broadcast';
import {ACCOUNT, RECIPIENT, pendingRecord, signedWire} from '../../__tests__/fixtures';
import {DAPP, ME, coSigned, transfer, txScene, v0} from './txHarness';

/** A scene with a signAndSend request simulated and ready to approve; `broadcast` is what the route does. */
async function ready(broadcast?: (wire: Uint8Array) => Promise<string>, tx = v0([transfer(1_000_000)])) {
  const c = await txScene({known: [RECIPIENT]});
  if (broadcast !== undefined) c.deps.broadcast = broadcast;
  const r = await c.send('s', tx);
  const requestId = String(r?.requestId);
  const simulation = String((await c.simulated()).request?.tx?.simulation.id);
  return {...c, requestId, simulation, go: () => c.approve(requestId, simulation)};
}

// Spec B1c §1.5 step 2, §3.3, C17 — real funds: no double signature, no double broadcast.
describe('page.signAndSendTransaction — the effect', () => {
  it('the signed bytes and the signature are recorded (v1_pending, then the entry) BEFORE the broadcast; the page gets the signature once', async () => {
    const seen: {pending: number; sent: unknown}[] = [];
    let c!: Awaited<ReturnType<typeof ready>>;
    c = await ready(async wire => {
      // What a worker that stopped right now would find: the pending record and the entry's record.
      seen.push({pending: (await readPending(c.ext)).length, sent: (await readDappSession(c.ext)).queue[0]?.sent});
      return firstSignature(wire);
    });
    expect(await c.go()).toEqual({ok: true});
    const [record] = await readPending(c.ext);
    expect(record).toMatchObject({account: ACCOUNT.publicKey, origin: DAPP, intent: null, state: 'pending', lastValidBlockHeight: 5_000});
    const signature = String(record?.signature);
    expect(seen).toEqual([{pending: 1, sent: {wire: record?.wire, signature}}]);
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, result: {signature}}]);
    // The signature is the account's, over the dApp's message.
    const tx = VersionedTransaction.deserialize(base64.decode(String(record?.wire)));
    expect(ed25519.verify(base58.decode(signature), tx.message.serialize(), ME.toBytes())).toBe(true);
    // The history badge's list, and the grant's last interactions.
    expect(await c.ext.local.get(DAPP_TXS_KEY)).toEqual([{signature, origin: DAPP, at: c.deps.clock.t}]);
    expect(((await c.ext.local.get(GRANTS_KEY)) as Grant[])[0]?.recent[0]).toEqual({type: 'signAndSendTransaction', at: c.deps.clock.t, outcome: 'approved'});
  });

  it('a dApp’s record is not the wallet’s send: the popup’s pending list omits it, and it blocks no send of the wallet’s own', async () => {
    const c = await ready(async wire => firstSignature(wire));
    await c.go();
    const records = await readPending(c.ext);
    expect(records).toHaveLength(1);
    expect(inFlightFor(records, ACCOUNT.publicKey)).toBeUndefined();
    const popup = {id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/popup.html`};
    expect(await handleMessage(c.ext, {type: 'wallet.pending'}, popup, c.deps)).toEqual({ok: true, data: []});
  });

  it('the route refuses before forwarding (nothing reached the network): send-failed (§1.6, rev 3.3), the record failed not-sent', async () => {
    const c = await ready(async () => {
      throw new BroadcastRejected('rejected', 'Blockhash not found');
    });
    await c.go();
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, error: 'send-failed'}]);
    expect((await readPending(c.ext))[0]).toMatchObject({state: 'failed', failure: 'not-sent'});
  });

  it('not acknowledged (it may land): the signature, the record still pending — the dApp confirms (B1 §3)', async () => {
    const c = await ready(async () => {
      throw new BroadcastUnavailable(502);
    });
    await c.go();
    const [record] = await readPending(c.ext);
    expect(record).toMatchObject({state: 'pending', detailCode: 'unacked'});
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, result: {signature: record?.signature}}]);
  });

  it('a co-signed transaction: broadcast with both signatures, the dApp’s untouched', async () => {
    const wires: Uint8Array[] = [];
    const c = await ready(async wire => {
      wires.push(wire);
      return firstSignature(wire);
    }, coSigned());
    await c.go();
    expect(wires).toHaveLength(1);
    const sent = VersionedTransaction.deserialize(wires[0] ?? new Uint8Array());
    expect(sent.signatures[0]).toEqual(VersionedTransaction.deserialize(base64.decode(coSigned())).signatures[0]);
    expect(ed25519.verify(sent.signatures[1] ?? new Uint8Array(), sent.message.serialize(), ME.toBytes())).toBe(true);
    // The id is the fee payer's (the dApp's) signature; the badge list holds it.
    expect(((await c.ext.local.get(DAPP_TXS_KEY)) as {signature: string}[])[0]?.signature).toBe(firstSignature(wires[0] ?? new Uint8Array()));
  });

  it('a restart with the signed bytes recorded: answered the signature from the record — never signed or broadcast again', async () => {
    let broadcasts = 0;
    const c = await ready(async wire => {
      broadcasts++;
      return firstSignature(wire);
    });
    const s = await readDappSession(c.ext);
    const sent = {wire: 'AQ==', signature: '3'.repeat(88)};
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, state: 'deciding', decidedBy: 'the-dead-instance', decidingAt: c.deps.clock.t, decision: {kind: 'approve', account: ACCOUNT.publicKey, scope: null}, sent}))});
    expect(runtimeFor(c.ext).instance).not.toBe('the-dead-instance');
    expect(await c.page.ask({type: 'page.resume', requestIds: [c.requestId]})).toEqual({resume: [{requestId: c.requestId, result: {signature: sent.signature}}]});
    expect(await c.go()).toEqual({ok: false, error: 'not-head'});
    expect(broadcasts).toBe(0);
  });

  it('a restart before the record: rejected (nothing left the extension) — the mutation "no sent record" would answer a signature never made', async () => {
    const c = await ready(async wire => firstSignature(wire));
    const s = await readDappSession(c.ext);
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, state: 'deciding', decidedBy: 'the-dead-instance', decidingAt: c.deps.clock.t, decision: {kind: 'approve', account: ACCOUNT.publicKey, scope: null}}))});
    expect(await c.page.ask({type: 'page.resume', requestIds: [c.requestId]})).toEqual({resume: [{requestId: c.requestId, error: 'rejected'}]});
  });

  it('a lock after the record, during the broadcast: the lock answers the signature, the broadcast still runs once, no second answer', async () => {
    let broadcasts = 0;
    let c!: Awaited<ReturnType<typeof ready>>;
    c = await ready(async wire => {
      broadcasts++;
      await lock(c.ext);
      return firstSignature(wire);
    });
    expect(await c.go()).toEqual({ok: true});
    const [record] = await readPending(c.ext);
    expect(broadcasts).toBe(1);
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, result: {signature: record?.signature}}]);
  });

  it('a lock between the deciding section and the effect (the auto-lock arm): rejected, nothing signed into v1_pending, nothing broadcast', async () => {
    let broadcasts = 0;
    const c = await ready(async wire => {
      broadcasts++;
      return firstSignature(wire);
    });
    const create = c.ext.alarms.create;
    c.ext.alarms.create = (name, o) => (name === AUTOLOCK_ALARM ? lock(c.ext) : create(name, o));
    expect(await c.go()).toEqual({ok: true});
    expect(broadcasts).toBe(0);
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, error: 'rejected'}]);
    expect(await readPending(c.ext)).toEqual([]);
  });

  it('the grant revoked while the key is read: rejected, and the recorded bytes are marked never sent (no broadcast)', async () => {
    let broadcasts = 0;
    const c = await ready(async wire => {
      broadcasts++;
      return firstSignature(wire);
    });
    const get = c.ext.session.get;
    let revoked = false;
    c.ext.session.get = async k => {
      const v = await get(k);
      if (k === 'v1_session' && !revoked && (await readDappSession(c.ext)).queue[0]?.state === 'deciding') {
        revoked = true;
        await c.ext.local.set(GRANTS_KEY, []);
      }
      return v;
    };
    expect(await c.go()).toEqual({ok: true});
    expect(revoked).toBe(true);
    expect(broadcasts).toBe(0);
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, error: 'rejected'}]);
    expect((await readPending(c.ext))[0]).toMatchObject({state: 'failed', failure: 'not-sent'});
  });

  it('a dead send effect (this instance) with its bytes recorded: still deciding at DECIDING_TTL_MS, answered the signature at SEND_DECIDING_TTL_MS — above the route’s 30 s (review 1 L2)', async () => {
    expect(SEND_DECIDING_TTL_MS).toBeGreaterThan(BROADCAST_TIMEOUT_MS);
    const c = await ready(async wire => firstSignature(wire));
    const s = await readDappSession(c.ext);
    const sent = {wire: 'AQ==', signature: '4'.repeat(88)};
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, state: 'deciding', decidedBy: runtimeFor(c.ext).instance, decidingAt: c.deps.clock.t, decision: {kind: 'approve', account: ACCOUNT.publicKey, scope: null}, sent}))});
    c.deps.clock.t += DECIDING_TTL_MS;
    // A route call may still be running (BROADCAST_TIMEOUT_MS): not yet a dead effect.
    expect(await c.page.ask({type: 'page.resume', requestIds: [c.requestId]})).toEqual({resume: [{requestId: c.requestId, pending: true}]});
    c.deps.clock.t += SEND_DECIDING_TTL_MS - DECIDING_TTL_MS;
    expect(await c.page.ask({type: 'page.resume', requestIds: [c.requestId]})).toEqual({resume: [{requestId: c.requestId, result: {signature: sent.signature}}]});
  });

  /**
   * Review 1 M1: the state a worker stopped at, built from the real pieces — the bytes recorded in v1_pending
   * (recordDappSend), the entry `deciding` by an instance that no longer runs, with or without its `sent` record.
   */
  async function stoppedAt(withSent: boolean) {
    const wires: Uint8Array[] = [];
    const c = await ready(async wire => {
      wires.push(wire);
      return firstSignature(wire);
    });
    const unsigned = base64.decode(String((await readDappSession(c.ext)).queue[0]?.transactions?.[0]));
    const parsed = parseWire(unsigned);
    if (parsed === null) throw new Error('the scene’s transaction does not parse');
    // Signed as the effect signs it (the account's slot), then recorded as the effect records it.
    const [wire = new Uint8Array()] = signAll([unsigned], [parsed], ACCOUNT);
    const record = await recordDappSend(c.ext, c.deps, {account: ACCOUNT.publicKey, wire, lastValidBlockHeight: 5_000, origin: DAPP});
    const s = await readDappSession(c.ext);
    const sent = withSent ? {wire: record.wire, signature: record.signature} : null;
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, state: 'deciding', decidedBy: 'the-dead-instance', decidingAt: c.deps.clock.t, decision: {kind: 'approve', account: ACCOUNT.publicKey, scope: null}, sent}))});
    return {...c, wires, record};
  }

  it('a restart after the entry recorded the bytes and before the route: the page is answered the signature, and the bytes reach the route exactly once (the poller’s next round)', async () => {
    const c = await stoppedAt(true);
    expect((await readPending(c.ext))[0]?.firstBroadcast).toBe('held');
    expect(await c.page.ask({type: 'page.resume', requestIds: [c.requestId]})).toEqual({resume: [{requestId: c.requestId, result: {signature: c.record.signature}}]});
    // Marked owed before the answer was stored; nothing sent yet.
    expect((await readPending(c.ext))[0]?.firstBroadcast).toBe('due');
    expect(c.wires).toEqual([]);
    await pollOnce(c.ext, c.deps);
    expect(c.wires.map(w => base64.encode(w))).toEqual([c.record.wire]);
    expect((await readPending(c.ext))[0]).toMatchObject({firstBroadcast: 'done', state: 'pending'});
    // Positive control: a record already handed over is never sent again.
    await pollOnce(c.ext, c.deps);
    await pollOnce(c.ext, c.deps);
    expect(c.wires).toHaveLength(1);
  });

  it('a lock after the entry recorded the bytes, the effect stopped: the lock answers the signature, marks the record due, and the poller sends the bytes once', async () => {
    const c = await stoppedAt(true);
    await lock(c.ext);
    expect(await c.page.ask({type: 'page.resume', requestIds: [c.requestId]})).toEqual({resume: [{requestId: c.requestId, result: {signature: c.record.signature}}]});
    expect((await readPending(c.ext))[0]?.firstBroadcast).toBe('due');
    await pollOnce(c.ext, c.deps);
    await pollOnce(c.ext, c.deps);
    expect(c.wires.map(w => base64.encode(w))).toEqual([c.record.wire]);
  });

  // Plan 2 review 2 L1: C4's five-minute expiry never answers a recorded send `timeout`.
  it('an approval in C4’s last seconds whose route call straddles the five-minute mark: the page gets the signature, never `timeout`; the bytes went once', async () => {
    let c!: Awaited<ReturnType<typeof ready>>;
    let broadcasts = 0;
    c = await ready(async wire => {
      broadcasts++;
      // The route answers 20 s later (inside BROADCAST_TIMEOUT_MS): past arrivedAt + REQUEST_TTL_MS by then.
      c.deps.clock.t += 20_000;
      return firstSignature(wire);
    });
    const arrivedAt = (await readDappSession(c.ext)).queue[0]?.arrivedAt ?? 0;
    // A fresh simulation near the end of C4's five minutes (the window refreshed it), then the approval.
    c.deps.clock.t = arrivedAt + REQUEST_TTL_MS - 10_000;
    const fresh = String((await c.simulated(c.simulation)).request?.tx?.simulation.id);
    expect(await c.approve(c.requestId, fresh)).toEqual({ok: true});
    const [record] = await readPending(c.ext);
    expect(broadcasts).toBe(1);
    expect(record?.firstBroadcast).toBe('done');
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, result: {signature: record?.signature}}]);
  });

  it('a restart with the bytes recorded, first swept after C4’s five minutes: the signature (not `timeout`), the record due, the poller sends it once', async () => {
    const c = await stoppedAt(true);
    const arrivedAt = (await readDappSession(c.ext)).queue[0]?.arrivedAt ?? 0;
    c.deps.clock.t = arrivedAt + REQUEST_TTL_MS;
    expect(await c.page.ask({type: 'page.resume', requestIds: [c.requestId]})).toEqual({resume: [{requestId: c.requestId, result: {signature: c.record.signature}}]});
    expect((await readPending(c.ext))[0]?.firstBroadcast).toBe('due');
    await pollOnce(c.ext, c.deps);
    await pollOnce(c.ext, c.deps);
    expect(c.wires.map(w => base64.encode(w))).toEqual([c.record.wire]);
  });

  // The invariant behind every `due` (review 2's MX2): a page is promised a send only by an answer that IS its signature.
  it('promised: only an answer that is the entry’s recorded signature marks a record due — never an error on an entry with bytes recorded', async () => {
    const c = await stoppedAt(true);
    const [e] = (await readDappSession(c.ext)).queue;
    if (e === undefined) throw new Error('no entry');
    const sig = c.record.signature;
    expect(promised([{...e, state: 'answered', answer: {result: {signature: sig}}}])).toEqual([sig]);
    for (const answer of [{error: 'timeout'}, {error: 'rejected'}, {error: 'send-failed'}, {result: {signature: '5'.repeat(88)}}] as const) {
      expect([answer, promised([{...e, state: 'answered', answer}])]).toEqual([answer, []]);
    }
    expect(promised([{...e, sent: null, state: 'answered', answer: {result: {signature: sig}}}])).toEqual([]);
  });

  it('a stop between the record and the entry’s `sent`: the page is answered rejected, and the recorded bytes never reach the route', async () => {
    const c = await stoppedAt(false);
    expect(await c.page.ask({type: 'page.resume', requestIds: [c.requestId]})).toEqual({resume: [{requestId: c.requestId, error: 'rejected'}]});
    await pollOnce(c.ext, c.deps);
    await pollOnce(c.ext, c.deps);
    expect(c.wires).toEqual([]);
    // Held, never owed: it polls until it expires ("Not confirmed — no funds moved", true).
    expect((await readPending(c.ext))[0]).toMatchObject({firstBroadcast: 'held', state: 'pending'});
  });

  it('the effect and the poller never both send: a normal approval hands the bytes over once, and a lock’s `due` during the broadcast adds no second one', async () => {
    let c!: Awaited<ReturnType<typeof ready>>;
    let broadcasts = 0;
    c = await ready(async wire => {
      broadcasts++;
      // The lock marks the record due while the effect's broadcast runs; the poller runs too — once (review 2 L5: a
      // poller inside every broadcast recursed without end under a claim that never marks `done`).
      if (broadcasts === 1) {
        await lock(c.ext);
        await pollOnce(c.ext, c.deps);
      }
      return firstSignature(wire);
    });
    expect(await c.go()).toEqual({ok: true});
    await pollOnce(c.ext, c.deps);
    expect(broadcasts).toBe(1);
    expect((await readPending(c.ext))[0]?.firstBroadcast).toBe('done');
  });

  // Controller ruling on Task 5: "Send again" (wallet.resend) never sends a dApp's record, whatever its first-broadcast state.
  it('wallet.resend refuses a dApp record — held (its page answered rejected) and due (the poller owns it); a wallet send re-sends as before', async () => {
    const c = await stoppedAt(false);
    const popup = {id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/popup.html`};
    c.deps.clock.t += RESEND_MIN_INTERVAL_MS;
    expect((await readPending(c.ext))[0]?.firstBroadcast).toBe('held');
    expect(await handleMessage(c.ext, {type: 'wallet.resend', id: c.record.id}, popup, c.deps)).toEqual({ok: false, error: 'unknown'});
    expect(c.wires).toEqual([]);
    await markDue(c.ext, [c.record.signature]);
    expect((await readPending(c.ext))[0]?.firstBroadcast).toBe('due');
    expect(await handleMessage(c.ext, {type: 'wallet.resend', id: c.record.id}, popup, c.deps)).toEqual({ok: false, error: 'unknown'});
    expect(c.wires).toEqual([]);
    // Positive control: the wallet's own open send (origin null) is re-sent, its own bytes, once.
    const own = base64.encode(signedWire(7n));
    await updatePending(c.ext, rs => [...rs, pendingRecord({id: 'own', account: ACCOUNT.publicKey, signature: '6'.repeat(88), wire: own})]);
    expect(await handleMessage(c.ext, {type: 'wallet.resend', id: 'own'}, popup, c.deps)).toMatchObject({ok: true});
    expect(c.wires.filter(w => base64.encode(w) === own)).toHaveLength(1);
    expect(c.wires.filter(w => base64.encode(w) === c.record.wire).length).toBeLessThanOrEqual(1);
  });
});

describe('the history badge (#26b, #27b)', () => {
  it('signTransaction: a transaction the account pays for is listed by its id; one another signer pays for is not', async () => {
    const c = await txScene({known: [RECIPIENT]});
    const r = await c.signTx('t', [v0(), coSigned()]);
    const id = (await c.simulated()).request?.tx?.simulation.id;
    await c.approve(String(r?.requestId), id);
    const signed = (c.page.answersFor(String(r?.requestId))[0]?.result as {signed: string[]}).signed;
    expect(await c.ext.local.get(DAPP_TXS_KEY)).toEqual([{signature: firstSignature(base64.decode(signed[0] ?? '')), origin: DAPP, at: c.deps.clock.t}]);
  });

  it('wallet.history marks a listed signature origin "dapp", every other row null', async () => {
    const c = await txScene();
    const listed = '2'.repeat(88);
    const other = '3'.repeat(88);
    await c.ext.local.set(DAPP_TXS_KEY, [{signature: listed, origin: DAPP, at: 1}]);
    c.deps.reader.getSignaturesForAddress = async () => [
      {signature: listed, blockTime: 1, err: null},
      {signature: other, blockTime: 1, err: null},
    ];
    c.deps.reader.getTransaction = async () => ({blockTime: 1, meta: {err: null, fee: 5000, preBalances: [], postBalances: [], preTokenBalances: [], postTokenBalances: []}, transaction: {message: {accountKeys: [], instructions: []}}});
    // History paces its getTransaction calls (two a second) with deps.sleep; nothing else runs here.
    c.deps.sleep = async () => undefined;
    const popup = {id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/popup.html`};
    const r = (await handleMessage(c.ext, {type: 'wallet.history', account: ACCOUNT.publicKey}, popup, c.deps)) as {ok: true; data: {items: {signature: string; origin: unknown}[]}};
    expect(r.data.items.map(i => [i.signature, i.origin])).toEqual([
      [listed, 'dapp'],
      [other, null],
    ]);
  });
});
