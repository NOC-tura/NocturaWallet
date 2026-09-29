import type {EnvelopeV1, Kdf} from '../vault/envelope';

export type Factor = {password: string; kdf: Kdf} | {prfOutput: Uint8Array};
export type Outcome = 'unlocked' | 'wrong' | 'failed' | 'damaged' | 'no-wallet';

export interface AttemptUnlockDeps {
  envelope(): Promise<EnvelopeV1 | null>;
  send(m: unknown): Promise<{ok: boolean; error?: string}>;
  unlockFlow(deps: {env: EnvelopeV1; send(m: unknown): Promise<{ok: boolean; error?: string}>}, factor: Factor): Promise<'unlocked' | 'wrong' | 'failed' | 'damaged'>;
}

/**
 * Read the envelope and, if present, run unlockFlow — the shared core behind both the password
 * form and the passkey button.
 *
 * Zeroes `factor.prfOutput`, when the factor is a passkey PRF output, in a `finally` that wraps
 * the ENTIRE attempt, including the envelope read. This matters because `unlockFlow` only ever
 * gets to do its own zeroing when it is actually called: a missing wallet (`envelope()` resolves
 * `null`) or a broken extension context (`envelope()` rejects — e.g. "Extension context
 * invalidated", which can happen if the extension reloads while a passkey prompt the person is
 * still answering is open) both return or throw before `unlockFlow` is ever reached, and without
 * this outer `finally` the caller's PRF output would never be zeroed on those paths. Zeroing here
 * as well as inside `unlockFlow` is deliberately redundant — filling an already-zeroed array with
 * zeros is a no-op — rather than relying on either side alone.
 */
export async function attemptUnlock(deps: AttemptUnlockDeps, factor: Factor): Promise<Outcome> {
  try {
    const env = await deps.envelope();
    if (!env) return 'no-wallet';
    return await deps.unlockFlow({env, send: deps.send}, factor);
  } catch {
    // Same rule as unlockFlow: an unexpected throw is a failed attempt, never an escaping
    // exception that would leave the page reading "Unlocking…".
    return 'failed';
  } finally {
    if ('prfOutput' in factor) factor.prfOutput.fill(0);
  }
}

export interface AttemptPasskeyUnlockDeps extends AttemptUnlockDeps {
  evaluatePrf(): Promise<Uint8Array | null>;
}

/**
 * The passkey button's whole flow: evaluate PRF, then hand the result to `attemptUnlock` as the
 * factor. A `null` PRF output (the platform has none to offer) and a thrown error (e.g. the
 * person cancels the platform's prompt) are both reported as `'unavailable'` — the caller decides
 * the copy for that single case, so there is exactly one place that string needs to live.
 */
export async function attemptPasskeyUnlock(deps: AttemptPasskeyUnlockDeps): Promise<Outcome | 'unavailable'> {
  let out: Uint8Array | null;
  try {
    out = await deps.evaluatePrf();
  } catch {
    return 'unavailable';
  }
  if (!out) return 'unavailable';
  return attemptUnlock(deps, {prfOutput: out});
}

export interface BusyGate {
  isBusy(): boolean;
  setBusy(busy: boolean): void;
}

/**
 * Runs `action` only when the gate is free, holding it busy for the whole call — synchronously,
 * before `action`'s first `await` — so a passkey prompt already in flight cannot be raced by a
 * password submit sharing the same gate (cardinal rule 6: no double-submit, applied across both
 * unlock paths rather than to each one alone). A second call while busy never invokes `action`
 * at all; it just returns the `'busy'` sentinel.
 */
export async function runExclusive<T>(gate: BusyGate, action: () => Promise<T>): Promise<T | 'busy'> {
  if (gate.isBusy()) return 'busy';
  gate.setBusy(true);
  try {
    return await action();
  } finally {
    gate.setBusy(false);
  }
}

/** The cap on the extra wait after a wrong password (spec §2). */
export const MAX_WRONG_DELAY_MS = 30_000;

/**
 * The extra wait after the n-th consecutive wrong outcome: none after the first (a typo costs
 * only the ~3 s Argon2id run), then 1 s, 2 s, 4 s, 8 s … doubling up to `MAX_WRONG_DELAY_MS`.
 */
export function wrongDelayMs(consecutiveWrong: number): number {
  if (consecutiveWrong <= 1) return 0;
  return Math.min(MAX_WRONG_DELAY_MS, 1000 * 2 ** (consecutiveWrong - 2));
}

export interface WrongBackoff {
  run<T extends Outcome | 'unavailable'>(action: () => Promise<T>, onWait: () => void): Promise<T>;
}

/**
 * Spec §2: wrong passwords get an increasing delay on top of the Argon2id cost. The streak lives
 * in this page's memory; `'unlocked'` resets it, `'wrong'` extends it and every other outcome
 * (`'damaged'` included — a corrupt envelope is not a guess) leaves it as it is. The delay
 * runs INSIDE `run`, so a caller that wraps `run` in `runExclusive` keeps the busy gate (and the
 * disabled buttons) held for the whole wait. `sleep` is injected so the sequence is testable
 * without a clock.
 */
export function createWrongBackoff(sleep: (ms: number) => Promise<void>): WrongBackoff {
  let streak = 0;
  return {
    async run(action, onWait) {
      const outcome = await action();
      if (outcome === 'unlocked') streak = 0;
      if (outcome !== 'wrong') return outcome;
      streak += 1;
      const ms = wrongDelayMs(streak);
      if (ms > 0) {
        onWait();
        await sleep(ms);
      }
      return outcome;
    },
  };
}
