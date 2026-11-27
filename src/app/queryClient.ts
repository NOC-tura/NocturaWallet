/**
 * The app's one TanStack QueryClient (was local to AppProviders). Exported so that code outside React
 * (the wipe/import reset hook below, #21's post-send refresh) can reach the cache.
 *
 * M1d review M4: the per-account entries (`accountSnapshot`, `txHistory`, keyed by address; since the history
 * work also `parsedTx` and the history sessions) are dropped
 * whenever the encrypted store is replaced — a wipe (`clearAllStores`) or an import (`initSecureMmkv`) —
 * so the old wallet's balances and history do not outlive it in memory. They were never shown to the new
 * wallet (the keys are addresses); this just stops them lingering for up to `gcTime`.
 */
import {QueryClient} from '@tanstack/react-query';
import {onSecureMmkvReset} from '../store/mmkv/instances';
import {PARSED_TX_KEY, applyParsedTxDefaults} from '../modules/solana/historyReads';
import {dropHistorySessions} from '../modules/solana/historySession';

/** `parsedTx` (history spec §3.3): raw transactions, kept 24 h — the old wallet's must not outlive it either */
export const ACCOUNT_QUERY_KEYS = ['accountSnapshot', 'txHistory', PARSED_TX_KEY] as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 10_000,
      gcTime: 5 * 60_000,
    },
  },
});
applyParsedTxDefaults(queryClient);

export function clearAccountQueries(client: QueryClient = queryClient): void {
  for (const key of ACCOUNT_QUERY_KEYS) {
    client.removeQueries({queryKey: [key]});
  }
}

/**
 * History spec §3.3: an invalidation of `['txHistory', address]` (#21 after a confirmed Send) also
 * drops that account's history session, so the next read starts from the head instead of continuing
 * a session that does not know the new transaction. Returns the unsubscribe.
 */
export function dropHistorySessionOnInvalidate(client: QueryClient = queryClient): () => void {
  return client.getQueryCache().subscribe(event => {
    if (event.type !== 'updated' || event.action.type !== 'invalidate') {
      return;
    }
    const [name, address] = event.query.queryKey as readonly unknown[];
    if (name === 'txHistory' && typeof address === 'string') {
      dropHistorySessions(address);
    }
  });
}
dropHistorySessionOnInvalidate();

onSecureMmkvReset(() => {
  clearAccountQueries();
  dropHistorySessions(); // every session belongs to the wallet that is gone
});
