import type {EnvelopeV1, Kdf} from '../vault/envelope';
import {storedVault} from './stored';

export type Factor = {password: string; kdf: Kdf} | {prfOutput: Uint8Array};
export type Outcome = 'unlocked' | 'wrong' | 'failed' | 'damaged' | 'no-wallet';

export interface AttemptUnlockDeps {
  /** v1_vault as stored: undefined when absent (src/unlock/stored.ts). */
  readEnvelope(): Promise<unknown>;
  send(m: unknown): Promise<{ok: boolean; error?: string}>;
  unlockFlow(deps: {env: EnvelopeV1; send(m: unknown): Promise<{ok: boolean; error?: string}>}, factor: Factor): Promise<'unlocked' | 'wrong' | 'failed' | 'damaged'>;
}

/**
 * Read the envelope and, if present, run unlockFlow — the shared core behind both the password
 * form and the passkey button.
 *
 * Zeroes `factor.prfOutput`, when the factor is a passkey PRF output, in a `finally` that wraps
 * the ENTIRE attempt, including the envelope read. This matters because `unlockFlow` only ever
 * gets to do its own zeroing when it is actually called: a missing or damaged wallet (`readEnvelope()`
 * resolves `undefined`, or something that is not an envelope) or a broken extension context (`readEnvelope()` rejects — e.g. "Extension context
 * invalidated", which can happen if the extension reloads while a passkey prompt the person is
 * still answering is open) both return or throw before `unlockFlow` is ever reached, and without
 * this outer `finally` the caller's PRF output would never be zeroed on those paths. Zeroing here
 * as well as inside `unlockFlow` is deliberately redundant — filling an already-zeroed array with
 * zeros is a no-op — rather than relying on either side alone.
 */
export async function attemptUnlock(deps: AttemptUnlockDeps, factor: Factor): Promise<Outcome> {
  try {
    // Only an absent v1_vault is "no wallet"; a stored value that is not an envelope (null included)
    // is damaged, as the background says (stored.ts, plan-1 carry).
    const stored = storedVault(await deps.readEnvelope());
    if (stored.kind === 'none') return 'no-wallet';
    if (stored.kind === 'damaged') return 'damaged';
    return await deps.unlockFlow({env: stored.env, send: deps.send}, factor);
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
  /**
   * `onWait(ms)` is told how long the wait will be, so a page can show its countdown (#9's
   * cooldown card). `ms` is a LOWER BOUND on the actual wait: it is read before `sleep(ms)` runs,
   * so it never includes whatever `onWait` itself costs (a DOM write, a thrown error) — `run`
   * sleeps the full `ms` regardless of what `onWait` does (see below).
   */
  run<T extends string>(action: () => Promise<T>, onWait: (ms: number) => void): Promise<T>;
}

/**
 * Spec §2: wrong passwords get an increasing delay on top of the Argon2id cost. The streak lives
 * in this page's memory; a proven factor (`'unlocked'`, and re-authentication's `'confirmed'`,
 * the accounts' `'done'`/`'done-locked'`/`'done-not-locked'`, the reveal's `'shown'`, and #40's
 * factor proof `'proven'`) resets it, `'wrong'` extends it and every other
 * outcome (`'damaged'` and `'mismatch-locked'` included — neither is a guess) leaves it as it is.
 * The delay runs INSIDE `run`, so a caller that wraps `run` in `runExclusive` keeps the busy
 * gate (and the disabled buttons) held for the whole wait. `sleep` is injected so the sequence is
 * testable without a clock. `onWait` runs in a `try/finally` around `sleep`: a throwing `onWait`
 * (a page bug in the countdown UI) must never skip the delay itself — that would let a page defeat
 * the backoff just by breaking its own display of it.
 */
/** Outcomes that proved the factor: unlocked, re-auth confirmed, accounts changed (even if then locked), phrase shown, #40's factor proof. */
const PROVEN: readonly string[] = ['unlocked', 'confirmed', 'applied', 'refused', 'done', 'done-locked', 'done-not-locked', 'shown', 'proven'];

export function createWrongBackoff(sleep: (ms: number) => Promise<void>): WrongBackoff {
  let streak = 0;
  return {
    async run(action, onWait) {
      const outcome = await action();
      // A proven factor ends the streak — it unlocked the vault, confirmed a re-authentication,
      // changed the accounts, showed the phrase or proved a factor (#40).
      if (PROVEN.includes(outcome)) streak = 0;
      if (outcome !== 'wrong') return outcome;
      streak += 1;
      const ms = wrongDelayMs(streak);
      if (ms > 0) {
        try {
          onWait(ms);
        } finally {
          await sleep(ms);
        }
      }
      return outcome;
    },
  };
}
