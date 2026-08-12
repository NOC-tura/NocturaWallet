import {PublicKey} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {poolPda, merkleTreePda} from './poolPdas';
import {MerkleTreeLayoutError, assertMerkleTreeAccount} from './merkleTreeAccount';

/**
 * MerkleTree zero-copy layout: 8-byte anchor discriminator, then
 * next_leaf_index: u64 (LE). The anonymity set = number of leaves inserted so far.
 *
 * The account shape is asserted rather than assumed — `length >= 16` was a proxy
 * for the layout, and a longer or reordered account would have yielded a
 * perfectly plausible leaf count read from the wrong offset.
 */
export function parseNextLeafIndex(data: Uint8Array): number {
  assertMerkleTreeAccount(data);
  let n = 0n;
  for (let i = 0; i < 8; i++) n |= BigInt(data[8 + i]!) << BigInt(8 * i);
  return Number(n);
}

export type AnonymitySet =
  | {status: 'ok'; count: number}
  /** RPC failed, or the pool does not exist. Transient or not-our-problem. */
  | {status: 'unavailable'}
  /** The account is not the shape we parse — a redeploy moved it. NOT transient. */
  | {status: 'incompatible'; reason: string};

/**
 * Read the pool's anonymity set, keeping "the network hiccuped" and "the program
 * was redeployed with a different layout" apart.
 *
 * They used to be one `catch { return null }`, which made a permanent,
 * app-breaking condition indistinguishable from a blip — so nobody would ever
 * look. The second is the one worth acting on.
 */
export async function readAnonymitySet(mint: string): Promise<AnonymitySet> {
  let data: Uint8Array;
  try {
    const pool = poolPda(new PublicKey(mint));
    const merkle = merkleTreePda(pool);
    const info = await getConnection().getAccountInfo(merkle);
    if (!info) return {status: 'unavailable'};
    data = Uint8Array.from(info.data);
  } catch {
    return {status: 'unavailable'};
  }
  try {
    return {status: 'ok', count: parseNextLeafIndex(data)};
  } catch (e) {
    if (e instanceof MerkleTreeLayoutError) {
      return {status: 'incompatible', reason: e.message};
    }
    return {status: 'unavailable'};
  }
}

/**
 * Back-compat shim for the Dashboard, which renders the line only when a number
 * is present and has no `.catch` on the call.
 *
 * NOTE, stated rather than buried: this COLLAPSES `incompatible` back into null,
 * so at the only call site today the distinction above is computed and then
 * discarded. That is deliberate — surfacing "this build cannot read the shielded
 * pool any more" is a UI decision, not a parsing one — but it means the
 * `incompatible` branch is currently proven by tests and not by use.
 */
export async function fetchAnonymitySet(mint: string): Promise<number | null> {
  const r = await readAnonymitySet(mint);
  return r.status === 'ok' ? r.count : null;
}
