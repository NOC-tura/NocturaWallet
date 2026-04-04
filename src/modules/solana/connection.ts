import {Connection} from '@solana/web3.js';
import {RPC_ENDPOINT} from '../../constants/programs';

const FALLBACK_RPC = 'https://api.mainnet-beta.solana.com';
const COMMITMENT = 'confirmed' as const;

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    const endpoint = RPC_ENDPOINT || FALLBACK_RPC;
    _connection = new Connection(endpoint, {
      commitment: COMMITMENT,
      confirmTransactionInitialTimeout: 60_000,
    });
  }
  return _connection;
}

export function resetConnection(): void {
  _connection = null;
}
