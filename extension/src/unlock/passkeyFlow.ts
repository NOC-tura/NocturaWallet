import {openProven, type ReauthFactor} from '../vault/reauth';
import {envelopeRevision} from '../shared/envelopeRevision';
import {lockOnMismatch, sessionKeys} from './reauthFlow';
import {storedVault} from './stored';
import type {Send} from './types';

export type RemovePasskeyOutcome = 'removed' | 'no-passkey' | 'busy' | 'wrong' | 'not-unlocked' | 'mismatch-locked' | 'damaged' | 'no-wallet' | 'failed';
const NAMED: readonly string[] = ['no-passkey', 'no-wallet'];

/** One attempt: read, prove against the session, send the revision proven. `retry`: the envelope moved (busy). */
async function attempt(deps: {readEnvelope(): Promise<unknown>; send: Send}, factor: ReauthFactor): Promise<RemovePasskeyOutcome | 'retry'> {
  const stored = storedVault(await deps.readEnvelope());
  if (stored.kind === 'none') return 'no-wallet';
  if (stored.kind === 'damaged') return 'damaged';
  const session = await sessionKeys(deps.send);
  if (session === null) return 'not-unlocked';
  const proven = await openProven(stored.env, factor, session);
  if (proven.outcome === 'mismatch') return lockOnMismatch(deps.send);
  if (proven.outcome !== 'ok') return proven.outcome;
  // Nothing of the proof is needed past this line: the background drops the field itself (E12).
  proven.dataKey.fill(0);
  const r = await deps.send({type: 'vault.removePasskey', expectedRevision: envelopeRevision(stored.env)});
  if (r.ok) return 'removed';
  if (r.error === 'busy') return 'retry';
  if (r.error === 'stored-invalid') return 'damaged';
  if (r.error === 'locked') return 'not-unlocked';
  return (NAMED.find(n => n === r.error) as RemovePasskeyOutcome | undefined) ?? 'failed';
}

/**
 * #6 "manage" → remove (spec B1b-2b E12, D12): the password or the passkey itself proves the wallet against the session
 * (openProven: a mismatch locks), then vault.removePasskey with the proven revision — the page sends no envelope. On
 * `busy` (another change landed) the whole flow runs once more with a fresh read and a fresh proof; a second `busy` is
 * the outcome `busy` (review L1: the wallet changed — "Start again"). A PRF output is zeroed on every path.
 */
export async function removePasskey(deps: {readEnvelope(): Promise<unknown>; send: Send}, factor: ReauthFactor): Promise<RemovePasskeyOutcome> {
  try {
    for (let i = 0; i < 2; i++) {
      const out = await attempt(deps, factor);
      if (out !== 'retry') return out;
    }
    return 'busy';
  } catch {
    return 'failed';
  } finally {
    if ('prfOutput' in factor) factor.prfOutput.fill(0);
  }
}
