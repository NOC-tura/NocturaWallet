import {PublicKey} from '@solana/web3.js';
import {buildTransferWitness} from '../transferWitness';
import {nullifier, mintHash, noteCommitment, pkRecipientHash} from '../noteCrypto';
import {getPkRecipientHash} from '../shieldedIdentity';
import {decToHex64} from '../fieldCodec';
import type {ShieldedNote} from '../types';

const MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
const seed = new Uint8Array(32).fill(7);
import {getViewPublicKey} from '../shieldedIdentity';
// recipient view key (48-B G1) — a real point so pkRecipientHash composes
const recipientViewKeyG1 = getViewPublicKey(new Uint8Array(32).fill(9));

function note(amount: bigint, index: number, secret: string): ShieldedNote {
  return {commitment: 'x', nullifier: '', mint: MINT, amount, index, spent: false, createdAt: 1, noteSecret: secret};
}

describe('buildTransferWitness', () => {
  it('1 real input + dummy: value split, dummy fields, recipient vs self outputs, 6-order params', () => {
    const input = note(500n, 0, '111');
    const w = buildTransferWitness({
      seed, realInputs: [{...input, commitment: decToHex64('999')}], recipientViewKeyG1, mint: MINT,
      transferAmount: 200n, leaves: [decToHex64('999')], outNoteSecrets: [77n, 88n], dummyNoteSecret: 5n,
    });
    const mH = mintHash(new PublicKey(MINT).toBytes());
    const pkHself = getPkRecipientHash(seed);
    const recipPkH = pkRecipientHash(recipientViewKeyG1);
    expect(w.change).toBe(300n);
    expect((w.params.out_amount as string[])).toEqual(['200', '300']);
    expect((w.params.in_isDummy as string[])).toEqual(['0', '1']);
    expect((w.params.in_amount as string[])[1]).toBe('0');
    expect(w.params.nullifier_0).toBe(nullifier({noteSecret: 111n, leafIndex: 0}).toString());
    expect(w.params.nullifier_1).toBe(nullifier({noteSecret: 5n, leafIndex: 0}).toString());
    expect((w.params.out_pkRecipientHash as string[])[0]).toBe(recipPkH.toString());
    expect((w.params.out_pkRecipientHash as string[])[1]).toBe(pkHself.toString());
    expect(w.params.outCommitment_0).toBe(noteCommitment({pkRecipientHash: recipPkH, amount: 200n, mintHash: mH, noteSecret: 77n}).toString());
    expect(w.params.outCommitment_1).toBe(noteCommitment({pkRecipientHash: pkHself, amount: 300n, mintHash: mH, noteSecret: 88n}).toString());
    expect((w.params.in_merklePath as string[][]).length).toBe(2);
    expect((w.params.in_merklePath as string[][])[0]!.length).toBe(20);
    expect(w.nullifier32[0]!.length).toBe(32);
    expect(w.outCommitment32[1]!.length).toBe(32);
    expect(w.merkleRoot32.length).toBe(32);
    expect(w.recipientOut).toEqual({commitment: w.outCommitmentDec[0], amount: 200n, noteSecret: 77n});
    expect(w.changeOut).toEqual({commitment: w.outCommitmentDec[1], amount: 300n, noteSecret: 88n});
  });

  it('rejects a transfer amount greater than the inputs', () => {
    expect(() => buildTransferWitness({
      seed, realInputs: [note(100n, 0, '1')], recipientViewKeyG1, mint: MINT,
      transferAmount: 200n, leaves: [decToHex64('1')], outNoteSecrets: [1n, 2n], dummyNoteSecret: 3n,
    })).toThrow();
  });
});
