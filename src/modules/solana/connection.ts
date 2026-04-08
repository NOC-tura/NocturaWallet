import {Connection} from '@solana/web3.js';
import {RPC_ENDPOINT, RPC_WEBSOCKET} from '../../constants/programs';

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
const FALLBACK_RPC = 'https://api.mainnet-beta.solana.com';
const FALLBACK_WS = 'wss://api.mainnet-beta.solana.com';
const COMMITMENT = 'confirmed' as const;

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    const endpoint = RPC_ENDPOINT || FALLBACK_RPC;
    const wsEndpoint = RPC_WEBSOCKET || FALLBACK_WS;
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
