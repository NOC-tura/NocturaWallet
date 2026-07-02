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
