import type {Ext} from '../ext';
import type {WalletDeps} from './deps';
import {REAUTH_KEY, getSession, sessionMutex} from './session';
import {randomId} from './digest';
import type {DappReauthReason, SendReauthReason} from './reauthPolicy';
import type {FeeReason} from '../../../core/fees/transferMarkup';
import {WALLET_TOKENS} from '../../../core/solana/balances';
import {SITE} from '../shared/site';
import {ALLOWANCE_WORD, OVERRIDE_WORDS, type RedFlagKind} from './dapp/redFlags';

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
  | {kind: 'settings'; autoLockMinutes: number | null; reauthUsdCents: number | null}
  /**
   * B1c-2 (spec B1c §3.3): a dApp's transaction request — the site as the window shows it (host, or host:port), how
   * many transactions it signs, what leaves the account per mint (null = SOL; positive base units; decimals when known)
   * and why. Bound to the request and its exact bytes (signTx.ts dappDigest). #10 describes it; the approval window
   * signs only once the challenge is proven and consumed. `outgoing` holds at most MAX_DAPP_OUTGOING mints (SOL first,
   * then the largest in USD); `omitted` counts the mints left out (plan 2 review 1 L9: a long list is cut, never refused).
   * B1c-3: `flags` — the red flags of every transaction, one per (transaction, row), so #10 names what is overridden
   * and a refresh that adds one asks again (signTx.ts reauthGate).
   */
  | {kind: 'dapp'; account: string; site: string; transactions: number; outgoing: DappOutgoing[]; omitted: number; reasons: DappReauthReason[]; thresholdCents: number; flags: DappFlag[]};

export interface DappOutgoing {
  mint: string | null;
  /** The wallet's own name for the token (SOL for `mint` null; NOC, USDC, USDT by their mints), else null. */
  symbol: 'SOL' | 'NOC' | 'USDC' | 'USDT' | null;
  amount: string;
  decimals: number | null;
}

/**
 * B1c-3 (spec §3.3 rev 3.6): one red flag of a dApp challenge — `tx` the transaction's index in the batch (0-based, as
 * the decision's overrides name it), its row of the red-flag table (F1–F10, the spec's own numbers: #10 needs no other
 * name for it), the typed word for a block (null for a warning), and for a dependent step the step it depends on
 * (`step`, 1-based, as the copy says it; null for every other row). F5 alone carries `scope` (O9): `unlimited` when an
 * approval of it is u64::MAX, else `nearly-all` (99 % of the balance up to the whole of it) — #10 names the two apart.
 */
export type FlagRow = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8' | 'F9' | 'F10';
export type F5Scope = 'unlimited' | 'nearly-all';
export interface DappFlag {
  tx: number;
  row: FlagRow;
  word: string | null;
  step: number | null;
  scope?: F5Scope;
}
/** Each red flag's row of the table (spec §3.3; F11, the origin mismatch, never reaches a challenge). */
export const FLAG_ROW: Record<RedFlagKind, FlagRow> = {
  'unknown-program': 'F1',
  'non-transfer': 'F2',
  assign: 'F3',
  'set-authority': 'F4',
  'unlimited-approve': 'F5',
  'bounded-approve': 'F6',
  'token-2022': 'F7',
  'durable-nonce': 'F8',
  'whole-balance': 'F9',
  dependent: 'F10',
};

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
const DAPP_REASONS: readonly string[] = [...REASONS, 'approval', 'override'];
/** At most this many mints in a dApp challenge's description (more than a five-transaction batch can name sensibly; the rest are counted in `omitted`). */
export const MAX_DAPP_OUTGOING = 16;
/** At most one flag per (transaction, row): ten rows over a five-transaction batch. */
export const MAX_DAPP_FLAGS = 50;
/** Each row's override word (a block), or null (a warning) — F5's is checked against its own list. */
const ROW_WORDS: Record<FlagRow, string | null> = {
  F1: null,
  F2: null,
  F3: OVERRIDE_WORDS.assign,
  F4: OVERRIDE_WORDS.setAuthority,
  F5: OVERRIDE_WORDS.unlimited,
  F6: null,
  F7: null,
  F8: null,
  F9: null,
  F10: OVERRIDE_WORDS.dependent,
};
/**
 * F5's word: the wallet's own symbol for a token it names (never SOL — an approve is of a token account), else UNLIMITED
 * at u64::MAX and ALLOWANCE below it (review 3 L14) — each only with its own scope.
 */
const UNLIMITED_WORDS: readonly string[] = ['NOC', 'USDC', 'USDT', OVERRIDE_WORDS.unlimited, ALLOWANCE_WORD];
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
  if (a.kind === 'dapp') {
    const outgoing = a.outgoing;
    const reasons = a.reasons;
    return (
      typeof a.account === 'string' &&
      ADDRESS.test(a.account) &&
      typeof a.site === 'string' &&
      SITE.test(a.site) &&
      isInt(a.transactions) &&
      a.transactions >= 1 &&
      a.transactions <= 5 &&
      Array.isArray(outgoing) &&
      outgoing.length <= MAX_DAPP_OUTGOING &&
      (outgoing as unknown[]).every(isOutgoing) &&
      isInt(a.omitted) &&
      a.omitted >= 0 &&
      Array.isArray(reasons) &&
      reasons.length > 0 &&
      new Set(reasons).size === reasons.length &&
      (reasons as unknown[]).every(r => typeof r === 'string' && DAPP_REASONS.includes(r)) &&
      isInt(a.thresholdCents) &&
      isDappFlags(a.flags, a.transactions, reasons as unknown[]) &&
      Object.keys(a).length === 9
    );
  }
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

/**
 * Fix round 1 item 4: a symbol names a real token only when its decimals match this wallet's own table
 * (WALLET_TOKENS) exactly — simulate.ts's decimals are untrusted mint data (a hostile or merely unusual token, or an
 * RPC that lies about a legitimate mint's account, can report anything), so a mismatch must never reach the store
 * labelled with a name it does not back. dappAbout applies the same rule when it builds `symbol` in the first place;
 * this is the store's own defense, never trusting its caller alone.
 */
function isOutgoing(x: unknown): x is DappOutgoing {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  const decimals = o.decimals;
  const symbolOk =
    o.mint === null
      ? o.symbol === 'SOL' && decimals === WALLET_TOKENS.SOL.decimals
      : o.symbol === null ||
        (typeof o.symbol === 'string' && o.symbol !== 'SOL' && TOKENS.includes(o.symbol) && decimals === WALLET_TOKENS[o.symbol as 'NOC' | 'USDC' | 'USDT'].decimals);
  return (
    (o.mint === null || (typeof o.mint === 'string' && ADDRESS.test(o.mint))) &&
    symbolOk &&
    typeof o.amount === 'string' &&
    DIGITS.test(o.amount) &&
    (decimals === null || (isInt(decimals) && decimals >= 0 && decimals <= 18)) &&
    Object.keys(o).length === 4
  );
}

/**
 * B1c-3: a dApp challenge's flags, exactly as signTx.ts dappAbout builds them — each row known, on a transaction of the
 * batch, a block with its own word and a warning with none, a dependent step naming an earlier one, F5 with its scope
 * and no other row with one, one per (transaction, row); and a block present exactly when the reasons name `override`
 * (simulate.ts adds it for one).
 */
function isDappFlags(x: unknown, transactions: number, reasons: readonly unknown[]): x is DappFlag[] {
  if (!Array.isArray(x) || x.length > MAX_DAPP_FLAGS) return false;
  const seen = new Set<string>();
  let blocks = 0;
  for (const v of x as unknown[]) {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
    const f = v as Record<string, unknown>;
    if (!isInt(f.tx) || f.tx < 0 || f.tx >= transactions || typeof f.row !== 'string' || !Object.hasOwn(ROW_WORDS, f.row)) return false;
    const row = f.row as FlagRow;
    if (Object.keys(f).length !== (row === 'F5' ? 5 : 4) || (row === 'F5' && f.scope !== 'unlimited' && f.scope !== 'nearly-all')) return false;
    const word = ROW_WORDS[row];
    if (word === null ? f.word !== null : row === 'F5' ? typeof f.word !== 'string' || !UNLIMITED_WORDS.includes(f.word) : f.word !== word) return false;
    if ((f.word === OVERRIDE_WORDS.unlimited && f.scope !== 'unlimited') || (f.word === ALLOWANCE_WORD && f.scope !== 'nearly-all')) return false;
    if (row === 'F10' ? !isInt(f.step) || f.step < 1 || f.step > f.tx : f.step !== null) return false;
    const key = `${f.tx}:${row}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (word !== null) blocks++;
  }
  return (blocks > 0) === reasons.includes('override');
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

// Every read-modify-write runs under sessionMutex, the mutex lock() clears the session in (one section,
// lockHook.ts): a lock can never land between a read and its write and be undone by the write.

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

/**
 * Fix round 1 item 1: remove exactly this id, whatever its digest or satisfied state — reauthGate calls this right
 * after issuing the id that supersedes it, so a tab already open on the old id reads back `unknown-challenge` instead
 * of silently going on proving a stale description (R9/R11: the old proof must never stand for what Approve is about
 * to sign once a fresh simulation outgrew it). Never `dropChallengesFor` by digest here: the new challenge is issued
 * for the SAME digest (the request's bytes), so a digest-keyed drop could not tell the superseded id from the one
 * replacing it — only the id does. A no-op for an id already gone.
 */
export async function dropChallenge(ext: Ext, id: string): Promise<void> {
  if (!CHALLENGE_ID.test(id)) return;
  await sessionMutex(async () => {
    const store = await load(ext);
    if (store.delete(id)) await save(ext, store);
  });
}

/** The patch a settings challenge was issued for (E9): the values parsePatch accepted at issue, null where unchanged. */
export type SettingsChallengePatch = {autoLockMinutes: number | null; reauthUsdCents: number | null};

/**
 * B1b-2b E9 (D6): the background applies a weakening setting when #10's proof satisfies its challenge. Under
 * sessionMutex, in ONE section: an unknown, expired or non-settings id is `unknown-challenge`; no session is
 * `locked`; otherwise the record is DELETED (single use — a replayed vault.reauthOk finds nothing) and its patch
 * returned. A send challenge is never taken here, and a settings challenge is never satisfied for a re-call
 * (C1: settings.set no longer accepts a challengeId).
 */
export async function takeSettingsChallenge(ext: Ext, now: number, id: string): Promise<SettingsChallengePatch | 'unknown-challenge' | 'locked'> {
  if (!CHALLENGE_ID.test(id)) return 'unknown-challenge';
  return sessionMutex(async () => {
    const store = live(await load(ext), now);
    const c = store.get(id);
    if (c === undefined || c.about.kind !== 'settings') return 'unknown-challenge';
    if ((await getSession(ext)) === null) return 'locked';
    store.delete(id);
    await save(ext, store);
    return {autoLockMinutes: c.about.autoLockMinutes, reauthUsdCents: c.about.reauthUsdCents};
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
