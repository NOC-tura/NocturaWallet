import {ENVELOPE_KEY, unlockFlow} from './unlockFlow';
import {attemptPasskeyUnlock, attemptUnlock, createWrongBackoff, runExclusive, type BusyGate, type Outcome} from './orchestrate';
import {workerKdf} from '../vault/kdf';
import {evaluatePrf} from '../vault/passkey';
import {unb64} from '../vault/bytes';
import {send} from '../ui/send';
import type {EnvelopeV1} from '../vault/envelope';

// The vault page renders only its own fixed strings — nothing from a dApp, a token or the
// network (spec §1). Every status line below is one of the WORDS/literal strings in this file.
interface LocalLike {
  storage: {local: {get(k: string): Promise<Record<string, unknown>>}};
}
const g = globalThis as unknown as {browser?: LocalLike; chrome?: LocalLike};
const api = (g.browser ?? g.chrome) as LocalLike;
const status = document.getElementById('status') as HTMLParagraphElement;
const pw = document.getElementById('password') as HTMLInputElement;
const unlockBtn = document.getElementById('unlock') as HTMLButtonElement;
const passkeyBtn = document.getElementById('passkey') as HTMLButtonElement;

const WORDS: Record<Outcome | 'unavailable', string> = {
  unlocked: 'Unlocked. You can close this tab.',
  wrong: 'That did not unlock the wallet.',
  failed: 'Unlock failed. Try again.',
  'no-wallet': 'No wallet on this browser yet.',
  unavailable: 'This device cannot unlock the wallet with a passkey; your password still works.',
};

async function envelope(): Promise<EnvelopeV1 | null> {
  return ((await api.storage.local.get(ENVELOPE_KEY))[ENVELOPE_KEY] as EnvelopeV1 | undefined) ?? null;
}

// Cardinal rule 6 (no double-submit): one busy flag for the whole page, not one per button —
// while a passkey prompt is in flight the password form must not be submittable, and vice
// versa. `runExclusive` marks it busy synchronously, before either action's first `await`.
let busy = false;
const gate: BusyGate = {isBusy: () => busy, setBusy: b => (busy = b)};

// Spec §2: consecutive wrong outcomes add a growing wait before the buttons come back. It runs
// inside runExclusive + withButtonsDisabled, so both buttons stay disabled and the gate held.
const WAITING = 'That did not unlock the wallet. Wait a moment before trying again.';
const backoff = createWrongBackoff(ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
const showWaiting = (): void => {
  status.textContent = WAITING;
};

/**
 * Disables both buttons for the duration of `action` and re-enables them — and clears the
 * password field — in a `finally`, so a thrown error can never leave the page stuck mid-unlock.
 */
async function withButtonsDisabled<T>(action: () => Promise<T>): Promise<T> {
  unlockBtn.disabled = true;
  passkeyBtn.disabled = true;
  status.textContent = 'Unlocking…';
  try {
    return await action();
  } finally {
    unlockBtn.disabled = false;
    passkeyBtn.disabled = false;
    pw.value = '';
  }
}

async function handlePasswordSubmit(): Promise<void> {
  const password = pw.value;
  const result = await runExclusive(gate, () =>
    withButtonsDisabled(() => backoff.run(() => attemptUnlock({envelope, send, unlockFlow}, {password, kdf: workerKdf}), showWaiting)),
  );
  if (result !== 'busy') status.textContent = WORDS[result];
}

document.getElementById('pw')?.addEventListener('submit', e => {
  e.preventDefault();
  void handlePasswordSubmit();
});

async function handlePasskeyClick(pk: NonNullable<EnvelopeV1['passkey']>): Promise<void> {
  const result = await runExclusive(gate, () =>
    withButtonsDisabled(() =>
      backoff.run(
        () =>
          attemptPasskeyUnlock({
            evaluatePrf: () => evaluatePrf(navigator.credentials, unb64(pk.credentialId), unb64(pk.prfSalt)),
            envelope,
            send,
            unlockFlow,
          }),
        showWaiting,
      ),
    ),
  );
  if (result !== 'busy') status.textContent = WORDS[result];
}

void envelope().then(env => {
  const pk = env?.passkey;
  if (!pk) return;
  passkeyBtn.hidden = false;
  passkeyBtn.addEventListener('click', () => void handlePasskeyClick(pk));
});
