import type {EnvelopeV1, Kdf} from '../vault/envelope';

export type Factor = {password: string; kdf: Kdf} | {prfOutput: Uint8Array};
export type Outcome = 'unlocked' | 'wrong' | 'failed' | 'no-wallet';

export interface AttemptUnlockDeps {
  envelope(): Promise<EnvelopeV1 | null>;
  send(m: unknown): Promise<{ok: boolean; error?: string}>;
  unlockFlow(deps: {env: EnvelopeV1; send(m: unknown): Promise<{ok: boolean; error?: string}>}, factor: Factor): Promise<'unlocked' | 'wrong' | 'failed'>;
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
