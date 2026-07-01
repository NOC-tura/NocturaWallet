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

// Pyth SOL/USD price account (read-only) required by presale_purchase_with_sol.
export const PYTH_SOL_USD_ACCOUNT = '7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE';

// Squads multisig vault (System-owned, mainnet) — the same vault used as
// SOL_TREASURY, so all Noctura SOL (presale revenue + wallet fee markup)
// consolidates into one multisig. Receives the transparent-transfer fee markup.
// Only this literal changes; no other code.
export const NOCTURA_FEE_TREASURY = IS_DEVNET
  ? 'TODO_DEVNET_FEE_TREASURY'
  : '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd';

export const RPC_ENDPOINT = Config.HELIUS_RPC_URL;
export const RPC_WEBSOCKET = Config.HELIUS_WS_URL;
export const API_BASE = Config.API_BASE;
// Origin of API_BASE (e.g. https://api.noc-tura.io) — used to absolutize the
// backend's relative image-proxy paths. Guarded so a missing/blank API_BASE
// can't throw at import time (new URL is available via react-native-url-polyfill).
export const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE).origin;
  } catch {
    return '';
  }
})();
// CoinGecko Demo API key — lifts the public-tier rate limit (~2/min → ~30/min).
// Optional: when empty, requests fall back to the (heavily rate-limited) public
// tier. For a production launch this is replaced by a backend price proxy.
export const COINGECKO_API_KEY = Config.COINGECKO_API_KEY ?? '';

export const SHIELDED_ADDRESS_HRP = 'noc' as const;

// ---- Startup guards for TODO addresses ------------------------------------
// Prevents runtime crashes from `new PublicKey('TODO_...')`.
// These fire on module load — if any TODO address is active for the current
// NETWORK, a warning is logged so developers know transactions will fail.
//
// DEVNET: All 5 addresses are TODO. To populate, deploy the Phase 1 programs
// to devnet and copy the resulting program ID, mint, admin, treasury, and fee
// treasury addresses here. See Phase 1 repo deployment instructions.
//
// MAINNET: all addresses populated. NOCTURA_FEE_TREASURY now points to the
// Squads multisig vault (= SOL_TREASURY); no TODOs remain.

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
  /** Fixed SOL markup added to every transparent transfer (lamports, BigInt). */
  transferMarkup: 20_000n,
  /**
   * Percentage-based fees below are Phase 4 (not active in v1).
   * These are PERCENTAGE CONSTANTS (not lamport amounts) — float is acceptable
   * here because they represent ratios, not monetary values.
   * When fee calculation uses these, convert to BigInt basis points:
   *   const feeLamports = (amount * BigInt(Math.round(percent * 10000))) / 10000n;
   */
  swapFeePercent: 0.003,       // 0.3%
  gaslessSwapFeePercent: 0.004, // 0.4%
  crossChainFeePercent: 0.001, // 0.1%
} as const;

export const SHIELDED_FEES = {
  privateTransfer: 500_000n,
  privateSwap: 7_000_000n,
  crossModeDeposit: 1_000_000n,
  crossModeWithdraw: 2_000_000n,
} as const;

// ---- Shielded pool (devnet POC) ----------------------------------------------
// Deployed devnet program. The mainnet pool is a separate, audited deployment.
export const SHIELDED_POOL_PROGRAM_ID =
  'NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES' as const;

// Devnet test mint the pool was initialized for. Sourced from the env so the
// devnet build can override it; falls back to empty until configured.
export const SHIELDED_DEVNET_MINT =
  Config.SHIELDED_DEVNET_MINT ?? '';

// Compute-unit limits: measured deposit ~132,256 / withdraw ~152,508 CU on
// devnet; add headroom (the wallet prepends setComputeUnitLimit).
export const SHIELDED_CU = {deposit: 200_000, withdraw: 250_000} as const;

/**
 * SPL mints that have a shielded pool (i.e. what can be shielded/displayed).
 * Devnet: the test mint. Mainnet: NOC (extend when more pools ship — keep the
 * set small; anonymity favors fewer, busier pools).
 *
 * NOTE: SHIELDED_DEVNET_MINT may be '' if the env isn't set, so we filter it
 * out to avoid an empty-string "mint" appearing in the list.
 */
// Key off whether the devnet test mint is CONFIGURED, not IS_DEVNET: the devnet
// shielded test build runs with NETWORK=mainnet-beta (to avoid the unfinished
// TODO_DEVNET_* presale placeholders), so IS_DEVNET is false there even though the
// shielded pool is the devnet AtjVK test mint. Presence of SHIELDED_DEVNET_MINT =
// "use the devnet test pool"; otherwise (production) the pool is NOC.
export const SHIELDED_POOL_MINTS: readonly string[] =
  SHIELDED_DEVNET_MINT.length > 0 ? [SHIELDED_DEVNET_MINT] : [NOC_MINT];
