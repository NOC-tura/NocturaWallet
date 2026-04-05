import {getConnection} from '../solana/connection';
import {getBalance, getTokenAccounts} from '../solana/queries';
import {useWalletStore} from '../../store/zustand/walletStore';
import {PublicKey} from '@solana/web3.js';

export interface SyncResult {
  success: boolean;
  solBalance?: string;
  tokenCount?: number;
  timestamp: number;
}

export async function forceSync(): Promise<SyncResult> {
  const publicKey = useWalletStore.getState().publicKey;
  if (!publicKey) return {success: false, timestamp: Date.now()};

  try {
    const connection = getConnection();
    const pk = new PublicKey(publicKey);

    const [solBalance, tokenAccounts] = await Promise.allSettled([
      getBalance(connection, pk),
      getTokenAccounts(connection, pk),
    ]);

    const sol = solBalance.status === 'fulfilled' ? solBalance.value.toString() : useWalletStore.getState().solBalance;
    const tokens = tokenAccounts.status === 'fulfilled'
      ? Object.fromEntries(tokenAccounts.value.map(t => [t.mint, t.amount]))
      : useWalletStore.getState().tokenBalances;

    useWalletStore.getState().updateBalances(sol, useWalletStore.getState().nocBalance, tokens);

    return {
      success: true,
      solBalance: sol,
      tokenCount: tokenAccounts.status === 'fulfilled' ? tokenAccounts.value.length : 0,
      timestamp: Date.now(),
    };
  } catch {
    return {success: false, timestamp: Date.now()};
  }
}

export function registerBackgroundTask(): void {
  // Stub — real BGTaskScheduler (iOS) / WorkManager (Android) registration
  // requires native code. Foreground sync on app open is the primary mechanism.
}

export function lastSyncedAt(): number | null {
  return useWalletStore.getState().lastSyncedAt;
}
