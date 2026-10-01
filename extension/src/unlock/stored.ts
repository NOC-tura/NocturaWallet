import {checkEnvelope, type EnvelopeV1} from '../vault/envelope';
import {accountsPolicyOk} from '../shared/envelopeRules';

/**
 * What v1_vault holds, as the vault page reads it — the same three answers the background gives
 * (accountsStore: only an ABSENT key is "no wallet"; anything else stored there that is not an
 * envelope — null, an array, a string, a malformed object — is a damaged vault, `stored-invalid`).
 * Plan 1 carried the mismatch: the page read a stored null as "no wallet" (onboarding's present(),
 * accountsFlow, revealFlow, reauthFlow, the unlock page). Every page flow now reads through this one
 * function. A damaged vault is never treated as gone: onboarding refuses to write over it ('exists'),
 * and every flow that needs the envelope stops with 'damaged'. Repairing it is #37's (B1b-2b).
 *
 * Fix round 1 item 1: checkEnvelope alone is weaker than the background's envelopeShape — it never
 * checked the MAX_ACCOUNTS cap, duplicate account indexes, an empty publicKey, or a cli wallet
 * holding anything but exactly account 0. A vault the background calls stored-invalid on one of
 * those rules used to read here as a whole wallet. `accountsPolicyOk` (src/shared/envelopeRules.ts)
 * is the one predicate both sides apply, so `storedVault` now returns `wallet` only when checkEnvelope
 * AND that predicate both pass.
 */
export type StoredVault = {kind: 'none'} | {kind: 'damaged'} | {kind: 'wallet'; env: EnvelopeV1};

export function storedVault(raw: unknown): StoredVault {
  if (raw === undefined) return {kind: 'none'};
  try {
    checkEnvelope(raw);
  } catch {
    return {kind: 'damaged'};
  }
  if (!accountsPolicyOk(raw.scheme, raw.accounts)) return {kind: 'damaged'};
  return {kind: 'wallet', env: raw};
}

/**
 * The passkey a bootstrap may offer a button for — only when the stored vault reads as a whole,
 * undamaged wallet (storedVault). Fix round 1 item 2: main.ts and modes.ts (startReauth) used to
 * cast the raw storage read straight to `EnvelopeV1 | undefined` and read `.passkey` off it, which
 * would show a passkey button over a damaged vault that happened to carry a passkey-shaped field.
 * Both now call this instead.
 */
export function passkeyOf(raw: unknown): EnvelopeV1['passkey'] | undefined {
  const stored = storedVault(raw);
  return stored.kind === 'wallet' ? stored.env.passkey : undefined;
}
