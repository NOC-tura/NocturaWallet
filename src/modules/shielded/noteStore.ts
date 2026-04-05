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
  return {...json, amount: BigInt(json.amount)};
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

export function addNote(note: ShieldedNote): void {
  const notes = loadNotes(note.mint);
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

export function clearMint(mint: string): void {
  getStorage().remove(storageKey(mint));
}
