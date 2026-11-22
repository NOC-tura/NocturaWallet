/**
 * M1d spec §4.3 (plan A14): #21 Now public names the new account a fresh exit landed on, so the
 * user can find it in the Accounts sheet. Reads only, with no change to M1c's flow (the note store's
 * first read writes an empty record when none exists; at `onPending` the record always exists, so
 * call this nowhere else without that guarantee): the reserved
 * scheme is on the note's PENDING intent (written right before the flow's `onPending(rho)`; the
 * settled note drops it), and the account is the registry's `fresh-exit` entry of that scheme.
 * Anything missing or unreadable → null, never a guess.
 */
import {loadA0NoteStore} from '../shielded/a0/noteStore';
import {loadA0AccountRegistry, parseA0Scheme} from '../shielded/a0/accountRegistry';
import {accountLabel} from './accountList';

export function pendingFreshSchemeOf(rho: string): string | null {
  try {
    const note = loadA0NoteStore().notes.find(n => n.rho === rho);
    return note?.unshield?.destination === 'fresh' ? note.unshield.scheme ?? null : null;
  } catch {
    return null;
  }
}

export function freshExitAccountOf(scheme: string | null): {label: string; address: string} | null {
  if (scheme === null) {
    return null;
  }
  const parsed = parseA0Scheme(scheme);
  if (parsed === null) {
    return null;
  }
  try {
    const entry = (loadA0AccountRegistry() ?? []).find(e => e.scheme === scheme && e.role === 'fresh-exit');
    return entry ? {label: accountLabel(parsed), address: entry.address} : null;
  } catch {
    return null;
  }
}
