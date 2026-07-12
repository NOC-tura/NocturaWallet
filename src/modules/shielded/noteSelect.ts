import {getNotes} from './noteStore';
import type {ShieldedNote} from './types';

/**
 * Best-fit: the SMALLEST unspent note whose amount >= target (minimizes change,
 * preserves large notes for future large unshields). null when none covers it.
 * The withdraw circuit takes ONE input note, so the target must fit in a single note.
 */
export function selectBestFit(notes: ShieldedNote[], target: bigint): ShieldedNote | null {
  let best: ShieldedNote | null = null;
  for (const n of notes) {
    if (n.amount < target) continue;
    if (best === null || n.amount < best.amount) best = n;
  }
  return best;
}

/** Best-fit input note for withdrawing `target` from `mint` (null if none covers it). */
export function selectInputNote(mint: string, target: bigint): ShieldedNote | null {
  return selectBestFit(getNotes(mint), target);
}

/**
 * Select 1 or 2 real input notes to fund `target` for a 2-in transfer.
 * Best-fit: the smallest single note >= target; else the two largest notes if
 * they sum to >= target; else null (target exceeds the two-largest capacity).
 */
export function selectTransferInputs(notes: ShieldedNote[], target: bigint): ShieldedNote[] | null {
  const single = selectBestFit(notes, target);
  if (single) return [single];
  const sorted = [...notes].sort((a, b) => (a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0));
  if (sorted.length >= 2 && sorted[0]!.amount + sorted[1]!.amount >= target) {
    return [sorted[0]!, sorted[1]!];
  }
  return null;
}

/** Max transferable in one tx = the sum of the two largest notes (2-in circuit). */
export function maxTransferable(notes: ShieldedNote[]): bigint {
  const sorted = [...notes].sort((a, b) => (a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0));
  return (sorted[0]?.amount ?? 0n) + (sorted[1]?.amount ?? 0n);
}
