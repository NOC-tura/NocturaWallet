import {reauthenticate, type ReauthFactor, type SessionKeys} from '../vault/reauth';
import {storedVault} from './stored';
import type {Send} from './types';

export type ReauthPageOutcome = 'confirmed' | 'wrong' | 'not-unlocked' | 'mismatch-locked' | 'expired' | 'damaged' | 'no-wallet' | 'failed';

/** The session's PUBLIC keys, from vault.status — never its secret keys. Null while locked. */
export async function sessionKeys(send: Send): Promise<SessionKeys | null> {
  const r = await send({type: 'vault.status'});
  const d = r.ok && typeof r.data === 'object' && r.data !== null ? (r.data as {unlocked?: unknown; accounts?: unknown}) : null;
  if (d === null || d.unlocked !== true || !Array.isArray(d.accounts)) return null;
  const out: SessionKeys = [];
  for (const a of d.accounts as unknown[]) {
    if (typeof a !== 'object' || a === null) return null;
    const {index, publicKey} = a as {index?: unknown; publicKey?: unknown};
    if (typeof index !== 'number' || !Number.isSafeInteger(index) || typeof publicKey !== 'string') return null;
    out.push({index, publicKey});
  }
  return out.length > 0 ? out : null;
}

/**
 * Spec §2: a proof mismatch — the factor opened this vault, but the session holds keys that are not
 * its keys — locks the vault. Reported as locked only when the background says it did.
 */
export async function lockOnMismatch(send: Send): Promise<'mismatch-locked' | 'failed'> {
  const r = await send({type: 'vault.lock'});
  return r.ok ? 'mismatch-locked' : 'failed';
}

/**
 * Re-authentication in the vault page (brief decision 6): prove the factor against the session's
 * public keys, then tell the background which challenge was proven. A mismatch locks the vault.
 * The data key is zeroed inside reauthenticate; a passkey PRF output is zeroed here on every path.
 */
export async function runReauth(
  deps: {readEnvelope(): Promise<unknown>; send: Send},
  challengeId: string,
  factor: ReauthFactor,
): Promise<ReauthPageOutcome> {
  try {
    const stored = storedVault(await deps.readEnvelope());
    if (stored.kind === 'none') return 'no-wallet';
    if (stored.kind === 'damaged') return 'damaged';
    const session = await sessionKeys(deps.send);
    if (session === null) return 'not-unlocked';
    const outcome = await reauthenticate(stored.env, factor, session);
    if (outcome === 'mismatch') return await lockOnMismatch(deps.send);
    if (outcome !== 'ok') return outcome;
    const r = await deps.send({type: 'vault.reauthOk', challengeId});
    if (r.ok) return 'confirmed';
    // D39: the challenge expired (or was discarded) while the password was typed — #10's `expired`,
    // never `failed`. A lock that landed after the status read is `not-unlocked`.
    if (r.error === 'unknown-challenge') return 'expired';
    if (r.error === 'locked') return 'not-unlocked';
    return 'failed';
  } catch {
    return 'failed';
  } finally {
    if ('prfOutput' in factor) factor.prfOutput.fill(0);
  }
}
