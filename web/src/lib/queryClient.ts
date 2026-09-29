import {QueryClient} from '@tanstack/react-query';

/**
 * One retry for reads, none on window focus. A method outside the RPC proxy's allowlist
 * (a JSON-RPC -32601 error; a 403 before 2026-09-29) is our bug, not a transient, and
 * retrying a bug just repeats it, so anything that can produce one is expected to surface
 * rather than loop.
 */
export const queryClient = new QueryClient({
  defaultOptions: {queries: {retry: 1, refetchOnWindowFocus: false}},
});
