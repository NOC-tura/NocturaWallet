/**
 * The app's one TanStack QueryClient (was local to AppProviders). Exported so that code outside React
 * (the wipe/import reset hook below, #21's post-send refresh) can reach the cache.
 *
 * M1d review M4: the per-account entries (`accountSnapshot`, `txHistory`, keyed by address) are dropped
 * whenever the encrypted store is replaced — a wipe (`clearAllStores`) or an import (`initSecureMmkv`) —
 * so the old wallet's balances and history do not outlive it in memory. They were never shown to the new
 * wallet (the keys are addresses); this just stops them lingering for up to `gcTime`.
 */
import {QueryClient} from '@tanstack/react-query';
import {onSecureMmkvReset} from '../store/mmkv/instances';

export const ACCOUNT_QUERY_KEYS = ['accountSnapshot', 'txHistory'] as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 10_000,
      gcTime: 5 * 60_000,
    },
  },
});

export function clearAccountQueries(client: QueryClient = queryClient): void {
  for (const key of ACCOUNT_QUERY_KEYS) {
    client.removeQueries({queryKey: [key]});
  }
}

onSecureMmkvReset(() => clearAccountQueries());
