/**
 * Race a promise against a timeout. React Native's fetch (used by @solana/web3.js
 * Connection) has NO default timeout, so a stalled RPC call can hang forever.
 * Wrap latency-sensitive calls with this so a stall rejects instead of blocking.
 */
/** What `withTimeout` rejects with: a caller can tell "no answer in time" from an answer that is an error. */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'operation',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}
