/**
 * Grants (spec §2.1, D4, C1, C2, C8, C11): which origin may see which one account. `persistent` grants live in
 * storage.local (v1_dapp_grants, background-owned: scripts/check-vault-isolation.mjs BACKGROUND_OWNED_KEYS), `session`
 * grants in the dApp session state (store.ts), wiped by the lock hook and by the browser on close. One grant per exact
 * origin (C8: `https://jup.ag` and `https://www.jup.ag` are two). Wiped by a wallet delete, kept by a restore (C11:
 * accountsStore's WALLET_DATA_KEYS). Every write runs inside store.ts's dappSection.
 */
export const GRANTS_KEY = 'v1_dapp_grants';
/** Persistent grants at most (§2.1): a connect beyond it opens #47 with Q16 and only [Reject]. */
export const MAX_GRANTS = 200;
/** Grant.recent keeps this many interactions (#49's "Last 3 interactions"). */
export const RECENT_KEPT = 3;

export type RequestType = 'connect' | 'signMessage' | 'signTransaction' | 'signAndSendTransaction';
export interface Recent {
  type: RequestType;
  at: number;
  outcome: 'approved' | 'rejected';
}
export interface Grant {
  /** Exactly sender.origin. */
  origin: string;
  /** base58 publicKey of the granted account (C1: the dApp's account, not the popup's active one). */
  account: string;
  scope: 'session' | 'persistent';
  /** UTC ms. */
  connectedAt: number;
  /** UTC ms; every accepted request. */
  lastUsedAt: number;
  /** The last RECENT_KEPT interactions, newest first. */
  recent: Recent[];
}

const REQUEST_TYPES: readonly string[] = ['connect', 'signMessage', 'signTransaction', 'signAndSendTransaction'];
const isTime = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
/** An https origin as the browser reports it: scheme, host (ASCII / punycode, or an IP literal) and an optional port. */
const ORIGIN = /^https:\/\/[^\s/?#@]+$/;

function recentOf(x: unknown): Recent | null {
  if (typeof x !== 'object' || x === null) return null;
  const {type, at, outcome} = x as Record<string, unknown>;
  if (typeof type !== 'string' || !REQUEST_TYPES.includes(type) || !isTime(at) || (outcome !== 'approved' && outcome !== 'rejected')) return null;
  return {type: type as RequestType, at, outcome};
}

/** One stored grant, rebuilt field by field; null when any field is not what the background writes. */
export function grantOf(x: unknown, scope: Grant['scope']): Grant | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as Record<string, unknown>;
  if (typeof o.origin !== 'string' || !ORIGIN.test(o.origin) || typeof o.account !== 'string' || o.account.length === 0) return null;
  if (o.scope !== scope || !isTime(o.connectedAt) || !isTime(o.lastUsedAt) || !Array.isArray(o.recent)) return null;
  const recent: Recent[] = [];
  for (const r of (o.recent as unknown[]).slice(0, RECENT_KEPT)) {
    const v = recentOf(r);
    if (v === null) return null;
    recent.push(v);
  }
  return {origin: o.origin, account: o.account, scope, connectedAt: o.connectedAt, lastUsedAt: o.lastUsedAt, recent};
}

/** A stored list, re-validated: a bad entry and a second grant for an origin already read are dropped; at most `max`. */
export function grantsOf(x: unknown, scope: Grant['scope'], max: number): Grant[] {
  if (!Array.isArray(x)) return [];
  const out: Grant[] = [];
  const seen = new Set<string>();
  for (const item of x as unknown[]) {
    if (out.length >= max) break;
    const g = grantOf(item, scope);
    if (g === null || seen.has(g.origin)) continue;
    seen.add(g.origin);
    out.push(g);
  }
  return out;
}

/** The grant with this interaction recorded (newest first, RECENT_KEPT kept) and, when approved, lastUsedAt moved. */
export function withRecent(g: Grant, type: RequestType, at: number, outcome: Recent['outcome']): Grant {
  return {...g, lastUsedAt: outcome === 'approved' ? at : g.lastUsedAt, recent: [{type, at, outcome}, ...g.recent].slice(0, RECENT_KEPT)};
}
