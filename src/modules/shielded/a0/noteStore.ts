/**
 * The A0 note store (spec §8): the wallet's own notes in the A0 pool, as PUBLIC or
 * spend-irrelevant fields only, and the monotone deposit counter.
 *
 * FIELDS — exactly §8's: `{commitment, amount, rho, depositIndex?, lastValidBlockHeight?,
 * leafIndex?, status: pending | unspent | spent, spentTx?, pendingSince?}`. No `noteSecret`, no
 * diversifier (every own note is under `d_self`, which stays in Rust, R9) and no nullifier of an
 * unspent note (R12) — there is no field to put one in, and a record carrying any other field
 * does not decode.
 *
 * METADATA (I-4) — `nextDepositIndex`, one counter per `nk`: it only ever increases. A pending
 * deposit takes exactly the current value and moves it on in the SAME storage write as the note
 * (§5 step 5); a dropped pending deposit does not hand it back (§5 step 7); a restore sets it to
 * the highest recovered index + 1 unless it is already higher.
 *
 * STORAGE — the encrypted instance (`mmkvSecure()`) only, one key (`v1_a0_notes`, schema 1),
 * bound to the A0 program and pool, beside the tree sync's cache. Every operation is one
 * synchronous read-modify-write of that one value, so a write is atomic (one `set`) and no other
 * JS can interleave with it. FAIL CLOSED: without the encrypted instance every call throws
 * `E_A0_STORE_LOCKED`, and a record that does not decode exactly throws `E_A0_STORE_CORRUPT` —
 * neither ever reads as "an empty store with counter 0", which would hand a used counter out
 * again. A corrupt record is replaced only by a recovery from the chain
 * (`mergeA0RecoveredNotes`), the source the store is a cache of (§7).
 *
 * THE v1 NOTES (§8 "Old notes", §12) — not migrated. The first A0 run (the first call that finds
 * no A0 record) removes every v1 note key (`v1_notes_<mint>`, the v1 `noteStore.ts` schema) from
 * the encrypted instance and then writes the empty A0 record, so it happens once: a later call
 * finds the record and touches nothing. Shielded runs only in the devnet build (R8), so only
 * the devnet build ever gets here.
 */
import {mmkvSecure} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';
import {A0} from './constants';
import {FIELD_MODULUS} from './fieldEquations';

export const A0_NOTE_STORE_SCHEMA = 1;

export type A0NoteStatus = 'pending' | 'unspent' | 'spent';

/** One own note (spec §8). 32-byte values are 64-char lowercase BE hex; amounts / counters BigInt. */
export interface A0Note {
  commitment: string;
  amount: bigint;
  rho: string;
  /** the deposit counter that made this note's rho (a deposit note) */
  depositIndex?: bigint;
  /** a PENDING DEPOSIT's expiry: dropped once the chain is past it with no rho PDA (§5 step 7) */
  lastValidBlockHeight?: number;
  leafIndex?: number;
  status: A0NoteStatus;
  /** the spending transaction, once known */
  spentTx?: string;
  /** a PENDING UNSHIELD's start, chain time (unix seconds) — M1c's */
  pendingSince?: number;
}

export interface A0NoteStoreState {
  nextDepositIndex: bigint;
  notes: A0Note[];
}

export type A0NoteStoreErrorCode =
  /** no encrypted instance (before onboarding / after a wipe) */
  | 'E_A0_STORE_LOCKED'
  /** the stored record does not decode exactly */
  | 'E_A0_STORE_CORRUPT'
  /** an attempt to lower nextDepositIndex */
  | 'E_A0_COUNTER_LOWER'
  /** a pending deposit whose counter is not nextDepositIndex */
  | 'E_A0_COUNTER_MISMATCH'
  /** a note or counter value out of its range or shape */
  | 'E_A0_NOTE_INVALID'
  /** a second note with the same rho or commitment */
  | 'E_A0_NOTE_DUPLICATE'
  /** no note with this rho */
  | 'E_A0_NOTE_UNKNOWN'
  /** the note is not in the state the call requires */
  | 'E_A0_NOTE_STATE';

export class A0NoteStoreError extends Error {
  readonly code: A0NoteStoreErrorCode;
  constructor(code: A0NoteStoreErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'A0NoteStoreError';
    this.code = code;
  }
}

const KEY = MMKV_KEYS.A0_NOTES;
const V1_NOTES_PREFIX = MMKV_KEYS.SHIELDED_NOTES_PREFIX;
const U64_MAX = 2n ** 64n - 1n;
const HEX64 = /^[0-9a-f]{64}$/;
const B58_SIG = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
const DEC = /^(0|[1-9][0-9]*)$/;
/** 2^20 leaves (depth 20) */
const LEAF_LIMIT = 1_048_576;
const FIELDS = new Set([
  'commitment',
  'amount',
  'rho',
  'depositIndex',
  'lastValidBlockHeight',
  'leafIndex',
  'status',
  'spentTx',
  'pendingSince',
]);

const invalid = (what: string): never => {
  throw new A0NoteStoreError('E_A0_NOTE_INVALID', what);
};
const isNat = (v: unknown, limit = Number.MAX_SAFE_INTEGER): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v < limit;
const field = (v: unknown, what: string): string =>
  typeof v === 'string' && HEX64.test(v) && BigInt(`0x${v}`) < FIELD_MODULUS ? v : invalid(`${what} is not a canonical 64-hex field element`);
const u64 = (v: unknown, what: string): bigint =>
  typeof v === 'bigint' && v >= 0n && v <= U64_MAX ? v : invalid(`${what} is not a u64`);

/** A copy of `n` with every field checked and the state rules of §5 / §8 held. */
function checkNote(n: A0Note): A0Note {
  for (const k of Object.keys(n)) {
    if (!FIELDS.has(k)) {
      invalid(`a note field "${k}" that §8 does not list`);
    }
  }
  const out: A0Note = {
    commitment: field(n.commitment, 'commitment'),
    amount: u64(n.amount, 'amount'),
    rho: field(n.rho, 'rho'),
    status: n.status,
  };
  if (n.status !== 'pending' && n.status !== 'unspent' && n.status !== 'spent') {
    invalid(`status ${String(n.status)}`);
  }
  if (n.depositIndex !== undefined) {
    out.depositIndex = u64(n.depositIndex, 'depositIndex');
  }
  if (n.leafIndex !== undefined) {
    out.leafIndex = isNat(n.leafIndex, LEAF_LIMIT) ? n.leafIndex : invalid('leafIndex');
  }
  if (n.lastValidBlockHeight !== undefined) {
    out.lastValidBlockHeight = isNat(n.lastValidBlockHeight) ? n.lastValidBlockHeight : invalid('lastValidBlockHeight');
  }
  if (n.pendingSince !== undefined) {
    out.pendingSince = isNat(n.pendingSince) ? n.pendingSince : invalid('pendingSince');
  }
  if (n.spentTx !== undefined) {
    out.spentTx = typeof n.spentTx === 'string' && B58_SIG.test(n.spentTx) ? n.spentTx : invalid('spentTx');
  }
  // state rules: a pending note is a pending deposit (lastValidBlockHeight, a counter, no leaf yet)
  // or a pending unshield (pendingSince, a leaf); unspent / spent notes have their leaf and no
  // pending-only field; only a spent note names its spending tx.
  if (out.status === 'pending') {
    const deposit = out.lastValidBlockHeight !== undefined;
    const unshield = out.pendingSince !== undefined;
    if (deposit === unshield) {
      invalid('a pending note is either a pending deposit (lastValidBlockHeight) or a pending unshield (pendingSince)');
    }
    if (deposit && (out.depositIndex === undefined || out.leafIndex !== undefined)) {
      invalid('a pending deposit has its counter and no leaf yet');
    }
    if (unshield && out.leafIndex === undefined) {
      invalid('a pending unshield spends a note with a leaf');
    }
  } else if (out.leafIndex === undefined || out.lastValidBlockHeight !== undefined || out.pendingSince !== undefined) {
    invalid(`an ${out.status} note has its leaf index and no pending-only field`);
  }
  if (out.spentTx !== undefined && out.status !== 'spent') {
    invalid('only a spent note names its spending transaction');
  }
  return out;
}

function checkUnique(notes: readonly A0Note[]): void {
  const rhos = new Set<string>();
  const cms = new Set<string>();
  for (const n of notes) {
    if (rhos.has(n.rho) || cms.has(n.commitment)) {
      throw new A0NoteStoreError('E_A0_NOTE_DUPLICATE', `a second note with rho ${n.rho} or commitment ${n.commitment}`);
    }
    rhos.add(n.rho);
    cms.add(n.commitment);
  }
}

// ------------------------------------------------------------------ the record

type Json = null | boolean | number | string | Json[] | {[k: string]: Json};

class Corrupt extends Error {}

const big = (v: Json | undefined): bigint => {
  if (typeof v !== 'string' || !DEC.test(v)) {
    throw new Corrupt('u64');
  }
  return BigInt(v);
};

function decodeNote(v: Json): A0Note {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    throw new Corrupt('note');
  }
  const n: Record<string, unknown> = {...v};
  for (const k of ['amount', 'depositIndex'] as const) {
    if (n[k] !== undefined) {
      n[k] = big(v[k]);
    }
  }
  try {
    return checkNote(n as unknown as A0Note);
  } catch (e) {
    throw new Corrupt(e instanceof Error ? e.message : 'note');
  }
}

function encode(state: A0NoteStoreState): string {
  const notes = state.notes.map(n => {
    const o: Record<string, string | number> = {
      commitment: n.commitment,
      amount: n.amount.toString(),
      rho: n.rho,
    };
    if (n.depositIndex !== undefined) {
      o.depositIndex = n.depositIndex.toString();
    }
    if (n.lastValidBlockHeight !== undefined) {
      o.lastValidBlockHeight = n.lastValidBlockHeight;
    }
    if (n.leafIndex !== undefined) {
      o.leafIndex = n.leafIndex;
    }
    o.status = n.status;
    if (n.spentTx !== undefined) {
      o.spentTx = n.spentTx;
    }
    if (n.pendingSince !== undefined) {
      o.pendingSince = n.pendingSince;
    }
    return o;
  });
  return JSON.stringify({
    schema: A0_NOTE_STORE_SCHEMA,
    programId: A0.programId,
    pool: A0.pool,
    nextDepositIndex: state.nextDepositIndex.toString(),
    notes,
  });
}

function decode(raw: string): A0NoteStoreState {
  const o = JSON.parse(raw) as Json;
  if (o === null || typeof o !== 'object' || Array.isArray(o)) {
    throw new Corrupt('record');
  }
  const keys = Object.keys(o).sort().join(',');
  if (
    keys !== 'nextDepositIndex,notes,pool,programId,schema' ||
    o.schema !== A0_NOTE_STORE_SCHEMA ||
    o.programId !== A0.programId ||
    o.pool !== A0.pool ||
    !Array.isArray(o.notes)
  ) {
    throw new Corrupt('record header');
  }
  const next = big(o.nextDepositIndex);
  if (next > U64_MAX) {
    throw new Corrupt('nextDepositIndex');
  }
  const notes = o.notes.map(decodeNote);
  try {
    checkUnique(notes);
  } catch {
    throw new Corrupt('duplicate note');
  }
  return {nextDepositIndex: next, notes};
}

function storage() {
  const store = mmkvSecure();
  if (!store) {
    throw new A0NoteStoreError('E_A0_STORE_LOCKED', 'the encrypted store is not open');
  }
  return store;
}

/** The first A0 run: clear the v1 note schema, then write the empty A0 record (so: once). */
function firstRun(store: NonNullable<ReturnType<typeof mmkvSecure>>): A0NoteStoreState {
  for (const k of store.getAllKeys()) {
    if (k.startsWith(V1_NOTES_PREFIX)) {
      store.remove(k);
    }
  }
  const empty: A0NoteStoreState = {nextDepositIndex: 0n, notes: []};
  store.set(KEY, encode(empty));
  return empty;
}

function read(): A0NoteStoreState {
  const store = storage();
  const raw = store.getString(KEY);
  if (raw === undefined) {
    return firstRun(store);
  }
  try {
    return decode(raw);
  } catch {
    throw new A0NoteStoreError('E_A0_STORE_CORRUPT', `the ${KEY} record does not decode`);
  }
}

function write(state: A0NoteStoreState): void {
  storage().set(KEY, encode(state));
}

const bigMax = (a: bigint, b: bigint): bigint => (a > b ? a : b);

// ------------------------------------------------------------------ the API

/**
 * Whether an A0 record exists (decodable or not), WITHOUT the first-run write `loadA0NoteStore`
 * makes. The startup step (`a0/startup.ts`) asks this before anything else touches the store: no
 * record = a fresh install or a wiped app → restore from the seed first (Task 4, M1b checkpoint).
 * Throws `E_A0_STORE_LOCKED` without the encrypted instance.
 */
export function hasA0NoteRecord(): boolean {
  return storage().getString(KEY) !== undefined;
}

/** The store (and, on the first A0 run, the v1 notes cleared). Throws LOCKED / CORRUPT. */
export function loadA0NoteStore(): A0NoteStoreState {
  return read();
}

/** The sum of the unspent notes' amounts. */
export function a0UnspentBalance(): bigint {
  return read().notes.reduce((s, n) => (n.status === 'unspent' ? s + n.amount : s), 0n);
}

/** Raise `nextDepositIndex` to `next`; refuses to lower it (equal is a no-op). §5 step 2. */
export function setA0NextDepositIndex(next: bigint): void {
  if (typeof next !== 'bigint' || next < 0n || next > U64_MAX) {
    invalid('nextDepositIndex is not a counter');
  }
  const s = read();
  if (next < s.nextDepositIndex) {
    throw new A0NoteStoreError('E_A0_COUNTER_LOWER', `nextDepositIndex ${s.nextDepositIndex} cannot go down to ${next}`);
  }
  if (next !== s.nextDepositIndex) {
    write({...s, nextDepositIndex: next});
  }
}

/**
 * §5 step 5: BEFORE submitting, the note as `pending` and `nextDepositIndex = depositIndex + 1`,
 * in ONE write. `depositIndex` must be exactly the current counter (lower would reuse a rho,
 * higher would leave a gap the recovery's gap limit counts).
 */
export function addA0PendingDeposit(d: {
  commitment: string;
  amount: bigint;
  rho: string;
  depositIndex: bigint;
  lastValidBlockHeight: number;
}): void {
  const note = checkNote({
    commitment: d.commitment,
    amount: d.amount,
    rho: d.rho,
    depositIndex: d.depositIndex,
    lastValidBlockHeight: d.lastValidBlockHeight,
    status: 'pending',
  });
  if (note.depositIndex === U64_MAX) {
    invalid('the deposit counter is exhausted');
  }
  const s = read();
  if (note.depositIndex !== s.nextDepositIndex) {
    throw new A0NoteStoreError(
      'E_A0_COUNTER_MISMATCH',
      `a pending deposit at counter ${note.depositIndex}, the store's next is ${s.nextDepositIndex}`,
    );
  }
  const notes = [...s.notes, note];
  checkUnique(notes);
  write({nextDepositIndex: s.nextDepositIndex + 1n, notes});
}

function indexOfRho(s: A0NoteStoreState, rho: string): number {
  const i = s.notes.findIndex(n => n.rho === rho);
  if (i < 0) {
    throw new A0NoteStoreError('E_A0_NOTE_UNKNOWN', `no note with rho ${rho}`);
  }
  return i;
}

const isPendingDeposit = (n: A0Note): boolean => n.status === 'pending' && n.lastValidBlockHeight !== undefined;

/** §5 step 6: a pending deposit becomes `unspent` at the leaf of its LeafInserted, whose commitment must be the note's. */
export function confirmA0Deposit(rho: string, leaf: {leafIndex: number; commitment: string}): void {
  const s = read();
  const i = indexOfRho(s, rho);
  const n = s.notes[i]!;
  if (!isPendingDeposit(n)) {
    throw new A0NoteStoreError('E_A0_NOTE_STATE', `the note with rho ${rho} is not a pending deposit`);
  }
  if (leaf.commitment !== n.commitment) {
    throw new A0NoteStoreError('E_A0_NOTE_STATE', `the LeafInserted commitment ${leaf.commitment} is not the note's ${n.commitment}`);
  }
  const confirmed: A0Note = {...n, leafIndex: leaf.leafIndex, status: 'unspent'};
  delete confirmed.lastValidBlockHeight; // only a pending deposit carries its expiry
  checkNote(confirmed);
  const notes = [...s.notes];
  notes[i] = confirmed;
  write({...s, notes});
}

/** §5 step 7: drop a pending deposit that can no longer land. The counter is NOT given back. */
export function dropA0PendingDeposit(rho: string): void {
  const s = read();
  const i = indexOfRho(s, rho);
  if (!isPendingDeposit(s.notes[i]!)) {
    throw new A0NoteStoreError('E_A0_NOTE_STATE', `the note with rho ${rho} is not a pending deposit`);
  }
  write({...s, notes: s.notes.filter((_n, j) => j !== i)});
}

/** The stored note vs the chain's view of the same rho (the rules of `mergeA0RecoveredNotes`). */
function merged(stored: A0Note, chain: A0Note): A0Note {
  if (stored.status === 'spent') {
    return stored; // spent is final: a note never becomes spendable again
  }
  if (chain.status === 'spent') {
    return chain;
  }
  if (stored.status === 'pending' && stored.pendingSince !== undefined) {
    return stored; // an unshield in flight: M1c's reconciliation decides, not a restore
  }
  return chain; // a pending deposit the chain has confirmed, or an unspent note re-read
}

/**
 * Write a recovery's result (§7: the store is a cache of the chain). Each recovered note is added,
 * or merged with the stored note of the same rho: spent stays spent; the chain's `spent` wins over
 * anything else; a pending unshield (`pendingSince`) is left for M1c; otherwise the chain's note
 * (`unspent`, with its leaf) replaces the stored one — that confirms a pending deposit that
 * landed. Stored notes the chain does not show are kept (a pending deposit is reconciled by §5
 * step 7, not here). `nextDepositIndex` becomes the higher of the two. A CORRUPT record is
 * replaced by the recovery alone (`replacedCorrupt: true`): its pending entries are lost, which
 * the deposit pre-check covers (a landed one is found by its rho PDA, §5 step 2). Atomic: one write.
 */
export function mergeA0RecoveredNotes(
  recovered: readonly A0Note[],
  nextDepositIndex: bigint,
): {replacedCorrupt: boolean} {
  const checked = recovered.map(checkNote);
  checkUnique(checked);
  if (typeof nextDepositIndex !== 'bigint' || nextDepositIndex < 0n || nextDepositIndex > U64_MAX) {
    invalid('nextDepositIndex is not a counter');
  }
  let base: A0NoteStoreState;
  let replacedCorrupt = false;
  try {
    base = read();
  } catch (e) {
    if (!(e instanceof A0NoteStoreError && e.code === 'E_A0_STORE_CORRUPT')) {
      throw e;
    }
    base = {nextDepositIndex: 0n, notes: []};
    replacedCorrupt = true;
  }
  const notes = [...base.notes];
  for (const r of checked) {
    const i = notes.findIndex(n => n.rho === r.rho);
    if (i < 0) {
      notes.push(r);
    } else {
      notes[i] = merged(notes[i]!, r);
    }
  }
  checkUnique(notes);
  write({nextDepositIndex: bigMax(base.nextDepositIndex, nextDepositIndex), notes});
  return {replacedCorrupt};
}
