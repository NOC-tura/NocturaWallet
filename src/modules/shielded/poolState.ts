import {PublicKey} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {poolPda, merkleTreePda} from './poolPdas';

/**
 * MerkleTree zero-copy layout: 8-byte anchor discriminator, then
 * next_leaf_index: u64 (LE). The anonymity set = number of leaves inserted so far.
 */
export function parseNextLeafIndex(data: Uint8Array): number {
  if (data.length < 16) throw new Error('merkle_tree account too short');
  let n = 0n;
  for (let i = 0; i < 8; i++) n |= BigInt(data[8 + i]!) << BigInt(8 * i);
  return Number(n);
}

/** Fetch the pool's anonymity set (merkle leaf count) for `mint`, or null on RPC error. */
export async function fetchAnonymitySet(mint: string): Promise<number | null> {
  try {
    const pool = poolPda(new PublicKey(mint));
    const merkle = merkleTreePda(pool);
    const info = await getConnection().getAccountInfo(merkle);
    if (!info) return null;
    return parseNextLeafIndex(Uint8Array.from(info.data));
  } catch {
    return null;
  }
}
