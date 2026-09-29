import type {Ext} from '../ext';
import type {WalletDeps} from './deps';
import {REAUTH_KEY} from './session';
import {createMutex} from './mutex';
import {randomId} from './digest';

/** How long the vault page has to prove the factor (brief decision 6). */
export const CHALLENGE_TTL_MS = 120_000;

interface Challenge {
  digest: string;
  expiresAt: number;
  satisfied: boolean;
}
type Store = Record<string, Challenge>;

const serial = createMutex();

function isChallenge(x: unknown): x is Challenge {
  if (typeof x !== 'object' || x === null) return false;
  const c = x as Record<string, unknown>;
  return typeof c.digest === 'string' && typeof c.expiresAt === 'number' && typeof c.satisfied === 'boolean';
}

async function load(ext: Ext): Promise<Store> {
  const v = await ext.session.get(REAUTH_KEY);
  const out: Store = {};
  if (typeof v !== 'object' || v === null) return out;
  for (const [id, c] of Object.entries(v as Record<string, unknown>)) if (isChallenge(c)) out[id] = c;
  return out;
}

const live = (store: Store, now: number): Store => Object.fromEntries(Object.entries(store).filter(([, c]) => c.expiresAt > now));

/** A new challenge for the action whose digest is given; the vault page proves, the action consumes. */
export async function issueChallenge(ext: Ext, deps: Pick<WalletDeps, 'now' | 'randomBytes'>, digest: string): Promise<string> {
  const id = randomId(deps.randomBytes);
  await serial(async () => {
    const now = deps.now();
    const store = live(await load(ext), now);
    store[id] = {digest, expiresAt: now + CHALLENGE_TTL_MS, satisfied: false};
    await ext.session.set(REAUTH_KEY, store);
  });
  return id;
}

/** vault.reauthOk: the proof succeeded in the vault page. False for an unknown or expired id. */
export async function satisfyChallenge(ext: Ext, now: number, id: string): Promise<boolean> {
  return serial(async () => {
    const store = live(await load(ext), now);
    const c = store[id];
    if (c !== undefined) store[id] = {...c, satisfied: true};
    await ext.session.set(REAUTH_KEY, store);
    return c !== undefined;
  });
}

/** Peek without consuming: may the action proceed? */
export async function challengeSatisfied(ext: Ext, now: number, id: string, digest: string): Promise<boolean> {
  const c = (await load(ext))[id];
  return c !== undefined && c.satisfied && c.expiresAt > now && c.digest === digest;
}

/**
 * True exactly once, for a satisfied, unexpired challenge with the same digest. A different digest
 * burns the challenge (it can never be right); a not-yet-satisfied one is left for the vault page.
 */
export async function consumeChallenge(ext: Ext, now: number, id: string, digest: string): Promise<boolean> {
  return serial(async () => {
    const store = live(await load(ext), now);
    const c = store[id];
    if (c === undefined) return false;
    if (c.digest === digest && !c.satisfied) return false;
    delete store[id];
    await ext.session.set(REAUTH_KEY, store);
    return c.digest === digest;
  });
}
