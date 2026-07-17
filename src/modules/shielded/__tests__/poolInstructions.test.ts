import {PublicKey} from '@solana/web3.js';
import {sha256} from '@noble/hashes/sha2.js';
import {buildDepositIx, depositDiscriminator} from '../poolInstructions';
import {SHIELDED_POOL_PROGRAM_ID} from '../../../constants/programs';

const A = (s: number) => new PublicKey(new Uint8Array(32).fill(s));

describe('buildDepositIx', () => {
  it('discriminator = sha256("global:deposit")[0:8]', () => {
    expect(Buffer.from(depositDiscriminator()).equals(
      Buffer.from(sha256(Buffer.from('global:deposit')).slice(0, 8)))).toBe(true);
  });

  it('data = disc(8)+amount(u64 LE)+commitment(32)+vec(len4 LE + 256)+vec(len4 LE + 128)', () => {
    const commitment = new Uint8Array(32).fill(9);
    const proofBytes = new Uint8Array(256).fill(0xab);
    const ciphertext = new Uint8Array(128).fill(0xcd);
    const ix = buildDepositIx({
      amount: 1_000_000_000n, commitment, proofBytes, ciphertext,
      pool: A(1), merkleTree: A(2), vault: A(3),
      depositor: A(4), depositorTokenAccount: A(5),
    });
    expect(ix.programId.toBase58()).toBe(SHIELDED_POOL_PROGRAM_ID);
    expect(ix.data.length).toBe(8 + 8 + 32 + 4 + 256 + 4 + 128);
    expect(ix.data.readUInt8(8)).toBe(0x00);
    expect(ix.data.readUInt32LE(8)).toBe(0x3B9ACA00 & 0xffffffff);
    expect(ix.data.readUInt32LE(48)).toBe(256);
  });

  it('account metas in program order with correct flags', () => {
    const ix = buildDepositIx({
      amount: 1n, commitment: new Uint8Array(32), proofBytes: new Uint8Array(256),
      ciphertext: new Uint8Array(128),
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

  it('appends the ciphertext memo: total = …+u32le(128)+ct(128), len prefix at 308', () => {
    const ciphertext = new Uint8Array(128).fill(0xcd);
    const ix = buildDepositIx({
      amount: 1n, commitment: new Uint8Array(32).fill(9),
      proofBytes: new Uint8Array(256).fill(0xab), ciphertext,
      pool: A(1), merkleTree: A(2), vault: A(3),
      depositor: A(4), depositorTokenAccount: A(5),
    });
    expect(ix.data.length).toBe(8 + 8 + 32 + 4 + 256 + 4 + 128); // 440
    expect(ix.data.readUInt32LE(308)).toBe(128);                 // memo len prefix
    expect(Buffer.from(ix.data.subarray(312))).toEqual(Buffer.from(ciphertext));
  });

  it('rejects a ciphertext that is not 128 bytes', () => {
    expect(() => buildDepositIx({
      amount: 1n, commitment: new Uint8Array(32), proofBytes: new Uint8Array(256),
      ciphertext: new Uint8Array(64),
      pool: A(1), merkleTree: A(2), vault: A(3),
      depositor: A(4), depositorTokenAccount: A(5),
    })).toThrow(/ciphertext must be 128 bytes/);
  });
});
