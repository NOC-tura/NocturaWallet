import Config from 'react-native-config';
import {assertKnownNetwork} from './networkGuard';
// The mainnet literals live in core/ so the web app reads the same ones. The devnet
// switch stays here: core has no network to switch on, the web being mainnet-only.
import {
  MAINNET_ADMIN_ADDRESS,
  MAINNET_NOC_MINT,
  MAINNET_PROGRAM_ID,
  MAINNET_SOL_TREASURY,
  PYTH_SOL_USD_ACCOUNT as CORE_PYTH_SOL_USD_ACCOUNT,
} from '../../core/presale/addresses';
import {MAINNET_FEE_TREASURY, TRANSFER_MARKUP_LAMPORTS} from '../../core/fees/transferMarkup';

// Fail closed BEFORE any address constant is derived. Previously this was an
// unchecked cast whose default branch was mainnet, so a missing or misspelled
// NETWORK silently selected the real mint, program and treasuries.
const RAW_NETWORK = Config.NETWORK;
assertKnownNetwork(RAW_NETWORK);

export const NETWORK = RAW_NETWORK;
export const IS_DEVNET = NETWORK === 'devnet';

// The Phase 1 program (presale + staking + airdrop + referral) and the NOC mint exist on MAINNET
// only. There are no devnet values (spec S13): the devnet build disables every presale surface
// (`isPresaleEnabled()`, constants/chain.ts) instead of running it on placeholders, so these are
// the mainnet literals in every build. NOC_MINT names the token; on devnet no account of it exists.

// $NOC SPL Token
export const NOC_MINT = MAINNET_NOC_MINT;
export const NOC_DECIMALS = 9;

// Noctura On-Chain Program (Phase 1 — unified: presale + staking + airdrop + referral)
export const PROGRAM_ID = MAINNET_PROGRAM_ID;
export const ADMIN_ADDRESS = MAINNET_ADMIN_ADDRESS;
export const SOL_TREASURY = MAINNET_SOL_TREASURY;

// Pyth SOL/USD price account (read-only) required by presale_purchase_with_sol.
export const PYTH_SOL_USD_ACCOUNT = CORE_PYTH_SOL_USD_ACCOUNT;

// Squads multisig vault (System-owned, mainnet) — the same vault used as
// SOL_TREASURY, so all Noctura SOL (presale revenue + wallet fee markup)
// consolidates into one multisig. Receives the transparent-transfer fee markup.
export const NOCTURA_FEE_TREASURY = MAINNET_FEE_TREASURY;

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

export const TRANSPARENT_FEES = {
  /** Fixed SOL markup added to every transparent transfer (lamports, BigInt). */
  transferMarkup: TRANSFER_MARKUP_LAMPORTS,
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
