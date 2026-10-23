import {PublicKey} from '@solana/web3.js';
import {SPL_TOKEN_PROGRAM, encodeU64LE, findAssociatedTokenAddress} from '../encoding';
import * as buy from '../../presale/buyInstructions';
import * as transfer from '../transfer';
import * as balances from '../balances';

// B1d §6.2 (review M2): the helpers core/solana needs live here, so an extension build that leaves presale out does not
// carry core/presale/buyInstructions.ts. Every old name still answers — the same function, not a copy — so the app and
// web are unchanged.
describe('core/solana/encoding.ts', () => {
  it('encodeU64LE: little-endian by hand, u64 range only', () => {
    expect([...encodeU64LE(0x0102030405060708n)]).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
    expect([...encodeU64LE(2n ** 64n - 1n)]).toEqual([255, 255, 255, 255, 255, 255, 255, 255]);
    expect(() => encodeU64LE(-1n)).toThrow(/out of u64 range/);
    expect(() => encodeU64LE(2n ** 64n)).toThrow(/out of u64 range/);
  });

  it('findAssociatedTokenAddress: the ATA program derivation, off-curve owners included', () => {
    // The live Squads vault (off-curve) and USDC: the vault ATA the presale's stablecoin purchases pay into.
    const owner = new PublicKey('6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd');
    const mint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    const [expected] = PublicKey.findProgramAddressSync(
      [owner.toBytes(), new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA').toBytes(), mint.toBytes()],
      new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
    );
    expect(PublicKey.isOnCurve(owner.toBytes())).toBe(false);
    expect(findAssociatedTokenAddress(owner, mint).toBase58()).toBe(expected.toBase58());
  });

  it('SPL_TOKEN_PROGRAM is the classic Token program', () => {
    expect(SPL_TOKEN_PROGRAM).toBe('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  });

  it('the old names re-export the same bindings: buyInstructions, transfer and balances', () => {
    expect(buy.encodeU64LE).toBe(encodeU64LE);
    expect(buy.findAssociatedTokenAddress).toBe(findAssociatedTokenAddress);
    expect(buy.SPL_TOKEN_PROGRAM).toBe(SPL_TOKEN_PROGRAM);
    expect(transfer.findAssociatedTokenAddress).toBe(findAssociatedTokenAddress);
    expect(balances.SPL_TOKEN_PROGRAM).toBe(SPL_TOKEN_PROGRAM);
  });
});
