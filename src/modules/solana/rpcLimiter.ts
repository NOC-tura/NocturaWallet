import {RateLimiter} from './rateLimiter';

/** Shared rate limiter for all Solana RPC calls. Max 10 concurrent. */
export const rpcLimiter = new RateLimiter({
  maxConcurrent: 10,
  maxRetries: 3,
  baseDelayMs: 1000,
});

/**
 * Reset all rate limiter state (active count, queues, cooldown timestamps).
 * Call this in test `beforeEach` hooks to prevent cooldown delays from
 * bleeding between test cases.
 *
 * @internal — test use only.
 */
export function _resetRateLimitersForTest(): void {
  rpcLimiter.reset();
}
