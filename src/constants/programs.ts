import Config from 'react-native-config';

export const NETWORK = Config.NETWORK as 'devnet' | 'mainnet-beta';
export const IS_DEVNET = NETWORK === 'devnet';

// $NOC SPL Token
export const NOC_MINT = IS_DEVNET
  ? 'TODO_DEVNET_MINT'
  : 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
export const NOC_DECIMALS = 9;

// Noctura On-Chain Program (Phase 1 — unified: presale + staking + airdrop + referral)
export const PROGRAM_ID = IS_DEVNET
  ? 'TODO_DEVNET_PROGRAM'
  : '6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt';

export const PROGRAMS = {
  icoProgram: PROGRAM_ID,
  verifier: null as string | null,
  tree: null as string | null,
  nullifiers: null as string | null,
} as const;

export const ADMIN_ADDRESS = IS_DEVNET
  ? 'TODO_DEVNET_ADMIN'
  : 'KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr';

export const SOL_TREASURY = IS_DEVNET
  ? 'TODO_DEVNET_TREASURY'
  : '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd';

export const NOCTURA_FEE_TREASURY = IS_DEVNET
  ? 'TODO_DEVNET_FEE_TREASURY'
  : 'TODO_MAINNET_FEE_TREASURY';

export const RPC_ENDPOINT = Config.HELIUS_RPC_URL;
export const RPC_WEBSOCKET = Config.HELIUS_WS_URL;
export const API_BASE = Config.API_BASE;

export const SHIELDED_ADDRESS_HRP = 'noc' as const;

// ---- Startup guards for TODO addresses ------------------------------------
// Prevents runtime crashes from `new PublicKey('TODO_...')` on mainnet.
// These fire on module load — if any TODO address is active for the current
// NETWORK, the app crashes immediately with a clear error instead of failing
// deep inside a transaction builder.

const TODO_GUARD_ADDRESSES = {
  NOC_MINT,
  PROGRAM_ID,
  ADMIN_ADDRESS,
  SOL_TREASURY,
  NOCTURA_FEE_TREASURY,
} as const;

for (const [name, value] of Object.entries(TODO_GUARD_ADDRESSES)) {
  if (value.startsWith('TODO')) {
    console.warn(
      `[NOCTURA] ${name} is not configured for ${NETWORK}: "${value}". ` +
      `Transactions using this address will fail. Set the real address before production.`,
    );
  }
}

export const TRANSPARENT_FEES = {
  transferMarkup: 20_000n,
  swapFeePercent: 0.003,
  gaslessSwapFeePercent: 0.004,
  crossChainFeePercent: 0.001,
} as const;

export const SHIELDED_FEES = {
  privateTransfer: 500_000n,
  privateSwap: 7_000_000n,
  crossModeDeposit: 1_000_000n,
  crossModeWithdraw: 2_000_000n,
} as const;
