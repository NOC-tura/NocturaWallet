import {PublicKey} from '@solana/web3.js';
import {nullifier, mintHash, pkRecipientHash, noteCommitment} from './noteCrypto';
import {getPkRecipientHash} from './shieldedIdentity';
import {computeMerklePath} from '../merkle/merkleModule';
import {decToBe32, hexToDec} from './fieldCodec';
import type {ShieldedProveParams} from '../zkProver/types';
import type {ShieldedNote} from './types';

const DEPTH = 20;

export interface TransferWitnessInput {
  seed: Uint8Array;
  realInputs: ShieldedNote[]; // 1 or 2, leafIndex already resolved
  recipientViewKeyG1: Uint8Array; // 48-B recipient view key
  mint: string;
  transferAmount: bigint;
  leaves: string[]; // hex, from syncLeaves
  outNoteSecrets: [bigint, bigint]; // fresh random (out_0 recipient, out_1 change)
  dummyNoteSecret: bigint; // fresh random (dummy input, if 1 real)
}

export interface TransferOutRef {
  commitment: string;
  amount: bigint;
  noteSecret: bigint;
}

export interface TransferWitness {
  params: ShieldedProveParams;
  merkleRoot32: Uint8Array; // 32-B root — ix arg + on-chain root-membership guard
  nullifier32: [Uint8Array, Uint8Array];
  outCommitment32: [Uint8Array, Uint8Array];
  outCommitmentDec: [string, string];
  // Typed decimals for the full public-input cross-check in transferFlow (params
  // is a loose Record, so these give type-safe access). Order-aligned with the
  // circuit's public signals: [merkleRoot, nullifier_0/1, outCommitment_0/1, mintHash].
  merkleRootDec: string;
  nullifierDec: [string, string];
  mintHashDec: string;
  recipientOut: TransferOutRef; // out_0 — encrypt to recipient (NOT stored by sender)
  changeOut: TransferOutRef; // out_1 — self change (encrypt to self + store locally)
  change: bigint;
}

/**
 * Build the 2-in/2-out transfer witness. Inputs are all owned by the sender; a
 * 1-real-input transfer pads input 1 with a dummy (isDummy=1, amount 0, fresh
 * random noteSecret -> unique nullifier, unchecked path). out_0 = recipient
 * (their address view key), out_1 = self change. Value conserved: Sum(in) = out_0+out_1.
 *
 * transfer.circom signals (exact):
 *   PUBLIC:  merkleRoot, nullifier_0, nullifier_1, outCommitment_0,
 *            outCommitment_1, mintHash
 *   PRIVATE: in_noteSecret[2], in_pkRecipientHash[2], in_amount[2],
 *            in_leafIndex[2], in_merklePath[2][20], in_merklePathIndices[2][20],
 *            in_isDummy[2], out_pkRecipientHash[2], out_amount[2], out_noteSecret[2]
 *
 * merklePath/merklePathIndices are decimal-string arrays (indices as '0'/'1',
 * LSB-first) — same encoding as the withdraw witnesses.
 */
export function buildTransferWitness(input: TransferWitnessInput): TransferWitness {
  const {seed, realInputs, recipientViewKeyG1, mint, transferAmount, leaves, outNoteSecrets, dummyNoteSecret} = input;
  if (realInputs.length < 1 || realInputs.length > 2) {
    throw new Error('transfer takes 1 or 2 real inputs');
  }
  const pkHself = getPkRecipientHash(seed);
  const mH = mintHash(new PublicKey(mint).toBytes());

  const inNoteSecret: string[] = [];
  const inPkH: string[] = [];
  const inAmount: string[] = [];
  const inLeafIndex: string[] = [];
  const inMerklePath: string[][] = [];
  const inMerklePathIndices: string[][] = [];
  const inIsDummy: string[] = [];
  const nulls: bigint[] = [];
  let totalIn = 0n;
  let rootDec = '';

  for (let i = 0; i < 2; i++) {
    const real = realInputs[i];
    if (real) {
      const {root, siblings, pathIndices} = computeMerklePath(leaves, real.index);
      rootDec = hexToDec(root);
      nulls.push(nullifier({noteSecret: BigInt(real.noteSecret), leafIndex: real.index}));
      inNoteSecret.push(BigInt(real.noteSecret).toString());
      inPkH.push(pkHself.toString());
      inAmount.push(real.amount.toString());
      inLeafIndex.push(real.index.toString());
      inMerklePath.push(siblings.map(hexToDec));
      inMerklePathIndices.push(pathIndices.map(b => b.toString()));
      inIsDummy.push('0');
      totalIn += real.amount;
    } else {
      nulls.push(nullifier({noteSecret: dummyNoteSecret, leafIndex: 0}));
      inNoteSecret.push(dummyNoteSecret.toString());
      inPkH.push(pkHself.toString());
      inAmount.push('0');
      inLeafIndex.push('0');
      inMerklePath.push(new Array<string>(DEPTH).fill('0'));
      inMerklePathIndices.push(new Array<string>(DEPTH).fill('0'));
      inIsDummy.push('1');
    }
  }

  if (transferAmount < 0n || transferAmount > totalIn) {
    throw new Error(`transferAmount ${transferAmount} out of range (0..${totalIn})`);
  }
  const change = totalIn - transferAmount;

  const recipPkH = pkRecipientHash(recipientViewKeyG1);
  const outPkH = [recipPkH, pkHself];
  const outAmount = [transferAmount, change];
  const outCommitment = [
    noteCommitment({pkRecipientHash: recipPkH, amount: transferAmount, mintHash: mH, noteSecret: outNoteSecrets[0]}),
    noteCommitment({pkRecipientHash: pkHself, amount: change, mintHash: mH, noteSecret: outNoteSecrets[1]}),
  ];

  const params: ShieldedProveParams = {
    merkleRoot: rootDec,
    nullifier_0: nulls[0]!.toString(),
    nullifier_1: nulls[1]!.toString(),
    outCommitment_0: outCommitment[0]!.toString(),
    outCommitment_1: outCommitment[1]!.toString(),
    mintHash: mH.toString(),
    in_noteSecret: inNoteSecret,
    in_pkRecipientHash: inPkH,
    in_amount: inAmount,
    in_leafIndex: inLeafIndex,
    in_merklePath: inMerklePath,
    in_merklePathIndices: inMerklePathIndices,
    in_isDummy: inIsDummy,
    out_pkRecipientHash: outPkH.map(x => x.toString()),
    out_amount: outAmount.map(x => x.toString()),
    out_noteSecret: outNoteSecrets.map(x => x.toString()),
  };

  return {
    params,
    merkleRoot32: decToBe32(rootDec),
    nullifier32: [decToBe32(nulls[0]!.toString()), decToBe32(nulls[1]!.toString())],
    outCommitment32: [decToBe32(outCommitment[0]!.toString()), decToBe32(outCommitment[1]!.toString())],
    outCommitmentDec: [outCommitment[0]!.toString(), outCommitment[1]!.toString()],
    merkleRootDec: rootDec,
    nullifierDec: [nulls[0]!.toString(), nulls[1]!.toString()],
    mintHashDec: mH.toString(),
    recipientOut: {commitment: outCommitment[0]!.toString(), amount: transferAmount, noteSecret: outNoteSecrets[0]},
    changeOut: {commitment: outCommitment[1]!.toString(), amount: change, noteSecret: outNoteSecrets[1]},
    change,
  };
}
