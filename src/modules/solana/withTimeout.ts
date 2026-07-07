/**
 * Race a promise against a timeout. React Native's fetch (used by @solana/web3.js
 * Connection) has NO default timeout, so a stalled RPC call can hang forever.
 * Wrap latency-sensitive calls with this so a stall rejects instead of blocking.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'operation',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}
