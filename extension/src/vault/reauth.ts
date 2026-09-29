import {
  CorruptEnvelope, decryptMnemonic, unlockWithPassword, unlockWithPrf, UnsafeKdfParams, WrongPasskey, WrongPassword, type EnvelopeV1, type Kdf,
} from './envelope';
import {deriveSessionAccounts, type SessionAccount} from './accounts';

/**
 * Re-authentication proves the factor, not just that someone clicked (spec §2): unwrap the data
 * key, decrypt the seed, re-derive the session's accounts and require every public key to match
 * what the background holds.
 *
 * The outcomes are kept apart because the callers act on them differently: 'wrong' is a typo (retry,
 * with the wrong-password backoff); 'mismatch' means the session does not belong to this vault —
 * spec §2: "A mismatch locks the vault"; 'damaged' is a stored envelope this code could not have
 * written; 'failed' is anything else.
 *
 * An empty session fails ('mismatch'): `[].every(...)` is vacuously true, so without the length
 * guard a proof against no accounts would prove nothing. Every data key is zeroed on every path
 * except an 'ok' from openProven, which hands it to the caller.
 */
export type ReauthFactor = {password: string; kdf: Kdf} | {prfOutput: Uint8Array};
export type SessionKeys = Pick<SessionAccount, 'index' | 'publicKey'>[];
export type ReauthOutcome = 'ok' | 'wrong' | 'mismatch' | 'damaged' | 'failed';
export type Proven = {outcome: 'ok'; dataKey: Uint8Array; mnemonic: string} | {outcome: Exclude<ReauthOutcome, 'ok'>};

export function unwrapDataKey(env: EnvelopeV1, factor: ReauthFactor): Promise<Uint8Array> {
  return 'prfOutput' in factor ? unlockWithPrf(env, factor.prfOutput) : unlockWithPassword(env, factor.password, factor.kdf);
}

/** The proof, handing over the seed phrase and the data key on success (the caller zeroes the key). */
export async function openProven(env: EnvelopeV1, factor: ReauthFactor, session: SessionKeys): Promise<Proven> {
  let dataKey: Uint8Array;
  try {
    dataKey = await unwrapDataKey(env, factor);
  } catch (e) {
    if (e instanceof WrongPassword || e instanceof WrongPasskey) return {outcome: 'wrong'};
    if (e instanceof CorruptEnvelope || e instanceof UnsafeKdfParams) return {outcome: 'damaged'};
    return {outcome: 'failed'};
  }
  let handedOver = false;
  try {
    let mnemonic: string;
    try {
      mnemonic = await decryptMnemonic(env, dataKey);
    } catch {
      // The factor already unwrapped the key: a failure here is corruption, not a wrong guess.
      return {outcome: 'damaged'};
    }
    const derived = await deriveSessionAccounts(mnemonic, env.scheme, session.map(a => a.index));
    // every() walks derived, so a shorter derived would pass on a prefix: the lengths must match.
    const same = session.length > 0 && derived.length === session.length && derived.every((d, i) => d.publicKey === session[i]?.publicKey);
    if (!same) return {outcome: 'mismatch'};
    handedOver = true;
    return {outcome: 'ok', dataKey, mnemonic};
  } catch {
    return {outcome: 'failed'};
  } finally {
    if (!handedOver) dataKey.fill(0);
  }
}

export async function reauthenticate(env: EnvelopeV1, factor: ReauthFactor, session: SessionKeys): Promise<ReauthOutcome> {
  const proven = await openProven(env, factor, session);
  if (proven.outcome === 'ok') proven.dataKey.fill(0);
  return proven.outcome;
}

export async function proveWithPassword(env: EnvelopeV1, password: string, kdf: Kdf, session: SessionKeys): Promise<boolean> {
  return (await reauthenticate(env, {password, kdf}, session)) === 'ok';
}

export async function proveWithPrf(env: EnvelopeV1, prfOutput: Uint8Array, session: SessionKeys): Promise<boolean> {
  return (await reauthenticate(env, {prfOutput}, session)) === 'ok';
}
