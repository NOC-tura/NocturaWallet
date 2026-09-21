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
