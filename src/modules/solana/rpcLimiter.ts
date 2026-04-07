import {RateLimiter} from './rateLimiter';

/** Shared rate limiter for all Solana RPC calls. Max 10 concurrent. */
export const rpcLimiter = new RateLimiter({
  maxConcurrent: 10,
  maxRetries: 3,
  baseDelayMs: 1000,
});

/**
 * Rate limiter for /v1/prove/* endpoints. Max 1 concurrent, 3s cooldown.
 * Uses maxConcurrent=1 and cooldownMs=3000 so only one proof request runs
 * at a time and a 3-second gap is enforced between requests.
 */
export const proveLimiter = new RateLimiter({
  maxConcurrent: 1,
  cooldownMs: 3000,
  maxRetries: 1,
  baseDelayMs: 1000,
});

/**
 * Rate limiter for /v1/relayer/submit. Max 1 concurrent, 5s cooldown.
 * Ensures at most one relayer submission is in-flight at a time with a
 * 5-second cooldown between submissions.
 */
export const relayerLimiter = new RateLimiter({
  maxConcurrent: 1,
  cooldownMs: 5000,
  maxRetries: 1,
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
  proveLimiter.reset();
  relayerLimiter.reset();
}
