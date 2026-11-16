/**
 * The A0 pool's note count — the anonymity set as a NUMBER (spec §11 "Measure, not boolean (I4)":
 * where a screen speaks of the pool's privacy at all, it shows the pool's note count, never a
 * yes/no). Read from the MerkleTree account `5URd…` (`nextLeafIndex` = the leaves the program has
 * inserted), one `getAccountInfo` of a public account every client reads — nothing of the user's.
 *
 * Replaces the v1 `poolState.fetchAnonymitySet` (the NPkc pool) for the screens. "unavailable"
 * (RPC down, no account) and "incompatible" (the account is not the layout Task 2 decodes) stay
 * apart, as the v1 reader learned to keep them.
 */
import {PublicKey} from '@solana/web3.js';
import type {Connection} from '@solana/web3.js';
import {A0} from './constants';
import {parseA0TreeAccount} from './treeAccount';

export type A0PoolNoteCount =
  | {status: 'ok'; count: number}
  | {status: 'unavailable'}
  | {status: 'incompatible'; reason: string};

export async function readA0PoolNoteCount(connection: Connection): Promise<A0PoolNoteCount> {
  let data: Uint8Array;
  try {
    const info = await connection.getAccountInfo(new PublicKey(A0.merkleTree), 'confirmed');
    if (!info || info.owner.toBase58() !== A0.programId) {
      return {status: 'unavailable'};
    }
    data = Uint8Array.from(info.data);
  } catch {
    return {status: 'unavailable'};
  }
  try {
    return {status: 'ok', count: parseA0TreeAccount(data).nextLeafIndex};
  } catch (e) {
    return {status: 'incompatible', reason: e instanceof Error ? e.message : String(e)};
  }
}
