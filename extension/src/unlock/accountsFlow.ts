import type {EnvelopeV1} from '../vault/envelope';
import {reencryptForAccounts} from '../vault/reencrypt';
import {openProven, type ReauthFactor} from '../vault/reauth';
import {deriveSessionAccounts} from '../vault/accounts';
import {envelopeRevision} from '../shared/envelopeRevision';
import {MAX_ACCOUNTS} from '../shared/envelopeRules';
import {lockOnMismatch, sessionKeys} from './reauthFlow';
import {storedVault} from './stored';
import type {Send, VaultStore} from './types';

export type AccountsOutcome =
  | 'done'
  | 'done-locked'
  | 'done-not-locked'
  | 'wrong'
  | 'mismatch-locked'
  | 'damaged'
  | 'not-unlocked'
  | 'no-wallet'
  | 'cli-single'
  | 'last-account'
  | 'no-such-account'
  | 'too-many-accounts'
  /** B1b-2b E13: the account number is not one (not a safe integer in 0 … 2^31 − 1). */
  | 'bad-index'
  /** B1b-2b E13: that account is already in the envelope. */
  | 'index-taken'
  /** B1b-2b C5: a send from an account this change drops is still open (the background refused the store). */
  | 'send-open'
  | 'failed';

/** The SLIP-0010 hardened limit of the account level (m/44'/501'/{account}'/0'): the highest index there is. */
export const MAX_ACCOUNT_INDEX = 2 ** 31 - 1;
export const isAccountIndex = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 && x <= MAX_ACCOUNT_INDEX;

/** C6: the lowest account index not in the list — what the add form pre-fills, so "add it again" is the default after a remove. */
export function lowestFreeIndex(indexes: readonly number[]): number {
  const taken = new Set(indexes);
  let i = 0;
  while (taken.has(i)) i += 1;
  return i;
}

type Deps = VaultStore & {send: Send};
/** The new account list: indexes and names only — reencryptForAccounts derives every public key. */
type Named = {index: number; name: string}[];

/**
 * One attempt: read, re-authenticate (a proof against the session), let `change` name the new list,
 * re-encrypt the seed under the same data key with the new header, ask the background to store it
 * over the revision of the envelope THIS attempt opened, then hand it the new keys. 'busy' means the
 * stored envelope moved in between; the caller decides whether to run again.
 */
async function attempt(deps: Deps, factor: ReauthFactor, change: (env: EnvelopeV1) => Named | AccountsOutcome): Promise<AccountsOutcome | 'busy'> {
  const stored = storedVault(await deps.readEnvelope());
  if (stored.kind === 'none') return 'no-wallet';
  if (stored.kind === 'damaged') return 'damaged';
  const env = stored.env;
  const session = await sessionKeys(deps.send);
  if (session === null) return 'not-unlocked';
  const proven = await openProven(env, factor, session);
  if (proven.outcome === 'mismatch') return lockOnMismatch(deps.send);
  if (proven.outcome !== 'ok') return proven.outcome;
  try {
    const next = change(env);
    if (typeof next === 'string') return next;
    const reencrypted = await reencryptForAccounts(env, proven.dataKey, next);
    const stored = await deps.storeEnvelope(envelopeRevision(env), reencrypted);
    if (stored === 'busy') return 'busy';
    if (stored === 'send-open') return 'send-open';
    if (stored === 'stored-invalid') return 'damaged';
    if (stored === 'no-wallet') return 'no-wallet';
    if (stored !== 'stored') return 'failed';
    // Stored: the accounts HAVE changed. From here, anything that keeps the new keys out of the
    // session locks the vault — a removed account's key must not keep signing — and says so.
    try {
      const indexes = reencrypted.accounts.map(a => a.index);
      const derived = await deriveSessionAccounts(proven.mnemonic, env.scheme, indexes);
      // The keys handed over are the ones the stored header names, account by account.
      const same = derived.length === indexes.length && derived.every((d, i) => d.publicKey === reencrypted.accounts[i]?.publicKey);
      if (same && (await deps.send({type: 'vault.setKeys', accounts: derived})).ok) return 'done';
    } catch {
      // fall through to the lock
    }
    return lockAfterChange(deps.send);
  } finally {
    proven.dataKey.fill(0);
  }
}

async function lockAfterChange(send: Send): Promise<'done-locked' | 'done-not-locked'> {
  try {
    return (await send({type: 'vault.lock'})).ok ? 'done-locked' : 'done-not-locked';
  } catch {
    return 'done-not-locked';
  }
}

/**
 * Adding or removing an account (spec §2). When the background answers 'busy' (another tab changed
 * the envelope since it was read), the WHOLE flow runs once more — a fresh read and a fresh proof,
 * never a proof carried over — and then gives up ('failed'). 'stored-invalid' stops at once
 * ('damaged': re-reading cannot help). A passkey PRF output survives the retry and is zeroed at the end.
 */
async function withProvenSeed(deps: Deps, factor: ReauthFactor, change: (env: EnvelopeV1) => Named | AccountsOutcome): Promise<AccountsOutcome> {
  try {
    for (let i = 0; i < 2; i++) {
      const outcome = await attempt(deps, factor, change);
      if (outcome !== 'busy') return outcome;
    }
    return 'failed';
  } catch {
    return 'failed';
  } finally {
    if ('prfOutput' in factor) factor.prfOutput.fill(0);
  }
}

/**
 * B1b-2b E13 (D16, C6): the SLIP-0010 account at `index` — any index not in the envelope, so an account removed earlier
 * can be added again: reencryptForAccounts derives its key from the seed, so re-adding index N always yields the address
 * N had (with the default name "Account N+1": a removed account's name is not kept, review L3). Appended to the
 * envelope order (the display order is E14's). A bad index is refused before anything is read or proven; a cli wallet
 * has exactly one account. A PRF output is zeroed on every path, a bad index included.
 */
export function addAccount(deps: Deps, factor: ReauthFactor, index: number): Promise<AccountsOutcome> {
  if (!isAccountIndex(index)) {
    if ('prfOutput' in factor) factor.prfOutput.fill(0);
    return Promise.resolve('bad-index');
  }
  return withProvenSeed(deps, factor, env => {
    if (env.scheme === 'cli') return 'cli-single';
    if (env.accounts.length >= MAX_ACCOUNTS) return 'too-many-accounts';
    if (env.accounts.some(a => a.index === index)) return 'index-taken';
    return [...env.accounts.map(a => ({index: a.index, name: a.name})), {index, name: `Account ${index + 1}`}];
  });
}

/** Removing an account (D16): allowed with funds (they stay on Solana); refused by the background while a send from it is open (C5). */
export function removeAccount(deps: Deps, factor: ReauthFactor, index: number): Promise<AccountsOutcome> {
  return withProvenSeed(deps, factor, env => {
    if (!env.accounts.some(a => a.index === index)) return 'no-such-account';
    if (env.accounts.length === 1) return 'last-account';
    return env.accounts.filter(a => a.index !== index).map(a => ({index: a.index, name: a.name}));
  });
}
