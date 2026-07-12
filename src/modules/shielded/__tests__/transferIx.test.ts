import {PublicKey} from '@solana/web3.js';
import {sha256} from '@noble/hashes/sha2.js';
import {buildTransferIx} from '../poolInstructions';

const pk = (s: string) => new PublicKey(s);
const SYS = '11111111111111111111111111111111';

describe('buildTransferIx', () => {
  const base = {
    merkleRoot: new Uint8Array(32).fill(1),
    nullifier0: new Uint8Array(32).fill(2),
    nullifier1: new Uint8Array(32).fill(3),
    outCommitment0: new Uint8Array(32).fill(4),
    outCommitment1: new Uint8Array(32).fill(5),
    proofBytes: new Uint8Array(256).fill(6),
    ciphertext0: new Uint8Array(128).fill(7),
    ciphertext1: new Uint8Array(128).fill(8),
    pool: pk('11111111111111111111111111111112'),
    merkleTree: pk('11111111111111111111111111111113'),
    nullifierRecord0: pk('11111111111111111111111111111114'),
    nullifierRecord1: pk('11111111111111111111111111111115'),
    feePayer: pk('11111111111111111111111111111116'),
    transferVk: pk('11111111111111111111111111111117'),
  };

  it('uses the global:transfer discriminator', () => {
    const ix = buildTransferIx(base);
    expect(Buffer.from(ix.data.subarray(0, 8))).toEqual(Buffer.from(sha256(Buffer.from('global:transfer')).slice(0, 8)));
  });

  it('lays out data: disc + 5x32 + len+proof(256) + len+ct0(128) + len+ct1(128)', () => {
    const ix = buildTransferIx(base);
    expect(ix.data.length).toBe(8 + 32 * 5 + 4 + 256 + 4 + 128 + 4 + 128);
  });

  it('orders accounts per TransferCtx (transfer_vk at index 5)', () => {
    const ix = buildTransferIx(base);
    const keys = ix.keys.map(k => [k.pubkey.toBase58(), k.isSigner, k.isWritable]);
    expect(keys).toEqual([
      [base.pool.toBase58(), false, false],
      [base.merkleTree.toBase58(), false, true],
      [base.nullifierRecord0.toBase58(), false, true],
      [base.nullifierRecord1.toBase58(), false, true],
      [base.feePayer.toBase58(), true, true],
      [base.transferVk.toBase58(), false, false],
      [SYS, false, false],
    ]);
  });

  it('rejects wrong lengths', () => {
    expect(() => buildTransferIx({...base, ciphertext0: new Uint8Array(64)})).toThrow();
    expect(() => buildTransferIx({...base, proofBytes: new Uint8Array(10)})).toThrow();
  });
});
