import {storedDigest} from '../shared/storedDigest';
import {vaultReading} from './stored';
import type {Send} from './types';

/**
 * The removal's outcome as the screen names it: `changed` is the page's own compare failing (the value stored now is not
 * the one shown — nothing is sent) and the background's `busy` (it changed between the click and the removal).
 */
export type RemoveDamagedOutcome = 'removed' | 'changed' | 'not-unreadable' | 'no-wallet' | 'send-open' | 'unlocked' | 'failed';
const NAMED: readonly RemoveDamagedOutcome[] = ['not-unreadable', 'no-wallet', 'send-open', 'unlocked'];

/**
 * The vault page's half of vault.forgetDamaged (B1e §2.4) and its one builder of the message. Only the removal screen
 * (screens/removeDamaged.ts) imports this module — a source test holds it there. At the click it reads v1_vault again
 * and sends only when the value stored now is still unreadable on this page's reading AND has the digest the screen
 * showed (`shownDigest`); otherwise nothing is sent. The page's judgement never decides: the background re-reads and
 * re-judges with the frozen predicate before it removes anything.
 */
export async function removeDamaged(deps: {send: Send; readEnvelope(): Promise<unknown>}, shownDigest: string): Promise<RemoveDamagedOutcome> {
  let raw: unknown;
  try {
    raw = await deps.readEnvelope();
  } catch {
    return 'failed';
  }
  if (raw === undefined) return 'no-wallet';
  if (vaultReading(raw).kind !== 'unreadable') return 'not-unreadable';
  if (storedDigest(raw) !== shownDigest) return 'changed';
  try {
    const r = await deps.send({type: 'vault.forgetDamaged', expectedDigest: shownDigest});
    if (r.ok) return 'removed';
    if (r.error === 'busy') return 'changed';
    return NAMED.find(n => n === r.error) ?? 'failed';
  } catch {
    return 'failed';
  }
}
