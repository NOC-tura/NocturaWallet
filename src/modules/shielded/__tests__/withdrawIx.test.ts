import {PublicKey} from '@solana/web3.js';
import {sha256} from '@noble/hashes/sha2.js';
import {buildWithdrawIx} from '../poolInstructions';

const pk = (s: string) => new PublicKey(s);
const SYS = '11111111111111111111111111111111';
const TOK = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

describe('buildWithdrawIx', () => {
  const base = {
    merkleRoot: new Uint8Array(32).fill(1),
    nullifier: new Uint8Array(32).fill(2),
    amount: 200n,
    proofBytes: new Uint8Array(256).fill(3),
    pool: pk('11111111111111111111111111111112'),
    merkleTree: pk('11111111111111111111111111111113'),
    vault: pk('11111111111111111111111111111114'),
    destinationTokenAccount: pk('11111111111111111111111111111115'),
    nullifierRecord: pk('11111111111111111111111111111116'),
    feePayer: pk('11111111111111111111111111111117'),
  };

  it('uses the global:withdraw discriminator', () => {
    const ix = buildWithdrawIx(base);
    const disc = sha256(Buffer.from('global:withdraw')).slice(0, 8);
    expect(Buffer.from(ix.data.subarray(0, 8))).toEqual(Buffer.from(disc));
  });

  it('lays out data: disc + root(32) + nullifier(32) + amount(u64 LE) + len(u32) + proof', () => {
    const ix = buildWithdrawIx(base);
    expect(ix.data.length).toBe(8 + 32 + 32 + 8 + 4 + 256);
    expect(ix.data[8 + 64]).toBe(200);
    const lenOff = 8 + 32 + 32 + 8;
    expect(ix.data[lenOff]).toBe(256 & 0xff);
    expect(ix.data[lenOff + 1]).toBe((256 >> 8) & 0xff);
  });

  it('orders accounts per WithdrawCtx with correct signer/writable flags', () => {
    const ix = buildWithdrawIx(base);
    const keys = ix.keys.map(k => [k.pubkey.toBase58(), k.isSigner, k.isWritable]);
    expect(keys).toEqual([
      [base.pool.toBase58(), false, false],
      [base.merkleTree.toBase58(), false, true],
      [base.vault.toBase58(), false, true],
      [base.destinationTokenAccount.toBase58(), false, true],
      [base.nullifierRecord.toBase58(), false, true],
      [base.feePayer.toBase58(), true, true],
      [TOK, false, false],
      [SYS, false, false],
    ]);
  });

  it('rejects wrong proof length', () => {
    expect(() => buildWithdrawIx({...base, proofBytes: new Uint8Array(10)})).toThrow();
  });
});
