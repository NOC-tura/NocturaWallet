/**
 * M1d spec §4.4 (M1 spec §10 C2): a Send between two accounts of this seed where either is a fresh
 * exit puts both on one transaction — the chain then shows they belong together. Recognised
 * locally from the registry's addresses (plus main); no request. A `fresh-pending` reservation is
 * an exit in flight and counts as one (plan A2).
 */
import type {SeedAccount} from './accountList';

const EXIT_LIKE: ReadonlySet<string> = new Set(['fresh-exit', 'fresh-pending']);

export function linkingWarningApplies(seed: readonly SeedAccount[], source: string, recipient: string | null): boolean {
  if (recipient === null || recipient === source) {
    return false;
  }
  const s = seed.find(a => a.address === source);
  const r = seed.find(a => a.address === recipient);
  if (!s || !r) {
    return false;
  }
  return EXIT_LIKE.has(s.role) || EXIT_LIKE.has(r.role);
}
