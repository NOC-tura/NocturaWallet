import {PublicKey} from '@solana/web3.js';
import {getConnection} from './connection';

type BalanceCallback = (lamports: number) => void;
type UnsubscribeFn = () => void;

/**
 * Subscribe to balance changes for an account via WebSocket.
 * Uses Solana's onAccountChange subscription.
 *
 * The WebSocket endpoint is set on the Connection instance via the wsEndpoint
 * option in connection.ts (falls back to wss://api.mainnet-beta.solana.com).
 *
 * @returns A cleanup function that removes the subscription when called.
 */
export function subscribeToBalance(
  address: string,
  callback: BalanceCallback,
): UnsubscribeFn {
  const connection = getConnection();
  const pubkey = new PublicKey(address);

  const subId = connection.onAccountChange(pubkey, accountInfo => {
    callback(accountInfo.lamports);
  });

  return () => {
    connection.removeAccountChangeListener(subId);
  };
}
