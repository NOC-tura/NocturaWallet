import {PublicKey} from '@solana/web3.js';
import {buildWithdrawWitness} from '../withdrawWitness';
import {nullifier, mintHash, recipientField} from '../noteCrypto';
import {getPkRecipientHash} from '../shieldedIdentity';
import {decToHex64} from '../fieldCodec';
import {computeMerklePath} from '../../merkle/merkleModule';
import type {ShieldedNote} from '../types';

const MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
const DEST = new PublicKey('11111111111111111111111111111112');
const seed = new Uint8Array(32).fill(7);

function makeNote(commitmentDec: string): ShieldedNote {
  return {commitment: commitmentDec, nullifier: '', mint: MINT, amount: 200n, index: 0, spent: false, createdAt: 1, noteSecret: '12345'};
}

describe('buildWithdrawWitness', () => {
  it('produces circuit-order public params with correct crypto', () => {
    const note = makeNote('999');
    const leaves = [decToHex64(note.commitment)];
    const {params, nullifier32, merkleRoot32} = buildWithdrawWitness({
      seed, note, destTokenAccount: DEST, leaves,
    });

    const expectedNull = nullifier({noteSecret: BigInt(note.noteSecret), leafIndex: note.index});
    const expectedMint = mintHash(new PublicKey(MINT).toBytes());
    const expectedRecip = recipientField(DEST.toBytes());
    const expectedPk = getPkRecipientHash(seed);
    const {root} = computeMerklePath(leaves, note.index);

    expect(params.nullifier).toBe(expectedNull.toString());
    expect(params.mintHash).toBe(expectedMint.toString());
    expect(params.recipientField).toBe(expectedRecip.toString());
    expect(params.pkRecipientHash).toBe(expectedPk.toString());
    expect(params.merkleRoot).toBe(BigInt('0x' + root).toString());
    expect(params.withdrawAmount).toBe('200');
    expect(params.amount).toBe('200');
    expect(params.leafIndex).toBe('0');
    expect((params.merklePath as string[]).length).toBe(20);
    expect((params.merklePathIndices as string[]).length).toBe(20);
    expect(nullifier32.length).toBe(32);
    expect(merkleRoot32.length).toBe(32);
  });
});
