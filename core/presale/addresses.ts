/**
 * Mainnet addresses, owned here so that both apps read one literal.
 *
 * They cannot live in `src/constants/programs.ts`: its first line is
 * `import Config from 'react-native-config'` and it asserts the network at import
 * time, so pulling it into the web bundle would drag React Native along. That file now
 * uses these for its mainnet branch and keeps its own devnet switch, which core does
 * not need — the web is mainnet-only.
 */
export const MAINNET_PROGRAM_ID = '6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt';
export const MAINNET_ADMIN_ADDRESS = 'KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr';
export const MAINNET_NOC_MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
export const MAINNET_SOL_TREASURY = '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd';
/** Pyth SOL/USD price account (read-only), required by `presale_purchase_with_sol`. */
export const PYTH_SOL_USD_ACCOUNT = '7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE';
export const NOC_DECIMALS = 9;

/** Circle's USDC and Tether's USDT on Solana mainnet, both 6 decimals. */
export const MAINNET_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const MAINNET_USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

/**
 * The treasury's associated token accounts for USDC and USDT — where a stablecoin purchase pays (B1d §2.1, C5):
 * `findAssociatedTokenAddress(MAINNET_SOL_TREASURY, mint)`, whole addresses (a test re-derives both). The extension
 * reads `config.sol_treasury` and refuses the presale unless it is the pinned treasury, so these are the only
 * destinations it ever pays.
 */
export const MAINNET_VAULT_USDC_ATA = 'DNMn9dt7sqLoKZ27ms2U7kyBJPJUL9dvtqgTavVNDGW3';
export const MAINNET_VAULT_USDT_ATA = '8mk9WSfsioRXUv2VtMjMmbGC3baXqTs4CZqseD8cvsRp';
