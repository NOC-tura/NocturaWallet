/**
 * The A0 note store (spec §8): the wallet's own notes in the A0 pool, as PUBLIC or
 * spend-irrelevant fields only, and the monotone deposit counter.
 *
 * FIELDS — §8's: `{commitment, amount, rho, depositIndex?, lastValidBlockHeight?,
 * leafIndex?, status: pending | unspent | spent, spentTx?, pendingSince?}`, plus (M1c Task 7) a
 * pending unshield's `unshield` intent — the terms the human approved: `{owner, amount, fee,
 * feePayer, gasGrantLamports, destination, scheme?}`, all values the relayer is sent and the chain
 * shows once the tx lands — so the post-landing verifier can run on a pending unshield found by a
 * reconciliation after the app died (§6 step 8). No spend secret, no diversifier (every own note
 * is under `d_self`, which stays in Rust, R9) and no nullifier of an unspent note (R12) — there is
 * no field to put one in (the intent has none either), and a record carrying any other field does
 * not decode.
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
 * BINDING (R2-N1, R3-N5) — an in-app "Wipe wallet" followed by an import replaces the encrypted
 * instance inside ONE process, while an async flow of the old wallet (a restore, a reconcile, a
 * deposit) may still be in flight. Every call takes an optional `bound`: the instance its caller
 * captured at its own entry (`mmkvSecure()` then). When given, the call refuses with
 * `E_A0_STORE_CHANGED` BEFORE reading or writing anything if the open instance is not that one —
 * so a stale flow can neither write the old wallet's notes into the new wallet's store nor create
 * the new store's record (whose absence is what makes the new wallet restore). Flows pass it to
 * every call made after an `await`. `saveA0SyncCache` (syncCache.ts) is deliberately unbound
 * (N7): public data that verifies itself on read.
 *
 * THE v1 NOTES (§8 "Old notes", §12) — not migrated. The first A0 run (the first call that finds
 * no A0 record) removes every v1 note key (`v1_notes_<mint>`, the v1 `noteStore.ts` schema) from
 * the encrypted instance and then writes the empty A0 record, so it happens once: a later call
 * finds the record and touches nothing. Shielded runs only in the devnet build (R8), so only
 * the devnet build ever gets here.
 */
import type {MMKV} from 'react-native-mmkv';
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
  /** a PENDING UNSHIELD's approved terms (M1c Task 7); absent on a pending unshield written without them */
  unshield?: A0PendingUnshield;
}

/**
 * What a pending unshield was approved for (M1c Task 7, spec §6 steps 4–8): the native
 * authorization's owner, amount and fee, the quote's fee payer and grant, and the destination
 * the user chose (with the reserved registry scheme for a fresh account). Public once the tx
 * lands; never a nullifier, a proof or a payload (R12: the in-flight nullifier lives in memory only).
 */
export interface A0PendingUnshield {
  /** the destination wallet address (base58) — the ATA is derived from it */
  owner: string;
  /** base units the destination receives, 1..2^64-1 */
  amount: bigint;
  /** the relayer fee (the quote's minFee.withdraw_change, R5) */
  fee: bigint;
  /** the quote's fee payer (= the pinned relayer) */
  feePayer: string;
  /** the quote's grant, or null when it carried none */
  gasGrantLamports: bigint | null;
  destination: 'fresh' | 'main' | 'external';
  /** `fresh` only: the reserved `slip10:n` */
  scheme?: string;
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
  /** the caller's flow started on another encrypted instance (a wipe + import since, R2-N1) */
  | 'E_A0_STORE_CHANGED'
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
const B58_KEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const FRESH_SCHEME = /^slip10:(0|[1-9][0-9]{0,9})$/;
const INTENT_FIELDS = 'amount,destination,feePayer,fee,gasGrantLamports,owner,scheme';
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
  'unshield',
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

/** A copy of a pending unshield's intent, every field checked (`E_A0_NOTE_INVALID`). */
function checkIntent(u: A0PendingUnshield): A0PendingUnshield {
  if (u === null || typeof u !== 'object') {
    invalid('the unshield intent is not an object');
  }
  for (const k of Object.keys(u)) {
    if (!INTENT_FIELDS.split(',').includes(k)) {
      invalid(`an unshield intent field "${k}"`);
    }
  }
  const key = (v: unknown, what: string): string => (typeof v === 'string' && B58_KEY.test(v) ? v : invalid(`${what} is not a base58 key`));
  const out: A0PendingUnshield = {
    owner: key(u.owner, 'the unshield owner'),
    amount: u64(u.amount, 'the unshield amount'),
    fee: u64(u.fee, 'the unshield fee'),
    feePayer: key(u.feePayer, 'the unshield fee payer'),
    gasGrantLamports: u.gasGrantLamports === null ? null : u64(u.gasGrantLamports, 'the unshield grant'),
    destination: u.destination,
  };
  if (out.amount === 0n || out.amount + out.fee > U64_MAX) {
    invalid('the unshield amount is not 1..2^64-1 with its fee');
  }
  if (out.destination !== 'fresh' && out.destination !== 'main' && out.destination !== 'external') {
    invalid(`unshield destination ${String(out.destination)}`);
  }
  if ((out.destination === 'fresh') !== (u.scheme !== undefined)) {
    invalid('a fresh destination names its reserved scheme, and only a fresh one');
  }
  if (u.scheme !== undefined) {
    out.scheme = typeof u.scheme === 'string' && FRESH_SCHEME.test(u.scheme) ? u.scheme : invalid('the unshield scheme');
  }
  return out;
}

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
  if (n.unshield !== undefined) {
    out.unshield = checkIntent(n.unshield);
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
    if (out.unshield !== undefined && !unshield) {
      invalid('only a pending unshield carries an unshield intent');
    }
    if (out.unshield !== undefined && out.unshield.amount + out.unshield.fee > out.amount) {
      invalid('the unshield spends more than the note holds');
    }
  } else if (
    out.leafIndex === undefined ||
    out.lastValidBlockHeight !== undefined ||
    out.pendingSince !== undefined ||
    out.unshield !== undefined
  ) {
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
  const u = v.unshield;
  if (u !== undefined) {
    if (u === null || typeof u !== 'object' || Array.isArray(u)) {
      throw new Corrupt('unshield intent');
    }
    n.unshield = {
      ...u,
      amount: big(u.amount),
      fee: big(u.fee),
      gasGrantLamports: u.gasGrantLamports === null ? null : big(u.gasGrantLamports),
    };
  }
  try {
    return checkNote(n as unknown as A0Note);
  } catch (e) {
    throw new Corrupt(e instanceof Error ? e.message : 'note');
  }
}

function encode(state: A0NoteStoreState): string {
  const notes = state.notes.map(n => {
    const o: Record<string, string | number | Record<string, string | null>> = {
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
    if (n.unshield !== undefined) {
      const u = n.unshield;
      o.unshield = {
        owner: u.owner,
        amount: u.amount.toString(),
        fee: u.fee.toString(),
        feePayer: u.feePayer,
        gasGrantLamports: u.gasGrantLamports === null ? null : u.gasGrantLamports.toString(),
        destination: u.destination,
        ...(u.scheme !== undefined ? {scheme: u.scheme} : {}),
      };
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

/**
 * The instance a flow captured at its entry (`mmkvSecure()` then; null = none was open), passed
 * back to every store call it makes after an `await`. Omitted = the open instance, unchecked.
 */
export type A0StoreBinding = MMKV | null;

function storage(bound?: A0StoreBinding): MMKV {
  const store = mmkvSecure();
  if (!store) {
    throw new A0NoteStoreError('E_A0_STORE_LOCKED', 'the encrypted store is not open');
  }
  if (bound !== undefined && store !== bound) {
    throw new A0NoteStoreError(
      'E_A0_STORE_CHANGED',
      'the encrypted store was replaced (wipe + import) while this flow was in flight; nothing written',
    );
  }
  return store;
}

/** The first A0 run: clear the v1 note schema, then write the empty A0 record (so: once). */
function firstRun(store: MMKV): A0NoteStoreState {
  for (const k of store.getAllKeys()) {
    if (k.startsWith(V1_NOTES_PREFIX)) {
      store.remove(k);
    }
  }
  const empty: A0NoteStoreState = {nextDepositIndex: 0n, notes: []};
  store.set(KEY, encode(empty));
  return empty;
}

function decodeOrCorrupt(raw: string): A0NoteStoreState {
  try {
    return decode(raw);
  } catch {
    throw new A0NoteStoreError('E_A0_STORE_CORRUPT', `the ${KEY} record does not decode`);
  }
}

function read(bound?: A0StoreBinding): A0NoteStoreState {
  const store = storage(bound);
  const raw = store.getString(KEY);
  if (raw === undefined) {
    return firstRun(store);
  }
  return decodeOrCorrupt(raw);
}

/**
 * The record as it is, WITHOUT the first-run write: an absent record has no note, so `rho` is
 * unknown (R3-N5: confirm and drop never create the record — only the startup step and an
 * explicit first store read do).
 */
function readExisting(rho: string, bound?: A0StoreBinding): A0NoteStoreState {
  const raw = storage(bound).getString(KEY);
  if (raw === undefined) {
    throw new A0NoteStoreError('E_A0_NOTE_UNKNOWN', `no note with rho ${rho} (no A0 record)`);
  }
  return decodeOrCorrupt(raw);
}

function write(state: A0NoteStoreState, bound?: A0StoreBinding): void {
  storage(bound).set(KEY, encode(state));
}

const bigMax = (a: bigint, b: bigint): bigint => (a > b ? a : b);

// ------------------------------------------------------------------ the API

/**
 * Whether an A0 record exists (decodable or not), WITHOUT the first-run write `loadA0NoteStore`
 * makes. The startup step (`a0/startup.ts`) asks this before anything else touches the store: no
 * record = a fresh install or a wiped app → restore from the seed first (Task 4, M1b checkpoint).
 * Throws `E_A0_STORE_LOCKED` without the encrypted instance.
 */
export function hasA0NoteRecord(bound?: A0StoreBinding): boolean {
  return storage(bound).getString(KEY) !== undefined;
}

/**
 * What wiping the app would lose from this store (the wipe warning, WipeWalletScreen) — read
 * WITHOUT any write, never throws:
 *  - `'notes'` — an `unspent` or `pending` note is recorded (a pending deposit may be landing);
 *  - `'unreadable'` — the encrypted store is not open or the record does not decode: what it
 *    holds is unknown, so the caller must warn as if it held notes;
 *  - `'none'` — no record, or a record with only `spent` notes.
 * Notes are recoverable from the seed phrase (restore), which is what the warning must say.
 */
export function a0WipeRisk(): 'none' | 'notes' | 'unreadable' {
  const store = mmkvSecure();
  if (!store) {
    return 'unreadable';
  }
  const raw = store.getString(KEY);
  if (raw === undefined) {
    return 'none';
  }
  try {
    return decode(raw).notes.some(n => n.status !== 'spent') ? 'notes' : 'none';
  } catch {
    return 'unreadable';
  }
}

/** The store (and, on the first A0 run, the v1 notes cleared). Throws LOCKED / CORRUPT / CHANGED. */
export function loadA0NoteStore(bound?: A0StoreBinding): A0NoteStoreState {
  return read(bound);
}

/** The sum of the unspent notes' amounts. */
export function a0UnspentBalance(): bigint {
  return read().notes.reduce((s, n) => (n.status === 'unspent' ? s + n.amount : s), 0n);
}

/** Raise `nextDepositIndex` to `next`; refuses to lower it (equal is a no-op). §5 step 2. */
export function setA0NextDepositIndex(next: bigint, bound?: A0StoreBinding): void {
  if (typeof next !== 'bigint' || next < 0n || next > U64_MAX) {
    invalid('nextDepositIndex is not a counter');
  }
  const s = read(bound);
  if (next < s.nextDepositIndex) {
    throw new A0NoteStoreError('E_A0_COUNTER_LOWER', `nextDepositIndex ${s.nextDepositIndex} cannot go down to ${next}`);
  }
  if (next !== s.nextDepositIndex) {
    write({...s, nextDepositIndex: next}, bound);
  }
}

/**
 * §5 step 5: BEFORE submitting, the note as `pending` and `nextDepositIndex = depositIndex + 1`,
 * in ONE write. `depositIndex` must be exactly the current counter (lower would reuse a rho,
 * higher would leave a gap the recovery's gap limit counts).
 */
export function addA0PendingDeposit(
  d: {
    commitment: string;
    amount: bigint;
    rho: string;
    depositIndex: bigint;
    lastValidBlockHeight: number;
  },
  bound?: A0StoreBinding,
): void {
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
  const s = read(bound);
  if (note.depositIndex !== s.nextDepositIndex) {
    throw new A0NoteStoreError(
      'E_A0_COUNTER_MISMATCH',
      `a pending deposit at counter ${note.depositIndex}, the store's next is ${s.nextDepositIndex}`,
    );
  }
  const notes = [...s.notes, note];
  checkUnique(notes);
  write({nextDepositIndex: s.nextDepositIndex + 1n, notes}, bound);
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
export function confirmA0Deposit(
  rho: string,
  leaf: {leafIndex: number; commitment: string},
  bound?: A0StoreBinding,
): void {
  const s = readExisting(rho, bound);
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
  write({...s, notes}, bound);
}

/** §5 step 7: drop a pending deposit that can no longer land. The counter is NOT given back. */
export function dropA0PendingDeposit(rho: string, bound?: A0StoreBinding): void {
  const s = readExisting(rho, bound);
  const i = indexOfRho(s, rho);
  if (!isPendingDeposit(s.notes[i]!)) {
    throw new A0NoteStoreError('E_A0_NOTE_STATE', `the note with rho ${rho} is not a pending deposit`);
  }
  write({...s, notes: s.notes.filter((_n, j) => j !== i)}, bound);
}

const isPendingUnshield = (n: A0Note): boolean => n.status === 'pending' && n.pendingSince !== undefined;

/**
 * §6 step 7 (M1c Task 7): BEFORE the submit, the note being spent becomes a pending unshield —
 * `pendingSince` (the chain time read just before the submit) and the approved intent, in ONE
 * write. Only an `unspent` note can be: anything else refuses (`E_A0_NOTE_STATE`), so one note is
 * never in two unshields. Never creates the record.
 */
export function markA0PendingUnshield(
  rho: string,
  pendingSince: number,
  unshield: A0PendingUnshield,
  bound?: A0StoreBinding,
): void {
  const s = readExisting(rho, bound);
  const i = indexOfRho(s, rho);
  const n = s.notes[i]!;
  if (n.status !== 'unspent') {
    throw new A0NoteStoreError('E_A0_NOTE_STATE', `the note with rho ${rho} is ${n.status}, not unspent`);
  }
  const next = checkNote({...n, status: 'pending', pendingSince, unshield});
  const notes = [...s.notes];
  notes[i] = next;
  write({...s, notes}, bound);
}

/**
 * §6 step 8 (M1c Task 7): a pending unshield that is known NOT to have landed (nothing was
 * forwarded, or the chain-time window passed with a completed sync and no Withdraw of it) goes
 * back to `unspent` at its leaf. Anything but a pending unshield refuses (`E_A0_NOTE_STATE`).
 */
export function revertA0PendingUnshield(rho: string, bound?: A0StoreBinding): void {
  const s = readExisting(rho, bound);
  const i = indexOfRho(s, rho);
  const n = s.notes[i]!;
  if (!isPendingUnshield(n)) {
    throw new A0NoteStoreError('E_A0_NOTE_STATE', `the note with rho ${rho} is not a pending unshield`);
  }
  const back: A0Note = {...n, status: 'unspent'};
  delete back.pendingSince;
  delete back.unshield;
  const notes = [...s.notes];
  notes[i] = checkNote(back);
  write({...s, notes}, bound);
}

/**
 * R2-N2 / m-1 (M1c Task 7): a HELD submit re-reads the chain clock after the hold, and the later
 * value becomes `pendingSince` — the landing window counts from the last chain time read before
 * the request leaves. Only ever LATER (`'moved'`, one write); an equal or earlier time writes
 * nothing (`'kept'`). Anything but a pending unshield refuses (`E_A0_NOTE_STATE`); a time that is
 * not a whole non-negative number refuses (`E_A0_NOTE_INVALID`).
 */
export function refreshA0PendingSince(rho: string, pendingSince: number, bound?: A0StoreBinding): 'moved' | 'kept' {
  const s = readExisting(rho, bound);
  const i = indexOfRho(s, rho);
  const n = s.notes[i]!;
  if (!isPendingUnshield(n)) {
    throw new A0NoteStoreError('E_A0_NOTE_STATE', `the note with rho ${rho} is not a pending unshield`);
  }
  const next = checkNote({...n, pendingSince});
  if (next.pendingSince! <= n.pendingSince!) {
    return 'kept';
  }
  const notes = [...s.notes];
  notes[i] = next;
  write({...s, notes}, bound);
  return 'moved';
}

/** A change note as an unshield's settle stores it (§6 step 8; Task 5's recovery stores the same). */
export interface A0ChangeNote {
  commitment: string;
  /** input − amount − fee; 0 is a note too (the program side's zero_change vector) */
  amount: bigint;
  /** Poseidon3(0x13, nullifier, 0) of the PUBLIC (landed) nullifier */
  rho: string;
  leafIndex: number;
}

/**
 * §6 step 8 (M1c Task 7): the chain shows the spend — the note becomes `spent` with `spentTx`,
 * and its change note (when the landed change leaf is ours; null otherwise) is added `unspent`,
 * in ONE write. Chain truth: a pending unshield OR an unspent note (a restore may have reverted
 * it meanwhile) can be settled. A second settler is a no-op: the note already `spent` with the
 * SAME `spentTx` and the change note already stored as given → nothing written. Another
 * `spentTx`, or a stored note with the change's rho or commitment that is not exactly it, refuses
 * (`E_A0_NOTE_STATE` / `E_A0_NOTE_DUPLICATE`).
 */
export function settleA0Unshield(
  rho: string,
  spentTx: string,
  change: A0ChangeNote | null,
  bound?: A0StoreBinding,
): 'settled' | 'already' {
  const s = readExisting(rho, bound);
  const i = indexOfRho(s, rho);
  const n = s.notes[i]!;
  const changeNote: A0Note | null = change
    ? checkNote({commitment: change.commitment, amount: change.amount, rho: change.rho, leafIndex: change.leafIndex, status: 'unspent'})
    : null;
  const sameChange = (m: A0Note): boolean =>
    changeNote !== null &&
    m.rho === changeNote.rho &&
    m.commitment === changeNote.commitment &&
    m.leafIndex === changeNote.leafIndex &&
    m.amount === changeNote.amount &&
    m.depositIndex === undefined;
  const changeStored = changeNote !== null && s.notes.some(sameChange);
  if (n.status === 'spent') {
    if (n.spentTx !== spentTx) {
      throw new A0NoteStoreError('E_A0_NOTE_STATE', `the note with rho ${rho} is spent by ${String(n.spentTx)}, not ${spentTx}`);
    }
    if (changeNote === null || changeStored) {
      return 'already';
    }
  } else if (n.status !== 'unspent' && !isPendingUnshield(n)) {
    throw new A0NoteStoreError('E_A0_NOTE_STATE', `the note with rho ${rho} is a pending deposit`);
  }
  const spent: A0Note = {...n, status: 'spent', spentTx};
  delete spent.pendingSince;
  delete spent.unshield;
  const notes = [...s.notes];
  notes[i] = checkNote(spent);
  if (changeNote !== null && !changeStored) {
    notes.push(changeNote);
  }
  checkUnique(notes);
  write({...s, notes}, bound);
  return 'settled';
}

/** The stored note vs the chain's view of the same rho (the rules of `mergeA0RecoveredNotes`). */
function merged(stored: A0Note, chain: A0Note): A0Note {
  if (stored.status === 'spent' && (chain.status !== 'spent' || chain.spentTx === undefined)) {
    return stored; // spent is final: a note never becomes spendable again
  }
  if (stored.status === 'pending' && stored.pendingSince !== undefined) {
    // an unshield in flight: M1c's reconciliation decides, not a restore or a deposit pre-check —
    // spent on chain or not (M1c final review I-3): it settles it THROUGH the verifier, and
    // `settleA0Unshield` accepts the change note this merge may store now (`changeStored`)
    return stored;
  }
  if (chain.status === 'spent') {
    return chain; // the chain's spend, with its spending tx when the restore attributed it (M1c)
  }
  return chain; // a pending deposit the chain has confirmed, or an unspent note re-read
}

/**
 * Write a recovery's result (§7: the store is a cache of the chain). Each recovered note is added,
 * or merged with the stored note of the same rho: spent stays spent; the chain's `spent` wins over
 * anything else (and, when it names its spending tx, over a stored `spent` too — M1c's
 * attribution fills or corrects `spentTx`: chain truth wins) EXCEPT a pending unshield
 * (`pendingSince`), which is left for M1c's reconciliation even when the chain shows it spent
 * (I-3: the reconciliation runs the verifier on that tx); otherwise the chain's note
 * (`unspent`, with its leaf) replaces the stored one — that confirms a pending deposit that
 * landed. Stored notes the chain does not show are kept (a pending deposit is reconciled by §5
 * step 7, not here). `nextDepositIndex` becomes the higher of the two. A CORRUPT record is
 * replaced by the recovery alone (`replacedCorrupt: true`): its pending entries are lost, which
 * the deposit pre-check covers (a landed one is found by its rho PDA, §5 step 2). Atomic: one write.
 *
 * STATED HAZARD (Task 3 review m2): that replace is the ONE by-design path that can lower
 * `nextDepositIndex` — the unreadable record's counter is not known, so the counter becomes the
 * recovery's (highest hit + 1). The pending deposits' counters the record held are lost with it;
 * a counter handed out again is caught by the pre-check once the earlier deposit has landed (its
 * rho PDA exists); one still in flight at that moment can be raced — the later of the two fails
 * at the rho PDA's `init` (a paid, rejected tx) and the one that landed is found by a restore.
 */
export function mergeA0RecoveredNotes(
  recovered: readonly A0Note[],
  nextDepositIndex: bigint,
  bound?: A0StoreBinding,
): {replacedCorrupt: boolean} {
  const checked = recovered.map(checkNote);
  checkUnique(checked);
  if (typeof nextDepositIndex !== 'bigint' || nextDepositIndex < 0n || nextDepositIndex > U64_MAX) {
    invalid('nextDepositIndex is not a counter');
  }
  let base: A0NoteStoreState;
  let replacedCorrupt = false;
  try {
    base = read(bound);
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
  write({nextDepositIndex: bigMax(base.nextDepositIndex, nextDepositIndex), notes}, bound);
  return {replacedCorrupt};
}
