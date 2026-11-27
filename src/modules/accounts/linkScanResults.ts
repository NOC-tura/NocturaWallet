/**
 * History spec §6.4, owner Q3 (2026-11-27): the LAST result of the "linked" scan per exit, so the Accounts
 * sheet can say "Link check not finished" for an exit whose last scan ended `failed` or `capped` — a
 * neutral line, never "not linked" (a scan that did not finish says nothing either way).
 *
 * MEMORY ONLY: never persisted. The runner writes a result only while its scan is live, and clears them
 * all with its other in-memory state on `onSecureMmkvReset` (a wipe, an import, an unlock).
 */
import type {LinkScanResult} from './linkScan';

const last = new Map<string, LinkScanResult>();
const listeners = new Set<() => void>();
let version = 0;

function changed(): void {
  version += 1;
  for (const listener of [...listeners]) {
    listener();
  }
}

export function recordLinkScanResult(exit: string, result: LinkScanResult): void {
  if (last.get(exit) === result) {
    return;
  }
  last.set(exit, result);
  changed();
}

export function clearLinkScanResults(): void {
  if (last.size === 0) {
    return;
  }
  last.clear();
  changed();
}

/** undefined when the exit was not scanned since the last reset */
export function lastLinkScanResult(exit: string): LinkScanResult | undefined {
  return last.get(exit);
}

/** The last scan of `exit` ended without reading its history through: `failed` or `capped`. */
export function linkCheckUnfinished(exit: string): boolean {
  const result = last.get(exit);
  return result === 'failed' || result === 'capped';
}

/** For `useSyncExternalStore`: a number that changes with every recorded or cleared result. */
export function linkScanResultsVersion(): number {
  return version;
}

export function subscribeLinkScanResults(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
