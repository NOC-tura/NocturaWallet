import {ENVELOPE_KEY, unlockFlow} from './unlockFlow';
import {attemptPasskeyUnlock, attemptUnlock, createWrongBackoff, runExclusive, type BusyGate, type Outcome} from './orchestrate';
import {workerKdf} from '../vault/kdf';
import {evaluatePrf} from '../vault/passkey';
import {unb64} from '../vault/bytes';
import {send} from '../ui/send';
import {readLocal} from '../shared/readLocal';
import type {EnvelopeV1} from '../vault/envelope';
import {pageMode} from './mode';
import {startMode} from './modes';

// unlock.html?mode=create|import|reauth&challenge=…|accounts|reveal shows that mode's section; no
// mode is the unlock page below, whose handlers stay registered either way (on a hidden section).
startMode(pageMode(location.search));

// The vault page renders only its own fixed strings — nothing from a dApp, a token or the
// network (spec §1). Every status line below is one of the WORDS/literal strings in this file.
const status = document.getElementById('status') as HTMLParagraphElement;
const pw = document.getElementById('password') as HTMLInputElement;
const unlockBtn = document.getElementById('unlock') as HTMLButtonElement;
const passkeyBtn = document.getElementById('passkey') as HTMLButtonElement;

const WORDS: Record<Outcome | 'unavailable', string> = {
  unlocked: 'Unlocked. You can close this tab.',
  wrong: 'That did not unlock the wallet.',
  failed: 'Unlock failed. Try again.',
  damaged: "This wallet's stored data is damaged.",
  'no-wallet': 'No wallet on this browser yet.',
  unavailable: 'This device cannot unlock the wallet with a passkey; your password still works.',
};

const readEnvelope = (): Promise<unknown> => readLocal(ENVELOPE_KEY);

// Cardinal rule 6 (no double-submit): one busy flag for the whole page, not one per button —
// while a passkey prompt is in flight the password form must not be submittable, and vice
// versa. `runExclusive` marks it busy synchronously, before either action's first `await`.
let busy = false;
const gate: BusyGate = {isBusy: () => busy, setBusy: b => (busy = b)};

// Spec §2: consecutive wrong outcomes add a growing wait before the buttons come back. It runs
// inside runExclusive + withButtonsDisabled, so both buttons stay disabled and the gate held.
const WAITING = 'That did not unlock the wallet. Wait a moment before trying again.';
const backoff = createWrongBackoff(ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
// The delay is a person-at-the-keyboard throttle held in this page's memory: reloading
// unlock.html resets the streak. Spec §2 is explicit that against a stolen envelope only
// Argon2id's cost stands, so this is deliberate, not an oversight.
const showWaiting = (): void => {
  pw.value = ''; // a near-miss password must not sit in the field for the whole wait
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
    withButtonsDisabled(() => backoff.run(() => attemptUnlock({readEnvelope, send, unlockFlow}, {password, kdf: workerKdf}), showWaiting)),
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
            readEnvelope,
            send,
            unlockFlow,
          }),
        showWaiting,
      ),
    ),
  );
  if (result !== 'busy') status.textContent = WORDS[result];
}

void readEnvelope().then(raw => {
  const pk = (raw as EnvelopeV1 | undefined)?.passkey;
  if (!pk) return;
  passkeyBtn.hidden = false;
  passkeyBtn.addEventListener('click', () => void handlePasskeyClick(pk));
}, () => {
  status.textContent = "This wallet's stored data could not be read. Reload this page.";
});
