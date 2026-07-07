import {getConnection} from '../solana/connection';
import {syncLeaves} from './merkleSync';
import {parseDepositEvents} from './depositEvents';
import {decToHex64} from './fieldCodec';
import {withTimeout} from '../solana/withTimeout';

/** Sentinel leaf index for a note whose on-chain index isn't known yet. */
export const UNRESOLVED_INDEX = -1;

/**
 * Best-effort, time-bounded resolution of a note's on-chain leaf index AFTER its
 * tx confirms. The tx already succeeded (submitPoolTx* confirms via HTTP polling,
 * which also surfaces on-chain errors), so this must NEVER block the flow — a
 * plain `getTransaction` on a just-confirmed tx can stall forever (RN fetch has no
 * timeout), which hung both the shield and unshield on-device.
 *
 * Strategy: the tx's own `LeafInserted` event (matched by commitment, since a
 * withdraw_with_change tx inserts a change leaf) → a resync + deterministic
 * commitment lookup → `UNRESOLVED_INDEX` if neither resolves promptly. A sentinel
 * index is backfilled from the synced leaves when the note is later spent.
 */
export async function resolveLeafIndex(
  txSignature: string,
  commitmentDec: string,
  mintBase58: string,
): Promise<number> {
  const connection = getConnection();
  const hex = decToHex64(commitmentDec);
  try {
    const tx = await withTimeout(
      connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0, commitment: 'confirmed',
      }),
      12_000, 'getTransaction',
    );
    const events = parseDepositEvents(tx?.meta?.logMessages ?? []);
    const match = events.find(e => e.commitment === hex);
    if (match) return match.leafIndex;
    if (events.length > 0) return events[0]!.leafIndex;
  } catch { /* fall through to resync */ }
  try {
    const {leaves} = await withTimeout(syncLeaves(mintBase58), 20_000, 'resync');
    const found = leaves.indexOf(hex);
    if (found >= 0) return found;
  } catch { /* fall through to sentinel */ }
  return UNRESOLVED_INDEX;
}
