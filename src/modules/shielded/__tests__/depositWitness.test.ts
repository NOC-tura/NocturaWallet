import {PublicKey} from '@solana/web3.js';
import {buildDepositNote} from '../depositWitness';
import {getPkRecipientHash} from '../shieldedIdentity';
import {mintHash, noteCommitment} from '../noteCrypto';

const SEED = new Uint8Array(64).map((_v, i) => (i * 5 + 2) & 0xff);
const MINT = new PublicKey('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');

describe('buildDepositNote', () => {
  it('produces circuit params matching the canonical encodings', () => {
    const {params, note} = buildDepositNote(SEED, 1_000_000_000n, MINT);
    const pkH = getPkRecipientHash(SEED);
    const mH = mintHash(MINT.toBytes());
    const expectedCommitment = noteCommitment({
      pkRecipientHash: pkH, amount: 1_000_000_000n, mintHash: mH,
      noteSecret: BigInt(note.noteSecret),
    });
    expect(params.commitment).toBe(expectedCommitment.toString());
    expect(params.amount).toBe('1000000000');
    expect(params.mintHash).toBe(mH.toString());
    expect(params.pkRecipientHash).toBe(pkH.toString());
    expect(params.noteSecret).toBe(note.noteSecret);
    expect(note.commitment).toBe(expectedCommitment.toString());
  });
});
