import {NOT_CONFIRMED, pollOnce, submitSigned} from '../pending';
import {PENDING_KEY, readPending, viewOf} from '../pendingStore';
import type {WalletDeps} from '../deps';
import {BroadcastRejected, firstSignature} from '../../../../core/solana/broadcast';
import {RpcCoolingDown, type SignatureStatus} from '../../../../core/solana/rpc';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, pendingRecord, signedWire, unlocked} from './fixtures';

// Spec B1b-2a E8: every place the engine writes `failed` says why — #44 keys on `failure`, never on
// the free-text `detail`, which stays exactly what B1b-1 wrote.
const INTENT = {token: 'SOL' as const, recipient: RECIPIENT, amount: '1'};
const landedWithErr: SignatureStatus = {err: {InstructionError: [0, 'x']}, confirmationStatus: 'finalized'};
const EXPIRED_HEIGHT = 1033;

async function submitted(broadcast?: WalletDeps['broadcast']) {
  const ext = fakeExt();
  await unlocked(ext);
  const deps = fakeDeps({broadcast: broadcast ?? (async wire => firstSignature(wire))});
  const view = await submitSigned(ext, deps, {account: ACCOUNT.publicKey, wire: signedWire(), lastValidBlockHeight: 1000, intent: INTENT});
  return {ext, deps, view};
}

describe('PendingRecord.failure (E8)', () => {
  it('first broadcast refused by the route (400 with a contract reason): not-sent, detail unchanged', async () => {
    const {view} = await submitted(async () => {
      throw new BroadcastRejected('rejected', 'Blockhash not found');
    });
    expect(view).toMatchObject({state: 'failed', failure: 'not-sent', detail: 'The network refused this transaction (rejected: Blockhash not found). No funds moved.'});
  });

  it('first broadcast refused by the cool-down before sending: not-sent, detail unchanged', async () => {
    const {view} = await submitted(async () => {
      throw new RpcCoolingDown('broadcast');
    });
    expect(view).toMatchObject({state: 'failed', failure: 'not-sent', detail: 'Not sent: the coordinator is cooling down after an earlier HTTP 403. No funds moved.'});
  });

  it('the poller’s regular status check finds it landed with an error: landed', async () => {
    const {ext, deps} = await submitted();
    deps.reader = fakeReader({getSignatureStatuses: async () => [landedWithErr], getBlockHeight: async () => 900});
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]).toMatchObject({state: 'failed', failure: 'landed', detail: 'Landed but failed ({"InstructionError":[0,"x"]}): the network fee was paid, nothing was sent.'});
  });

  it('the full-history check past lastValidBlockHeight + 32 finds it landed with an error: landed', async () => {
    const {ext, deps} = await submitted();
    deps.reader = fakeReader({
      getSignatureStatuses: async (sigs, history) => (history === true ? [landedWithErr] : sigs.map(() => null)),
      getBlockHeight: async () => EXPIRED_HEIGHT,
    });
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]).toMatchObject({state: 'failed', failure: 'landed'});
  });

  it('every other state carries null: pending, confirmed, expired', async () => {
    const {ext, deps, view} = await submitted();
    expect(view.failure).toBeNull();
    deps.reader = fakeReader({getSignatureStatuses: async sigs => sigs.map(() => null), getBlockHeight: async () => EXPIRED_HEIGHT});
    await pollOnce(ext, deps);
    deps.clock.t += 2_000;
    await pollOnce(ext, deps);
    expect((await readPending(ext))[0]).toMatchObject({state: 'expired', detail: NOT_CONFIRMED, failure: null});
    const ok = await submitted();
    ok.deps.reader = fakeReader({getSignatureStatuses: async () => [{err: null, confirmationStatus: 'confirmed'}], getBlockHeight: async () => 900});
    await pollOnce(ok.ext, ok.deps);
    expect((await readPending(ok.ext))[0]).toMatchObject({state: 'confirmed', failure: null});
  });

  it('a record from before E8 (no failure field) reads as null; any other value drops it', async () => {
    const ext = fakeExt();
    const {failure: _dropped, ...old} = pendingRecord({state: 'failed'});
    await ext.local.set(PENDING_KEY, [old, {...old, id: 'r2', failure: 'exploded'}]);
    const read = await readPending(ext);
    expect(read.map(r => [r.id, r.failure])).toEqual([['r1', null]]);
    expect(viewOf(read[0]!).failure).toBeNull();
  });
});
