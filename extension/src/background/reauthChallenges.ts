import type {Ext} from '../ext';
import type {WalletDeps} from './deps';
import {REAUTH_KEY, sessionMutex} from './session';
import {randomId} from './digest';
import type {SendReauthReason} from './reauthPolicy';
import type {FeeReason} from '../../../core/fees/transferMarkup';

/** How long the vault page has to prove the factor (brief decision 6), counted from the last prepare of the same intent. */
export const CHALLENGE_TTL_MS = 120_000;
/**
 * No re-base extends a challenge past its issue plus this (controller ruling C5): whatever re-prepares
 * happen, one proof lives at most ten minutes (spec B1b-2a E3).
 */
export const CHALLENGE_MAX_LIFE_MS = 10 * 60_000;

/** What randomId produces. Anything else — `__proto__`, `constructor`, garbage — is refused unread. */
export const CHALLENGE_ID = /^[0-9a-f]{32}$/;

/**
 * The action behind a challenge, written by the same call that binds the digest, from the same parsed
 * values (E3). The vault page reads it through vault.challengeInfo — never from its URL. Amounts are
 * base-unit decimal strings.
 */
export type ChallengeAbout =
  | {
      kind: 'send';
      account: string;
      token: 'SOL' | 'NOC' | 'USDC' | 'USDT';
      recipient: string;
      amount: string;
      /** The whole network fee: 5 000 per signature plus the priority fee. */
      networkLamports: string;
      /** The priority part of networkLamports (plan 3, carry 1): #10 shows the base fee and the priority as two rows, as #19 and #20 do. */
      priorityLamports: string;
      markupLamports: string;
      markupReason: FeeReason;
      rentLamports: string;
      reasons: SendReauthReason[];
      thresholdCents: number;
    }
  | {kind: 'settings'; autoLockMinutes: number | null; reauthUsdCents: number | null};

/** The fields a re-prepare of the same intent may refresh; the identity fields (account, token, recipient, amount) never change. */
export type SendAboutRefresh = Pick<
  Extract<ChallengeAbout, {kind: 'send'}>,
  'networkLamports' | 'priorityLamports' | 'markupLamports' | 'markupReason' | 'rentLamports' | 'reasons' | 'thresholdCents'
>;

interface Challenge {
  digest: string;
  issuedAt: number;
  expiresAt: number;
  satisfied: boolean;
  about: ChallengeAbout;
}
// A Map, not an object: no id can resolve to an inherited property.
type Store = Map<string, Challenge>;

const TOKENS: readonly string[] = ['SOL', 'NOC', 'USDC', 'USDT'];
const REASONS: readonly string[] = ['first-send', 'over-5-percent', 'over-usd-threshold', 'whole-balance-to-new'];
const FEE_REASONS: readonly string[] = ['pre-tge', 'zero-fee-eligible', 'status-unknown', 'charged'];
const DIGITS = /^\d{1,20}$/;
/** A base58 Solana address's shape (32–44 characters). */
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x);
const isIntOrNull = (x: unknown): boolean => x === null || isInt(x);

/** The exact shape of `about`: a stored record with any other shape is dropped. */
function isAbout(x: unknown): x is ChallengeAbout {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
  const a = x as Record<string, unknown>;
  if (a.kind === 'settings') return isIntOrNull(a.autoLockMinutes) && isIntOrNull(a.reauthUsdCents) && Object.keys(a).length === 3;
  if (a.kind !== 'send') return false;
  return (
    typeof a.account === 'string' &&
    ADDRESS.test(a.account) &&
    typeof a.recipient === 'string' &&
    ADDRESS.test(a.recipient) &&
    typeof a.token === 'string' &&
    TOKENS.includes(a.token) &&
    [a.amount, a.networkLamports, a.priorityLamports, a.markupLamports, a.rentLamports].every(v => typeof v === 'string' && DIGITS.test(v)) &&
    // The priority is a part of the network fee, never more: the base fee row is their difference.
    BigInt(a.priorityLamports as string) <= BigInt(a.networkLamports as string) &&
    typeof a.markupReason === 'string' &&
    FEE_REASONS.includes(a.markupReason) &&
    Array.isArray(a.reasons) &&
    (a.reasons as unknown[]).every(r => typeof r === 'string' && REASONS.includes(r)) &&
    isInt(a.thresholdCents) &&
    Object.keys(a).length === 12
  );
}

function isChallenge(x: unknown): x is Challenge {
  if (typeof x !== 'object' || x === null) return false;
  const c = x as Record<string, unknown>;
  return typeof c.digest === 'string' && typeof c.issuedAt === 'number' && typeof c.expiresAt === 'number' && typeof c.satisfied === 'boolean' && isAbout(c.about);
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
export async function issueChallenge(ext: Ext, deps: Pick<WalletDeps, 'now' | 'randomBytes'>, digest: string, about: ChallengeAbout): Promise<string> {
  if (digest.length === 0) throw new TypeError('issueChallenge: empty digest');
  if (!isAbout(about)) throw new TypeError('issueChallenge: malformed about');
  const id = randomId(deps.randomBytes);
  await sessionMutex(async () => {
    const now = deps.now();
    const store = live(await load(ext), now);
    store.set(id, {digest, issuedAt: now, expiresAt: now + CHALLENGE_TTL_MS, satisfied: false, about});
    await save(ext, store);
  });
  return id;
}

/**
 * A re-prepare of the same intent carries a still-live challenge (owner D39): the same grant renewed,
 * not a new one. True, and `expiresAt` = min(now + CHALLENGE_TTL_MS, issuedAt + CHALLENGE_MAX_LIFE_MS)
 * with `satisfied` kept, for a live challenge with this digest; the send fields of `about` that a
 * re-prepare recomputes are refreshed. False — nothing changed — for an expired, unknown or other-digest
 * challenge: an expired one is never revived, and one bound elsewhere is never re-based.
 */
export async function rebaseChallenge(ext: Ext, now: number, id: string, digest: string, refresh: SendAboutRefresh): Promise<boolean> {
  if (!CHALLENGE_ID.test(id)) return false;
  return sessionMutex(async () => {
    const store = live(await load(ext), now);
    const c = store.get(id);
    if (c === undefined || c.digest !== digest || c.about.kind !== 'send') return false;
    // With a clock that only moves forward, a live challenge has issuedAt + CHALLENGE_MAX_LIFE_MS ≥
    // expiresAt > now, so this does not shorten it; a clock stepped backwards can shorten it, which
    // fails closed (a new challenge, a new proof).
    const expiresAt = Math.min(now + CHALLENGE_TTL_MS, c.issuedAt + CHALLENGE_MAX_LIFE_MS);
    // Built field by field: the identity fields come only from the stored record, and nothing else
    // the caller's object carries is written.
    const about: ChallengeAbout = {
      kind: 'send',
      account: c.about.account,
      token: c.about.token,
      recipient: c.about.recipient,
      amount: c.about.amount,
      networkLamports: refresh.networkLamports,
      priorityLamports: refresh.priorityLamports,
      markupLamports: refresh.markupLamports,
      markupReason: refresh.markupReason,
      rentLamports: refresh.rentLamports,
      reasons: refresh.reasons,
      thresholdCents: refresh.thresholdCents,
    };
    if (!isAbout(about)) return false;
    store.set(id, {...c, expiresAt, about});
    await save(ext, store);
    return true;
  });
}

/** vault.challengeInfo: the action a live challenge stands for, or null (unknown, malformed or expired). */
export async function challengeInfo(ext: Ext, now: number, id: string): Promise<ChallengeAbout | null> {
  if (!CHALLENGE_ID.test(id)) return null;
  const c = (await load(ext)).get(id);
  return c !== undefined && c.expiresAt > now ? c.about : null;
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

/** Remove every challenge bound to one of these digests (wallet.discardPrepared, E7). Under sessionMutex by the caller. */
export async function dropChallengesFor(ext: Ext, digests: ReadonlySet<string>): Promise<void> {
  const store = await load(ext);
  let changed = false;
  for (const [id, c] of store) {
    if (digests.has(c.digest)) {
      store.delete(id);
      changed = true;
    }
  }
  if (changed) await save(ext, store);
}
