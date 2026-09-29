import {
  CorruptEnvelope, decryptMnemonic, unlockWithPassword, unlockWithPrf, UnsafeKdfParams, WrongPasskey, WrongPassword, type EnvelopeV1, type Kdf,
} from '../vault/envelope';
import {deriveSessionAccounts} from '../vault/accounts';

export const ENVELOPE_KEY = 'v1_vault';

/**
 * The only place the seed exists: unwrap the data key, decrypt, derive the envelope's accounts,
 * hand the background their signing keys, and let the seed go out of scope (spec §2).
 *
 * Every secret this function touches is zeroed on every exit path, success or failure:
 * `dataKey` in a `finally` around its own use, and — when the factor is a passkey PRF output —
 * `factor.prfOutput` in an outer `finally`, because the caller hands ownership of that array
 * over to this call. A proven-wrong password or passkey (a thrown `WrongPassword`/
 * `WrongPasskey`) is `'wrong'`; a stored envelope that is malformed (`CorruptEnvelope`) or
 * declares an Argon2id cost outside the bounds (`UnsafeKdfParams`) is `'damaged'` before the
 * factor is ever checked — and so is ANY `decryptMnemonic` failure once the factor has already
 * unwrapped the data key: past that point the factor is proven correct, so a bad AES-GCM tag
 * can only mean the stored envelope was tampered with or corrupted, never a wrong guess. Both
 * are a failure, with nothing sent and no wrong-password backoff, that the page names as
 * damaged data rather than inviting another try; anything else after that (a mismatched
 * derived key, a `send()` rejection, …) comes back as `'failed'`, never as an escaping
 * exception.
 */
export async function unlockFlow(
  deps: {env: EnvelopeV1; send(m: unknown): Promise<{ok: boolean; error?: string}>},
  factor: {password: string; kdf: Kdf} | {prfOutput: Uint8Array},
): Promise<'unlocked' | 'wrong' | 'failed' | 'damaged'> {
  const isPrf = 'prfOutput' in factor;
  try {
    let dataKey: Uint8Array;
    try {
      dataKey = isPrf ? await unlockWithPrf(deps.env, factor.prfOutput) : await unlockWithPassword(deps.env, factor.password, factor.kdf);
    } catch (e) {
      if (e instanceof WrongPassword || e instanceof WrongPasskey) return 'wrong';
      if (e instanceof CorruptEnvelope || e instanceof UnsafeKdfParams) return 'damaged';
      return 'failed';
    }
    try {
      let mnemonic: string;
      try {
        mnemonic = await decryptMnemonic(deps.env, dataKey);
      } catch {
        // The factor is already proven right (the unwrap above succeeded): any failure here —
        // a bad AES-GCM tag, an AAD that no longer matches the stored header — is corruption or
        // tampering, not a wrong guess. Every decryptMnemonic error counts, not just
        // CorruptEnvelope/UnsafeKdfParams (checkEnvelope's own throws): AES-GCM's own tag
        // check throws a plain error, not one of those two.
        return 'damaged';
      }
      try {
        const indexes = deps.env.accounts.length ? deps.env.accounts.map(a => a.index) : [0];
        const accounts = await deriveSessionAccounts(mnemonic, deps.env.scheme, indexes);
        // The derived keys must be the ones the envelope records for this wallet, account by
        // account; otherwise nothing is sent. (An envelope with no stored accounts has nothing
        // to compare against and derives account 0, as before.)
        const stored = deps.env.accounts;
        if (stored.length > 0 && (accounts.length !== stored.length || accounts.some((a, i) => a.publicKey !== stored[i]?.publicKey))) {
          return 'failed';
        }
        const r = await deps.send({type: 'vault.setKeys', accounts});
        return r.ok ? 'unlocked' : 'failed';
      } catch {
        return 'failed';
      }
    } finally {
      dataKey.fill(0);
    }
  } finally {
    if (isPrf) factor.prfOutput.fill(0);
  }
}
