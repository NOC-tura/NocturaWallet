import type {EnvelopeV1} from '../vault/envelope';
import {reencryptForAccounts} from '../vault/reencrypt';
import {openProven, type ReauthFactor} from '../vault/reauth';
import {deriveSessionAccounts} from '../vault/accounts';
import {envelopeRevision} from '../shared/envelopeRevision';
import {lockOnMismatch, sessionKeys} from './reauthFlow';
import type {Send, VaultStore} from './types';

export type AccountsOutcome =
  | 'done'
  | 'wrong'
  | 'mismatch-locked'
  | 'damaged'
  | 'not-unlocked'
  | 'no-wallet'
  | 'cli-single'
  | 'last-account'
  | 'no-such-account'
  | 'failed';

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
  const raw = await deps.readEnvelope();
  if (raw === undefined || raw === null) return 'no-wallet';
  const env = raw as EnvelopeV1;
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
    if (stored === 'stored-invalid') return 'damaged';
    if (stored === 'no-wallet') return 'no-wallet';
    if (stored !== 'stored') return 'failed';
    const indexes = reencrypted.accounts.map(a => a.index);
    const derived = await deriveSessionAccounts(proven.mnemonic, env.scheme, indexes);
    // The keys handed over are the ones the stored header names, account by account.
    if (derived.length !== indexes.length || derived.some((d, i) => d.publicKey !== reencrypted.accounts[i]?.publicKey)) return 'failed';
    const r = await deps.send({type: 'vault.setKeys', accounts: derived});
    return r.ok ? 'done' : 'failed';
  } finally {
    proven.dataKey.fill(0);
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

/** The next SLIP-0010 account (a cli wallet has exactly one). */
export function addAccount(deps: Deps, factor: ReauthFactor): Promise<AccountsOutcome> {
  return withProvenSeed(deps, factor, env => {
    if (env.scheme === 'cli') return 'cli-single';
    const next = Math.max(...env.accounts.map(a => a.index)) + 1;
    return [...env.accounts.map(a => ({index: a.index, name: a.name})), {index: next, name: `Account ${next + 1}`}];
  });
}

export function removeAccount(deps: Deps, factor: ReauthFactor, index: number): Promise<AccountsOutcome> {
  return withProvenSeed(deps, factor, env => {
    if (!env.accounts.some(a => a.index === index)) return 'no-such-account';
    if (env.accounts.length === 1) return 'last-account';
    return env.accounts.filter(a => a.index !== index).map(a => ({index: a.index, name: a.name}));
  });
}
