import {
  getAttemptCount,
  checkCooldown,
  recordFailedAttempt,
  resetAttempts,
  LOCKOUT_THRESHOLD,
  COOLDOWN_MS,
  WIPE_SESSION_THRESHOLD,
} from '../pinLockout';
import {mmkvPublic} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';

describe('pinLockout', () => {
  beforeEach(() => {
    mmkvPublic.set(MMKV_KEYS.PIN_ATTEMPT_COUNT, 0);
    mmkvPublic.set(MMKV_KEYS.PIN_COOLDOWN_UNTIL, 0);
  });

  it('getAttemptCount returns 0 initially', () => {
    expect(getAttemptCount()).toBe(0);
  });

  it('recordFailedAttempt increments count', () => {
    recordFailedAttempt();
    expect(getAttemptCount()).toBe(1);
    recordFailedAttempt();
    expect(getAttemptCount()).toBe(2);
  });

  it('does not start cooldown before threshold', () => {
    for (let i = 0; i < LOCKOUT_THRESHOLD - 1; i++) {
      const result = recordFailedAttempt();
      expect(result.cooldownStarted).toBe(false);
    }
    expect(checkCooldown().blocked).toBe(false);
  });

  it('starts 30s cooldown at threshold (5 failures)', () => {
    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) {
      recordFailedAttempt();
    }
    const cooldown = checkCooldown();
    expect(cooldown.blocked).toBe(true);
    if (cooldown.blocked) {
      expect(cooldown.remainingMs).toBeGreaterThan(0);
      expect(cooldown.remainingMs).toBeLessThanOrEqual(COOLDOWN_MS);
    }
  });

  it('cooldown expires after duration', () => {
    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) {
      recordFailedAttempt();
    }
    // Simulate time passing
    mmkvPublic.set(MMKV_KEYS.PIN_COOLDOWN_UNTIL, Date.now() - 1000);
    expect(checkCooldown().blocked).toBe(false);
  });

  it('returns shouldWipeSession after 10 failures', () => {
    for (let i = 0; i < WIPE_SESSION_THRESHOLD - 1; i++) {
      const result = recordFailedAttempt();
      expect(result.shouldWipeSession).toBe(false);
    }
    const result = recordFailedAttempt();
    expect(result.shouldWipeSession).toBe(true);
  });

  it('resetAttempts clears count and cooldown', () => {
    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) {
      recordFailedAttempt();
    }
    expect(getAttemptCount()).toBe(LOCKOUT_THRESHOLD);
    expect(checkCooldown().blocked).toBe(true);

    resetAttempts();
    expect(getAttemptCount()).toBe(0);
    expect(checkCooldown().blocked).toBe(false);
  });

  it('LOCKOUT_THRESHOLD is 5', () => {
    expect(LOCKOUT_THRESHOLD).toBe(5);
  });

  it('COOLDOWN_MS is 30000', () => {
    expect(COOLDOWN_MS).toBe(30_000);
  });

  it('WIPE_SESSION_THRESHOLD is 10', () => {
    expect(WIPE_SESSION_THRESHOLD).toBe(10);
  });
});
