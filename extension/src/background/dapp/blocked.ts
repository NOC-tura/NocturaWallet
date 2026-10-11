/**
 * Blocked hosts (spec §2.6, D3): "Reject and report" and "Block this site" write here; a blocked host's requests are
 * answered `rejected` at once, with no window and no queue entry. Keyed by HOST — every port and scheme (review 2 H2,
 * L7). storage.local, background-owned (v1_dapp_blocked), at most MAX_BLOCKED (the oldest falls out), wiped by a delete
 * and kept by a restore (C11). Writes run inside store.ts's dappSection. Nothing is reported to a server (D3).
 */
export const BLOCKED_KEY = 'v1_dapp_blocked';
export const MAX_BLOCKED = 200;

export interface Blocked {
  host: string;
  blockedAt: number;
  /** The listed domain the host imitated (#49's "Looked like …"), or null. */
  imitates: string | null;
}

const HOST = /^[^\s/?#@:]{1,253}$|^\[[0-9a-f:.]{2,45}\]$/;

/** The stored list, re-validated, newest first; anything else in the key reads as no block. */
export function blockedOf(x: unknown): Blocked[] {
  if (!Array.isArray(x)) return [];
  const out: Blocked[] = [];
  const seen = new Set<string>();
  for (const item of x as unknown[]) {
    if (out.length >= MAX_BLOCKED) break;
    if (typeof item !== 'object' || item === null) continue;
    const {host, blockedAt, imitates} = item as Record<string, unknown>;
    if (typeof host !== 'string' || !HOST.test(host) || seen.has(host)) continue;
    if (typeof blockedAt !== 'number' || !Number.isSafeInteger(blockedAt) || blockedAt < 0) continue;
    if (imitates !== null && typeof imitates !== 'string') continue;
    seen.add(host);
    out.push({host, blockedAt, imitates});
  }
  return out;
}

export const isBlocked = (list: readonly Blocked[], host: string): boolean => list.some(b => b.host === host);

/** The list with `host` blocked first (an existing block moves to the front); at most MAX_BLOCKED, the oldest dropped. */
export function withBlock(list: readonly Blocked[], host: string, imitates: string | null, now: number): Blocked[] {
  return [{host, blockedAt: now, imitates}, ...list.filter(b => b.host !== host)].slice(0, MAX_BLOCKED);
}

export const withoutBlock = (list: readonly Blocked[], host: string): Blocked[] => list.filter(b => b.host !== host);
