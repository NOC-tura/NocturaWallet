import {PublicKey} from '@solana/web3.js';
import {poolPda, merkleTreePda, nullifierPda, vaultAta, wchangeVkPda, transferVkPda} from '../poolPdas';
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

describe('wchangeVkPda', () => {
  it('derives ["wchange_vk", pool] under the shielded program', () => {
    const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
    const pool = poolPda(WSOL_MINT);
    const vk = wchangeVkPda(pool);
    const expected = PublicKey.findProgramAddressSync(
      [Buffer.from('wchange_vk'), pool.toBuffer()],
      new PublicKey('NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES'),
    )[0];
    expect(vk.toBase58()).toBe(expected.toBase58());
  });
});

describe('transferVkPda', () => {
  it('derives ["transfer_vk", pool] under the shielded program', () => {
    const pool = poolPda(new PublicKey('AtjVK2z561wDYo5EvougJKAo9AJ4KdduxSbiF173aiAe'));
    const expected = PublicKey.findProgramAddressSync(
      [Buffer.from('transfer_vk'), pool.toBuffer()],
      new PublicKey('NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES'),
    )[0];
    expect(transferVkPda(pool).toBase58()).toBe(expected.toBase58());
  });
});
