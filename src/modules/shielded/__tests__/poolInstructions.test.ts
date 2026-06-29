import {PublicKey} from '@solana/web3.js';
import {sha256} from '@noble/hashes/sha2.js';
import {buildDepositIx, depositDiscriminator} from '../poolInstructions';
import {SHIELDED_POOL_PROGRAM_ID} from '../../../constants/programs';

const MINT = new PublicKey('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');
const A = (s: number) => new PublicKey(new Uint8Array(32).fill(s));

describe('buildDepositIx', () => {
  it('discriminator = sha256("global:deposit")[0:8]', () => {
    expect(Buffer.from(depositDiscriminator()).equals(
      Buffer.from(sha256(Buffer.from('global:deposit')).slice(0, 8)))).toBe(true);
  });

  it('data = disc(8)+amount(u64 LE)+commitment(32)+vec(len4 LE + 256)', () => {
    const commitment = new Uint8Array(32).fill(9);
    const proofBytes = new Uint8Array(256).fill(0xab);
    const ix = buildDepositIx({
      amount: 1_000_000_000n, commitment, proofBytes,
      pool: A(1), merkleTree: A(2), vault: A(3),
      depositor: A(4), depositorTokenAccount: A(5),
    });
    expect(ix.programId.toBase58()).toBe(SHIELDED_POOL_PROGRAM_ID);
    expect(ix.data.length).toBe(8 + 8 + 32 + 4 + 256);
    expect(ix.data.readUInt8(8)).toBe(0x00);
    expect(ix.data.readUInt32LE(8)).toBe(0x3B9ACA00 & 0xffffffff);
    expect(ix.data.readUInt32LE(48)).toBe(256);
  });

  it('account metas in program order with correct flags', () => {
    const ix = buildDepositIx({
      amount: 1n, commitment: new Uint8Array(32), proofBytes: new Uint8Array(256),
      pool: A(1), merkleTree: A(2), vault: A(3),
      depositor: A(4), depositorTokenAccount: A(5),
    });
    expect(ix.keys.map(k => [k.isSigner, k.isWritable])).toEqual([
      [false, false], // pool
      [false, true],  // merkle_tree (mut)
      [false, true],  // vault (mut)
      [true, false],  // depositor (signer; fee payer promotes writable at msg level)
      [false, true],  // depositor_token_account (mut)
      [false, false], // token_program
    ]);
  });
});
