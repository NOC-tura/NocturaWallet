import type {Connection} from '@solana/web3.js';

/**
 * Thrown when a screen unmounts (or the user navigates away) between deciding
 * to submit and actually broadcasting. Callers treat it as "abandon quietly",
 * never as a failure the user should retry.
 */
export class CancelledError extends Error {
  constructor() {
    super('submit cancelled');
    this.name = 'CancelledError';
  }
}

export interface LandedSignature {
  signature: string;
  slot: number | null;
}

/**
 * Return the first of `signatures` that is on-chain AND succeeded, or null.
 *
 * Guards the retry path against double-sending. A send can be reported as
 * failed while the transaction is still in flight (a connection reset after the
 * RPC accepted it, a blockhash-expiry timeout, a status poll that misses a tx
 * older than the RPC's status cache). Re-broadcasting then produces a SECOND
 * distinct signature, and both can land — the user pays twice.
 *
 * Call this before any re-broadcast and adopt the returned signature instead of
 * submitting again.
 *
 * Fail-safe direction: anything uncertain (RPC error, `processed` only, a
 * landed-but-reverted tx) returns null, i.e. "not landed, retrying is allowed".
 * A landed-but-reverted tx moved no funds, so retrying it is correct.
 */
export async function findLandedSignature(
  connection: Connection,
  signatures: string[],
): Promise<LandedSignature | null> {
  for (const signature of signatures) {
    try {
      const status = await connection.getSignatureStatus(signature);
      const value = status?.value;
      if (!value) continue;
      // Check err FIRST: a landed-but-failed tx has both err and a
      // confirmationStatus, and must never be reported as a success.
      if (value.err) continue;
      if (value.confirmationStatus === 'confirmed' || value.confirmationStatus === 'finalized') {
        return {signature, slot: value.slot ?? null};
      }
    } catch {
      // An RPC failure tells us nothing — keep looking, never claim it landed.
    }
  }
  return null;
}
