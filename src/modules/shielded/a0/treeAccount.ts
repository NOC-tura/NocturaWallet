/* eslint-disable no-bitwise -- byte-level decoding is what this file is about */
/**
 * The A0 MerkleTree account `5URd…` (spec §1 "MerkleTree account (3352 bytes)", §9 checks),
 * decoded from its raw bytes. Offsets are the program side's facts (`A0_MERKLE_TREE`); every
 * VALUE in it (zeros, roots) is compared by the tree sync with what the wallet computes, never
 * consumed as an input to a proof.
 *
 * Exact size and the IDL's account discriminator, not `length >= needed`: a longer or reordered
 * account would return plausible values from the wrong place (the lesson of the v1
 * merkleTreeAccount guard, kept here; the v1 module itself is deleted in M1b Task 6).
 */
import {A0_MERKLE_TREE} from './constants';
import {A0SyncError} from './syncErrors';

export interface A0TreeAccount {
  /** the number of leaves the program has inserted */
  nextLeafIndex: number;
  /** zeros[0..19], 64-char BE hex — zeros[0] is the zero leaf */
  zeros: string[];
  /** filled_subtrees[0..19], BE hex */
  filledSubtrees: string[];
  /** the 64-entry ring, BE hex, in slot order (not age order) */
  rootHistory: string[];
  /** index of the newest root in rootHistory */
  rootHistoryHead: number;
}

const hex = (b: Uint8Array): string => {
  let s = '';
  for (const x of b) {
    s += x.toString(16).padStart(2, '0');
  }
  return s;
};

function readU64(data: Uint8Array, at: number): bigint {
  let v = 0n;
  for (let i = 7; i >= 0; i--) {
    v = (v << 8n) | BigInt(data[at + i]!);
  }
  return v;
}

function read32s(data: Uint8Array, at: number, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(hex(data.subarray(at + 32 * i, at + 32 * (i + 1))));
  }
  return out;
}

/** Decode the account, or throw `A0SyncError('E_A0_TREE_LAYOUT')`. */
export function parseA0TreeAccount(data: Uint8Array): A0TreeAccount {
  const L = A0_MERKLE_TREE;
  if (data.length !== L.size) {
    throw new A0SyncError(
      'E_A0_TREE_LAYOUT',
      `MerkleTree account is ${data.length} bytes, expected exactly ${L.size}`,
    );
  }
  const disc = hex(data.subarray(0, 8));
  if (disc !== L.discriminator) {
    throw new A0SyncError(
      'E_A0_TREE_LAYOUT',
      `account discriminator ${disc} is not MerkleTree's ${L.discriminator}`,
    );
  }
  const next = readU64(data, L.offsets.nextLeafIndex);
  if (next > 1n << BigInt(L.depth)) {
    throw new A0SyncError('E_A0_TREE_LAYOUT', `nextLeafIndex ${next} exceeds 2^${L.depth}`);
  }
  const head = data[L.offsets.rootHistoryHead]! | (data[L.offsets.rootHistoryHead + 1]! << 8);
  if (head >= L.rootHistoryLen) {
    throw new A0SyncError('E_A0_TREE_LAYOUT', `rootHistoryHead ${head} ≥ ${L.rootHistoryLen}`);
  }
  return {
    nextLeafIndex: Number(next),
    zeros: read32s(data, L.offsets.zeros, L.depth),
    filledSubtrees: read32s(data, L.offsets.filledSubtrees, L.depth),
    rootHistory: read32s(data, L.offsets.rootHistory, L.rootHistoryLen),
    rootHistoryHead: head,
  };
}
