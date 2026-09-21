/**
 * Both endpoints are same-origin: in development the Vite proxy forwards them, in
 * production the wallet host serves them. Nothing here carries a VITE_ prefix —
 * that prefix is exactly what inlines a value into the public bundle, and a key
 * reachable from the bundle is a published key.
 */
export const API_BASE = '/api/v1';

/**
 * Absolute on purpose. `new Connection('/rpc')` throws
 * "Endpoint URL must start with `http:` or `https:`" in web3.js 1.95.8 — verified by
 * constructing one in config.test.ts — so the relative form cannot be used here even
 * though `fetch` accepts it for API_BASE.
 */
export function rpcEndpoint(): string {
  return `${window.location.origin}/rpc`;
}
