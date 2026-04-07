import {Connection} from '@solana/web3.js';
import {RPC_ENDPOINT, RPC_WEBSOCKET} from '../../constants/programs';

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
