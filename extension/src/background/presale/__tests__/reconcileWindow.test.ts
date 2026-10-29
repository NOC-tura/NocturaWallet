import {readPresaleRecords, reconcilePresaleRecords, runPresaleRecords, unrecordedFor} from '../record';
import {readPending, updatePending, type PendingRecord} from '../../pendingStore';
import {VAULT_KEY} from '../../accountsStore';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {fakeExt} from '../../__tests__/fakeExt';
import {ACCOUNT as SESSION_ACCOUNT, pendingRecord, signedWire} from '../../__tests__/fixtures';
import {MAINNET_SOL_TREASURY} from '../../../../../core/presale/addresses';
import {firstSignature} from '../../../../../core/solana/broadcast';

// B1d §2.4, the controller's reconcile ruling and its accepted gap (the plan's Review Focus 1): the wake can only find
// what v1_pending still holds. A confirmed purchase whose entry the hook never wrote is recovered while it is among the
// 20 newest closed records (pendingStore's MAX_RECORDS, every kind and account counted); 20 newer ones push it out, and
// then nothing records it and #27 has no Q34 for it. Both sides of that edge are rows here, the numbers written out.

const ACCOUNT = SESSION_ACCOUNT.publicKey;
const SIG = firstSignature(signedWire(11n));
const T0 = 1_000_000;
const ENVELOPE = {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: ACCOUNT}]};
/** §2.3: a purchase's `extra.data` as the kind writes it — 2 SOL at stage 0, no referrer (record.test.ts's). */
const DATA = {currency: 'SOL', amount: '2000000000', stage: '0', priceTicks: '1501', nocBase: '1998667554963357', spentCents: '30000', destination: MAINNET_SOL_TREASURY, referrer: null};
const PURCHASE = pendingRecord({id: 'buy', account: ACCOUNT, signature: SIG, intent: null, state: 'confirmed', createdAt: T0 - 60_000, fee: {networkLamports: '5050', markupLamports: '0'}, extra: {kind: 'presale-buy', data: DATA}});
/** A later confirmed send of the same account — any closed record counts toward the 20. */
const send = (n: number): PendingRecord => pendingRecord({id: `send-${n}`, account: ACCOUNT, signature: `send-signature-${n}`, state: 'confirmed', createdAt: T0 + n});

/** The purchase confirmed with no entry (the worker stopped before the hook), then `newer` closed records, then a wake. */
async function wokenAfter(newer: number) {
  const ext = fakeExt();
  const posts: unknown[] = [];
  const deps = fakeDeps({postJson: async (_path, body) => (posts.push(body), {status: 200, body: {success: true}})});
  deps.clock.t = T0;
  await ext.local.set(VAULT_KEY, ENVELOPE);
  await updatePending(ext, records => [...records, PURCHASE]);
  for (let n = 1; n <= newer; n++) await updatePending(ext, records => [...records, send(n)]);
  await reconcilePresaleRecords(ext, deps);
  await runPresaleRecords(ext, deps);
  const held = (await readPending(ext)).some(r => r.signature === SIG);
  return {held, posts: posts.length, entries: (await readPresaleRecords(ext)).map(e => [e.signature, e.state]), unrecorded: await unrecordedFor(ext, ACCOUNT)};
}

describe('the reconcile window (§2.4, the accepted gap): only what v1_pending still holds is reconciled', () => {
  it('19 newer closed records: the purchase is still held — reconciled, POSTed once, done (positive control)', async () => {
    expect(await wokenAfter(19)).toEqual({held: true, posts: 1, entries: [[SIG, 'done']], unrecorded: []});
  });

  it('20 newer closed records push it out: nothing reconciled, nothing POSTed, no entry — so #27 has no Q34 for it either', async () => {
    expect(await wokenAfter(20)).toEqual({held: false, posts: 0, entries: [], unrecorded: []});
  });
});
