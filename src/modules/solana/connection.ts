import {Connection} from '@solana/web3.js';
import {NETWORK, RPC_ENDPOINT, RPC_WEBSOCKET} from '../../constants/programs';

/**
 * SECURITY NOTE: RPC calls are NOT SSL-pinned.
 *
 * Solana's Connection class uses its own HTTP client (fetch/node-fetch),
 * bypassing our pinnedFetch module. This means a MITM attacker on the RPC
 * endpoint could return fake balances, fake transaction confirmations, or
 * manipulate simulation results.
 *
 * Mitigating factors:
 * - Transactions are signed client-side — an attacker cannot steal funds
 *   by intercepting RPC calls (they'd need the private key to sign)
 * - Helius RPC uses standard TLS (not pinned, but still encrypted)
 * - The fallback public RPC has no SLA and is rate-limited
 *
 * Future improvement: inject a custom fetch wrapper into Connection that
 * uses pinnedFetch for the Helius endpoint. Requires Connection config
 * support for custom fetch (available in @solana/web3.js via fetchMiddleware).
 */
// The public endpoint OF THIS BUILD'S CHAIN (S13): a devnet build whose RPC_ENDPOINT is missing
// falls back to devnet, never to mainnet under a devnet label.
const FALLBACK_RPC = NETWORK === 'devnet' ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com';
const FALLBACK_WS = NETWORK === 'devnet' ? 'wss://api.devnet.solana.com' : 'wss://api.mainnet-beta.solana.com';
const COMMITMENT = 'confirmed' as const;

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    const endpoint = RPC_ENDPOINT || FALLBACK_RPC;
    const wsEndpoint = RPC_WEBSOCKET || FALLBACK_WS;
    // If RPC_ENDPOINT didn't make it through react-native-config (missing .env
    // in the bundle, build cache, etc.) we fall back to the public endpoint of
    // the build's NETWORK (rate-limited) — surface it loudly so this doesn't
    // waste another debugging cycle.
    if (!RPC_ENDPOINT) {
      console.warn(
        '[connection] RPC_ENDPOINT is empty — falling back to ' + FALLBACK_RPC +
          '. Check .env / react-native-config bundling.',
      );
    }
    _connection = new Connection(endpoint, {
      commitment: COMMITMENT,
      confirmTransactionInitialTimeout: 60_000,
      wsEndpoint,
    });
  }
  return _connection;
}

export function resetConnection(): void {
  _connection = null;
}
