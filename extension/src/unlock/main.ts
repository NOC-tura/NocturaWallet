import {ENVELOPE_KEY, unlockFlow} from './unlockFlow';
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

const WORDS = {unlocked: 'Unlocked. You can close this tab.', wrong: 'That did not unlock the wallet.', failed: 'Unlock failed. Try again.'};

async function envelope(): Promise<EnvelopeV1 | null> {
  return ((await api.storage.local.get(ENVELOPE_KEY))[ENVELOPE_KEY] as EnvelopeV1 | undefined) ?? null;
}

/**
 * Cardinal rule 6 (no double-submit): both buttons are disabled for the whole call, and the
 * `finally` re-enables them and clears the password field on every exit path — including a
 * thrown error — so the page can never get stuck mid-unlock.
 */
async function run(factor: Parameters<typeof unlockFlow>[1]): Promise<void> {
  const env = await envelope();
  if (!env) {
    status.textContent = 'No wallet on this browser yet.';
    return;
  }
  unlockBtn.disabled = true;
  passkeyBtn.disabled = true;
  status.textContent = 'Unlocking…';
  try {
    const r = await unlockFlow({env, send}, factor);
    status.textContent = WORDS[r];
  } finally {
    unlockBtn.disabled = false;
    passkeyBtn.disabled = false;
    pw.value = '';
  }
}

document.getElementById('pw')?.addEventListener('submit', e => {
  e.preventDefault();
  void run({password: pw.value, kdf: workerKdf});
});

void envelope().then(env => {
  if (!env?.passkey) return;
  passkeyBtn.hidden = false;
  passkeyBtn.addEventListener('click', async () => {
    const pk = env.passkey;
    if (!pk) return;
    // Disabled immediately on tap, before evaluatePrf even starts (cardinal rule 6) — a
    // second tap while the platform's passkey prompt is open must not fire a second one.
    passkeyBtn.disabled = true;
    let out: Uint8Array | undefined;
    try {
      out = (await evaluatePrf(navigator.credentials, unb64(pk.credentialId), unb64(pk.prfSalt))) ?? undefined;
      if (!out) {
        status.textContent = 'This device cannot unlock the wallet with a passkey; your password still works.';
        return;
      }
      const prfOutput = out;
      out = undefined; // ownership passes to run(), whose unlockFlow call zeroes it on every path
      await run({prfOutput});
    } catch {
      status.textContent = 'This device cannot unlock the wallet with a passkey; your password still works.';
    } finally {
      // Only reachable non-empty if evaluatePrf returned a PRF output but run() was never
      // called with it (e.g. an error thrown between the two) — zero it rather than leak it.
      out?.fill(0);
      passkeyBtn.disabled = false;
    }
  });
});
