import {PublicKey} from '@solana/web3.js'; // value import — also serves as the type
import {nullifier, mintHash, recipientField} from './noteCrypto';
import {getPkRecipientHash} from './shieldedIdentity';
import {computeMerklePath} from '../merkle/merkleModule';
import {decToBe32, hexToDec} from './fieldCodec';
import type {ShieldedProveParams} from '../zkProver/types';
import type {ShieldedNote} from './types';

export interface WithdrawWitnessInput {
  seed: Uint8Array;
  note: ShieldedNote;
  destTokenAccount: PublicKey;
  leaves: string[]; // hex commitments, dense by leaf index (from merkleSync)
}

export interface WithdrawWitness {
  params: ShieldedProveParams;
  nullifier32: Uint8Array;  // BE 32B — ix arg + nullifier PDA seed
  merkleRoot32: Uint8Array; // BE 32B — ix arg
}

/**
 * Build the withdraw circuit witness + /zk/prove params for a whole-note spend.
 * Public inputs (circuit order): [merkleRoot, nullifier, withdrawAmount,
 * recipientField, mintHash]. withdrawAmount == amount (no change output).
 * merklePath/merklePathIndices are decimal-string arrays (indices as '0'/'1',
 * LSB-first). See project_shielded_c2_contract for the signal contract.
 */
export function buildWithdrawWitness(input: WithdrawWitnessInput): WithdrawWitness {
  const {seed, note, destTokenAccount, leaves} = input;
  const pkH = getPkRecipientHash(seed);
  const mH = mintHash(new PublicKey(note.mint).toBytes());
  const nul = nullifier({noteSecret: BigInt(note.noteSecret), leafIndex: note.index});
  const recip = recipientField(destTokenAccount.toBytes());
  const {root, siblings, pathIndices} = computeMerklePath(leaves, note.index);
  const merkleRootDec = hexToDec(root);

  const params: ShieldedProveParams = {
    merkleRoot: merkleRootDec,
    nullifier: nul.toString(),
    withdrawAmount: note.amount.toString(),
    recipientField: recip.toString(),
    mintHash: mH.toString(),
    noteSecret: BigInt(note.noteSecret).toString(),
    pkRecipientHash: pkH.toString(),
    amount: note.amount.toString(),
    leafIndex: note.index.toString(),
    merklePath: siblings.map(hexToDec),
    merklePathIndices: pathIndices.map(b => b.toString()),
  };

  return {
    params,
    nullifier32: decToBe32(nul.toString()),
    merkleRoot32: decToBe32(merkleRootDec),
  };
}
