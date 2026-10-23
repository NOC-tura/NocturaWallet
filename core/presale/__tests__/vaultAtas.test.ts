import {PublicKey} from '@solana/web3.js';
import {
  MAINNET_ADMIN_ADDRESS,
  MAINNET_SOL_TREASURY,
  MAINNET_USDC_MINT,
  MAINNET_USDT_MINT,
  MAINNET_VAULT_USDC_ATA,
  MAINNET_VAULT_USDT_ATA,
} from '../addresses';
import {findAssociatedTokenAddress} from '../../solana/encoding';

// B1d §2.1, C5: the stablecoin destinations are the treasury's own ATAs — whole addresses, re-derived here.
describe('the pinned vault ATAs', () => {
  it('each is findAssociatedTokenAddress(MAINNET_SOL_TREASURY, its mint)', () => {
    const treasury = new PublicKey(MAINNET_SOL_TREASURY);
    expect(findAssociatedTokenAddress(treasury, new PublicKey(MAINNET_USDC_MINT)).toBase58()).toBe(MAINNET_VAULT_USDC_ATA);
    expect(findAssociatedTokenAddress(treasury, new PublicKey(MAINNET_USDT_MINT)).toBase58()).toBe(MAINNET_VAULT_USDT_ATA);
  });

  it('the spec’s literals (§2.1), whole', () => {
    expect(MAINNET_VAULT_USDC_ATA).toBe('DNMn9dt7sqLoKZ27ms2U7kyBJPJUL9dvtqgTavVNDGW3');
    expect(MAINNET_VAULT_USDT_ATA).toBe('8mk9WSfsioRXUv2VtMjMmbGC3baXqTs4CZqseD8cvsRp');
  });

  it('negative control: the admin’s ATAs (the pre-2026-09-21 derivation) are different accounts', () => {
    const admin = new PublicKey(MAINNET_ADMIN_ADDRESS);
    expect(findAssociatedTokenAddress(admin, new PublicKey(MAINNET_USDC_MINT)).toBase58()).not.toBe(MAINNET_VAULT_USDC_ATA);
    expect(findAssociatedTokenAddress(admin, new PublicKey(MAINNET_USDT_MINT)).toBase58()).not.toBe(MAINNET_VAULT_USDT_ATA);
  });
});
