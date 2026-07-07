import {deriveShieldedViewKey} from '../keyDerivation/shielded';
import {getPkRecipientHash} from './shieldedIdentity';

export interface ShieldedViewSession {
  skView: Uint8Array;
  pkH: bigint;
}

let _session: ShieldedViewSession | null = null;

/**
 * Cache the (view-only) scan keys for this session.
 *
 * sk_view is the BLS12-381 view key (EIP-2333 path m/12381/371/2/0). It is
 * view-only — it cannot authorize spends — and is already JS-resident by the
 * wallet's view-key model. Populated once at secure-store unlock so note
 * scanning on every dashboard focus does not require a keychain round-trip.
 * Cleared on session lock via clearShieldedViewSession().
 *
 * ⛔ NEVER call this with sk_spend. This file must not import or reference any
 *    spend-key derivation. sk_spend lives exclusively in native code.
 */
export function setShieldedViewSession(seed: Uint8Array): void {
  _session = {skView: deriveShieldedViewKey(seed), pkH: getPkRecipientHash(seed)};
}

export function getShieldedViewSession(): ShieldedViewSession | null {
  return _session;
}

export function clearShieldedViewSession(): void {
  _session = null;
}
