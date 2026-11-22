import {getConnection} from '../solana/connection';
import {getBalance, getTokenAccounts} from '../solana/queries';
import {sumTokenBalancesByMint} from '../solana/tokenBalances';
import {useWalletStore} from '../../store/zustand/walletStore';
import {PublicKey} from '@solana/web3.js';
import {NOC_MINT} from '../../constants/programs';
import {TokenManager} from '../tokens/tokenModule';
import {fetchTokenMetadata, loadCachedMetadata, saveCachedMetadata} from '../tokens/tokenMetadata';
import {redactUrlSecrets} from '../../utils/redactSecrets';

const tokenManager = new TokenManager();

export interface SyncResult {
  success: boolean;
  /** true when exactly one of the two reads failed (success is false then) */
  partial: boolean;
  solBalance?: string;
  tokenCount?: number;
  timestamp: number;
  error?: string;
}

export async function forceSync(): Promise<SyncResult> {
  const publicKey = useWalletStore.getState().publicKey;
  if (!publicKey) {
    return {success: false, partial: false, timestamp: Date.now(), error: 'No wallet loaded'};
  }

  // Fix round 1 / 2: the wallet this sync belongs to. A wipe or import while the reads are in flight must
  // not let the old wallet's figures (or its failure) land on the new store.
  const walletChanged = (): boolean => useWalletStore.getState().publicKey !== publicKey;
  const changedResult = (): SyncResult => ({
    success: false,
    partial: false,
    timestamp: Date.now(),
    error: 'wallet changed',
  });
  // Fix round 1 / 1: set once the balances are written; a later throw must not label them stale.
  let wrote = false;

  try {
    const connection = getConnection();
    const pk = new PublicKey(publicKey);

    const [solBalance, tokenAccounts] = await Promise.allSettled([
      getBalance(connection, pk),
      getTokenAccounts(connection, pk),
    ]);

    // post-M1d R1 / r2-5: a sync counts only when EVERY read succeeded. A partial or total failure writes
    // nothing — not the balances, not the token list — so every figure keeps the age of the last fully
    // successful sync, and a fresh half never sits under an old age. Both reasons are surfaced (rate limit /
    // wrong cluster / network down show differently on the two endpoints); identical ones are deduplicated.
    if (walletChanged()) {
      return changedResult();
    }
    if (solBalance.status === 'rejected' || tokenAccounts.status === 'rejected') {
      const reasonOf = (r: PromiseSettledResult<unknown>): string | null =>
        r.status === 'rejected' ? (r.reason instanceof Error ? r.reason.message : String(r.reason)) : null;
      const solReason = reasonOf(solBalance);
      const tokenReason = reasonOf(tokenAccounts);
      const partial = solReason === null || tokenReason === null;
      // Redacted here rather than at the display site: this string is returned into app state as well as
      // shown in an Alert, and the RPC endpoint carries the Helius API key in its query string.
      const reason = redactUrlSecrets(
        solReason !== null && tokenReason !== null
          ? solReason === tokenReason
            ? solReason
            : `sol: ${solReason}; tokens: ${tokenReason}`
          : solReason !== null
            ? `sol: ${solReason}`
            : `tokens: ${tokenReason}`,
      );
      if (__DEV__) {
        console.warn('[forceSync] a read failed:', reason);
      }
      useWalletStore.getState().markSyncFailed();
      return {success: false, partial, timestamp: Date.now(), error: reason};
    }

    const sol = solBalance.value.toString();
    // Sum per mint — an owner can hold one mint across several token accounts, which this wallet routinely does.
    const tokens = sumTokenBalancesByMint(tokenAccounts.value);
    // review r1-3: the token read succeeded, so "no NOC account" is a read of zero — never the store's old
    // figure (which would be shown as current under this sync's fresh lastSyncedAt)
    const nocBalance = tokens[NOC_MINT] ?? '0';

    useWalletStore.getState().updateBalances(sol, nocBalance, tokens);
    wrote = true;

    // Populate the dashboard's token-metadata list from the held accounts so
    // SPL tokens (USDC, etc.) actually render — updateBalances only stores the
    // mint→amount map, not the per-token metadata the list iterates over.
    // Load the Jupiter verified list so verified (non-core) held tokens pass
    // buildDisplayTokens' trust filter. Best-effort — it caches internally.
    try {
      await tokenManager.fetchVerifiedList();
    } catch {
      // verified list unavailable — only core tokens will show this sync
    }

    // Resolve name/symbol/logo for held non-core mints via Helius DAS, warm-
    // starting from the MMKV cache so a failed/slow fetch still shows logos.
    const heldMints = tokenAccounts.value
      .filter(t => t.amount !== '0' && t.mint !== NOC_MINT)
      .map(t => t.mint);
    let meta = loadCachedMetadata();
    try {
      const resolved = await fetchTokenMetadata(heldMints);
      meta = {...meta, ...resolved};
      saveCachedMetadata(meta);
    } catch {
      // DAS unavailable — keep the cached metadata
    }

    if (walletChanged()) {
      return changedResult();
    }
    useWalletStore
      .getState()
      .setTokens(tokenManager.buildDisplayTokens(tokenAccounts.value, meta));

    return {
      success: true,
      partial: false,
      solBalance: sol,
      tokenCount: tokenAccounts.value.length,
      timestamp: Date.now(),
    };
  } catch (e) {
    const msg = redactUrlSecrets(e instanceof Error ? e.message : String(e));
    if (__DEV__) {
      console.warn('[forceSync] threw:', msg);
    }
    if (!wrote && !walletChanged()) {
      useWalletStore.getState().markSyncFailed();
    }
    return {success: false, partial: false, timestamp: Date.now(), error: msg};
  }
}

export function registerBackgroundTask(): void {
  // Stub — real BGTaskScheduler (iOS) / WorkManager (Android) registration
  // requires native code. Foreground sync on app open is the primary mechanism.
}

export function lastSyncedAt(): number | null {
  return useWalletStore.getState().lastSyncedAt;
}
