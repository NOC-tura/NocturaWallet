import {ENVELOPE_KEY} from './unlockFlow';
import {MIN_PASSWORD_LENGTH, detectImport, finishOnboarding, indexesFor, newMnemonic, type Candidate, type FinishOutcome, type ProbeResult} from './onboarding';
import {addAccount, removeAccount, type AccountsOutcome} from './accountsFlow';
import {runReauth, type ReauthPageOutcome} from './reauthFlow';
import {runReveal, type RevealOutcome} from './revealFlow';
import {createWrongBackoff, runExclusive, type BusyGate} from './orchestrate';
import {backgroundVaultStore} from './vaultStore';
import type {PageMode} from './mode';
import {workerKdf} from '../vault/kdf';
import {evaluatePrf} from '../vault/passkey';
import {unb64} from '../vault/bytes';
import type {EnvelopeV1} from '../vault/envelope';
import {send} from '../ui/send';
import {readLocal} from '../shared/readLocal';

// Thin page modes for B1b-1 (the owner's screens arrive in B1b-2). The vault page renders only its
// own fixed strings (spec §1): every status line is a literal below, and the only other text it
// ever shows is the user's own phrase — the new wallet's 24 words, or the stored phrase after a
// proof (textContent, never markup). This page never touches the network: import asks the
// background (wallet.probeBalances, public keys only), and every write of the envelope is the
// background's (vault.storeEnvelope).
const FINISH_WORDS: Record<FinishOutcome, string> = {
  created: 'Wallet created. You can close this tab.',
  'created-locked': 'Wallet created. Unlock it to use it.',
  exists: 'A wallet already exists in this browser. Nothing was changed.',
  'weak-password': 'The password must be at least 12 characters.',
  'invalid-mnemonic': 'That is not a valid 12- or 24-word recovery phrase.',
  failed: 'Something went wrong. Nothing was saved.',
};
const CHOOSE_WORDS = {
  'both-funded': 'Both address types on this phrase hold funds. Choose the one to use.',
  unresolved: 'Balances could not be checked. Choose the address type to use.',
} as const;
const REAUTH_WORDS: Record<ReauthPageOutcome | 'unavailable', string> = {
  confirmed: 'Confirmed. You can close this tab.',
  wrong: 'That did not confirm it.',
  'not-unlocked': 'The wallet is locked. Unlock it first, then try again.',
  'mismatch-locked': 'That did not match this wallet, so the wallet has been locked.',
  damaged: "This wallet's stored data is damaged.",
  'no-wallet': 'No wallet on this browser yet.',
  failed: 'Something went wrong. Try again.',
  unavailable: 'This device cannot confirm with a passkey; your password still works.',
};
const ACCOUNTS_WORDS: Record<AccountsOutcome, string> = {
  done: 'Done. The accounts are updated.',
  'done-locked': 'The accounts were changed, and the wallet has been locked. Unlock it to use them.',
  'done-not-locked': 'The accounts were changed, but the wallet could not be locked. Lock it now from the Noctura menu.',
  wrong: 'That did not confirm it.',
  'mismatch-locked': 'That did not match this wallet, so the wallet has been locked.',
  damaged: "This wallet's stored data is damaged.",
  'not-unlocked': 'The wallet is locked. Unlock it first, then try again.',
  'no-wallet': 'No wallet on this browser yet.',
  'cli-single': 'A Solana CLI wallet has exactly one account.',
  'last-account': 'The last account cannot be removed.',
  'no-such-account': 'There is no account with that number.',
  'too-many-accounts': 'This wallet already has the most accounts it can hold.',
  failed: 'Something went wrong.',
};
const REVEAL_WORDS: Record<RevealOutcome['outcome'], string> = {
  shown: 'Write them down, in order, and keep them offline. Noctura never copies them anywhere.',
  wrong: 'That did not confirm it.',
  'not-unlocked': 'The wallet is locked. Unlock it first, then try again.',
  'mismatch-locked': 'That did not match this wallet, so the wallet has been locked.',
  damaged: "This wallet's stored data is damaged.",
  'no-wallet': 'No wallet on this browser yet.',
  failed: 'Something went wrong. Try again.',
};
const WAIT = 'That did not confirm it. Wait a moment before trying again.';
const UNREADABLE = "This wallet's stored data could not be read. Reload this page.";
const SECTIONS = ['unlock-section', 'create', 'import', 'reauth', 'accounts', 'reveal'] as const;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const say = (text: string): void => {
  $('status').textContent = text;
};
const store = backgroundVaultStore(send, () => readLocal(ENVELOPE_KEY));
// Cardinal rule 6: one busy flag for the page; runExclusive sets it before the first await.
let busy = false;
const gate: BusyGate = {isBusy: () => busy, setBusy: b => (busy = b)};
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** The user's own words, one list item each, as text. */
function showWords(list: HTMLElement, words: readonly string[]): void {
  list.replaceChildren(
    ...words.map(w => {
      const li = document.createElement('li');
      li.textContent = w;
      return li;
    }),
  );
}

export function startMode(mode: PageMode): void {
  const shown = mode.mode === 'unlock' ? 'unlock-section' : mode.mode;
  for (const id of SECTIONS) $(id).hidden = id !== shown;
  if (mode.mode === 'create') startCreate();
  if (mode.mode === 'import') startImport();
  if (mode.mode === 'reauth') startReauth(mode.challengeId);
  if (mode.mode === 'accounts') startAccounts();
  if (mode.mode === 'reveal') startReveal();
}

function startCreate(): void {
  let mnemonic: string | null = newMnemonic();
  const words = $('words');
  showWords(words, mnemonic.split(' '));
  const button = $<HTMLButtonElement>('create-btn');
  button.addEventListener('click', () => {
    void runExclusive(gate, async () => {
      // The fields are cleared only once the attempt goes ahead: a click the busy gate or the
      // checkbox turns away leaves what was typed.
      if (mnemonic === null) return;
      if (!$<HTMLInputElement>('saved').checked) return say('Write the words down first, then tick the box.');
      const pw = $<HTMLInputElement>('new-password');
      const pw2 = $<HTMLInputElement>('new-password2');
      const password = pw.value;
      const repeated = pw2.value;
      pw.value = '';
      pw2.value = '';
      if (password !== repeated) return say('The two passwords are not the same.');
      button.disabled = true;
      say('Creating the wallet…');
      try {
        const outcome = await finishOnboarding({...store, send, kdf: workerKdf}, {mnemonic, password, scheme: 'slip10', indexes: [0]});
        say(FINISH_WORDS[outcome]);
        if (outcome === 'created' || outcome === 'created-locked' || outcome === 'exists') {
          words.replaceChildren();
          mnemonic = null;
        }
      } finally {
        button.disabled = false;
      }
    });
  });
}

function startImport(): void {
  let pending: {mnemonic: string; password: string; candidates: Candidate[]; probe: ProbeResult} | null = null;
  const finish = async (scheme: 'slip10' | 'cli'): Promise<void> => {
    const p = pending;
    if (p === null) return;
    pending = null;
    $('choose').hidden = true;
    say('Importing…');
    const outcome = await finishOnboarding({...store, send, kdf: workerKdf}, {mnemonic: p.mnemonic, password: p.password, scheme, indexes: indexesFor(scheme, p.candidates, p.probe)});
    say(FINISH_WORDS[outcome]);
  };
  $('import-btn').addEventListener('click', () => {
    void runExclusive(gate, async () => {
      const phrase = $<HTMLTextAreaElement>('phrase');
      const pw = $<HTMLInputElement>('imp-password');
      const pw2 = $<HTMLInputElement>('imp-password2');
      const mnemonic = phrase.value;
      const password = pw.value;
      const repeated = pw2.value;
      pw.value = '';
      pw2.value = '';
      if (password.length < MIN_PASSWORD_LENGTH) return say(FINISH_WORDS['weak-password']);
      if (password !== repeated) return say('The two passwords are not the same.');
      say('Checking which addresses hold funds…');
      // Only 12 or 24 words, refused before anything is sent (detectImport).
      const detected = await detectImport(send, mnemonic);
      if (detected.outcome === 'invalid-mnemonic') return say(FINISH_WORDS['invalid-mnemonic']);
      phrase.value = '';
      const {candidates, probe, choice} = detected;
      pending = {mnemonic, password, candidates, probe};
      if ('choose' in choice) {
        $('choose-why').textContent = CHOOSE_WORDS[choice.choose];
        $('choose').hidden = false;
        say('');
        return;
      }
      await finish(choice.scheme);
    });
  });
  $('choose-slip10').addEventListener('click', () => void runExclusive(gate, () => finish('slip10')));
  $('choose-cli').addEventListener('click', () => void runExclusive(gate, () => finish('cli')));
}

// Deferred to B1b-2 (stated): this page does not show WHICH action the challenge is for — the
// background holds only its digest; B1b-2's screen asks the background for a description.
function startReauth(challengeId: string): void {
  const backoff = createWrongBackoff(sleep);
  $('reauth-form').addEventListener('submit', e => {
    e.preventDefault();
    void runExclusive(gate, async () => {
      const pw = $<HTMLInputElement>('reauth-password');
      const password = pw.value;
      pw.value = '';
      say('Checking…');
      const outcome = await backoff.run(() => runReauth({...store, send}, challengeId, {password, kdf: workerKdf}), () => say(WAIT));
      say(REAUTH_WORDS[outcome]);
    });
  });
  void store.readEnvelope().then(raw => {
    const pk = (raw as EnvelopeV1 | undefined)?.passkey;
    if (!pk) return;
    const button = $<HTMLButtonElement>('reauth-passkey');
    button.hidden = false;
    button.addEventListener('click', () => {
      void runExclusive(gate, async () => {
        let prfOutput: Uint8Array | null;
        try {
          prfOutput = await evaluatePrf(navigator.credentials, unb64(pk.credentialId), unb64(pk.prfSalt));
        } catch {
          prfOutput = null;
        }
        if (prfOutput === null) return say(REAUTH_WORDS.unavailable);
        const factor = {prfOutput};
        say(REAUTH_WORDS[await backoff.run(() => runReauth({...store, send}, challengeId, factor), () => say(WAIT))]);
      });
    });
  }, () => say(UNREADABLE));
}

function startAccounts(): void {
  const backoff = createWrongBackoff(sleep);
  const factor = () => {
    const pw = $<HTMLInputElement>('acc-password');
    const password = pw.value;
    pw.value = '';
    return {password, kdf: workerKdf};
  };
  $('add-account').addEventListener('click', () => {
    void runExclusive(gate, async () => {
      const f = factor();
      say('Adding an account…');
      say(ACCOUNTS_WORDS[await backoff.run(() => addAccount({...store, send}, f), () => say(WAIT))]);
    });
  });
  $('remove-account').addEventListener('click', () => {
    void runExclusive(gate, async () => {
      const n = Number($<HTMLInputElement>('remove-index').value);
      if (!Number.isSafeInteger(n) || n < 1) return say('Enter the number of the account to remove (1, 2, …).');
      const f = factor();
      say('Removing the account…');
      say(ACCOUNTS_WORDS[await backoff.run(() => removeAccount({...store, send}, f, n - 1), () => say(WAIT))]);
    });
  });
}

function startReveal(): void {
  const backoff = createWrongBackoff(sleep);
  const list = $('reveal-words');
  const hide = (): void => {
    list.replaceChildren();
  };
  $('reveal-form').addEventListener('submit', e => {
    e.preventDefault();
    void runExclusive(gate, async () => {
      const pw = $<HTMLInputElement>('reveal-password');
      const password = pw.value;
      pw.value = '';
      hide();
      say('Checking…');
      const outcome = await backoff.run(async () => {
        const r = await runReveal({...store, send}, {password, kdf: workerKdf});
        if (r.outcome === 'shown') showWords(list, r.words);
        return r.outcome;
      }, () => say(WAIT));
      say(REVEAL_WORDS[outcome]);
    });
  });
  $('reveal-hide').addEventListener('click', () => {
    hide();
    say('');
  });
  // Leaving the page (closing the tab, navigating, or going into the back-forward cache) or hiding
  // it (another tab, a minimised window) clears the words: they come back only with a new proof.
  addEventListener('pagehide', hide);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hide();
  });
}
