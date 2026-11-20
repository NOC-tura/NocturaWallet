/**
 * Recovery of deposits from the seed (spec §7 "Deposits", R12, R13, §8 "after a restore it is the
 * highest recovered depositIndex + 1").
 *
 * The chain is the recorded devnet history of tree 5URd… (fixtures/devnet-tree-5URd.json), served
 * to the REAL web3.js Connection (recordedRpc.ts) and verified by the real tree sync. Its deposits
 * were made by the PROGRAM SIDE's keys, so for the test seed it holds no own note — the negative
 * case. The positive cases append deposits and unshields of the test seed to a copy of it
 * (ownHistory.ts: clones of real landed txs, the tree account advanced as the program advances
 * it), with every rho / commitment / nullifier taken from the OFFLINE equations (offlineA0.ts,
 * held to a0-key-vectors.json) — never from the code under test. The native core is the offline
 * fake behind the real bridge.
 */
jest.mock('@solana/web3.js', () =>
  jest.requireActual<typeof import('../__testing__/realWeb3')>('../__testing__/realWeb3').loadRealWeb3(),
);
jest.mock('react-native', () => ({
  NativeModules: {
    NocturaProver: jest.requireActual<typeof import('../__testing__/offlineA0')>('../__testing__/offlineA0').createFakeProverNative(),
  },
}));
import {readFileSync} from 'fs';
import {join} from 'path';
import {NativeModules} from 'react-native';
import {clearAllStores, initSecureMmkv, mmkvSecure} from '../../../../store/mmkv/instances';
import {OTHER_SEED, TEST_SEED, offlineKeys, seedBytes, strangerField} from '../__testing__/offlineA0';
import type {FakeProverNative} from '../__testing__/offlineA0';
import {appendDeposit, appendDepositPair, appendWithdraw} from '../__testing__/ownHistory';
import {chainFrom, recordedConnection} from '../__testing__/recordedRpc';
import type {RecordedChain, RecordedFixture} from '../__testing__/recordedRpc';
import {addA0PendingDeposit, loadA0NoteStore, setA0NextDepositIndex} from '../noteStore';
import {
  A0_DEPOSIT_GAP_LIMIT,
  A0RecoveryError,
  a0R13TriggerReached,
  loadA0LastRestoreStats,
  restoreA0FromSeed,
} from '../recovery';

const TREE = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/devnet-tree-5URd.json'), 'utf8'),
) as RecordedFixture;
const fake = NativeModules.NocturaProver as unknown as FakeProverNative;
const own = offlineKeys(TEST_SEED);
const other = offlineKeys(OTHER_SEED);
const KEY = 'v1_a0_notes';

const fresh = (): RecordedChain => chainFrom(TREE);
const restore = (chain: RecordedChain, seed: Uint8Array = seedBytes(TEST_SEED)) =>
  restoreA0FromSeed(recordedConnection(chain).connection, seed, {sync: {useCache: false}});

/** Our deposit at counter `i` (rho and commitment from the offline equations). */
const ownDeposit = (chain: RecordedChain, i: bigint, amount: bigint) => {
  const rho = own.rho(i);
  return {rho, commitment: own.commitment(amount, rho), ...appendDeposit(chain, {amount, rho, commitment: own.commitment(amount, rho)})};
};
/** Every Withdraw nullifier of the recorded history, decoded independently from its logs. */
const recordedNullifiers = (chain: RecordedChain): string[] =>
  [...chain.signatures].reverse().flatMap(s =>
    chain.transactions[s.signature]!.meta.logMessages
      .filter(l => l.startsWith('Program data: '))
      .map(l => Buffer.from(l.slice(14), 'base64'))
      .filter(b => b.subarray(0, 8).toString('hex') === 'c0f1c9d946965af7')
      .map(b => b.subarray(8, 40).toString('hex')),
  );
const callsOf = (m: string) => fake.calls.filter(c => c.method === m);

beforeEach(() => {
  clearAllStores();
  initSecureMmkv('test-key');
  fake.reset();
});

describe('the recorded devnet history (the program side\'s deposits) — the negative case', () => {
  it('yields ZERO own notes for the test seed: counter 0, exactly the gap limit tried, no matchSpent', async () => {
    const chain = fresh();
    const res = await restore(chain);
    expect(res.notes).toEqual([]);
    expect(res.nextDepositIndex).toBe(0n);
    expect(A0_DEPOSIT_GAP_LIMIT).toBe(100); // S15 (was 20)
    expect(callsOf('depositRho').map(c => c.args[1])).toEqual([...Array(100).keys()].map(String));
    expect(callsOf('commitment')).toHaveLength(0);
    expect(callsOf('matchSpent')).toHaveLength(0);
    expect(res.stats.treeTransactions).toBe(15);
    expect(loadA0NoteStore()).toEqual({nextDepositIndex: 0n, notes: []});
  });

  it('the history does hold deposits and unshields — they are simply not ours', async () => {
    const res = await restore(fresh());
    expect(res.stats.depositsInHistory).toBeGreaterThanOrEqual(5);
    expect(recordedNullifiers(fresh()).length).toBeGreaterThanOrEqual(4);
    expect(res.stats.withdrawNullifiersInHistory).toBe(recordedNullifiers(fresh()).length);
  });
});

describe('own deposits appended to the recorded history — the positive cases', () => {
  it('finds every own deposit: amount from the instruction, leaf from LeafInserted, spent-status from ONE matchSpent', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000_000n);
    appendDeposit(chain, {amount: 7n, rho: other.rho(0n), commitment: other.commitment(7n, other.rho(0n))});
    const d1 = ownDeposit(chain, 1n, 250_000_000n);
    const w1 = appendWithdraw(chain, {nullifier: own.nullifier(d1.rho), changeCommitment: strangerField(1)});
    const d2 = ownDeposit(chain, 2n, 42n);
    const res = await restore(chain);
    expect(res.notes).toEqual([
      {commitment: d0.commitment, amount: 1_000_000_000n, rho: d0.rho, depositIndex: 0n, leafIndex: 17, status: 'unspent'},
      {commitment: d1.commitment, amount: 250_000_000n, rho: d1.rho, depositIndex: 1n, leafIndex: 19, status: 'spent', spentTx: w1.signature},
      {commitment: d2.commitment, amount: 42n, rho: d2.rho, depositIndex: 2n, leafIndex: 21, status: 'unspent'},
    ]);
    expect([d0.leafIndex, d1.leafIndex, d2.leafIndex]).toEqual([17, 19, 21]);
    expect(res.nextDepositIndex).toBe(3n);
    // ONE matchSpent for the spent-status: every synced Withdraw nullifier, every own rho …
    const ms = callsOf('matchSpent');
    expect(ms[0]!.args[1]).toEqual([...recordedNullifiers(fresh()), own.nullifier(d1.rho)]);
    expect(ms[0]!.args[2]).toEqual([d0.rho, d1.rho, d2.rho]);
    // … then the attribution (M1c): one matchSpent([n], [the spent rho]) per synced nullifier, in
    // sync order, until the spent note is attributed (its own nullifier is the last one)
    expect(ms.slice(1).map(c => c.args.slice(1))).toEqual(
      [...recordedNullifiers(fresh()), own.nullifier(d1.rho)].map(n => [[n], [d1.rho]]),
    );
    // the commitment check went through Rust's commitment() for each hit
    expect(callsOf('commitment').map(c => c.args.slice(1))).toEqual([
      ['1000000000', d0.rho],
      ['250000000', d1.rho],
      ['42', d2.rho],
      // the change check of d1's spend (250,000,000 − 400,000 − 10,000): not ours (a stranger's leaf)
      ['249590000', own.rhoChange(own.nullifier(d1.rho))],
    ]);
    // and the store holds them, with no nullifier anywhere
    expect(loadA0NoteStore()).toEqual({nextDepositIndex: 3n, notes: res.notes});
    const text = mmkvSecure()!.getString(KEY)!;
    for (const r of [d0.rho, d1.rho, d2.rho]) {
      expect(text).not.toContain(own.nullifier(r));
    }
    expect(res.stats).toMatchObject({ownNotes: 3, spentNotes: 1, foreignRhoHits: 0, depositIndicesTried: 103, changeNotes: 0, unmatchedChangeLeaves: 1});
  });

  it('deposits that landed out of counter order are all found, returned by counter', async () => {
    const chain = fresh();
    const d2 = ownDeposit(chain, 2n, 3n);
    const d0 = ownDeposit(chain, 0n, 1n);
    const d1 = ownDeposit(chain, 1n, 2n);
    const res = await restore(chain);
    expect(res.notes.map(n => [n.depositIndex, n.leafIndex, n.rho])).toEqual([
      [0n, d0.leafIndex, d0.rho],
      [1n, d1.leafIndex, d1.rho],
      [2n, d2.leafIndex, d2.rho],
    ]);
  });

  it('two deposits in one transaction, a stranger\'s first: our note takes the leaf of ITS commitment, not the first leaf', async () => {
    const chain = fresh();
    const r0 = own.rho(0n);
    const pair = appendDepositPair(
      chain,
      {amount: 7n, rho: other.rho(0n), commitment: other.commitment(7n, other.rho(0n))},
      {amount: 8n, rho: r0, commitment: own.commitment(8n, r0)},
    );
    expect(pair.leafIndices).toEqual([17, 18]);
    const res = await restore(chain);
    expect(res.notes).toEqual([{commitment: own.commitment(8n, r0), amount: 8n, rho: r0, depositIndex: 0n, leafIndex: 18, status: 'unspent'}]);
  });

  it('OUR rho under SOMEONE ELSE\'s commitment (a front-run) is not imported — but it burns its counter', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 5n);
    const r1 = own.rho(1n);
    appendDeposit(chain, {amount: 5n, rho: r1, commitment: other.commitment(5n, r1)});
    const d2 = ownDeposit(chain, 2n, 5n);
    const res = await restore(chain);
    expect(res.notes.map(n => n.rho)).toEqual([d0.rho, d2.rho]);
    expect(res.stats.foreignRhoHits).toBe(1);
    expect(res.nextDepositIndex).toBe(3n);
  });

  it('a deposit whose instruction amount is not the one its commitment binds is not imported (the check uses the instruction\'s amount)', async () => {
    const chain = fresh();
    const r0 = own.rho(0n);
    appendDeposit(chain, {amount: 6n, rho: r0, commitment: own.commitment(5n, r0)});
    const res = await restore(chain);
    expect(res.notes).toEqual([]);
    expect(res.stats.foreignRhoHits).toBe(1);
    expect(res.nextDepositIndex).toBe(1n);
    // positive twin: the same deposit with the matching amount is ours
    const ok = fresh();
    appendDeposit(ok, {amount: 5n, rho: r0, commitment: own.commitment(5n, r0)});
    expect((await restore(ok)).notes.map(n => n.amount)).toEqual([5n]);
  });

  it('two successful deposits carrying one rho (impossible on chain: the rho PDA is init) refuse the recovery', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 5n);
    appendDeposit(chain, {amount: 6n, rho: d0.rho, commitment: own.commitment(6n, d0.rho)});
    const err = await restore(chain).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(A0RecoveryError);
    expect((err as A0RecoveryError).code).toBe('E_A0_RECOVERY_DUPLICATE_RHO');
    expect(fake.liveHandle()).toBeNull();
    expect(mmkvSecure()!.getString(KEY)).toBeUndefined();
  });
});

describe('the gap limit (S15: 100 consecutive misses, was 20)', () => {
  it('99 misses then a hit → found (and the walk goes on 100 past it)', async () => {
    const chain = fresh();
    ownDeposit(chain, 0n, 1n);
    ownDeposit(chain, 100n, 2n);
    const res = await restore(chain);
    expect(res.notes.map(n => n.depositIndex)).toEqual([0n, 100n]);
    expect(res.nextDepositIndex).toBe(101n);
    expect(res.stats.depositIndicesTried).toBe(201);
  });

  it('100 misses → stop: a deposit 101 past the last hit is not looked for', async () => {
    const chain = fresh();
    ownDeposit(chain, 0n, 1n);
    ownDeposit(chain, 101n, 2n);
    const res = await restore(chain);
    expect(res.notes.map(n => n.depositIndex)).toEqual([0n]);
    expect(res.nextDepositIndex).toBe(1n);
    expect(res.stats.depositIndicesTried).toBe(101);
    expect(callsOf('depositRho').map(c => c.args[1])).not.toContain('101');
  });

  it('from the start: a first deposit at 99 is found, at 100 it is not', async () => {
    const at99 = fresh();
    ownDeposit(at99, 99n, 1n);
    expect((await restore(at99)).notes.map(n => n.depositIndex)).toEqual([99n]);
    fake.reset();
    const at100 = fresh();
    ownDeposit(at100, 100n, 1n);
    const res = await restore(at100);
    expect(res.notes).toEqual([]);
    expect(res.nextDepositIndex).toBe(0n);
  });

  it('the old limit no longer stops it: a deposit 21 past the last hit (beyond the M1b limit of 20) is found', async () => {
    const chain = fresh();
    ownDeposit(chain, 0n, 1n);
    ownDeposit(chain, 21n, 2n);
    expect((await restore(chain)).notes.map(n => n.depositIndex)).toEqual([0n, 21n]);
  });
});

describe('the key handle and the seed (spec §3 "Handle lifetime", C3)', () => {
  it('one keysOpen, one keysClose of the same handle; the caller\'s seed is zero-filled', async () => {
    const chain = fresh();
    ownDeposit(chain, 0n, 1n);
    const seed = seedBytes(TEST_SEED);
    await restore(chain, seed);
    expect(callsOf('keysOpen')).toHaveLength(1);
    const closes = callsOf('keysClose');
    expect(closes).toHaveLength(1);
    expect(closes[0]!.args[0]).toBe(callsOf('depositRho')[0]!.args[0]);
    expect(fake.liveHandle()).toBeNull();
    expect(seed.every(b => b === 0)).toBe(true);
  });

  it('a native refusal mid-recovery: the handle is still closed, the store untouched, the seed zero-filled', async () => {
    const chain = fresh();
    ownDeposit(chain, 0n, 1n);
    fake.failNext('commitment', Object.assign(new Error('E_A0_INTERNAL: boom'), {code: 'E_A0_INTERNAL'}));
    const seed = seedBytes(TEST_SEED);
    await expect(restore(chain, seed)).rejects.toThrow('E_A0_INTERNAL');
    expect(callsOf('keysClose')).toHaveLength(1);
    expect(fake.liveHandle()).toBeNull();
    expect(mmkvSecure()!.getString(KEY)).toBeUndefined();
    expect(seed.every(b => b === 0)).toBe(true);
  });

  it('a sync that refuses: no key is opened at all, the seed is zero-filled', async () => {
    const chain = fresh();
    chain.account.value = null;
    const seed = seedBytes(TEST_SEED);
    await expect(restore(chain, seed)).rejects.toThrow('E_A0_TREE_MISSING');
    expect(callsOf('keysOpen')).toHaveLength(0);
    expect(seed.every(b => b === 0)).toBe(true);
  });

  it('without the encrypted store: refused before any request (E_A0_STORE_LOCKED), the seed zero-filled', async () => {
    clearAllStores();
    const {connection, requests} = recordedConnection(fresh());
    const seed = seedBytes(TEST_SEED);
    await expect(restoreA0FromSeed(connection, seed, {sync: {useCache: false}})).rejects.toMatchObject({code: 'E_A0_STORE_LOCKED'});
    expect(requests).toEqual([]);
    expect(callsOf('keysOpen')).toHaveLength(0);
    expect(seed.every(b => b === 0)).toBe(true);
  });

  it('into a store that already has a pending deposit and a higher counter: the deposit is confirmed, the counter kept', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 9n);
    // the deposit at 0 is pending in the store; counters 1..4 were used by deposits that never landed
    addA0PendingDeposit({commitment: d0.commitment, amount: 9n, rho: d0.rho, depositIndex: 0n, lastValidBlockHeight: 1});
    setA0NextDepositIndex(5n);
    const res = await restore(chain);
    expect(res.nextDepositIndex).toBe(1n);
    expect(loadA0NoteStore()).toEqual({
      nextDepositIndex: 5n,
      notes: [{commitment: d0.commitment, amount: 9n, rho: d0.rho, depositIndex: 0n, leafIndex: 17, status: 'unspent'}],
    });
  });

  it('an out-of-range answer from matchSpent is refused (E_A0_RECOVERY_NATIVE), the handle closed', async () => {
    const chain = fresh();
    ownDeposit(chain, 0n, 1n);
    const spy = jest.spyOn(fake, 'matchSpent').mockResolvedValueOnce([1]);
    const err = await restore(chain).catch((e: unknown) => e);
    spy.mockRestore();
    expect((err as A0RecoveryError).code).toBe('E_A0_RECOVERY_NATIVE');
    expect(fake.liveHandle()).toBeNull();
  });
});

describe('R13: the restore\'s cost is measured and kept', () => {
  it('returns and records the tree transaction count and the duration', async () => {
    const chain = fresh();
    ownDeposit(chain, 0n, 1n);
    appendWithdraw(chain, {nullifier: own.nullifier(own.rho(0n)), changeCommitment: strangerField(2)});
    const res = await restore(chain);
    expect(res.stats.treeTransactions).toBe(17);
    expect(res.stats.failedTransactions).toBe(0);
    expect(res.stats.fetchedTransactions).toBe(17);
    expect(res.stats.durationMs).toBeGreaterThanOrEqual(res.stats.syncDurationMs);
    expect(res.stats.syncDurationMs).toBeGreaterThanOrEqual(0);
    expect(res.stats.finishedAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    expect(res.stats.r13TriggerReached).toBe(false);
    expect(loadA0LastRestoreStats()).toEqual(res.stats);
  });

  it('R1-m4: highestHit — the highest counter found, own OR foreign — is returned and recorded; none → null', async () => {
    // The hazard it exposes (R1-m4; S15 raised the limit to 100): with a counter never handed back,
    // 100 consecutive expired or front-run counters hide every later own deposit from a restore.
    // highestHit lets the checkpoint see how far the walk got.
    const none = await restore(fresh());
    expect(none.stats.highestHit).toBeNull();
    expect(loadA0LastRestoreStats()!.highestHit).toBeNull();

    clearAllStores();
    initSecureMmkv('test-key');
    const chain = fresh();
    ownDeposit(chain, 0n, 1n);
    const r4 = own.rho(4n);
    appendDeposit(chain, {amount: 9n, rho: r4, commitment: other.commitment(9n, r4)}); // foreign hit at 4
    const res = await restore(chain);
    expect(res.notes.map(n => n.depositIndex)).toEqual([0n]);
    expect(res.stats).toMatchObject({ownNotes: 1, foreignRhoHits: 1, highestHit: 4, depositIndicesTried: 105});
    expect(res.nextDepositIndex).toBe(5n);
    expect(loadA0LastRestoreStats()).toEqual(res.stats);
    expect(loadA0LastRestoreStats()!.highestHit).toBe(4);
  });

  it('the trigger: more than 5,000 tree transactions, or more than 60 s', () => {
    expect(a0R13TriggerReached({treeTransactions: 5000, durationMs: 60_000})).toBe(false);
    expect(a0R13TriggerReached({treeTransactions: 5001, durationMs: 1})).toBe(true);
    expect(a0R13TriggerReached({treeTransactions: 1, durationMs: 60_001})).toBe(true);
  });
});
