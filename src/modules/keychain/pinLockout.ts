import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {ERROR_CODES} from '../../constants/errors';

/** After this many consecutive failures, enforce cooldown. */
const LOCKOUT_THRESHOLD = 5;

/** Cooldown duration in milliseconds (30 seconds). */
const COOLDOWN_MS = 30_000;

/** After this many consecutive failures, wipe the session (not the wallet). */
const WIPE_SESSION_THRESHOLD = 10;

/**
 * PIN lockout manager — tracks failed attempts and enforces cooldown.
 *
 * Stored in mmkvPublic (not secure) because:
 * - Only stores attempt count + cooldown timestamp
 * - No PII or secrets
 * - Must be readable before wallet unlock
 */
export function getAttemptCount(): number {
  return mmkvPublic.getNumber(MMKV_KEYS.PIN_ATTEMPT_COUNT) ?? 0;
}

export function getCooldownUntil(): number {
  return mmkvPublic.getNumber(MMKV_KEYS.PIN_COOLDOWN_UNTIL) ?? 0;
}

/**
 * Check if PIN entry is currently blocked by cooldown.
 * Returns null if allowed, or an error message with remaining seconds if blocked.
 */
export function checkCooldown(): {blocked: true; remainingMs: number} | {blocked: false} {
  const cooldownUntil = getCooldownUntil();
  if (cooldownUntil === 0) return {blocked: false};

  const remaining = cooldownUntil - Date.now();
  if (remaining <= 0) {
    // Cooldown expired — clear it
    mmkvPublic.set(MMKV_KEYS.PIN_COOLDOWN_UNTIL, 0);
    return {blocked: false};
  }

  return {blocked: true, remainingMs: remaining};
}

/**
 * Record a failed PIN attempt. Returns whether session should be wiped.
 */
export function recordFailedAttempt(): {shouldWipeSession: boolean; cooldownStarted: boolean} {
  const count = getAttemptCount() + 1;
  mmkvPublic.set(MMKV_KEYS.PIN_ATTEMPT_COUNT, count);

  let cooldownStarted = false;
  const shouldWipeSession = count >= WIPE_SESSION_THRESHOLD;

  // Start cooldown every LOCKOUT_THRESHOLD failures (5, 10, 15, ...)
  if (count >= LOCKOUT_THRESHOLD) {
    mmkvPublic.set(MMKV_KEYS.PIN_COOLDOWN_UNTIL, Date.now() + COOLDOWN_MS);
    cooldownStarted = true;
  }

  return {shouldWipeSession, cooldownStarted};
}

/**
 * Reset attempt counter and cooldown (called after successful PIN entry).
 */
export function resetAttempts(): void {
  mmkvPublic.set(MMKV_KEYS.PIN_ATTEMPT_COUNT, 0);
  mmkvPublic.set(MMKV_KEYS.PIN_COOLDOWN_UNTIL, 0);
}

export {LOCKOUT_THRESHOLD, COOLDOWN_MS, WIPE_SESSION_THRESHOLD};
