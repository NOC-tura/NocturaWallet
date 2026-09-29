import type {Ext} from '../ext';
import type {WalletDeps} from './deps';
import {REAUTH_KEY, sessionMutex} from './session';
import {randomId} from './digest';

/** How long the vault page has to prove the factor (brief decision 6). */
export const CHALLENGE_TTL_MS = 120_000;

/** What randomId produces. Anything else — `__proto__`, `constructor`, garbage — is refused unread. */
const CHALLENGE_ID = /^[0-9a-f]{32}$/;

interface Challenge {
  digest: string;
  expiresAt: number;
  satisfied: boolean;
}
// A Map, not an object: no id can resolve to an inherited property.
type Store = Map<string, Challenge>;

function isChallenge(x: unknown): x is Challenge {
  if (typeof x !== 'object' || x === null) return false;
  const c = x as Record<string, unknown>;
  return typeof c.digest === 'string' && typeof c.expiresAt === 'number' && typeof c.satisfied === 'boolean';
}

async function load(ext: Ext): Promise<Store> {
  const v = await ext.session.get(REAUTH_KEY);
  const out: Store = new Map();
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return out;
  for (const [id, c] of Object.entries(v as Record<string, unknown>)) if (CHALLENGE_ID.test(id) && isChallenge(c)) out.set(id, c);
  return out;
}

async function save(ext: Ext, store: Store): Promise<void> {
  await ext.session.set(REAUTH_KEY, Object.fromEntries(store));
}

function live(store: Store, now: number): Store {
  return new Map([...store].filter(([, c]) => c.expiresAt > now));
}

// Every read-modify-write runs under sessionMutex, the one clearSession (lock) takes: a lock can
// never land between a read and its write and be undone by the write.

/** A new challenge for the action whose digest is given; the vault page proves, the action consumes. */
export async function issueChallenge(ext: Ext, deps: Pick<WalletDeps, 'now' | 'randomBytes'>, digest: string): Promise<string> {
  if (digest.length === 0) throw new TypeError('issueChallenge: empty digest');
  const id = randomId(deps.randomBytes);
  await sessionMutex(async () => {
    const now = deps.now();
    const store = live(await load(ext), now);
    store.set(id, {digest, expiresAt: now + CHALLENGE_TTL_MS, satisfied: false});
    await save(ext, store);
  });
  return id;
}

/** vault.reauthOk: the proof succeeded in the vault page. False for an unknown, malformed or expired id. */
export async function satisfyChallenge(ext: Ext, now: number, id: string): Promise<boolean> {
  if (!CHALLENGE_ID.test(id)) return false;
  return sessionMutex(async () => {
    const store = live(await load(ext), now);
    const c = store.get(id);
    if (c !== undefined) store.set(id, {...c, satisfied: true});
    await save(ext, store);
    return c !== undefined;
  });
}

/** Peek without consuming: may the action proceed? */
export async function challengeSatisfied(ext: Ext, now: number, id: string, digest: string): Promise<boolean> {
  if (!CHALLENGE_ID.test(id)) return false;
  const c = (await load(ext)).get(id);
  return c !== undefined && c.satisfied && c.expiresAt > now && c.digest === digest;
}

/**
 * May a re-prepare of the same action keep this challenge instead of issuing a new one? True for a
 * live challenge with this digest, proven or not. Reads only: nothing is consumed or changed.
 */
export async function challengeReusable(ext: Ext, now: number, id: string, digest: string): Promise<boolean> {
  if (!CHALLENGE_ID.test(id)) return false;
  const c = (await load(ext)).get(id);
  return c !== undefined && c.expiresAt > now && c.digest === digest;
}

/**
 * True exactly once, for a satisfied, unexpired challenge with the same digest. A different digest
 * burns the challenge (it can never be right); a not-yet-satisfied one is left for the vault page.
 */
export async function consumeChallenge(ext: Ext, now: number, id: string, digest: string): Promise<boolean> {
  if (!CHALLENGE_ID.test(id)) return false;
  return sessionMutex(async () => {
    const store = live(await load(ext), now);
    const c = store.get(id);
    if (c === undefined) return false;
    if (c.digest === digest && !c.satisfied) return false;
    store.delete(id);
    await save(ext, store);
    return c.digest === digest;
  });
}
