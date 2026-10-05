import {WrongPassword, rewrapPassword, unlockWithPassword, type EnvelopeV1, type Kdf} from '../vault/envelope';
import {openProven} from '../vault/reauth';
import {envelopeRevision} from '../shared/envelopeRevision';
import {MIN_PASSWORD_LENGTH} from './onboarding';
import {lockOnMismatch, sessionKeys} from './reauthFlow';
import {storedVault} from './stored';
import type {Send} from './types';

/**
 * #36 change password (spec B1b-2b E10, D8, C2, C20): the vault page's half of vault.changePassword.
 *
 * Step 1 proves the CURRENT password against the session (openProven: a mismatch locks) and yields the data key —
 * held by the screen until step 3 sends, and zeroed on `pagehide`, on leave, after success and at the 5-minute TTL
 * (C20; the screen owns that). Password only (D8): a passkey holder must not take over the password. The phrase that
 * openProven also returns is dropped at once — its reference is neither kept nor returned (a JS string cannot be
 * zeroed; dropping it is the most this can do).
 */
export interface HeldProof {
  /** The envelope the proof opened (a private copy). */
  readonly env: EnvelopeV1;
  /** envelopeRevision(env): what vault.changePassword compares (a concurrent change answers `busy`). */
  readonly revision: string;
  /** The data key. Zeroed by changePassword on every path, or by the screen when it drops the proof. */
  readonly dataKey: Uint8Array;
}

export type ProveOutcome = {outcome: 'proven'; held: HeldProof} | {outcome: 'wrong' | 'not-unlocked' | 'mismatch-locked' | 'damaged' | 'no-wallet' | 'failed'};

/** Step 1: the current password, proven against the session. Never a passkey (D8). */
export async function proveCurrent(deps: {readEnvelope(): Promise<unknown>; send: Send}, password: string, kdf: Kdf): Promise<ProveOutcome> {
  try {
    const stored = storedVault(await deps.readEnvelope());
    if (stored.kind === 'none') return {outcome: 'no-wallet'};
    if (stored.kind === 'damaged') return {outcome: 'damaged'};
    const session = await sessionKeys(deps.send);
    if (session === null) return {outcome: 'not-unlocked'};
    const env = structuredClone(stored.env);
    const proven = await openProven(env, {password, kdf}, session);
    if (proven.outcome === 'mismatch') return {outcome: await lockOnMismatch(deps.send)};
    if (proven.outcome !== 'ok') return {outcome: proven.outcome};
    // Only the data key is kept: `proven.mnemonic` is not read past this line.
    const held: HeldProof = Object.freeze({env: Object.freeze(env), revision: envelopeRevision(env), dataKey: proven.dataKey});
    return {outcome: 'proven', held};
  } catch {
    return {outcome: 'failed'};
  }
}

/**
 * Step 2's `same` check (rev 2, review H2): is `candidate` the CURRENT password? One Argon2id over the candidate with
 * the STORED salt and cost, then the stored wrap: it opens → true; AES-KW refuses → false. Nothing of either password
 * is kept to compare strings; the KEK and the unwrapped key are zeroed (unlockWithPassword zeroes its KEK). Never
 * charged to the backoff (rev 3, review L1): a `true` is the expected way to O02, not a wrong attempt.
 */
export async function isCurrentPassword(env: EnvelopeV1, candidate: string, kdf: Kdf): Promise<boolean> {
  let key: Uint8Array;
  try {
    key = await unlockWithPassword(env, candidate, kdf);
  } catch (e) {
    if (e instanceof WrongPassword) return false;
    throw e;
  }
  key.fill(0);
  return true;
}

/** vault.changePassword's refusals as the page names them, plus `weak-password` (never sent) and `failed`. */
export type ChangeOutcome = 'changed' | 'weak-password' | 'locked' | 'busy' | 'no-wallet' | 'damaged' | 'failed';
const NAMED: readonly string[] = ['locked', 'busy', 'no-wallet'];

/**
 * Step 3: the new password wraps the same data key (rewrapPassword proves the new wrap before it is sent), and the
 * background stores exactly `{kdf.salt, password.wrapped}` changed over the revision step 1 proved (its own rule,
 * onlyPasswordChanged). The data key is zeroed on every path — after this call the proof is spent.
 */
export async function changePassword(deps: {send: Send; kdf: Kdf}, held: HeldProof, newPassword: string): Promise<ChangeOutcome> {
  try {
    if (newPassword.length < MIN_PASSWORD_LENGTH) return 'weak-password';
    const {salt, wrapped} = await rewrapPassword(held.env, held.dataKey, newPassword, deps.kdf);
    const next: EnvelopeV1 = {...held.env, kdf: {...held.env.kdf, salt}, password: {wrapped}};
    const r = await deps.send({type: 'vault.changePassword', expectedRevision: held.revision, envelope: next});
    if (r.ok) return 'changed';
    if (r.error === 'stored-invalid') return 'damaged';
    return (NAMED.find(n => n === r.error) as ChangeOutcome | undefined) ?? 'failed';
  } catch {
    return 'failed';
  } finally {
    held.dataKey.fill(0);
  }
}
