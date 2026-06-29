import type {PublicKey} from '@solana/web3.js';
import {mintHash, noteCommitment, randomFieldElement} from './noteCrypto';
import {getPkRecipientHash} from './shieldedIdentity';
import type {ShieldedProveParams} from '../zkProver/types';

export interface DepositNote {
  commitment: string;   // decimal
  noteSecret: string;   // decimal (stored locally; the spend secret)
  amount: bigint;
  mint: string;
}

/**
 * Build a fresh deposit note + the exact /zk/prove params for it.
 * noteSecret is random (< F) and stored locally — it is the spend secret.
 * See project_shielded_c2_contract for the encoding/key model.
 */
export function buildDepositNote(
  seed: Uint8Array,
  amount: bigint,
  mint: PublicKey,
): {params: ShieldedProveParams; note: DepositNote} {
  const pkH = getPkRecipientHash(seed);
  const mH = mintHash(mint.toBytes());
  const noteSecret = randomFieldElement();
  const commitment = noteCommitment({
    pkRecipientHash: pkH, amount, mintHash: mH, noteSecret,
  });
  const params: ShieldedProveParams = {
    commitment: commitment.toString(),
    amount: amount.toString(),
    mintHash: mH.toString(),
    pkRecipientHash: pkH.toString(),
    noteSecret: noteSecret.toString(),
  };
  return {
    params,
    note: {
      commitment: commitment.toString(),
      noteSecret: noteSecret.toString(),
      amount,
      mint: mint.toBase58(),
    },
  };
}
