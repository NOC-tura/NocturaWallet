import {decryptMnemonic, unlockWithPassword, unlockWithPrf, WrongPasskey, WrongPassword, type EnvelopeV1, type Kdf} from '../vault/envelope';
import {deriveSessionAccounts} from '../vault/accounts';

export const ENVELOPE_KEY = 'v1_vault';

/**
 * The only place the seed exists: unwrap the data key, decrypt, derive the envelope's accounts,
 * hand the background their signing keys, and let the seed go out of scope (spec §2).
 *
 * Every secret this function touches is zeroed on every exit path, success or failure:
 * `dataKey` in a `finally` around its own use, and — when the factor is a passkey PRF output —
 * `factor.prfOutput` in an outer `finally`, because the caller hands ownership of that array
 * over to this call. Any failure other than a proven-wrong password or passkey (a thrown
 * `WrongPassword`/`WrongPasskey`) comes back as `'failed'`, never as an escaping exception —
 * a corrupt envelope, a `send()` rejection, or anything else must leave the vault page able to
 * tell the person "try again" rather than crash.
 */
export async function unlockFlow(
  deps: {env: EnvelopeV1; send(m: unknown): Promise<{ok: boolean; error?: string}>},
  factor: {password: string; kdf: Kdf} | {prfOutput: Uint8Array},
): Promise<'unlocked' | 'wrong' | 'failed'> {
  const isPrf = 'prfOutput' in factor;
  try {
    let dataKey: Uint8Array;
    try {
      dataKey = isPrf ? await unlockWithPrf(deps.env, factor.prfOutput) : await unlockWithPassword(deps.env, factor.password, factor.kdf);
    } catch (e) {
      if (e instanceof WrongPassword || e instanceof WrongPasskey) return 'wrong';
      return 'failed';
    }
    try {
      const mnemonic = await decryptMnemonic(deps.env, dataKey);
      const indexes = deps.env.accounts.length ? deps.env.accounts.map(a => a.index) : [0];
      const accounts = await deriveSessionAccounts(mnemonic, deps.env.scheme, indexes);
      const r = await deps.send({type: 'vault.setKeys', accounts});
      return r.ok ? 'unlocked' : 'failed';
    } catch {
      return 'failed';
    } finally {
      dataKey.fill(0);
    }
  } finally {
    if (isPrf) factor.prfOutput.fill(0);
  }
}
