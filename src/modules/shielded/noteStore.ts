import {mmkvSecure} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {ERROR_CODES} from '../../constants/errors';
import type {ShieldedNote, ShieldedNoteJson} from './types';

function getStorage() {
  const store = mmkvSecure();
  if (!store) {
    throw new Error('NoteStore requires mmkvSecure — wallet must be onboarded');
  }
  return store;
}

function storageKey(mint: string): string {
  return `${MMKV_KEYS.SHIELDED_NOTES_PREFIX}${mint}`;
}

function toJson(note: ShieldedNote): ShieldedNoteJson {
  return {...note, amount: note.amount.toString()};
}

function fromJson(json: ShieldedNoteJson): ShieldedNote {
  return {
    ...json,
    amount: BigInt(json.amount),
    noteSecret: json.noteSecret ?? '',
  };
}

function loadNotes(mint: string): ShieldedNote[] {
  const raw = getStorage().getString(storageKey(mint));
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as ShieldedNoteJson[]).map(fromJson);
  } catch {
    return [];
  }
}

function saveNotes(mint: string, notes: ShieldedNote[]): void {
  getStorage().set(storageKey(mint), JSON.stringify(notes.map(toJson)));
}

export function getNotes(mint: string): ShieldedNote[] {
  return loadNotes(mint).filter(n => !n.spent);
}

export function getBalance(mint: string): bigint {
  return getNotes(mint).reduce((sum, n) => sum + n.amount, 0n);
}

export function selectNotes(mint: string, amount: bigint, fee: bigint): ShieldedNote[] {
  const target = amount + fee;
  const unspent = getNotes(mint).sort((a, b) =>
    a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0,
  );

  const selected: ShieldedNote[] = [];
  let total = 0n;
  for (const note of unspent) {
    selected.push(note);
    total += note.amount;
    if (total >= target) return selected;
  }

  const err = ERROR_CODES.INSUFFICIENT_NOC_FEE;
  throw new Error(err.message);
}

/**
 * Whether a note with this commitment already exists — SPENT OR UNSPENT.
 * Unlike getNotes (which filters spent), this reads the full set, so a rescan
 * can tell a genuinely-new note from a previously-seen (now spent) one.
 */
export function hasNote(mint: string, commitment: string): boolean {
  return loadNotes(mint).some(n => n.commitment === commitment);
}

export function addNote(note: ShieldedNote): void {
  const notes = loadNotes(note.mint);
  // Idempotent by commitment, spent-INCLUSIVE. A full rescan (cursor reset,
  // reinstall, concurrent scan) re-encounters notes already in the store; re-adding
  // a SPENT note as unspent would inflate the balance (getNotes filters spent, so a
  // spent-blind dedup can't catch it). A commitment present anywhere — spent or not —
  // is never re-inserted.
  if (notes.some(n => n.commitment === note.commitment)) return;
  notes.push(note);
  saveNotes(note.mint, notes);
}

/**
 * Mark notes as spent by their nullifiers.
 * Note: spec defines markSpent(nullifiers[]) but we require mint to avoid
 * scanning all mints. Callers always know the mint from the transaction context.
 */
export function markSpent(mint: string, nullifiers: string[]): void {
  const nullifierSet = new Set(nullifiers);
  const notes = loadNotes(mint);
  let changed = false;
  for (const note of notes) {
    if (nullifierSet.has(note.nullifier) && !note.spent) {
      note.spent = true;
      changed = true;
    }
  }
  if (changed) saveNotes(mint, notes);
}

/**
 * Mark the note at `leafIndex` as spent. Deposit-created notes store an empty
 * `nullifier` (it is computed only at withdraw time), so `markSpent(nullifiers)`
 * cannot match them; the on-chain leaf index is the stable key.
 */
export function markSpentByIndex(mint: string, leafIndex: number): void {
  const notes = loadNotes(mint);
  let changed = false;
  for (const note of notes) {
    if (note.index === leafIndex && !note.spent) {
      note.spent = true;
      changed = true;
    }
  }
  if (changed) saveNotes(mint, notes);
}

/**
 * Mark the note with the given `commitment` (decimal) as spent. Robust when the
 * note's on-chain leaf index is not yet known (change notes may be stored with a
 * sentinel index and resolved lazily) — commitments are unique, so this always
 * targets the right note.
 */
export function markSpentByCommitment(mint: string, commitment: string): void {
  const notes = loadNotes(mint);
  let changed = false;
  for (const note of notes) {
    if (note.commitment === commitment && !note.spent) {
      note.spent = true;
      changed = true;
    }
  }
  if (changed) saveNotes(mint, notes);
}

/**
 * Set the on-chain leaf index of a stored note (by commitment). Used to backfill
 * a change note whose index could not be determined at withdraw time (stored with
 * a sentinel) once it is resolved from the synced tree at spend time.
 */
export function setNoteIndex(mint: string, commitment: string, index: number): void {
  const notes = loadNotes(mint);
  let changed = false;
  for (const note of notes) {
    if (note.commitment === commitment && note.index !== index) {
      note.index = index;
      changed = true;
    }
  }
  if (changed) saveNotes(mint, notes);
}

export function clearMint(mint: string): void {
  getStorage().remove(storageKey(mint));
}
