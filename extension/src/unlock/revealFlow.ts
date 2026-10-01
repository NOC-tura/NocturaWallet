import {openProven, type ReauthFactor} from '../vault/reauth';
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
export async function runReveal(deps: {readEnvelope(): Promise<unknown>; send: Send}, factor: ReauthFactor): Promise<RevealOutcome> {
  try {
    const stored = storedVault(await deps.readEnvelope());
    if (stored.kind === 'none') return {outcome: 'no-wallet'};
    if (stored.kind === 'damaged') return {outcome: 'damaged'};
    const session = await sessionKeys(deps.send);
    if (session === null) return {outcome: 'not-unlocked'};
    const proven = await openProven(stored.env, factor, session);
    if (proven.outcome === 'mismatch') return {outcome: await lockOnMismatch(deps.send)};
    if (proven.outcome !== 'ok') return {outcome: proven.outcome};
    proven.dataKey.fill(0);
    return {outcome: 'shown', words: proven.mnemonic.split(' ')};
  } catch {
    return {outcome: 'failed'};
  } finally {
    if ('prfOutput' in factor) factor.prfOutput.fill(0);
  }
}
