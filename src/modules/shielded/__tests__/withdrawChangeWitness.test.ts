import {PublicKey} from '@solana/web3.js';
import {buildWithdrawChangeWitness} from '../withdrawChangeWitness';
import {nullifier, mintHash, recipientField, noteCommitment} from '../noteCrypto';
import {getPkRecipientHash} from '../shieldedIdentity';
import {decToHex64} from '../fieldCodec';
import type {ShieldedNote} from '../types';

const MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
const DEST = new PublicKey('11111111111111111111111111111112');
const seed = new Uint8Array(32).fill(7);
const note: ShieldedNote = {commitment: '999', nullifier: '', mint: MINT, amount: 500n, index: 0, spent: false, createdAt: 1, noteSecret: '12345'};

describe('buildWithdrawChangeWitness', () => {
  it('splits value and computes the self-change commitment (6-order params, no changeCommitment in params)', () => {
    const leaves = [decToHex64(note.commitment)];
    const w = buildWithdrawChangeWitness({
      seed, note, withdrawAmount: 200n, changeNoteSecret: 77n, destTokenAccount: DEST, leaves,
    });

    const pkH = getPkRecipientHash(seed);
    const mH = mintHash(new PublicKey(MINT).toBytes());
    const expectedChangeCommitment = noteCommitment({pkRecipientHash: pkH, amount: 300n, mintHash: mH, noteSecret: 77n});
    const expectedNull = nullifier({noteSecret: 12345n, leafIndex: 0});
    const expectedRecip = recipientField(DEST.toBytes());

    expect(w.changeAmount).toBe(300n);
    expect(w.params.withdrawAmount).toBe('200');
    expect(w.params.inputAmount).toBe('500');
    expect(w.params.changeAmount).toBe('300');
    expect(w.params.changeNoteSecret).toBe('77');
    expect(w.params.nullifier).toBe(expectedNull.toString());
    expect(w.params.recipientField).toBe(expectedRecip.toString());
    expect(w.params.mintHash).toBe(mH.toString());
    expect(w.params.pkRecipientHash).toBe(pkH.toString());
    expect('changeCommitment' in w.params).toBe(false);
    expect(w.changeCommitmentDec).toBe(expectedChangeCommitment.toString());
    expect(w.changeCommitment32.length).toBe(32);
    expect(w.nullifier32.length).toBe(32);
    expect(w.merkleRoot32.length).toBe(32);
    expect((w.params.merklePath as string[]).length).toBe(20);
    expect((w.params.merklePathIndices as string[]).length).toBe(20);
  });

  it('rejects a withdrawAmount greater than the note', () => {
    expect(() => buildWithdrawChangeWitness({
      seed, note, withdrawAmount: 600n, changeNoteSecret: 1n, destTokenAccount: DEST, leaves: [decToHex64(note.commitment)],
    })).toThrow();
  });
});
