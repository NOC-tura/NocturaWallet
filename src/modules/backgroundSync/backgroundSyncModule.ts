import {getConnection} from '../solana/connection';
import {getBalance, getTokenAccounts} from '../solana/queries';
import {useWalletStore} from '../../store/zustand/walletStore';
import {PublicKey} from '@solana/web3.js';
import {NOC_MINT} from '../../constants/programs';

export interface SyncResult {
  success: boolean;
  solBalance?: string;
  tokenCount?: number;
  timestamp: number;
  error?: string;
}

export async function forceSync(): Promise<SyncResult> {
  const publicKey = useWalletStore.getState().publicKey;
  if (!publicKey) {
    return {success: false, timestamp: Date.now(), error: 'No wallet loaded'};
  }

  try {
    const connection = getConnection();
    const pk = new PublicKey(publicKey);

    const [solBalance, tokenAccounts] = await Promise.allSettled([
      getBalance(connection, pk),
      getTokenAccounts(connection, pk),
    ]);

    // If BOTH calls fail, surface BOTH underlying reasons so the UI shows the
    // full picture (rate limit / wrong cluster / network down can manifest
    // differently on the two endpoints). Dedup when identical.
    if (solBalance.status === 'rejected' && tokenAccounts.status === 'rejected') {
      const solReason = solBalance.reason instanceof Error
        ? solBalance.reason.message
        : String(solBalance.reason);
      const tokenReason = tokenAccounts.reason instanceof Error
        ? tokenAccounts.reason.message
        : String(tokenAccounts.reason);
      const reason =
        solReason === tokenReason
          ? solReason
          : `sol: ${solReason}; tokens: ${tokenReason}`;
      if (__DEV__) {
        console.warn('[forceSync] both RPC calls failed:', reason);
      }
      return {success: false, timestamp: Date.now(), error: reason};
    }

    const sol = solBalance.status === 'fulfilled' ? solBalance.value.toString() : useWalletStore.getState().solBalance;
    const tokens = tokenAccounts.status === 'fulfilled'
      ? Object.fromEntries(tokenAccounts.value.map(t => [t.mint, t.amount]))
      : useWalletStore.getState().tokenBalances;

    // Extract NOC balance from token accounts (if available), otherwise keep existing
    const nocBalance = tokenAccounts.status === 'fulfilled'
      ? (tokenAccounts.value.find(t => t.mint === NOC_MINT)?.amount ?? useWalletStore.getState().nocBalance)
      : useWalletStore.getState().nocBalance;

    useWalletStore.getState().updateBalances(sol, nocBalance, tokens);

    return {
      success: true,
      solBalance: sol,
      tokenCount: tokenAccounts.status === 'fulfilled' ? tokenAccounts.value.length : 0,
      timestamp: Date.now(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (__DEV__) {
      console.warn('[forceSync] threw:', msg);
    }
    return {success: false, timestamp: Date.now(), error: msg};
  }
}

export function registerBackgroundTask(): void {
  // Stub — real BGTaskScheduler (iOS) / WorkManager (Android) registration
  // requires native code. Foreground sync on app open is the primary mechanism.
}

export function lastSyncedAt(): number | null {
  return useWalletStore.getState().lastSyncedAt;
}
