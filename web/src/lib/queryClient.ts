import {QueryClient} from '@tanstack/react-query';

/**
 * One retry for reads, none on window focus. A 403 from the RPC proxy means a method
 * outside its allowlist — our bug, not a transient — and retrying a bug just repeats
 * it, so anything that can produce one is expected to surface rather than loop.
 */
export const queryClient = new QueryClient({
  defaultOptions: {queries: {retry: 1, refetchOnWindowFocus: false}},
});
