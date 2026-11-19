/**
 * The reconciliation of pending unshields (spec §6 step 8 "unconfirmed / already_spent: reconcile
 * through the tree sync … once a sync completes after the chain's clock has passed pendingSince +
 * 300 s … This resolves on a quiet pool too"; §14 JS "the unconfirmed chain-time timeout on a quiet
 * pool", "a non-landing removes it"; §16 M1c's kill), the startup step and "Check again" (M1b's
 * reconcile, instance-bound), and the app killed between the submit and the relayer's answer.
 *
 * The world is the flow suite's (`__testing__/unshieldWorld.ts`): the real web3.js Connection over
 * the live devnet fake, the live relayer fake, the fake native core; every expected value from the
 * offline vectors. "Killed" is what the phone keeps: the encrypted store (the same MMKV id
 * re-opened) and the chain; the flow's promise is abandoned, the process state (the flow lock, the
 * reservation chain, the native session) starts again.
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
import {clearAllStores, initSecureMmkv, mmkvSecure} from '../../../../store/mmkv/instances';
import {TEST_SEED, seedBytes, strangerField} from '../__testing__/offlineA0';
import type {FakeProverNative} from '../__testing__/offlineA0';
import {ACCOUNT, RECORDED_LEAVES, WITHDRAW_IO, expectedChange, own, unshieldWorld} from '../__testing__/unshieldWorld';
import type {UnshieldWorld} from '../__testing__/unshieldWorld';
import {liveDevnet} from '../__testing__/liveDevnet';
import type {LiveDevnet} from '../__testing__/liveDevnet';
import {LIVE_FEE} from '../__testing__/liveRelayer';
import {appendWithdraw} from '../__testing__/ownHistory';
import {loadA0NoteStore, mergeA0RecoveredNotes} from '../noteStore';
import {recoverA0ChangeNotes, recoverA0Deposits} from '../recovery';
import {syncA0Tree} from '../treeSync';
import {a0KeysClose, a0KeysOpen} from '../../../zkProver/nativeProverBridge';
import type {A0Note} from '../noteStore';
import {loadA0AccountRegistry, releaseA0FreshAccount, reserveA0FreshAccount, resetA0ReservationsForTests} from '../accountRegistry';
import {resetA0ReadoutForTests, setA0ReadoutDefaultsForTests} from '../checkpointReadout';
import {resetA0StartupForTests, runA0Startup} from '../startup';
import {a0HasPendingUnshields, reconcileA0PendingUnshields, resetA0UnshieldForTests, unshieldA0} from '../unshieldFlow';
import type {A0UnshieldOptions, A0UnshieldOutcome} from '../unshieldFlow';

const fake = NativeModules.NocturaProver as unknown as FakeProverNative;
const TREE_ADDR = '5URdh1uLKXPh28AbcXBK1oWYGpQjVbMSjrKiAkt1q1Gc';
const FRESH1 = ACCOUNT(1);
/** §6 step 8's window, written out (not imported from the code under test) */
const WINDOW_S = 300;

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
const unshieldFresh = (amount = 400_000n, extra: Partial<A0UnshieldOptions> = {}): Promise<A0UnshieldOutcome> =>
  unshieldA0(w.net.connection, seedBytes(TEST_SEED), {destination: {kind: 'fresh'}, amount}, opts(extra));
const reconcile = (net: LiveDevnet = w.net, seed: Uint8Array | null = seedBytes(TEST_SEED)) =>
  reconcileA0PendingUnshields(net.connection, seed, {sync: {useCache: false}});
const noteOf = (rho: string): A0Note => loadA0NoteStore().notes.find(n => n.rho === rho)!;
const registry = () => loadA0AccountRegistry()!.map(e => ({scheme: e.scheme, role: e.role}));
const methods = (net: LiveDevnet, from = 0) => net.requests.slice(from).map(r => r.method);

beforeEach(() => {
  clearAllStores();
  initSecureMmkv('test-key');
  resetA0UnshieldForTests();
  resetA0ReservationsForTests();
  resetA0StartupForTests();
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

describe('not landed: the chain-time window on a QUIET pool (no pool tx after the submit)', () => {
  it('in the window → still pending; past pendingSince + 300 s of CHAIN time → unspent again, the reservation released', async () => {
    w.relayer.script.push({answer: 'unconfirmed', lands: false});
    await unshieldFresh();
    const since = noteOf(w.notes[0]!.rho).pendingSince!;
    expect(since).toBe(w.net.clock.blockTime);

    w.net.clock = {slot: w.net.clock.slot + 750, blockTime: since + WINDOW_S};
    const from = w.net.requests.length;
    expect(await reconcile()).toMatchObject({stillPending: [{rho: w.notes[0]!.rho, reason: 'in-window'}], reverted: [], released: []});
    // the clock is read BEFORE the sync, so "no Withdraw" is about a history that reaches past it
    const m = methods(w.net, from);
    expect(m.slice(0, 3)).toEqual(['getSlot', 'getBlockTime', 'getSignaturesForAddress']);
    expect(noteOf(w.notes[0]!.rho).status).toBe('pending');

    w.net.clock = {slot: w.net.clock.slot + 1, blockTime: since + WINDOW_S + 1};
    expect(await reconcile()).toMatchObject({reverted: [{rho: w.notes[0]!.rho}], released: ['slip10:1'], stillPending: []});
    const n = noteOf(w.notes[0]!.rho);
    expect(n).toEqual({commitment: w.notes[0]!.commitment, amount: w.notes[0]!.amount, rho: w.notes[0]!.rho, depositIndex: 0n, leafIndex: w.notes[0]!.leafIndex, status: 'unspent'});
    expect(registry()).toEqual([{scheme: 'slip10:0', role: 'main'}]);
  });

  it('the phone\'s clock is not the chain\'s: a chain clock that does not move keeps it pending however late it is', async () => {
    w.relayer.script.push({answer: 'unconfirmed', lands: false});
    await unshieldFresh();
    const realNow = Date.now;
    Date.now = () => realNow() + 3_600_000;
    try {
      expect(await reconcile()).toMatchObject({stillPending: [{reason: 'in-window'}], reverted: []});
    } finally {
      Date.now = realNow;
    }
  });

  it('no block time for the current slot → still pending ("no-clock"), never reverted', async () => {
    w.relayer.script.push({answer: 'unconfirmed', lands: false});
    await unshieldFresh();
    w.net.clock = {slot: w.net.clock.slot + 1, blockTime: null};
    expect(await reconcile()).toMatchObject({stillPending: [{reason: 'no-clock'}], reverted: []});
    expect(noteOf(w.notes[0]!.rho).status).toBe('pending');
  });
});

describe('landed after all: settled through the sync with the STORED intent, verified', () => {
  it('unconfirmed, then it landed: spent at the tx matchSpent attributes, the change stored, slip10:1 fresh-exit; nothing note-specific asked', async () => {
    w.relayer.script.push({answer: 'unconfirmed', lands: true});
    expect(await unshieldFresh()).toMatchObject({status: 'pending', reason: 'unconfirmed'});
    const sig = w.relayer.landed[0]!;
    const from = w.net.requests.length;
    const r = await reconcile();
    expect(r).toEqual({
      settled: [{rho: w.notes[0]!.rho, signature: sig, verified: true, code: null, changeRecorded: true}],
      reverted: [],
      stillPending: [],
      skipped: 0,
      released: [],
      promoted: ['slip10:1'],
    });
    const change = expectedChange(w.notes[0]!, 400_000n, LIVE_FEE);
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'spent', spentTx: sig});
    expect(noteOf(change.rho)).toEqual({commitment: change.commitment, amount: change.amount, rho: change.rho, leafIndex: RECORDED_LEAVES + 1, status: 'unspent'});
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-exit'});
    // the reconciliation's requests: the clock, the sync — no signature poll, no nullifier PDA
    expect([...new Set(methods(w.net, from))].sort()).toEqual(['getAccountInfo', 'getBlockTime', 'getSignaturesForAddress', 'getSlot', 'getTransaction']);
    const text = JSON.stringify(w.net.requests.slice(from));
    expect(text).not.toContain(w.notes[0]!.nullifier);
    const ascii = (lines.find(l => l.includes('"unshield-reconcile"')) ?? '');
    expect(ascii).toContain('"verified":true');
  });

  it('a second reconciliation of the settled note changes nothing and asks nothing', async () => {
    w.relayer.script.push({answer: 'unconfirmed', lands: true});
    await unshieldFresh();
    await reconcile();
    const before = mmkvSecure()!.getString('v1_a0_notes');
    const from = w.net.requests.length;
    expect(await reconcile()).toEqual({settled: [], reverted: [], stillPending: [], skipped: 0, released: [], promoted: []});
    expect(w.net.requests.length).toBe(from);
    expect(mmkvSecure()!.getString('v1_a0_notes')).toBe(before);
  });

  it('a pending unshield stored WITHOUT its intent (as Task 5 writes one) settles by recovery\'s rules alone (verified: false)', async () => {
    const note = w.notes[0]!;
    const raw = mmkvSecure()!.getString('v1_a0_notes')!;
    mmkvSecure()!.set('v1_a0_notes', raw.replace('"status":"unspent"', `"status":"pending","pendingSince":${w.net.clock.blockTime}`));
    const change = expectedChange(note, 400_000n, LIVE_FEE);
    const sig = appendWithdraw(w.net.chain, {nullifier: note.nullifier, changeCommitment: change.commitment, amount: 400_000n, fee: LIVE_FEE}).signature;
    expect(await reconcile()).toMatchObject({settled: [{signature: sig, verified: false, code: null, changeRecorded: true}]});
    expect(noteOf(note.rho)).toMatchObject({status: 'spent', spentTx: sig});
    expect(noteOf(change.rho)).toMatchObject({status: 'unspent', amount: change.amount});
  });
});

describe('the carry\'s rulings on Tasks 2 and 5, and m-2 in the reconciliation', () => {
  it('Task 2: a reservation released blindly, then the tx turns out LANDED — verified all the same (the account re-derived from the seed is ours) and fresh-exit again', async () => {
    w.relayer.script.push({answer: 'unconfirmed', lands: true});
    await unshieldFresh();
    expect(releaseA0FreshAccount('slip10:1')).toBe(true); // a stale reading released it
    expect(registry()).toEqual([{scheme: 'slip10:0', role: 'main'}]);
    const r = await reconcile();
    expect(r).toMatchObject({settled: [{signature: w.relayer.landed[0], verified: true, code: null, changeRecorded: true}], promoted: ['slip10:1']});
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-exit'});
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'spent', spentTx: w.relayer.landed[0]});
  });

  it('Task 5: a deposit pre-check settled the pending unshield first (spent + its change) — the reconcile never reverts it, never stores the change twice; the reservation is promoted by the history', async () => {
    w.relayer.script.push({answer: 'unconfirmed', lands: true});
    await unshieldFresh();
    const sig = w.relayer.landed[0]!;
    const since = noteOf(w.notes[0]!.rho).pendingSince!;
    // exactly what depositFlow's pre-check does on a hit: recover deposits + change notes on the synced tree, merge
    const {tree} = await syncA0Tree(w.net.connection, {useCache: false});
    const handle = await a0KeysOpen(seedBytes(TEST_SEED));
    const rec = await recoverA0Deposits(handle, tree);
    const change = await recoverA0ChangeNotes(handle, tree, rec.notes);
    mergeA0RecoveredNotes(change.notes, rec.nextDepositIndex);
    await a0KeysClose(handle);
    const expected = expectedChange(w.notes[0]!, 400_000n, LIVE_FEE);
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'spent', spentTx: sig});
    expect(loadA0NoteStore().notes.filter(n => n.rho === expected.rho)).toHaveLength(1);

    w.net.clock = {slot: w.net.clock.slot + 10_000, blockTime: since + 10 * WINDOW_S}; // far past the window
    const r = await reconcile();
    expect(r).toMatchObject({settled: [], reverted: [], stillPending: [], promoted: ['slip10:1'], released: []});
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'spent', spentTx: sig});
    expect(loadA0NoteStore().notes.filter(n => n.rho === expected.rho)).toEqual([
      {commitment: expected.commitment, amount: expected.amount, rho: expected.rho, leafIndex: RECORDED_LEAVES + 1, status: 'unspent'},
    ]);
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-exit'});
  });

  it('m-2: the reconciliation\'s clock falls back to slot−1 … slot−4 too (a past-window time there reverts)', async () => {
    w.relayer.script.push({answer: 'unconfirmed', lands: false});
    await unshieldFresh();
    const since = noteOf(w.notes[0]!.rho).pendingSince!;
    w.net.clock = {slot: w.net.clock.slot + 800, blockTime: null, earlier: [null, since + WINDOW_S + 1]};
    expect(await reconcile()).toMatchObject({reverted: [{rho: w.notes[0]!.rho}], released: ['slip10:1']});
  });
});

describe('killed between the submit and the relayer\'s answer (§16 M1c)', () => {
  /** Unshield until the app dies waiting for the relayer; the flow's promise is abandoned. */
  async function unshieldAndKill(lands: boolean): Promise<void> {
    w.relayer.script.push({answer: 'kill', lands});
    let submitted = () => undefined as void;
    const sent = new Promise<void>(r => {
      submitted = r;
    });
    // abandoned, never awaited: the app is dead
    const abandoned = unshieldFresh(400_000n, {onStage: s => (s === 'submit' ? submitted() : undefined)}).catch(() => undefined);
    expect(abandoned).toBeInstanceOf(Promise);
    await sent;
    await new Promise(r => setTimeout(r, 20));
    expect(w.net.killed).toBe(true);
  }
  /** The next start: the same store and chain, a new Connection, a new process (locks, chains, native session). */
  function restart(): LiveDevnet {
    const next = liveDevnet(w.net.chain);
    next.clock = w.net.clock;
    initSecureMmkv('test-key');
    resetA0UnshieldForTests();
    resetA0ReservationsForTests();
    resetA0StartupForTests();
    fake.reset();
    return next;
  }

  it('the pending unshield (pendingSince + intent) and the reservation survive the kill', async () => {
    await unshieldAndKill(false);
    restart();
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'pending', pendingSince: w.net.clock.blockTime, unshield: {owner: FRESH1.address, scheme: 'slip10:1'}});
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-pending'});
  });

  it('it LANDED: the next start\'s step settles it — verified, the change stored, the fresh account fresh-exit', async () => {
    await unshieldAndKill(true);
    const next = restart();
    const res = await runA0Startup(next.connection, seedBytes(TEST_SEED), {sync: {useCache: false}});
    expect(res.restoredBecause).toBeNull();
    expect(res.unshields).toMatchObject({settled: [{signature: w.relayer.landed[0], verified: true, code: null}], promoted: ['slip10:1']});
    const change = expectedChange(w.notes[0]!, 400_000n, LIVE_FEE);
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'spent', spentTx: w.relayer.landed[0]});
    expect(noteOf(change.rho)).toMatchObject({status: 'unspent', leafIndex: RECORDED_LEAVES + 1});
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-exit'});
  });

  it('it did NOT land: pending in the window, then — on "Check again" past it — unspent and released', async () => {
    await unshieldAndKill(false);
    const next = restart();
    const since = noteOf(w.notes[0]!.rho).pendingSince!;
    const res = await runA0Startup(next.connection, seedBytes(TEST_SEED), {sync: {useCache: false}});
    expect(res.unshields).toMatchObject({stillPending: [{reason: 'in-window'}]});
    next.clock = {slot: next.clock.slot + 1, blockTime: since + WINDOW_S + 1};
    expect(await reconcile(next)).toMatchObject({reverted: [{rho: w.notes[0]!.rho}], released: ['slip10:1']});
    expect(noteOf(w.notes[0]!.rho).status).toBe('unspent');
  });
});

describe('reservations no pending unshield names (the app died between the reservation and the pending write)', () => {
  it('released at the next reconciliation — no seed needed, no clock read; only the sync\'s requests', async () => {
    await reserveA0FreshAccount(w.net.connection, seedBytes(TEST_SEED));
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-pending'});
    const from = w.net.requests.length;
    expect(await reconcile(w.net, null)).toMatchObject({released: ['slip10:1'], promoted: []});
    expect([...new Set(methods(w.net, from))].sort()).toEqual(['getAccountInfo', 'getSignaturesForAddress', 'getTransaction']);
    expect(registry()).toEqual([{scheme: 'slip10:0', role: 'main'}]);
  });

  it('…but promoted when the synced history names the account (it received an exit: never handed out again)', async () => {
    await reserveA0FreshAccount(w.net.connection, seedBytes(TEST_SEED));
    appendWithdraw(w.net.chain, {nullifier: strangerField(41), changeCommitment: strangerField(42), template: '47k56NfB', to: {owner: FRESH1.address, ata: FRESH1.ata}});
    expect(await reconcile(w.net, null)).toMatchObject({promoted: ['slip10:1'], released: []});
    expect(registry()).toContainEqual({scheme: 'slip10:1', role: 'fresh-exit'});
  });
});

describe('when there is nothing to decide, nothing is asked; and the guards', () => {
  it('no pending unshield, no orphaned reservation → no request at all (the M1b startup is unchanged)', async () => {
    const from = w.net.requests.length;
    expect(await reconcile()).toEqual({settled: [], reverted: [], stillPending: [], skipped: 0, released: [], promoted: []});
    expect(w.net.requests.length).toBe(from);
    expect(lines.filter(l => l.includes('unshield-reconcile'))).toEqual([]);
  });

  it('a pending unshield and no seed → E_A0_UNSHIELD_NEEDS_SEED before any request; nothing written', async () => {
    w.relayer.script.push({answer: 'unconfirmed', lands: false});
    await unshieldFresh();
    const from = w.net.requests.length;
    const before = mmkvSecure()!.getString('v1_a0_notes');
    await expect(reconcile(w.net, null)).rejects.toMatchObject({code: 'E_A0_UNSHIELD_NEEDS_SEED'});
    expect(w.net.requests.length).toBe(from);
    expect(mmkvSecure()!.getString('v1_a0_notes')).toBe(before);
  });

  it('fix round 1 / I-1: a flow that writes its pending unshield WHILE a reconciliation reads the chain keeps its reservation (the sweep reads the store again)', async () => {
    // an orphan, so the reconciliation has work to do at entry and reaches its sync
    await reserveA0FreshAccount(w.net.connection, seedBytes(TEST_SEED));
    // the reconciliation on its own connection (same chain), held in its tree walk
    const other = liveDevnet(w.net.chain);
    other.clock = w.net.clock;
    other.holdWhen = m => m === 'getSignaturesForAddress';
    const rec = reconcile(other, null);
    while (other.held === 0) {
      await new Promise(r => setTimeout(r, 5));
    }
    // meanwhile a flow reserves slip10:2, writes its pending unshield, gets an unknown answer and returns
    w.relayer.script.push({answer: 'transport'});
    expect(await unshieldFresh()).toMatchObject({status: 'pending', reason: 'unknown'});
    expect(registry()).toContainEqual({scheme: 'slip10:2', role: 'fresh-pending'});
    other.release();
    expect(await rec).toMatchObject({released: ['slip10:1'], promoted: []});
    // R1-C1: an unknown outcome never releases its reservation
    expect(registry()).toContainEqual({scheme: 'slip10:2', role: 'fresh-pending'});
    expect(noteOf(w.notes[0]!.rho)).toMatchObject({status: 'pending', unshield: {scheme: 'slip10:2'}});
  });

  it('fix round 1 / M-2: a not-sent unshield leaves no live mark on its released scheme — a later orphan of that index is still swept', async () => {
    w.relayer.script.push({answer: 'raw', status: 400, body: {outcome: 'invalid_request'}});
    expect(await unshieldFresh()).toEqual({status: 'not-sent', outcome: 'invalid_request'});
    await reserveA0FreshAccount(w.net.connection, seedBytes(TEST_SEED)); // slip10:1 again, no pending write
    expect(await reconcile(w.net, null)).toMatchObject({released: ['slip10:1']});
    expect(registry()).toEqual([{scheme: 'slip10:0', role: 'main'}]);
  });

  it('fix round 1 / M-6: a0HasPendingUnshields does not count a note a flow in this process holds ("Check again" reads no keychain for it)', async () => {
    w.relayer.script.push({answer: 'hang'});
    let submitted = () => undefined as void;
    const sent = new Promise<void>(r => {
      submitted = r;
    });
    const flow = unshieldFresh(400_000n, {onStage: s => (s === 'submit' ? submitted() : undefined), transport: {...w.relayer.transport, deadlineMs: 60_000}});
    await sent;
    expect(noteOf(w.notes[0]!.rho).status).toBe('pending');
    expect(a0HasPendingUnshields()).toBe(false);
    w.relayer.abandon();
    expect(await flow).toMatchObject({status: 'pending', reason: 'unknown'});
    expect(a0HasPendingUnshields()).toBe(true);
  });

  it('a note a flow in this process still holds is skipped (the flow settles it), and its reservation is not an orphan', async () => {
    w.relayer.script.push({answer: 'hang'});
    let submitted = () => undefined as void;
    const sent = new Promise<void>(r => {
      submitted = r;
    });
    const flow = unshieldFresh(400_000n, {onStage: s => (s === 'submit' ? submitted() : undefined), transport: {...w.relayer.transport, deadlineMs: 60_000}});
    await sent;
    const from = w.net.requests.length;
    expect(await reconcile()).toMatchObject({skipped: 1, settled: [], reverted: [], released: []});
    expect(w.net.requests.length).toBe(from);
    w.relayer.abandon();
    expect(await flow).toMatchObject({status: 'pending', reason: 'unknown'});
  });

  it('a wipe + import while it read the chain → E_A0_STORE_CHANGED before writing', async () => {
    w.relayer.script.push({answer: 'unconfirmed', lands: true});
    await unshieldFresh();
    w.net.holdWhen = m => m === 'getSignaturesForAddress';
    const p = reconcile().catch((e: {code?: string}) => e.code);
    while (w.net.held === 0) {
      await new Promise(r => setTimeout(r, 5));
    }
    clearAllStores();
    initSecureMmkv('another-wallet');
    w.net.release();
    expect(await p).toBe('E_A0_STORE_CHANGED');
  });
});

describe('own values are offline (non-vacuous rows)', () => {
  it('the settled change is the offline equation\'s, not one read back from the code under test', () => {
    const n = w.notes[0]!;
    expect(n.nullifier).toBe(own.nullifier(n.rho));
    expect(expectedChange(n, 400_000n, LIVE_FEE).rho).toBe(own.rhoChange(n.nullifier));
  });
  it('the recorded tree has its 17 leaves before the own deposit', () => {
    expect(w.notes[0]!.leafIndex).toBe(RECORDED_LEAVES);
    expect(w.net.chain.tree).toBe(TREE_ADDR);
  });
});
