import {PublicKey} from '@solana/web3.js';
import {sha256} from '@noble/hashes/sha2.js';
import {buildWithdrawWithChangeIx} from '../poolInstructions';

const pk = (s: string) => new PublicKey(s);
const A = (s: number) => new PublicKey(new Uint8Array(32).fill(s));
const SYS = '11111111111111111111111111111111';
const TOK = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

describe('buildWithdrawWithChangeIx', () => {
  const base = {
    merkleRoot: new Uint8Array(32).fill(1),
    nullifier: new Uint8Array(32).fill(2),
    amount: 200n,
    changeCommitment: new Uint8Array(32).fill(9),
    proofBytes: new Uint8Array(256).fill(3),
    ciphertext: new Uint8Array(128).fill(0),
    pool: pk('11111111111111111111111111111112'),
    merkleTree: pk('11111111111111111111111111111113'),
    vault: pk('11111111111111111111111111111114'),
    destinationTokenAccount: pk('11111111111111111111111111111115'),
    nullifierRecord: pk('11111111111111111111111111111116'),
    feePayer: pk('11111111111111111111111111111117'),
    wchangeVk: pk('11111111111111111111111111111118'),
  };

  it('uses the global:withdraw_with_change discriminator', () => {
    const ix = buildWithdrawWithChangeIx(base);
    const disc = sha256(Buffer.from('global:withdraw_with_change')).slice(0, 8);
    expect(Buffer.from(ix.data.subarray(0, 8))).toEqual(Buffer.from(disc));
  });

  it('lays out data: disc + root(32) + nullifier(32) + amount(u64 LE) + change_commitment(32) + len(u32) + proof + len(u32) + ciphertext(128)', () => {
    const ix = buildWithdrawWithChangeIx(base);
    expect(ix.data.length).toBe(8 + 32 + 32 + 8 + 32 + 4 + 256 + 4 + 128);
    expect(ix.data[8 + 64]).toBe(200);
    expect(ix.data[8 + 64 + 8]).toBe(9);
    const lenOff = 8 + 32 + 32 + 8 + 32;
    expect(ix.data[lenOff]).toBe(256 & 0xff);
    expect(ix.data[lenOff + 1]).toBe((256 >> 8) & 0xff);
  });

  it('orders accounts: wchange_vk (ro) sits between fee_payer and token_program', () => {
    const ix = buildWithdrawWithChangeIx(base);
    const keys = ix.keys.map(k => [k.pubkey.toBase58(), k.isSigner, k.isWritable]);
    expect(keys).toEqual([
      [base.pool.toBase58(), false, false],
      [base.merkleTree.toBase58(), false, true],
      [base.vault.toBase58(), false, true],
      [base.destinationTokenAccount.toBase58(), false, true],
      [base.nullifierRecord.toBase58(), false, true],
      [base.feePayer.toBase58(), true, true],
      [base.wchangeVk.toBase58(), false, false],  // position 7 (per deployed ctx)
      [TOK, false, false],
      [SYS, false, false],
    ]);
  });

  it('rejects wrong lengths', () => {
    expect(() => buildWithdrawWithChangeIx({...base, changeCommitment: new Uint8Array(10)})).toThrow();
    expect(() => buildWithdrawWithChangeIx({...base, proofBytes: new Uint8Array(10)})).toThrow();
  });

  it('appends the ciphertext memo: total 504 B, len prefix 128 at offset 372', () => {
    const ciphertext = new Uint8Array(128).fill(0xee);
    const ix = buildWithdrawWithChangeIx({
      merkleRoot: new Uint8Array(32).fill(1),
      nullifier: new Uint8Array(32).fill(2),
      amount: 200n,
      changeCommitment: new Uint8Array(32).fill(9),
      proofBytes: new Uint8Array(256).fill(0xab),
      ciphertext,
      pool: A(1),
      merkleTree: A(2),
      vault: A(3),
      destinationTokenAccount: A(4),
      nullifierRecord: A(5),
      feePayer: A(6),
      wchangeVk: A(7),
    });
    expect(ix.data.length).toBe(8 + 32 + 32 + 8 + 32 + 4 + 256 + 4 + 128); // 504
    expect(ix.data.readUInt32LE(372)).toBe(128);
    expect(Buffer.from(ix.data.subarray(376))).toEqual(Buffer.from(ciphertext));
  });

  it('rejects a ciphertext that is not 128 bytes', () => {
    expect(() => buildWithdrawWithChangeIx({
      merkleRoot: new Uint8Array(32),
      nullifier: new Uint8Array(32),
      amount: 1n,
      changeCommitment: new Uint8Array(32),
      proofBytes: new Uint8Array(256),
      ciphertext: new Uint8Array(1),
      pool: A(1),
      merkleTree: A(2),
      vault: A(3),
      destinationTokenAccount: A(4),
      nullifierRecord: A(5),
      feePayer: A(6),
      wchangeVk: A(7),
    })).toThrow(/ciphertext must be 128 bytes/);
  });
});
