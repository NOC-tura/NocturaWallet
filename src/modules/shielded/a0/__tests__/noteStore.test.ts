/**
 * The A0 note store (spec §8, §5 steps 2/5/7, I-4, R12): the fields EXACTLY §8's, the monotone
 * deposit counter, the pending-note-plus-counter write as ONE storage write, the encrypted
 * instance only, fail-closed reads, and the one-time clearing of the v1 note schema.
 *
 * The note values are the offline vectors' (a0-key-vectors.json, the test seed): a real own
 * note's rho / commitment, and its nullifier as the value the store must never hold.
 */
import {clearAllStores, initSecureMmkv, mmkvPublic, mmkvSecure} from '../../../../store/mmkv/instances';
import {A0} from '../constants';
import {TEST_SEED} from '../__testing__/offlineA0';
import {
  A0_NOTE_STORE_SCHEMA,
  A0NoteStoreError,
  addA0PendingDeposit,
  a0UnspentBalance,
  confirmA0Deposit,
  dropA0PendingDeposit,
  loadA0NoteStore,
  mergeA0RecoveredNotes,
  setA0NextDepositIndex,
} from '../noteStore';
import type {A0Note} from '../noteStore';

const KEY = 'v1_a0_notes';
/** Spec §8, copied from its text: the ONLY fields a stored note may carry. */
const SPEC_8_FIELDS = ['commitment', 'amount', 'rho', 'depositIndex', 'lastValidBlockHeight', 'leafIndex', 'status', 'spentTx', 'pendingSince'];
const N0 = TEST_SEED.notes[0]!;
const N1 = TEST_SEED.notes[1]!;
const N2 = TEST_SEED.notes[2]!;
const cm = (n: typeof N0, amount: string) => n.commitments.find(c => c.amount === amount)!.commitment;
const SIG = '5YzqozdiSJ' + '1'.repeat(78);

const pending = (n: typeof N0, i: bigint) => ({
  commitment: cm(n, '1000000000'),
  amount: 1_000_000_000n,
  rho: n.rho,
  depositIndex: i,
  lastValidBlockHeight: 400_000_123,
});
const unspent = (n: typeof N0, i: bigint, leafIndex: number): A0Note => ({
  commitment: cm(n, '1000000000'),
  amount: 1_000_000_000n,
  rho: n.rho,
  depositIndex: i,
  leafIndex,
  status: 'unspent',
});

const code = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    if (e instanceof A0NoteStoreError) {
      return e.code;
    }
    throw e;
  }
  throw new Error('did not throw');
};
const raw = (): Record<string, unknown> => JSON.parse(mmkvSecure()!.getString(KEY)!) as Record<string, unknown>;

beforeEach(() => {
  clearAllStores();
  initSecureMmkv('test-key');
});

describe('the store record', () => {
  it('starts empty with nextDepositIndex 0, written to the ENCRYPTED instance only', () => {
    expect(loadA0NoteStore()).toEqual({nextDepositIndex: 0n, notes: []});
    expect(raw()).toEqual({schema: A0_NOTE_STORE_SCHEMA, programId: A0.programId, pool: A0.pool, nextDepositIndex: '0', notes: []});
    expect(mmkvPublic.getAllKeys()).toEqual([]);
  });

  it('a stored note carries only §8\'s fields — no noteSecret, no diversifier, no nullifier', () => {
    addA0PendingDeposit(pending(N0, 0n));
    const notes = raw().notes as Record<string, unknown>[];
    expect(notes).toHaveLength(1);
    for (const k of Object.keys(notes[0]!)) {
      expect(SPEC_8_FIELDS).toContain(k);
    }
    const text = mmkvSecure()!.getString(KEY)!;
    expect(text).not.toContain(N0.nullifier);
    expect(text).not.toMatch(/noteSecret|diversifier|nullifier|dSelf|addrField|"d"/);
    expect(notes[0]).toEqual({
      commitment: cm(N0, '1000000000'),
      amount: '1000000000',
      rho: N0.rho,
      depositIndex: '0',
      lastValidBlockHeight: 400_000_123,
      status: 'pending',
    });
  });

  it('without the encrypted instance every read and write refuses (E_A0_STORE_LOCKED) — never a counter of 0', () => {
    clearAllStores();
    expect(mmkvSecure()).toBeNull();
    expect(code(() => loadA0NoteStore())).toBe('E_A0_STORE_LOCKED');
    expect(code(() => addA0PendingDeposit(pending(N0, 0n)))).toBe('E_A0_STORE_LOCKED');
    expect(code(() => setA0NextDepositIndex(1n))).toBe('E_A0_STORE_LOCKED');
    expect(mmkvPublic.getAllKeys()).toEqual([]);
  });

  it.each([
    ['not JSON', '{'],
    ['another schema', JSON.stringify({schema: 2, programId: A0.programId, pool: A0.pool, nextDepositIndex: '5', notes: []})],
    ['another pool', JSON.stringify({schema: 1, programId: A0.programId, pool: A0.merkleTree, nextDepositIndex: '5', notes: []})],
    ['a counter that is not a u64', JSON.stringify({schema: 1, programId: A0.programId, pool: A0.pool, nextDepositIndex: '-1', notes: []})],
    [
      'a note with a field §8 does not list (a nullifier)',
      JSON.stringify({
        schema: 1, programId: A0.programId, pool: A0.pool, nextDepositIndex: '1',
        notes: [{commitment: cm(N0, '1000000000'), amount: '1000000000', rho: N0.rho, leafIndex: 3, status: 'unspent', nullifier: N0.nullifier}],
      }),
    ],
    [
      'an unspent note without its leaf index',
      JSON.stringify({
        schema: 1, programId: A0.programId, pool: A0.pool, nextDepositIndex: '1',
        notes: [{commitment: cm(N0, '1000000000'), amount: '1000000000', rho: N0.rho, status: 'unspent'}],
      }),
    ],
  ])('a record with %s is CORRUPT and refuses (never read as an empty store)', (_label, value) => {
    mmkvSecure()!.set(KEY, value);
    expect(code(() => loadA0NoteStore())).toBe('E_A0_STORE_CORRUPT');
    expect(code(() => addA0PendingDeposit(pending(N0, 0n)))).toBe('E_A0_STORE_CORRUPT');
    expect(mmkvSecure()!.getString(KEY)).toBe(value);
  });
});

describe('nextDepositIndex is monotone (I-4)', () => {
  it('a setter that refuses to lower it; equal is a no-op, higher is taken', () => {
    setA0NextDepositIndex(5n);
    expect(loadA0NoteStore().nextDepositIndex).toBe(5n);
    setA0NextDepositIndex(5n);
    expect(code(() => setA0NextDepositIndex(4n))).toBe('E_A0_COUNTER_LOWER');
    expect(code(() => setA0NextDepositIndex(0n))).toBe('E_A0_COUNTER_LOWER');
    expect(loadA0NoteStore().nextDepositIndex).toBe(5n);
    setA0NextDepositIndex(7n);
    expect(loadA0NoteStore().nextDepositIndex).toBe(7n);
    expect(code(() => setA0NextDepositIndex(2n ** 64n))).toBe('E_A0_NOTE_INVALID');
  });

  it('the pending note and the counter are ONE storage write (§5 step 5)', () => {
    loadA0NoteStore();
    const store = mmkvSecure()!;
    const set = jest.spyOn(store, 'set');
    addA0PendingDeposit(pending(N0, 0n));
    expect(set).toHaveBeenCalledTimes(1);
    expect(set.mock.calls[0]![0]).toBe(KEY);
    const written = JSON.parse(String(set.mock.calls[0]![1])) as {nextDepositIndex: string; notes: unknown[]};
    expect(written.nextDepositIndex).toBe('1');
    expect(written.notes).toHaveLength(1);
    set.mockRestore();
  });

  it('a pending deposit must use exactly the current counter: lower is a reuse, higher a gap', () => {
    addA0PendingDeposit(pending(N0, 0n));
    expect(code(() => addA0PendingDeposit(pending(N1, 0n)))).toBe('E_A0_COUNTER_MISMATCH');
    expect(code(() => addA0PendingDeposit(pending(N1, 2n)))).toBe('E_A0_COUNTER_MISMATCH');
    addA0PendingDeposit(pending(N1, 1n));
    expect(loadA0NoteStore().nextDepositIndex).toBe(2n);
  });

  it('a dropped pending deposit does not hand its counter back (§5 step 7)', () => {
    addA0PendingDeposit(pending(N0, 0n));
    dropA0PendingDeposit(N0.rho);
    expect(loadA0NoteStore()).toEqual({nextDepositIndex: 1n, notes: []});
    expect(code(() => addA0PendingDeposit(pending(N0, 0n)))).toBe('E_A0_COUNTER_MISMATCH');
  });

  it('a repeated rho or commitment is refused, whatever the counter', () => {
    addA0PendingDeposit(pending(N0, 0n));
    expect(code(() => addA0PendingDeposit({...pending(N1, 1n), rho: N0.rho}))).toBe('E_A0_NOTE_DUPLICATE');
    expect(code(() => addA0PendingDeposit({...pending(N1, 1n), commitment: cm(N0, '1000000000')}))).toBe('E_A0_NOTE_DUPLICATE');
    expect(loadA0NoteStore().nextDepositIndex).toBe(1n);
  });

  it.each([
    ['a rho ≥ r', {rho: 'ff'.repeat(32)}],
    ['an upper-case rho', {rho: N1.rho.toUpperCase()}],
    ['a short commitment', {commitment: 'ab'}],
    ['amount ≥ 2^64', {amount: 2n ** 64n}],
    ['a negative amount', {amount: -1n}],
    ['a fractional block height', {lastValidBlockHeight: 1.5}],
  ])('a pending deposit with %s is refused (E_A0_NOTE_INVALID)', (_l, patch) => {
    expect(code(() => addA0PendingDeposit({...pending(N1, 0n), ...patch}))).toBe('E_A0_NOTE_INVALID');
    expect(loadA0NoteStore()).toEqual({nextDepositIndex: 0n, notes: []});
  });
});

describe('confirm and drop (Task 4\'s calls)', () => {
  it('confirm: pending → unspent with the LeafInserted leaf index; its lastValidBlockHeight goes', () => {
    addA0PendingDeposit(pending(N0, 0n));
    confirmA0Deposit(N0.rho, {leafIndex: 17, commitment: cm(N0, '1000000000')});
    expect(loadA0NoteStore().notes).toEqual([unspent(N0, 0n, 17)]);
    expect(a0UnspentBalance()).toBe(1_000_000_000n);
  });

  it('confirm refuses a LeafInserted commitment that is not the note\'s, an unknown rho, a non-pending note', () => {
    addA0PendingDeposit(pending(N0, 0n));
    expect(code(() => confirmA0Deposit(N0.rho, {leafIndex: 17, commitment: cm(N0, '1')}))).toBe('E_A0_NOTE_STATE');
    expect(code(() => confirmA0Deposit(N1.rho, {leafIndex: 17, commitment: cm(N1, '1000000000')}))).toBe('E_A0_NOTE_UNKNOWN');
    confirmA0Deposit(N0.rho, {leafIndex: 17, commitment: cm(N0, '1000000000')});
    expect(code(() => confirmA0Deposit(N0.rho, {leafIndex: 18, commitment: cm(N0, '1000000000')}))).toBe('E_A0_NOTE_STATE');
    expect(code(() => dropA0PendingDeposit(N0.rho))).toBe('E_A0_NOTE_STATE');
    expect(code(() => dropA0PendingDeposit(N1.rho))).toBe('E_A0_NOTE_UNKNOWN');
  });
});

describe('merging a recovery (§7: the store is a cache of the chain)', () => {
  it('adds the recovered notes and takes the higher of the two counters', () => {
    setA0NextDepositIndex(9n);
    mergeA0RecoveredNotes([unspent(N0, 0n, 17), {...unspent(N1, 1n, 18), status: 'spent'}], 2n);
    const s = loadA0NoteStore();
    expect(s.nextDepositIndex).toBe(9n);
    expect(s.notes).toEqual([unspent(N0, 0n, 17), {...unspent(N1, 1n, 18), status: 'spent'}]);
    expect(a0UnspentBalance()).toBe(1_000_000_000n);
    mergeA0RecoveredNotes([], 12n);
    expect(loadA0NoteStore().nextDepositIndex).toBe(12n);
  });

  it('a recovered unspent note confirms a pending deposit of the same rho; a spent note never becomes unspent again', () => {
    addA0PendingDeposit(pending(N0, 0n));
    addA0PendingDeposit(pending(N1, 1n));
    mergeA0RecoveredNotes([{...unspent(N1, 1n, 18), status: 'spent'}], 2n);
    mergeA0RecoveredNotes([unspent(N0, 0n, 17), unspent(N1, 1n, 18)], 2n);
    expect(loadA0NoteStore().notes).toEqual([unspent(N0, 0n, 17), {...unspent(N1, 1n, 18), status: 'spent'}]);
  });

  it('a note with an unshield in flight (pendingSince) stays pending — M1c reconciles it', () => {
    const inFlight: A0Note = {...unspent(N2, 2n, 19), status: 'pending', pendingSince: 1_794_154_066};
    mergeA0RecoveredNotes([inFlight], 3n);
    mergeA0RecoveredNotes([unspent(N2, 2n, 19)], 3n);
    expect(loadA0NoteStore().notes).toEqual([inFlight]);
    mergeA0RecoveredNotes([{...unspent(N2, 2n, 19), status: 'spent', spentTx: SIG}], 3n);
    expect(loadA0NoteStore().notes).toEqual([{...unspent(N2, 2n, 19), status: 'spent', spentTx: SIG}]);
  });

  it('a corrupt record is replaced by the recovery (the chain is the source), and says so', () => {
    mmkvSecure()!.set(KEY, '{');
    expect(mergeA0RecoveredNotes([unspent(N0, 0n, 17)], 1n)).toEqual({replacedCorrupt: true});
    expect(loadA0NoteStore()).toEqual({nextDepositIndex: 1n, notes: [unspent(N0, 0n, 17)]});
    expect(mergeA0RecoveredNotes([], 1n)).toEqual({replacedCorrupt: false});
  });

  it('refuses a recovery whose notes are invalid, and writes nothing', () => {
    addA0PendingDeposit(pending(N0, 0n));
    const before = mmkvSecure()!.getString(KEY);
    expect(code(() => mergeA0RecoveredNotes([{...unspent(N1, 1n, 18), leafIndex: undefined}], 2n))).toBe('E_A0_NOTE_INVALID');
    expect(code(() => mergeA0RecoveredNotes([unspent(N1, 1n, 18), unspent(N1, 1n, 18)], 2n))).toBe('E_A0_NOTE_DUPLICATE');
    expect(mmkvSecure()!.getString(KEY)).toBe(before);
  });
});

describe('the v1 note schema is cleared on the first A0 run (§8, §12), once', () => {
  const V1_A = 'v1_notes_ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
  const V1_B = 'v1_notes_So11111111111111111111111111111111111111112';

  it('the first A0 load removes every v1_notes_<mint> key and nothing else', () => {
    const s = mmkvSecure()!;
    s.set(V1_A, '[{"noteSecret":"00"}]');
    s.set(V1_B, '[]');
    s.set('v1_a0_synced_tx', '{"schema":1}');
    s.set('v1_contacts_x', '1');
    loadA0NoteStore();
    expect(s.getAllKeys().sort()).toEqual([KEY, 'v1_a0_synced_tx', 'v1_contacts_x'].sort());
  });

  it('idempotent and once: a later load does not touch the store, nor a v1 key written after it', () => {
    addA0PendingDeposit(pending(N0, 0n));
    const before = mmkvSecure()!.getString(KEY);
    mmkvSecure()!.set(V1_A, '[]');
    loadA0NoteStore();
    loadA0NoteStore();
    expect(mmkvSecure()!.getString(KEY)).toBe(before);
    expect(mmkvSecure()!.getString(V1_A)).toBe('[]');
  });

  it('negative control: with an A0 record already present, the v1 keys are not cleared', () => {
    mmkvSecure()!.set(KEY, JSON.stringify({schema: 1, programId: A0.programId, pool: A0.pool, nextDepositIndex: '0', notes: []}));
    mmkvSecure()!.set(V1_A, '[]');
    loadA0NoteStore();
    expect(mmkvSecure()!.getString(V1_A)).toBe('[]');
  });
});
