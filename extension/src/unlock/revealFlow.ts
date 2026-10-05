import type {Kdf} from '../vault/envelope';
import {openProven} from '../vault/reauth';
import {lockOnMismatch, sessionKeys} from './reauthFlow';
import {storedVault} from './stored';
import type {Send} from './types';

export type RevealOutcome =
  | {outcome: 'shown'; words: string[]}
  | {outcome: 'wrong' | 'not-unlocked' | 'mismatch-locked' | 'damaged' | 'no-wallet' | 'failed'};

/**
 * Spec §2 "Showing the seed phrase": only in the tab, only after re-authentication, in the vault
 * page, no copy to clipboard. The proof is re-authentication's (a mismatch locks the vault); the data
 * key is zeroed at once; the phrase leaves this function only as words for the page to render —
 * nothing of it is sent to the background, logged or stored.
 */
export async function runReveal(deps: {readEnvelope(): Promise<unknown>; send: Send}, factor: {password: string; kdf: Kdf}): Promise<RevealOutcome> {
  // B1b-2b E16 (D23): the phrase is opened by the PASSWORD only — never by a passkey, whose holder would gain permanent
  // access that survives removing it (E12) or changing the password (E10). Refused at the function boundary, before any
  // envelope is read, whatever a caller cast past the type; a PRF output handed in anyway is zeroed.
  // Fix round 1 (review I1): refused on the key's PRESENCE — the test unwrapDataKey itself uses — not on its value
  // (`prfOutput: undefined`, or a getter that answers undefined once, passed a value check); the value is read once.
  const cast = factor as unknown as {prfOutput?: unknown};
  if ('prfOutput' in cast) {
    const prf = cast.prfOutput;
    if (prf instanceof Uint8Array) prf.fill(0);
    return {outcome: 'failed'};
  }
  // Each member read once, into a fresh object: openProven never sees the caller's object, so nothing the caller
  // controls (a getter, a proxy's `has`) can steer it onto the passkey path after this check.
  const password: unknown = factor.password;
  const kdf: unknown = factor.kdf;
  if (typeof password !== 'string' || typeof kdf !== 'function') return {outcome: 'failed'};
  const byPassword = {password, kdf: kdf as Kdf};
  try {
    const stored = storedVault(await deps.readEnvelope());
    if (stored.kind === 'none') return {outcome: 'no-wallet'};
    if (stored.kind === 'damaged') return {outcome: 'damaged'};
    const session = await sessionKeys(deps.send);
    if (session === null) return {outcome: 'not-unlocked'};
    const proven = await openProven(stored.env, byPassword, session);
    if (proven.outcome === 'mismatch') return {outcome: await lockOnMismatch(deps.send)};
    if (proven.outcome !== 'ok') return {outcome: proven.outcome};
    proven.dataKey.fill(0);
    return {outcome: 'shown', words: proven.mnemonic.split(' ')};
  } catch {
    return {outcome: 'failed'};
  }
}

/**
 * The verify check passed (B1b-2b E15, §3.5): the background records `phraseVerifiedAt`. True when it says so. Nothing of
 * the phrase is sent — only the fact.
 */
export async function recordVerified(send: Send): Promise<boolean> {
  try {
    return (await send({type: 'vault.phraseVerified'})).ok;
  } catch {
    return false;
  }
}
