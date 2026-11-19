/**
 * The A0 unshield flow (spec §6 steps 1–9, R5, R6, R12, I-2, I7, S3, S9, S10, S11; §8 the pending
 * unshield; §10 the fresh reservation; §14 JS "every relayer outcome, … the re-quote → re-confirm
 * rule, the confirmed sync retry bound, … the fresh-pending reservation").
 *
 * The world (`__testing__/unshieldWorld.ts`): the REAL web3.js Connection over the live devnet fake
 * (the recorded tree + the test seed's own deposits from the OFFLINE equations), the live relayer
 * fake (the transport's real URL check, JSON parsing and deadline; landings in the RECORDED shape
 * of 47k56NfB… / 3oHktG2X… carrying OUR nullifier, change commitment, amount, fee, root and proof,
 * to OUR owner and ATA), and the fake native core (`offlineA0.ts`): one authorization at a time,
 * every prove consuming it, the withdraw_change public inputs computed offline. Every expected
 * value — the nullifier, the change note, the ATAs — comes from the offline vectors, never from the
 * code under test.
 */
jest.mock('@solana/web3.js', () =>
  jest.requireActual<typeof import('../__testing__/realWeb3')>('../__testing__/realWeb3').loadRealWeb3(),
);
jest.mock('react-native', () => ({
  NativeModules: {
    NocturaProver: jest.requireActual<typeof import('../__testing__/offlineA0')>('../__testing__/offlineA0').createFakeProverNative(),
  },
  Platform: {OS: 'android', select: (o: {android?: unknown; default?: unknown}) => o.android ?? o.default},
}));
import {NativeModules} from 'react-native';
import {PublicKey} from '@solana/web3.js';
import {base58} from '@scure/base';
import {clearAllStores, initSecureMmkv, mmkvPublic, mmkvSecure} from '../../../../store/mmkv/instances';
import {storeTransparentScheme} from '../../../keyDerivation/derivationScheme';
import {TEST_SEED, seedBytes, strangerField} from '../__testing__/offlineA0';
import type {FakeProverNative} from '../__testing__/offlineA0';
import {ACCOUNT, MAIN, OTHER, RECORDED_LEAVES, WITHDRAW_IO, expectedChange, unshieldWorld} from '../__testing__/unshieldWorld';
import type {UnshieldWorld} from '../__testing__/unshieldWorld';
import {LIVE_FEE, LIVE_GRANT, RELAYER_FEE_PAYER} from '../__testing__/liveRelayer';
import {DEVNET_GENESIS} from '../__testing__/liveDevnet';
import {blobsOf, fromHex, setBlob, toHex} from '../__testing__/chainEdits';
import {nullifierPda} from '../__testing__/ownHistory';
import type {RecordedTx, RpcRequest} from '../__testing__/recordedRpc';
import {loadA0NoteStore} from '../noteStore';
import type {A0Note} from '../noteStore';
import {loadA0AccountRegistry, resetA0ReservationsForTests} from '../accountRegistry';
import {resetA0ReadoutForTests, setA0ReadoutDefaultsForTests} from '../checkpointReadout';
import {interpretA0SubmitAnswer} from '../relayerClient';
import {
  A0UnshieldError,
  a0ChainTime,
  a0IsGenericRelayFailed,
  a0UnshieldDestinationOffer,
  a0UnshieldSource,
  reconcileA0PendingUnshields,
  resetA0UnshieldForTests,
  unshieldA0,
} from '../unshieldFlow';
import type {A0UnshieldOptions, A0UnshieldOutcome, A0UnshieldRequest, A0UnshieldStage} from '../unshieldFlow';

const fake = NativeModules.NocturaProver as unknown as FakeProverNative;
const TREE_ADDR = '5URdh1uLKXPh28AbcXBK1oWYGpQjVbMSjrKiAkt1q1Gc';
const FRESH1 = ACCOUNT(1);
const FRESH2 = ACCOUNT(2);
/** §6 step 8, written out (not imported from the code under test) */
const RETRIES = 10;
const PAUSE_MS = 3000;

// every row runs the real web3.js over whole tree syncs (0.3–2 s alone); a full parallel Jest run
// was measured to push the 11-sync row past the default 5 s
jest.setTimeout(30_000);

let w: UnshieldWorld;
let lines: string[];

const opts = (extra: Partial<A0UnshieldOptions> = {}): A0UnshieldOptions => ({
  io: WITHDRAW_IO,
  sync: {useCache: false},
  transport: w.relayer.transport,
  confirmSyncDelayMs: 1,
  ...extra,
});
const run = (req: A0UnshieldRequest, extra: Partial<A0UnshieldOptions> = {}): Promise<A0UnshieldOutcome> =>
  unshieldA0(w.net.connection, seedBytes(TEST_SEED), req, opts(extra));
const fresh = (amount: bigint): A0UnshieldRequest => ({destination: {kind: 'fresh'}, amount});
const codeOf = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
  } catch (e) {
    return (e as {code?: string}).code ?? String(e);
  }
  return 'resolved';
};
const noteOf = (rho: string): A0Note => loadA0NoteStore().notes.find(n => n.rho === rho)!;
const registry = () => loadA0AccountRegistry()!.map(e => ({scheme: e.scheme, role: e.role, ...(e.linked ? {linked: true} : {})}));
const treeWalks = (from = 0) =>
  w.net.requests.slice(from).filter(r => r.method === 'getSignaturesForAddress' && r.params[0] === TREE_ADDR).length;
const readouts = (event: string) =>
  lines.map(l => JSON.parse(l.split(' ').slice(3).join(' ')) as Record<string, unknown>).filter(p => p.event === event);

beforeEach(() => {
  clearAllStores();
  initSecureMmkv('test-key');
  resetA0UnshieldForTests();
  resetA0ReservationsForTests();
  resetA0ReadoutForTests();
  lines = [];
  setA0ReadoutDefaultsForTests({enabled: true, sink: l => lines.push(l), session: 't'});
  w = unshieldWorld(fake);
});
afterEach(async () => {
  // an abandoned flow (a kill, a hang) resumes on the rejection: let it finish before the next test
  w.relayer.abandon();
  await new Promise(r => setTimeout(r, 20));
  resetA0UnshieldForTests();
});

// ------------------------------------------------------------------ pure rules

describe('the destination offer (S3, S9, S11) and the source note (§6 step 2)', () => {
  it('slip10 + a grant: fresh available and preselected; without a grant: disabled ("no-grant"), nothing preselected', () => {
    expect(a0UnshieldDestinationOffer({gasGrantLamports: LIVE_GRANT}, {kind: 'slip10', account: 0})).toEqual({
      fresh: {available: true, grantLamports: LIVE_GRANT},
      preselected: 'fresh',
    });
    expect(a0UnshieldDestinationOffer({gasGrantLamports: null}, {kind: 'slip10', account: 3})).toEqual({
      fresh: {available: false, reason: 'no-grant'},
      preselected: null,
    });
  });
  it('a cli wallet: no fresh account even with a grant ("cli"), nothing preselected', () => {
    expect(a0UnshieldDestinationOffer({gasGrantLamports: LIVE_GRANT}, {kind: 'cli'})).toEqual({
      fresh: {available: false, reason: 'cli'},
      preselected: null,
    });
  });
  it('the largest unspent note (ties: the lowest leaf); max = amount − fee; pending / spent / too small → not a source', () => {
    const n = (amount: bigint, leafIndex: number, status: A0Note['status'] = 'unspent'): A0Note => ({
      commitment: strangerField(leafIndex),
      amount,
      rho: strangerField(100 + leafIndex),
      leafIndex,
      status,
      ...(status === 'pending' ? {pendingSince: 1} : {}),
    });
    expect(a0UnshieldSource([n(5n, 1), n(9n, 4), n(9n, 2), n(50n, 3, 'pending'), n(60n, 5, 'spent')], 3n)).toEqual({note: n(9n, 2), maxAmount: 6n});
    expect(a0UnshieldSource([n(10_001n, 1)], 10_000n)).toEqual({note: n(10_001n, 1), maxAmount: 1n});
    expect(a0UnshieldSource([n(10_000n, 1)], 10_000n)).toBeNull();
    expect(a0UnshieldSource([n(50n, 3, 'pending')], 0n)).toBeNull();
  });
});

// ------------------------------------------------------------------ landed and verified

describe('confirmed → the sync → the verifier → settled (§6 step 8)', () => {
  it('a FRESH account (the grant): spent at the landed tx, the change note exactly as a restore recovers it, slip10:1 fresh-exit', async () => {
    const stages: A0UnshieldStage[] = [];
    const out = await run(fresh(400_000n), {onStage: s => stages.push(s)});
    const sig = w.relayer.landed[0]!;
    const note = w.notes[0]!;
    const change = expectedChange(note, 400_000n, LIVE_FEE);
    expect(out).toEqual({
      status: 'spent',
      signature: sig,
      changeLeafIndex: RECORDED_LEAVES + 1,
      changeAmount: change.amount,
      grantLamports: LIVE_GRANT,
      destinationWithoutSol: false,
    });
    expect(stages).toEqual(['sync', 'quote', 'approval', 'proof', 'submit', 'confirm']);
    expect(loadA0NoteStore().notes).toEqual([
      {commitment: note.commitment, amount: note.amount, rho: note.rho, depositIndex: 0n, leafIndex: note.leafIndex, status: 'spent', spentTx: sig},
      {commitment: change.commitment, amount: change.amount, rho: change.rho, leafIndex: RECORDED_LEAVES + 1, status: 'unspent'},
    ]);
    expect(registry()).toEqual([
      {scheme: 'slip10:0', role: 'main'},
      {scheme: 'slip10:1', role: 'fresh-exit'},
    ]);
    // the payload: the approved owner and ITS ATA (offline vectors), the quote's fee, the circuit's order
    const p = w.relayer.submits[0]!;
    expect(p).toMatchObject({
      kind: 'withdraw_change',
      destinationOwner: FRESH1.address,
      destination: FRESH1.ata,
      withdrawAmount: '400000',
      fee: LIVE_FEE.toString(),
      nullifier: note.nullifier,
      changeCommitment: change.commitment,
      cuLimit: 200_000,
    });
    expect(fake.liveHandle()).toBeNull(); // the one handle closed in the finally
    expect(fake.liveAuth()).toBeNull(); // the prove consumed the authorization
    expect(fake.approvals).toBe(1);
  });

  it('"My main account" (holds SOL: no grant, create-ATA no-op): spent, the registry unchanged', async () => {
    const out = await run({destination: {kind: 'main'}, amount: 250_000n});
    expect(out).toMatchObject({status: 'spent', grantLamports: null, destinationWithoutSol: false});
    expect(w.relayer.submits[0]).toMatchObject({destinationOwner: MAIN.address, destination: MAIN.ata});
    expect(registry()).toEqual([{scheme: 'slip10:0', role: 'main'}]);
  });

  it('"Another address" (outside this seed): spent, the registry unchanged', async () => {
    const out = await run({destination: {kind: 'external', owner: OTHER.address}, amount: 250_000n});
    expect(out).toMatchObject({status: 'spent', grantLamports: null});
    expect(w.relayer.submits[0]).toMatchObject({destinationOwner: OTHER.address, destination: OTHER.ata});
    expect(registry()).toEqual([{scheme: 'slip10:0', role: 'main'}]);
  });

  it('zero change: the whole note minus the fee — the change is an amount-0 note, stored as a restore imports it', async () => {
    const note = w.notes[0]!;
    const out = await run(fresh(note.amount - LIVE_FEE));
    const change = expectedChange(note, note.amount - LIVE_FEE, LIVE_FEE);
    expect(change.amount).toBe(0n);
    expect(out).toMatchObject({status: 'spent', changeAmount: 0n});
    expect(noteOf(change.rho)).toEqual({commitment: change.commitment, amount: 0n, rho: change.rho, leafIndex: RECORDED_LEAVES + 1, status: 'unspent'});
  });

  it('a fresh account the relayer did not fund (no grant landed, owner at 0 lamports): spent, reported "no SOL", still fresh-exit', async () => {
    w.relayer.script.push({answer: 'confirmed', template: '3UfCx5TD'});
    const out = await run(fresh(400_000n));
    expect(out).toMatchObject({status: 'spent', grantLamports: null, destinationWithoutSol: true});
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-exit'});
  });

  it('the readout: one "unshield-submitting" and one "unshield-outcome" line — public values only', async () => {
    await run(fresh(400_000n));
    expect(readouts('unshield-submitting')).toHaveLength(1);
    const [o] = readouts('unshield-outcome');
    expect(o).toMatchObject({
      owner: FRESH1.address,
      ata: FRESH1.ata,
      amount: '400000',
      fee: '10000',
      destination: 'fresh',
      status: 'spent',
      signature: w.relayer.landed[0],
      changeLeafIndex: RECORDED_LEAVES + 1,
      grantLamports: '3000000',
    });
    expect(Object.keys(o!).sort()).toEqual(
      ['amount', 'at', 'ata', 'changeLeafIndex', 'destination', 'destinationWithoutSol', 'event', 'fee', 'grantLamports', 'owner', 'schema', 'seq', 'session', 'signature', 'status'].sort(),
    );
  });
});

// ------------------------------------------------------------------ the I-5 reservation

describe('the fresh-pending reservation (§6.1, I-5)', () => {
  it('a second unshield started while the first is PENDING picks the next index', async () => {
    w = unshieldWorld(fake, {amounts: [1_000_000n, 900_000n]});
    w.relayer.script.push({answer: 'unconfirmed', lands: false});
    expect(await run(fresh(100_000n))).toMatchObject({status: 'pending', reason: 'unconfirmed'});
    expect(registry()).toEqual([
      {scheme: 'slip10:0', role: 'main'},
      {scheme: 'slip10:1', role: 'fresh-pending'},
    ]);
    const out = await run(fresh(100_000n));
    expect(out).toMatchObject({status: 'spent'});
    expect(w.relayer.submits[1]).toMatchObject({destinationOwner: FRESH2.address, destination: FRESH2.ata});
    expect(registry()).toEqual([
      {scheme: 'slip10:0', role: 'main'},
      {scheme: 'slip10:1', role: 'fresh-pending'},
      {scheme: 'slip10:2', role: 'fresh-exit'},
    ]);
    // the second spent the OTHER note: the first's is still the pending one
    expect(noteOf(w.notes[0]!.rho).status).toBe('pending');
    expect(noteOf(w.notes[1]!.rho).status).toBe('spent');
  });
});

// ------------------------------------------------------------------ the outcomes (§6 step 8)

describe('nothing forwarded → the note unspent again, the reservation released', () => {
  it.each([
    ['invalid_request', 400],
    ['duplicate_in_flight', 429],
    ['budget_exceeded', 429],
    ['balance_too_low', 503],
    ['unavailable', 503],
    ['transfer_disabled', 503],
    ['relayer_disabled', 503],
    ['misconfigured', 500],
  ])('%s (%i)', async (outcome, status) => {
    w.relayer.script.push({answer: 'raw', status, body: {outcome}});
    expect(await run(fresh(400_000n))).toEqual({status: 'not-sent', outcome});
    expect(noteOf(w.notes[0]!.rho)).toEqual({...noteOf(w.notes[0]!.rho), status: 'unspent'});
    expect(noteOf(w.notes[0]!.rho).pendingSince).toBeUndefined();
    expect(noteOf(w.notes[0]!.rho).unshield).toBeUndefined();
    expect(registry()).toEqual([{scheme: 'slip10:0', role: 'main'}]);
  });

  it('R3 (row :385 rewritten, R1-C1): an answer the contract does not allow (200 confirmed, no signature) is UNKNOWN — pending, the reservation kept, never "not sent"', async () => {
    w.relayer.script.push({answer: 'raw', status: 200, body: {outcome: 'confirmed'}});
    expect(await run(fresh(400_000n))).toEqual({status: 'pending', signature: null, reason: 'unknown'});
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'pending', pendingSince: w.net.clock.blockTime});
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-pending'});
  });
});

// ------------------------------------------------------------------ R1-C1: unreadable answers

describe('R1-C1: an answer that is not JSON — only a 4xx is "not forwarded"; any other status is unknown, reconciled', () => {
  const html = (status: number) => `<html><head><title>${status}</title></head><body><center><h1>${status} Gateway</h1></center><hr><center>nginx</center></body></html>`;

  it('a gateway 504 HTML page after the relayer forwarded and the tx LANDED: pending (unknown); the reconcile then settles it — spent, the change recorded, the reservation promoted', async () => {
    w.relayer.script.push({answer: 'text', status: 504, text: html(504), lands: true});
    expect(await run(fresh(400_000n))).toEqual({status: 'pending', signature: null, reason: 'unknown'});
    expect(noteOf(w.notes[0]!.rho).status).toBe('pending');
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-pending'});
    const sig = w.relayer.landed[0]!;
    const r = await reconcileA0PendingUnshields(w.net.connection, seedBytes(TEST_SEED), {sync: {useCache: false}});
    expect(r).toMatchObject({settled: [{signature: sig, verified: true, code: null, changeRecorded: true}], promoted: ['slip10:1'], reverted: []});
    const change = expectedChange(w.notes[0]!, 400_000n, LIVE_FEE);
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'spent', spentTx: sig});
    expect(noteOf(change.rho)).toEqual({commitment: change.commitment, amount: change.amount, rho: change.rho, leafIndex: RECORDED_LEAVES + 1, status: 'unspent'});
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-exit'});
  });

  it.each([502, 503, 500])('a %i HTML page: pending (unknown), the note pending with its intent, the reservation kept', async status => {
    w.relayer.script.push({answer: 'text', status, text: html(status)});
    expect(await run(fresh(400_000n))).toEqual({status: 'pending', signature: null, reason: 'unknown'});
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'pending', unshield: {owner: FRESH1.address, scheme: 'slip10:1'}});
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-pending'});
  });

  it('a 200 whose body is not JSON: pending (unknown), never "not sent"', async () => {
    w.relayer.script.push({answer: 'text', status: 200, text: 'OK'});
    expect(await run(fresh(400_000n))).toEqual({status: 'pending', signature: null, reason: 'unknown'});
    expect(noteOf(w.notes[0]!.rho).status).toBe('pending');
  });

  it.each<[number, string]>([
    [400, 'Bad Request'],
    [429, 'Too Many Requests'],
  ])('a %i plain-text body (refused before forwarding): not sent (relay_failed), the note unspent, the reservation released', async (status, text) => {
    w.relayer.script.push({answer: 'text', status, text});
    expect(await run(fresh(400_000n))).toEqual({status: 'not-sent', outcome: 'relay_failed'});
    expect(noteOf(w.notes[0]!.rho).status).toBe('unspent');
    expect(noteOf(w.notes[0]!.rho).unshield).toBeUndefined();
    expect(registry()).toEqual([{scheme: 'slip10:0', role: 'main'}]);
    expect(w.relayer.submits).toHaveLength(1); // never re-sent, never re-synced into a new round
    expect(fake.approvals).toBe(1);
  });
});

// ------------------------------------------------------------------ R3-N4: the generic signature-less relay_failed

describe('R3-N4: a generic relay_failed WITHOUT a signature — re-synced once; reverted only when the tx can never land', () => {
  let atSubmit = 0;
  const mark = {onStage: (s: A0UnshieldStage) => (s === 'submit' ? (atSubmit = w.net.requests.length) : undefined)};
  const proves = () => fake.calls.filter(c => c.method === 'prove').length;
  const pushOutOfTheRing = () => {
    for (let k = 0; k < 64; k++) {
      w.net.landForeign({amount: 1n + BigInt(k), commitment: strangerField(500 + k), rho: strangerField(900 + k)});
    }
  };
  const SIG = base58.encode(new Uint8Array(64).fill(7));

  it('the ONE predicate: true only for a readable 502 relay_failed with no signature', () => {
    const at = (status: number, body: unknown) => a0IsGenericRelayFailed(interpretA0SubmitAnswer({status, body}));
    expect(at(502, {outcome: 'relay_failed'})).toBe(true);
    expect(at(502, {outcome: 'relay_failed', error: 'simulation failed'})).toBe(true);
    expect(at(502, {outcome: 'relay_failed', txSignature: SIG})).toBe(false);
    expect(at(429, null)).toBe(false); // an unreadable 4xx: relay_failed, certainly not forwarded
    expect(at(400, null)).toBe(false);
    expect(at(504, null)).toBe(false); // unknown
    expect(at(502, {outcome: 'unconfirmed', txSignature: SIG})).toBe(false);
    expect(at(409, {outcome: 'already_spent'})).toBe(false);
    expect(at(400, {outcome: 'invalid_request'})).toBe(false);
    expect(at(200, {outcome: 'confirmed', txSignature: SIG})).toBe(false);
  });

  it('(b) fails — the proof\'s root is still in the ring: pending, the note pending, the reservation kept; ONE re-sync, one confirmation', async () => {
    w.relayer.script.push({answer: 'relay_failed'});
    expect(await run(fresh(400_000n), mark)).toEqual({status: 'pending', signature: null, reason: 'relay_failed'});
    expect(treeWalks(atSubmit)).toBe(1);
    expect([fake.approvals, proves(), w.relayer.submits.length]).toEqual([1, 1, 1]);
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'pending', unshield: {scheme: 'slip10:1'}});
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-pending'});
  });

  it('(a) fails — the root left the ring but the re-sync is not complete (the newest pool tx not listed yet): pending, no new round', async () => {
    w.relayer.script.push({
      answer: 'relay_failed',
      before: () => {
        pushOutOfTheRing();
        w.net.chain.signatures.shift(); // RPC lag: the newest deposit is not in the list
      },
    });
    expect(await run(fresh(400_000n), mark)).toEqual({status: 'pending', signature: null, reason: 'relay_failed'});
    expect(treeWalks(atSubmit)).toBe(1);
    expect([fake.approvals, proves(), w.relayer.submits.length]).toEqual([1, 1, 1]);
    expect(noteOf(w.notes[0]!.rho).status).toBe('pending');
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-pending'});
  }, 90_000);

  it('(c) fails — the tx LANDED (the relayer lost the node\'s answer) and then left the ring: pending, never reverted; the reconcile settles it spent', async () => {
    w.relayer.script.push({answer: 'relay_failed', lands: true, before: pushOutOfTheRing});
    expect(await run(fresh(400_000n), mark)).toEqual({status: 'pending', signature: null, reason: 'relay_failed'});
    expect([fake.approvals, proves(), w.relayer.submits.length]).toEqual([1, 1, 1]);
    expect(noteOf(w.notes[0]!.rho).status).toBe('pending');
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-pending'});
    const r = await reconcileA0PendingUnshields(w.net.connection, seedBytes(TEST_SEED), {sync: {useCache: false}});
    expect(r).toMatchObject({settled: [{signature: w.relayer.landed[0], verified: true}], promoted: ['slip10:1']});
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'spent', spentTx: w.relayer.landed[0]});
  }, 90_000);

  it('a re-sync that fails (an RPC error) proves nothing: pending', async () => {
    w.relayer.script.push({
      answer: 'relay_failed',
      before: () => {
        w.net.holdWhen = null;
        jest.spyOn(w.net.connection, 'getSignaturesForAddress').mockRejectedValueOnce(new Error('rpc down'));
      },
    });
    expect(await run(fresh(400_000n))).toEqual({status: 'pending', signature: null, reason: 'relay_failed'});
    expect(noteOf(w.notes[0]!.rho).status).toBe('pending');
  });
});

describe('forwarded (or maybe) → the note PENDING with pendingSince = chain time and its intent; the reservation kept', () => {
  const pendingIntent = () => ({
    owner: FRESH1.address,
    amount: 400_000n,
    fee: LIVE_FEE,
    feePayer: RELAYER_FEE_PAYER,
    gasGrantLamports: LIVE_GRANT,
    destination: 'fresh',
    scheme: 'slip10:1',
  });
  it.each<[string, () => void, string]>([
    ['unconfirmed', () => w.relayer.script.push({answer: 'unconfirmed', lands: false}), 'unconfirmed'],
    ['already_spent', () => w.relayer.script.push({answer: 'already_spent'}), 'already_spent'],
    ['a transport error', () => w.relayer.script.push({answer: 'transport'}), 'unknown'],
    ['an unreadable answer carrying a txSignature', () => w.relayer.script.push({answer: 'raw', status: 502, body: {outcome: 'odd', txSignature: '<landed>'}, lands: true}), 'unknown'],
    ['relay_failed WITH a signature', () => w.relayer.script.push({answer: 'raw', status: 502, body: {outcome: 'relay_failed', txSignature: '<landed>'}, lands: true}), 'relay_failed'],
  ])('%s', async (_label, script, reason) => {
    script();
    const out = await run(fresh(400_000n));
    expect(out).toMatchObject({status: 'pending', reason});
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'pending', pendingSince: w.net.clock.blockTime, leafIndex: w.notes[0]!.leafIndex, unshield: pendingIntent()});
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-pending'});
  });

  it('the JS deadline on submit (the request never settles) is "unknown", never "not forwarded"', async () => {
    w.relayer.script.push({answer: 'hang'});
    const out = await run(fresh(400_000n), {transport: {...w.relayer.transport, deadlineMs: 30}});
    expect(out).toEqual({status: 'pending', signature: null, reason: 'unknown'});
    expect(noteOf(w.notes[0]!.rho).status).toBe('pending');
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-pending'});
  });
});

describe('confirmed: the sync retry bound (I-2)', () => {
  let atSubmit = 0;
  const mark = {onStage: (s: A0UnshieldStage) => (s === 'submit' ? (atSubmit = w.net.requests.length) : undefined)};

  it('RPC lag: the signature appears on the 4th sync after the answer → settled', async () => {
    w.relayer.script.push({answer: 'confirmed', hideForSyncs: 3});
    expect(await run(fresh(400_000n), mark)).toMatchObject({status: 'spent'});
    expect(treeWalks(atSubmit)).toBe(4);
  });

  it(`never listed: exactly 1 + ${RETRIES} syncs, then pending ("not-in-sync"), the note pending, the reservation kept`, async () => {
    w.relayer.script.push({answer: 'confirmed', hideForSyncs: 1000});
    const out = await run(fresh(400_000n), mark);
    expect(out).toEqual({status: 'pending', signature: w.relayer.landed[0], reason: 'not-in-sync'});
    expect(treeWalks(atSubmit)).toBe(1 + RETRIES);
    expect(noteOf(w.notes[0]!.rho).status).toBe('pending');
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-pending'});
  });

  it(`the default pause between those syncs is ${PAUSE_MS} ms`, async () => {
    const real = global.setTimeout;
    const pauses: number[] = [];
    const spy = jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
      if (ms === PAUSE_MS) {
        pauses.push(ms);
        return real(fn, 0);
      }
      return real(fn, ms);
    }) as typeof setTimeout);
    try {
      w.relayer.script.push({answer: 'confirmed', hideForSyncs: 2});
      expect(await run(fresh(400_000n), {confirmSyncDelayMs: undefined})).toMatchObject({status: 'spent'});
    } finally {
      spy.mockRestore();
    }
    expect(pauses).toEqual([PAUSE_MS, PAUSE_MS]);
  });
});

describe('the re-quote → re-confirm rule (§6 step 7, I7)', () => {
  let clockMs = 1_800_000_000_000;
  const asked: {fee: string}[] = [];
  const atDialog = (first: () => void) => {
    let n = 0;
    fake.setConfirmer(req => {
      asked.push({fee: req.fee});
      n += 1;
      if (n === 1) {
        clockMs += 60_000; // the human took a minute: the quote (validForSeconds 60) is stale at submit
        first();
      }
      return 'approve';
    });
  };
  beforeEach(() => {
    asked.length = 0;
  });
  const proves = () => fake.calls.filter(c => c.method === 'prove').length;

  it('stale, same terms → re-fetched, the SAME proof submitted (one confirmation, one prove)', async () => {
    atDialog(() => undefined);
    const out = await run(fresh(400_000n), {now: () => clockMs});
    expect(out).toMatchObject({status: 'spent'});
    expect(w.relayer.quoteRequests).toBe(2);
    expect([fake.approvals, proves(), w.relayer.submits.length]).toEqual([1, 1, 1]);
  });

  it('stale, the fee changed → the proof discarded, a NEW confirmation for the new fee, a new proof; never a second dialog on a live approval', async () => {
    atDialog(() => {
      w.relayer.quote.minFee = {transfer: '10000', withdraw_change: '12000'};
    });
    const out = await run(fresh(400_000n), {now: () => clockMs});
    expect(asked).toEqual([{fee: '10000'}, {fee: '12000'}]);
    expect([fake.approvals, proves(), w.relayer.submits.length]).toEqual([2, 2, 1]);
    expect(w.relayer.submits[0]).toMatchObject({fee: '12000'});
    const change = expectedChange(w.notes[0]!, 400_000n, 12_000n);
    expect(out).toMatchObject({status: 'spent', changeAmount: change.amount});
    expect(fake.liveAuth()).toBeNull();
  });

  it('stale, the grant withdrawn → a fresh account is no longer offered: refused, nothing sent, the reservation released', async () => {
    atDialog(() => {
      delete w.relayer.quote.gasGrantLamports;
    });
    expect(await codeOf(run(fresh(400_000n), {now: () => clockMs}))).toBe('E_A0_UNSHIELD_TERMS');
    expect(w.relayer.submits).toHaveLength(0);
    expect(registry()).toEqual([{scheme: 'slip10:0', role: 'main'}]);
    expect(noteOf(w.notes[0]!.rho).status).toBe('unspent');
  });

  it('stale, the new fee leaves less than the amount in the note → refused, nothing sent', async () => {
    atDialog(() => {
      w.relayer.quote.maxFee = '1000000';
      w.relayer.quote.minFee = {transfer: '10000', withdraw_change: '700000'};
    });
    expect(await codeOf(run(fresh(400_000n), {now: () => clockMs}))).toBe('E_A0_UNSHIELD_TERMS');
    expect(w.relayer.submits).toHaveLength(0);
  });

  it('relay_failed after the root left the 64-root ring → re-synced, a new path, a NEW confirmation, then landed', async () => {
    w.relayer.script.push({
      answer: 'relay_failed',
      before: () => {
        for (let k = 0; k < 64; k++) {
          w.net.landForeign({amount: 1n + BigInt(k), commitment: strangerField(500 + k), rho: strangerField(900 + k)});
        }
      },
    });
    const out = await run(fresh(400_000n));
    expect(out).toMatchObject({status: 'spent', changeLeafIndex: RECORDED_LEAVES + 1 + 64});
    expect([fake.approvals, proves(), w.relayer.submits.length]).toEqual([2, 2, 2]);
    expect(w.relayer.submits[1]!.merkleRoot).not.toBe(w.relayer.submits[0]!.merkleRoot);
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-exit'});
  }, 90_000); // 64 appended deposits, synced twice: ~10 s alone
});

// ------------------------------------------------------------------ a refused landing is LOUD

/** Replace the landed tx's Withdraw nullifier (event + instruction argument) with `n`. */
function withNullifier(tx: RecordedTx, n: string): void {
  const line = blobsOf(tx).find(b => toHex(b.bytes.subarray(0, 8)) === 'c0f1c9d946965af7')!.line;
  setBlob(tx, line, Uint8Array.from([...fromHex('c0f1c9d946965af7'), ...fromHex(n)]));
  const msg = tx.transaction.message;
  const ix = msg.instructions.find(i => msg.accountKeys[i.programIdIndex] === 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH')!;
  const data = base58.decode(ix.data);
  data.set(fromHex(n), 40);
  ix.data = base58.encode(data);
}
/** Set the landed tx's top-level SystemProgram.transfer to `lamports`. */
function withGrant(tx: RecordedTx, lamports: bigint): void {
  const msg = tx.transaction.message;
  const ix = msg.instructions.find(i => msg.accountKeys[i.programIdIndex] === '11111111111111111111111111111111')!;
  const data = base58.decode(ix.data);
  new DataView(data.buffer, data.byteOffset).setBigUint64(4, lamports, true);
  ix.data = base58.encode(data);
}

describe('landed, but the verifier refuses: chain truth for the note, a loud outcome, never a retry', () => {
  it('a key of this seed signed it: the note spent, our change recorded, the fresh account fresh-exit AND linked; read out with its code', async () => {
    w.relayer.script.push({answer: 'confirmed', mutate: tx => (tx.transaction.message.accountKeys[0] = MAIN.address)});
    const out = await run(fresh(400_000n));
    const sig = w.relayer.landed[0]!;
    expect(out).toMatchObject({status: 'landed-unverified', signature: sig, code: 'E_A0_VERIFY_SEED_SIGNER', note: 'spent', changeRecorded: true, linked: true});
    const change = expectedChange(w.notes[0]!, 400_000n, LIVE_FEE);
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'spent', spentTx: sig});
    expect(noteOf(change.rho)).toMatchObject({commitment: change.commitment, amount: change.amount, status: 'unspent'});
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-exit', linked: true});
    expect(readouts('unshield-outcome')[0]).toMatchObject({status: 'landed-unverified', code: 'E_A0_VERIFY_SEED_SIGNER', linked: true});
    expect(w.relayer.submits).toHaveLength(1); // never retried
  });

  it('a grant of another amount: E_A0_VERIFY_GRANT_TERMS, the note spent, the fresh account (named by the tx) fresh-exit, not linked', async () => {
    w.relayer.script.push({answer: 'confirmed', mutate: tx => withGrant(tx, LIVE_GRANT - 1n)});
    expect(await run(fresh(400_000n))).toMatchObject({status: 'landed-unverified', code: 'E_A0_VERIFY_GRANT_TERMS', note: 'spent', linked: false});
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-exit'});
  });

  it('landed to another destination: E_A0_VERIFY_DESTINATION, the note spent, the reserved account (not in the tx) released', async () => {
    w.relayer.script.push({
      answer: 'confirmed',
      mutate: tx => {
        const k = tx.transaction.message.accountKeys;
        k[k.indexOf(FRESH1.ata)] = OTHER.ata;
        k[k.indexOf(FRESH1.address)] = OTHER.address;
      },
    });
    expect(await run(fresh(400_000n))).toMatchObject({status: 'landed-unverified', code: 'E_A0_VERIFY_DESTINATION', note: 'spent'});
    expect(registry()).toEqual([{scheme: 'slip10:0', role: 'main'}]);
  });

  it('landed with a change leaf that is not ours: E_A0_VERIFY_CHANGE_LEAF, the note spent, NO change note recorded', async () => {
    w.relayer.script.push({answer: 'confirmed', changeCommitment: strangerField(11)});
    expect(await run(fresh(400_000n))).toMatchObject({status: 'landed-unverified', code: 'E_A0_VERIFY_CHANGE_LEAF', note: 'spent', changeRecorded: false});
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'spent', spentTx: w.relayer.landed[0]});
    expect(loadA0NoteStore().notes).toHaveLength(1);
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-exit'});
  });

  it('the named tx does not spend the note (another nullifier): E_A0_VERIFY_NULLIFIER, the note STAYS pending, the reservation kept', async () => {
    w.relayer.script.push({answer: 'confirmed', mutate: tx => withNullifier(tx, strangerField(7))});
    expect(await run(fresh(400_000n))).toMatchObject({status: 'landed-unverified', code: 'E_A0_VERIFY_NULLIFIER', note: 'pending', changeRecorded: false});
    expect(noteOf(w.notes[0]!.rho).status).toBe('pending');
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-pending'});
  });
});

// ------------------------------------------------------------------ refusals before anything is sent

describe('refused before anything is sent: the note untouched, a reservation released', () => {
  const CLI = (
    JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'fixtures/a0-account-vectors.json'), 'utf8')) as {
      seeds: {accounts: {scheme: string; address: string}[]}[];
    }
  ).seeds[0]!.accounts.find(a => a.scheme === 'cli')!.address;
  const untouched = () => {
    expect(w.relayer.submits).toHaveLength(0);
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'unspent'});
    expect(noteOf(w.notes[0]!.rho).unshield).toBeUndefined();
  };

  it.each([
    ['the main account', () => MAIN.address],
    ['the seed\'s cli key', () => CLI],
    ['a fresh account already in the registry', () => FRESH1.address],
  ])('"Another address" that is %s → E_A0_UNSHIELD_DESTINATION (choose it as what it is), no dialog', async (_l, owner) => {
    w = unshieldWorld(fake, {amounts: [1_000_000n, 900_000n]});
    w.relayer.script.push({answer: 'unconfirmed', lands: false});
    await run(fresh(100_000n)); // slip10:1 now fresh-pending (a key of this seed)
    const before = w.relayer.submits.length;
    expect(await codeOf(run({destination: {kind: 'external', owner: owner()}, amount: 100_000n}))).toBe('E_A0_UNSHIELD_DESTINATION');
    expect(w.relayer.submits).toHaveLength(before);
    expect(fake.approvals).toBe(1);
  });

  it('"Another address" off the curve (the pool PDA) or not a key → E_A0_UNSHIELD_DESTINATION', async () => {
    expect(await codeOf(run({destination: {kind: 'external', owner: '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT'}, amount: 1n}))).toBe('E_A0_UNSHIELD_DESTINATION');
    expect(await codeOf(run({destination: {kind: 'external', owner: 'not-a-key'}, amount: 1n}))).toBe('E_A0_UNSHIELD_DESTINATION');
    untouched();
  });

  it('fresh without a grant in the quote (S11) → E_A0_UNSHIELD_DESTINATION, nothing reserved', async () => {
    w = unshieldWorld(fake, {grant: false});
    expect(await codeOf(run(fresh(1n)))).toBe('E_A0_UNSHIELD_DESTINATION');
    expect(registry()).toEqual([{scheme: 'slip10:0', role: 'main'}]);
    untouched();
  });

  it('a cli wallet (S9): fresh refused, "Another address" lands', async () => {
    clearAllStores();
    initSecureMmkv('test-key');
    storeTransparentScheme({kind: 'cli'});
    w = unshieldWorld(fake);
    expect(await codeOf(run(fresh(1n)))).toBe('E_A0_UNSHIELD_DESTINATION');
    expect(await run({destination: {kind: 'external', owner: OTHER.address}, amount: 300_000n})).toMatchObject({status: 'spent'});
    expect(registry()).toEqual([{scheme: 'cli', role: 'main'}]);
  });

  it.each([0n, 1_000_000n - LIVE_FEE + 1n])('amount %s → E_A0_UNSHIELD_AMOUNT (max = note − fee)', async amount => {
    expect(await codeOf(run(fresh(amount)))).toBe('E_A0_UNSHIELD_AMOUNT');
    expect((loadA0AccountRegistry() ?? []).filter(e => e.role !== 'main')).toEqual([]);
    untouched();
  });

  it('cancelled at the native dialog → its code; released; the handle closed', async () => {
    fake.setConfirmer(() => Object.assign(new Error('E_A0_CONFIRM_CANCELLED: no'), {code: 'E_A0_CONFIRM_CANCELLED'}));
    expect(await codeOf(run(fresh(400_000n)))).toBe('E_A0_CONFIRM_CANCELLED');
    expect(registry()).toEqual([{scheme: 'slip10:0', role: 'main'}]);
    expect(fake.liveHandle()).toBeNull();
    untouched();
  });

  it('Rust\'s public inputs disagree with JS\'s (recipientField) → E_A0_SUBMIT_PUBLIC_INPUTS; released; the approval consumed', async () => {
    fake.tamperNextProof(pi => pi.map((v, i) => (i === 3 ? strangerField(3) : v)));
    expect(await codeOf(run(fresh(400_000n)))).toBe('E_A0_SUBMIT_PUBLIC_INPUTS');
    expect(fake.liveAuth()).toBeNull();
    expect(registry()).toEqual([{scheme: 'slip10:0', role: 'main'}]);
    untouched();
  });

  it('no chain clock before the submit → E_A0_UNSHIELD_CLOCK, nothing written', async () => {
    w.net.clock.blockTime = null;
    expect(await codeOf(run(fresh(400_000n)))).toBe('E_A0_UNSHIELD_CLOCK');
    untouched();
  });

  it('the wallet was wiped + imported while the flow ran → E_A0_STORE_CHANGED before the pending write; nothing sent', async () => {
    w.net.holdWhen = m => m === 'getSlot';
    const p = codeOf(run(fresh(400_000n)));
    while (w.net.held === 0) {
      await new Promise(r => setTimeout(r, 5));
    }
    clearAllStores();
    initSecureMmkv('another-wallet');
    w.net.release();
    expect(await p).toBe('E_A0_STORE_CHANGED');
    expect(w.relayer.submits).toHaveLength(0);
  });
});

describe('one unshield at a time; one submit per unshield (CLAUDE.md rule 6)', () => {
  it('a second call while one runs → E_A0_UNSHIELD_BUSY at once; the relayer sees ONE submit', async () => {
    const first = run(fresh(400_000n));
    expect(await codeOf(run(fresh(400_000n)))).toBe('E_A0_UNSHIELD_BUSY');
    expect(await first).toMatchObject({status: 'spent'});
    expect(w.relayer.submits).toHaveLength(1);
    expect(fake.approvals).toBe(1);
  });
  it('the fake holds Rust\'s rule (control): a second approval while one is live → E_A0_AUTH_IN_FLIGHT after the dialog', async () => {
    const h = await fake.keysOpen(Array.from(seedBytes(TEST_SEED)));
    await fake.confirmUnshield(h, FRESH1.address, '1', '0');
    await expect(fake.confirmUnshield(h, FRESH1.address, '1', '0')).rejects.toMatchObject({code: 'E_A0_AUTH_IN_FLIGHT'});
    expect(fake.approvals).toBe(2);
  });
});

// ------------------------------------------------------------------ the in-flight nullifier (R12, I3)

/** Every encoding a value of 32 bytes could be stored, logged or sent in. */
const encodings = (hex: string): string[] => {
  const b = Buffer.from(hex, 'hex');
  return [hex, base58.encode(b), b.toString('base64'), BigInt(`0x${hex}`).toString()];
};
function mmkvHits(needles: string[]): string[] {
  const hits: string[] = [];
  for (const store of [mmkvSecure()!, mmkvPublic]) {
    for (const k of store.getAllKeys()) {
      const v = store.getString(k) ?? '';
      if (needles.some(n => v.includes(n) || k.includes(n))) {
        hits.push(k);
      }
    }
  }
  return hits;
}
/**
 * Requests that name the nullifier, its PDA or the relayed signature — except the sync's own fetch
 * of a listed tx: every `getTransaction(signature)` must follow a tree walk that had not fetched it
 * yet (with the cache off, each sync walk fetches every listed tx once), so a fetch BY the
 * signature outside a sync is one too many.
 */
function noteSpecificRequests(requests: RpcRequest[], nullifier: string, signature: string | null): string[] {
  const own = [...encodings(nullifier), ...encodings(Buffer.from(new PublicKey(nullifierPda(nullifier)).toBytes()).toString('hex'))];
  let walkFetched = true; // no walk yet: a fetch now is not a sync's
  const extra: string[] = [];
  for (const r of requests) {
    if (r.method === 'getSignaturesForAddress' && r.params[0] === TREE_ADDR) {
      walkFetched = false;
    } else if (signature !== null && r.method === 'getTransaction' && r.params[0] === signature) {
      if (walkFetched) {
        extra.push('getTransaction of the relayed signature outside a sync');
      }
      walkFetched = true;
    }
  }
  return extra.concat(requests.flatMap(r => {
    const text = JSON.stringify(r.params);
    if (own.some(n => text.includes(n))) {
      return [`${r.method} names the nullifier or its PDA`];
    }
    if (r.method === 'getSignatureStatuses') {
      return ['getSignatureStatuses'];
    }
    if (signature !== null && text.includes(signature) && !(r.method === 'getTransaction' && r.params[0] === signature)) {
      return [`${r.method} names the relayed signature`];
    }
    return [];
  }));
}

describe('the in-flight nullifier lives in memory only (R12) and nothing specific to the note reaches the RPC (I3)', () => {
  let logged: string[];
  let spies: jest.SpyInstance[];
  beforeEach(() => {
    logged = [];
    spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(m =>
      jest.spyOn(console, m).mockImplementation((...a: unknown[]) => {
        logged.push(a.map(x => (typeof x === 'string' ? x : JSON.stringify(x, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))).join(' '));
      }),
    );
  });
  afterEach(() => spies.forEach(s => s.mockRestore()));

  it.each<[string, () => void]>([
    ['landed and settled', () => undefined],
    ['pending (unconfirmed)', () => w.relayer.script.push({answer: 'unconfirmed', lands: true})],
    ['refused by the verifier', () => w.relayer.script.push({answer: 'confirmed', mutate: tx => withGrant(tx, 1n)})],
  ])('%s: the nullifier is in no MMKV value, no log call, no readout line, and no RPC param; the relayed signature only in the sync\'s getTransaction', async (_l, script) => {
    script();
    let atSubmit = -1;
    await run(fresh(400_000n), {onStage: st => (st === 'submit' ? (atSubmit = w.net.requests.length) : undefined)});
    const n = w.notes[0]!.nullifier;
    // the relayed signature is fetched exactly once per tree walk after the landing (cache off) — never by itself
    const fetchedBySig = w.net.requests.filter(r => r.method === 'getTransaction' && r.params[0] === w.relayer.landed[0]).length;
    expect(fetchedBySig).toBe(treeWalks(atSubmit));
    expect(w.relayer.submits[0]!.nullifier).toBe(n); // non-vacuous: the payload did carry it
    expect(mmkvHits(encodings(n))).toEqual([]);
    expect(logged.filter(l => encodings(n).some(e => l.includes(e)))).toEqual([]);
    expect(lines.filter(l => encodings(n).some(e => l.includes(e)))).toEqual([]);
    expect(noteSpecificRequests(w.net.requests, n, w.relayer.landed[0] ?? null)).toEqual([]);
    if (_l !== 'pending (unconfirmed)') {
      // non-vacuous: the settle read the landed tx — through the sync's fetch of every listed pool tx
      expect(w.net.requests.some(r => r.method === 'getTransaction' && r.params[0] === w.relayer.landed[0])).toBe(true);
    }
  });

  it('POSITIVE controls: the same checkers flag the nullifier written to MMKV, a getSignatureStatuses of the signature and a lookup of the nullifier PDA', async () => {
    await run(fresh(400_000n));
    const n = w.notes[0]!.nullifier;
    mmkvSecure()!.set('probe', `{"x":"${BigInt(`0x${n}`).toString()}"}`);
    expect(mmkvHits(encodings(n))).toEqual(['probe']);
    const from = w.net.requests.length;
    await w.net.connection.getSignatureStatuses([w.relayer.landed[0]!]);
    await w.net.connection.getAccountInfo(new PublicKey(nullifierPda(n)));
    await w.net.connection.getTransaction(w.relayer.landed[0]!, {commitment: 'confirmed', maxSupportedTransactionVersion: 0});
    expect(noteSpecificRequests(w.net.requests.slice(from), n, w.relayer.landed[0]!)).toEqual([
      'getTransaction of the relayed signature outside a sync',
      'getSignatureStatuses',
      'getAccountInfo names the nullifier or its PDA',
    ]);
    // …and the whole log with that fetch appended is flagged too (the flow's own syncs are not)
    expect(noteSpecificRequests(w.net.requests, n, w.relayer.landed[0]!)).toContain('getTransaction of the relayed signature outside a sync');
  });
});

// ------------------------------------------------------------------ the chain clock (m-2, R2-N2, m-1)

describe('m-2 / R2-N2: the chain clock — slot−1 … slot−4 when a slot has no block time; ONE anchor before the submit', () => {
  const T0 = 1_794_200_000;
  const clockReads = (from: number) =>
    w.net.requests.slice(from).filter(r => r.method === 'getSlot' || r.method === 'getBlockTime').map(r => (r.method === 'getSlot' ? 'getSlot' : `getBlockTime ${String(r.params[0])}`));

  it('a0ChainTime: no block time for the current slot → the first of slot−1 … slot−4 that has one', async () => {
    w.net.clock = {slot: 1000, blockTime: null, earlier: [null, T0 - 1, T0 - 2]};
    const from = w.net.requests.length;
    expect(await a0ChainTime(w.net.connection)).toBe(T0 - 1);
    expect(clockReads(from)).toEqual(['getSlot', 'getBlockTime 1000', 'getBlockTime 999', 'getBlockTime 998']);
  });

  it('a0ChainTime: an RPC error on a slot ("block not available") is "no block time" too: the slot before is asked', async () => {
    w.net.clock = {slot: 1000, blockTime: T0, earlier: [T0 - 1], errorAt: [1000]};
    expect(await a0ChainTime(w.net.connection)).toBe(T0 - 1);
  });

  it('a0ChainTime: none of the five slots has one → null after exactly five asks (never slot−5)', async () => {
    w.net.clock = {slot: 1000, blockTime: null, earlier: [null, null, null, null]};
    const from = w.net.requests.length;
    expect(await a0ChainTime(w.net.connection)).toBeNull();
    expect(clockReads(from)).toEqual(['getSlot', 'getBlockTime 1000', 'getBlockTime 999', 'getBlockTime 998', 'getBlockTime 997', 'getBlockTime 996']);
  });

  it('the anchor falls back too: pendingSince = slot−1\'s time when the current slot has none', async () => {
    w.net.clock = {slot: w.net.clock.slot, blockTime: null, earlier: [T0 - 1]};
    w.relayer.script.push({answer: 'unconfirmed', lands: false});
    expect(await run(fresh(400_000n))).toMatchObject({status: 'pending', reason: 'unconfirmed'});
    expect(noteOf(w.notes[0]!.rho).pendingSince).toBe(T0 - 1);
  });

  it('a dead clock BEFORE the prompts → E_A0_UNSHIELD_CLOCK with no dialog and no reservation; nothing written', async () => {
    w.net.clock = {slot: w.net.clock.slot, blockTime: null};
    expect(await codeOf(run(fresh(400_000n)))).toBe('E_A0_UNSHIELD_CLOCK');
    expect(fake.approvals).toBe(0);
    expect(w.net.requests.some(r => r.method === 'getSignaturesForAddress' && r.params[0] === FRESH1.address)).toBe(false);
    expect(registry()).toEqual([{scheme: 'slip10:0', role: 'main'}]);
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'unspent'});
  });

  it('a clock that dies AFTER the dialog → E_A0_UNSHIELD_CLOCK at the anchor: nothing written or sent, the reservation released, the approval consumed', async () => {
    fake.setConfirmer(() => {
      w.net.clock = {slot: w.net.clock.slot + 1, blockTime: null};
      return 'approve';
    });
    expect(await codeOf(run(fresh(400_000n)))).toBe('E_A0_UNSHIELD_CLOCK');
    expect([fake.approvals, w.relayer.submits.length]).toEqual([1, 0]);
    expect(fake.liveAuth()).toBeNull();
    expect(registry()).toEqual([{scheme: 'slip10:0', role: 'main'}]);
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'unspent'});
    expect(noteOf(w.notes[0]!.rho).pendingSince).toBeUndefined();
  });

  it('without a hold: exactly ONE anchor read between the proof and the submit, and it is pendingSince', async () => {
    let atProof = 0;
    let atSubmit = 0;
    w.relayer.script.push({answer: 'unconfirmed', lands: false});
    await run(fresh(400_000n), {
      onStage: s => {
        if (s === 'proof') {
          atProof = w.net.requests.length;
        } else if (s === 'submit') {
          atSubmit = w.net.requests.length;
        }
      },
    });
    expect(clockReads(atProof).slice(0, clockReads(atProof).length - clockReads(atSubmit).length)).toEqual(['getSlot', `getBlockTime ${w.net.clock.slot}`]);
    expect(noteOf(w.notes[0]!.rho).pendingSince).toBe(T0);
  });
});

describe('m-1 / R2-N2: a held submit re-reads the chain clock after the hold and keeps the LATER time', () => {
  const T0 = 1_794_200_000;
  const held = (during: () => void) => ({
    holdMs: () => {
      during();
      return 5;
    },
  });

  it('the hold took 30 s of chain time: pendingSince is the re-read (later) value', async () => {
    w.relayer.script.push({answer: 'unconfirmed', lands: false});
    await run(fresh(400_000n), held(() => (w.net.clock = {slot: w.net.clock.slot + 75, blockTime: T0 + 30})));
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'pending', pendingSince: T0 + 30, unshield: {scheme: 'slip10:1'}});
  });

  it('a re-read with no block time KEEPS the earlier anchor and the unshield goes on', async () => {
    w.relayer.script.push({answer: 'unconfirmed', lands: false});
    expect(await run(fresh(400_000n), held(() => (w.net.clock = {slot: w.net.clock.slot + 75, blockTime: null})))).toMatchObject({status: 'pending', reason: 'unconfirmed'});
    expect(w.relayer.submits).toHaveLength(1);
    expect(noteOf(w.notes[0]!.rho).pendingSince).toBe(T0);
  });

  it('a re-read that THROWS keeps the earlier anchor and the unshield goes on', async () => {
    w.relayer.script.push({answer: 'unconfirmed', lands: false});
    const out = await run(
      fresh(400_000n),
      held(() => {
        jest.spyOn(w.net.connection, 'getSlot').mockRejectedValueOnce(new Error('rpc down'));
      }),
    );
    expect(out).toMatchObject({status: 'pending', reason: 'unconfirmed'});
    expect(w.relayer.submits).toHaveLength(1);
    expect(noteOf(w.notes[0]!.rho).pendingSince).toBe(T0);
  });

  it('a re-read that is EARLIER never moves pendingSince back', async () => {
    w.relayer.script.push({answer: 'unconfirmed', lands: false});
    await run(fresh(400_000n), held(() => (w.net.clock = {slot: w.net.clock.slot + 1, blockTime: T0 - 5})));
    expect(noteOf(w.notes[0]!.rho).pendingSince).toBe(T0);
  });
});

// ------------------------------------------------------------------ m-5, Task 6, Task 2, R2-N3 (the carry's rulings)

describe('m-5: "Another address" refuses slip10:0 … 20 of this seed (21 local derivations) and every key of the seed set', () => {
  const errOf = async (p: Promise<unknown>): Promise<{code?: string; message: string}> => {
    try {
      await p;
    } catch (e) {
      return e as {code?: string; message: string};
    }
    throw new Error('resolved');
  };
  it.each([
    ['slip10:1 (not reserved)', 1],
    ['slip10:5 (never in the registry)', 5],
    ['slip10:20 (the last of the 21)', 20],
  ])('this seed\'s %s → E_A0_UNSHIELD_DESTINATION, "an account of this wallet not offered as a destination"; no dialog, nothing written', async (_l, n) => {
    const e = await errOf(run({destination: {kind: 'external', owner: ACCOUNT(n).address}, amount: 100_000n}));
    expect(e.code).toBe('E_A0_UNSHIELD_DESTINATION');
    expect(e.message).toContain('an account of this wallet not offered as a destination');
    expect([fake.approvals, w.relayer.submits.length]).toEqual([0, 0]);
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'unspent'});
    expect(registry()).toEqual([{scheme: 'slip10:0', role: 'main'}]);
  });

  it('a registry key is refused with ITS role named (the main account → choose "My main account")', async () => {
    const e = await errOf(run({destination: {kind: 'external', owner: MAIN.address}, amount: 100_000n}));
    expect(e.code).toBe('E_A0_UNSHIELD_DESTINATION');
    expect(e.message).toContain('your main account');
    expect(fake.approvals).toBe(0);
  });

  it('slip10:21 is outside the 21 derivations and the seed set: "Another address" lands to it as external (boundary)', async () => {
    const far = ACCOUNT(21);
    w.relayer.funded.add(far.address);
    expect(await run({destination: {kind: 'external', owner: far.address}, amount: 100_000n})).toMatchObject({status: 'spent'});
    expect(w.relayer.submits[0]).toMatchObject({destinationOwner: far.address, destination: far.ata});
    expect(registry()).toEqual([{scheme: 'slip10:0', role: 'main'}]);
  });
});

describe('the carry\'s rulings on Tasks 2, 4 and 6', () => {
  it('Task 6: a native refusal at the confirmation that is not a cancel (E_A0_UNKNOWN_HANDLE, m-7\'s window) ends this attempt — its code, released, no prove, nothing written', async () => {
    fake.setConfirmer(() => Object.assign(new Error('E_A0_UNKNOWN_HANDLE: the session was replaced'), {code: 'E_A0_UNKNOWN_HANDLE'}));
    expect(await codeOf(run(fresh(400_000n)))).toBe('E_A0_UNKNOWN_HANDLE');
    expect(fake.calls.filter(c => c.method === 'prove')).toHaveLength(0);
    expect(fake.liveHandle()).toBeNull();
    expect(registry()).toEqual([{scheme: 'slip10:0', role: 'main'}]);
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'unspent'});
    expect(w.relayer.submits).toHaveLength(0);
  });

  it('Task 2: the fresh account\'s history check runs on the SAME Connection whose genesis was checked as devnet; another cluster asks nothing about it', async () => {
    w.net.genesisHash = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'; // mainnet-beta
    expect(await codeOf(run(fresh(400_000n)))).toBe('E_A0_UNSHIELD_CLUSTER');
    expect(w.net.requests.some(r => r.method === 'getSignaturesForAddress' && r.params[0] === FRESH1.address)).toBe(false);
    expect((loadA0AccountRegistry() ?? []).filter(e => e.role !== 'main')).toEqual([]);
    w.net.genesisHash = DEVNET_GENESIS;
    expect(await run(fresh(400_000n))).toMatchObject({status: 'spent'});
    const genesis = w.net.requests.findIndex(r => r.method === 'getGenesisHash');
    const history = w.net.requests.findIndex(r => r.method === 'getSignaturesForAddress' && r.params[0] === FRESH1.address);
    expect(genesis).toBeGreaterThanOrEqual(0);
    expect(history).toBeGreaterThan(genesis);
  });

  it('Task 4 / R2-N3: the verifier\'s detail (it names a seed key) is never in a readout line — only its code', async () => {
    w.relayer.script.push({answer: 'confirmed', mutate: tx => (tx.transaction.message.accountKeys[0] = MAIN.address)});
    const out = await run(fresh(400_000n));
    expect(out).toMatchObject({status: 'landed-unverified', code: 'E_A0_VERIFY_SEED_SIGNER'});
    expect(out.status === 'landed-unverified' && out.detail.includes(MAIN.address)).toBe(true); // non-vacuous
    expect(lines.filter(l => l.includes(MAIN.address))).toEqual([]);
    expect(readouts('unshield-outcome')[0]).not.toHaveProperty('detail');
  });
});

describe('A0UnshieldError', () => {
  it('carries its code', () => {
    expect(new A0UnshieldError('E_A0_UNSHIELD_BUSY', 'x')).toMatchObject({code: 'E_A0_UNSHIELD_BUSY', message: 'E_A0_UNSHIELD_BUSY: x'});
  });
});
