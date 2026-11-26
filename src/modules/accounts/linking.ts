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

/**
 * post-M1d spec §4 (P3, R3): the accounts a Send links — the fresh-exit (or fresh-pending) accounts of
 * this seed among its two ends, source first. Empty exactly when the warning does not apply; never the
 * main account. Computed on #12 from the same registry read as the warning, carried in the intent, and
 * tagged by #21 only on a confirmed outcome.
 */
export function linkedParticipants(seed: readonly SeedAccount[], source: string, recipient: string | null): string[] {
  if (recipient === null || !linkingWarningApplies(seed, source, recipient)) {
    return [];
  }
  return [source, recipient].filter(a => {
    const entry = seed.find(x => x.address === a);
    return entry !== undefined && EXIT_LIKE.has(entry.role);
  });
}
