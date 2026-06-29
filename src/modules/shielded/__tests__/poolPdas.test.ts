import {PublicKey} from '@solana/web3.js';
import {poolPda, merkleTreePda, nullifierPda, vaultAta} from '../poolPdas';
import {SHIELDED_POOL_PROGRAM_ID} from '../../../constants/programs';

const MINT = new PublicKey('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');
const PROG = new PublicKey(SHIELDED_POOL_PROGRAM_ID);

describe('pool PDAs', () => {
  it('pool = ["pool", mint] under the program', () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool'), MINT.toBuffer()], PROG);
    expect(poolPda(MINT).equals(expected)).toBe(true);
  });
  it('merkle_tree = ["merkle", pool]', () => {
    const pool = poolPda(MINT);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from('merkle'), pool.toBuffer()], PROG);
    expect(merkleTreePda(pool).equals(expected)).toBe(true);
  });
  it('nullifier = ["nullifier", nullifier32]', () => {
    const n = new Uint8Array(32).fill(7);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from('nullifier'), Buffer.from(n)], PROG);
    expect(nullifierPda(n).equals(expected)).toBe(true);
  });
  it('vault is the off-curve ATA of pool for mint', () => {
    expect(vaultAta(poolPda(MINT), MINT)).toBeInstanceOf(PublicKey);
  });
});
