import {checkEnvelope, type EnvelopeV1} from '../vault/envelope';

/**
 * What v1_vault holds, as the vault page reads it — the same three answers the background gives
 * (accountsStore: only an ABSENT key is "no wallet"; anything else stored there that is not an
 * envelope — null, an array, a string, a malformed object — is a damaged vault, `stored-invalid`).
 * Plan 1 carried the mismatch: the page read a stored null as "no wallet" (onboarding's present(),
 * accountsFlow, revealFlow, reauthFlow, the unlock page). Every page flow now reads through this one
 * function. A damaged vault is never treated as gone: onboarding refuses to write over it ('exists'),
 * and every flow that needs the envelope stops with 'damaged'. Repairing it is #37's (B1b-2b).
 */
export type StoredVault = {kind: 'none'} | {kind: 'damaged'} | {kind: 'wallet'; env: EnvelopeV1};

export function storedVault(raw: unknown): StoredVault {
  if (raw === undefined) return {kind: 'none'};
  try {
    checkEnvelope(raw);
    return {kind: 'wallet', env: raw};
  } catch {
    return {kind: 'damaged'};
  }
}
