import {decryptMnemonic, unlockWithPassword, unlockWithPrf, type EnvelopeV1, type Kdf} from './envelope';
import {deriveSessionAccounts, type SessionAccount} from './accounts';

/**
 * Re-authentication proves the factor, not just that someone clicked (spec §2): unwrap the
 * data key, decrypt the seed, re-derive the session's accounts and require every public key
 * to match what the background holds. A mismatch is a failed proof.
 *
 * An empty session must fail: `[].every(...)` is vacuously true, so without the explicit
 * length guard a caller that (by bug or by attacker-controlled input) passes no accounts to
 * check against would get `true` back for ANY session, including an empty one — a proof that
 * proves nothing. The dataKey is zeroed in `finally` so it is wiped on every exit path,
 * including when `decryptMnemonic` throws (a bad IV/ciphertext, or a swapped envelope).
 */
async function matches(env: EnvelopeV1, dataKey: Uint8Array, session: SessionAccount[]): Promise<boolean> {
  try {
    const mnemonic = await decryptMnemonic(env, dataKey);
    // every() walks derived, so a shorter derived would pass on a prefix of the session;
    // the length check keeps the proof from resting on deriveSessionAccounts' invariant.
    const derived = await deriveSessionAccounts(mnemonic, env.scheme, session.map(a => a.index));
    return session.length > 0 && derived.length === session.length && derived.every((d, i) => d.publicKey === session[i]?.publicKey);
  } finally {
    dataKey.fill(0);
  }
}

export async function proveWithPassword(env: EnvelopeV1, password: string, kdf: Kdf, session: SessionAccount[]): Promise<boolean> {
  try {
    return await matches(env, await unlockWithPassword(env, password, kdf), session);
  } catch {
    return false;
  }
}

export async function proveWithPrf(env: EnvelopeV1, prfOutput: Uint8Array, session: SessionAccount[]): Promise<boolean> {
  try {
    return await matches(env, await unlockWithPrf(env, prfOutput), session);
  } catch {
    return false;
  }
}
