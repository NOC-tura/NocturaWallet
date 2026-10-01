import {evaluatePrf} from '../../vault/passkey';
import {unb64} from '../../vault/bytes';
import type {ReauthFactor} from '../../vault/reauth';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {proveFactor, replaceEmptyWallet, type FactorProof, type ReplaceOutcome} from '../forgetFlow';
import {commitWallet, detectImport, indexesFor, prepareWallet, type Candidate, type PreparedWallet, type ProbeResult} from '../onboarding';
import {createWrongBackoff} from '../orchestrate';
import {exclusive, type PageDeps} from '../page';
import {storedVault} from '../stored';
import {COMMON, IMPORT, PASSWORD, RESTORE, RETRY} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';
import {existsLines} from './createRun';
import {mountImport, type Scheme} from './importScreen';
import type {PasswordRefusal, PasswordScreen} from './password';

export interface RetryRun {
  /** Reads the stored vault, then shows the password step (or what the vault reads as, on #8). */
  show(): Promise<void>;
  /** For the tests: which of B's phrase, B prepared and the proof this run still references. */
  holds(): {phrase: boolean; prepared: boolean; proof: boolean};
}

type Action = {label: string; run(): void};

/**
 * #40's "Try a different seed" (D41, spec §3.8 `source=retry`, E5 §11.13): first the password (or
 * passkey) of the wallet being replaced — the factor proof, which records the revision it proved —
 * then #8 → the scheme → #5 "Import · 2 / 2" for the new wallet B. At the finish B is encrypted first,
 * then the proven wallet is deleted under the background's unfunded guard (C6) and B stored at once
 * (forgetFlow.replaceEmptyWallet: the guard is always sent). The two writes are not atomic: a failed
 * store after the delete keeps B in this page's memory behind [Try again], which retries the store
 * alone; a retry answered `wallet-exists` says so and stops (R2-L6). Funds that arrived meanwhile
 * (`funded`) change nothing. A delete that may have landed (its reply lost: `failed`) is never sent
 * twice blind: [Try again] reads the vault first — gone → the store alone; still the proven revision →
 * the guarded delete again; anything else → `busy` (controller addition, Task 13).
 *
 * What this run holds, and for how long (plan review H2; Scope 19): B's phrase from #8's Continue, and
 * the factor proof from the confirm step, until the run ends — B stored, any `stop` answer (`exists`,
 * `funded`, `unreachable`, `coordinator-refused`), any notice — and with the page (`pagehide`; a page
 * restored from the back/forward cache starts again at the password step). A hidden tab keeps them (the
 * hidden-tab rule is the password's, §3.5). Back from #5 puts the phrase back in #8's field (not memory);
 * Back from #8 drops the proof. B prepared (`next`: its envelope AND its session secret keys) exists only
 * behind a pending [Try again], and goes at every end and whenever the tab is hidden — while the run waits
 * on it too: the password it was encrypted under is dropped then (§3.5, L5), so B is encrypted again under
 * the password typed next — never stored under one the user was told to replace.
 *
 * The password step follows #9/#10's rules: the typed password leaves the field at the click; a hidden tab
 * or `pagehide` empties the field; a passkey's PRF output is zeroed on every path (proveFactor, or here
 * when the page was left during the prompt). A wrong factor gets the engine's backoff only (D11), its wait
 * said once in the step's one polite region; damaged and no-wallet are never charged to it.
 *
 * Rule 6 (spec §7.6): every button runs through the page's one `exclusive()` gate, guarded by `view`:
 * 'entry' (the password step), 'import' (the run moved on to #8 and #5), 'off' (before show(), after the
 * run ended or the page was left).
 */
export function createRetryRun(deps: PageDeps, o: {password: PasswordScreen}): RetryRun {
  const field = byId<HTMLInputElement>('rp-password');
  const confirm = byId<HTMLButtonElement>('rp-confirm');
  const passkey = byId<HTMLButtonElement>('rp-passkey');
  const back = byId<HTMLButtonElement>('rp-back');
  const backoff = createWrongBackoff(deps.sleep);
  const startAgain: Action = {label: RESTORE.startAgain, run: () => deps.go('unlock.html?mode=import&source=retry')};
  const setUp: Action = {label: RESTORE.setUp, run: () => deps.go('unlock.html?mode=welcome')};
  let view: 'off' | 'entry' | 'import' = 'off';
  let pk: {credentialId: string; prfSalt: string} | null = null;
  let proof: FactorProof | null = null;
  /** B, encrypted, once #5's password is set — only behind a pending [Try again]. */
  let next: PreparedWallet | null = null;
  /** The proven wallet is gone (its delete landed): a [Try again] stores B alone. */
  let deleted = false;
  /** The last delete's answer was not one the background names (a lost reply): it may have landed. */
  let uncertain = false;
  /** B's phrase, from #8's Continue to the run's end. */
  let phrase: string | null = null;
  /** Bumped by pagehide, a restart and #8's idle wipe: work that settles after either must not move the run on. */
  let generation = 0;
  /** Bumped whenever the tab is hidden or left: B prepared during it went with its password. */
  let leaves = 0;

  /** The run ended (or never began): nothing of B or of the proof is kept. */
  const end = () => {
    next = null;
    proof = null;
    phrase = null;
  };

  const render = () => {
    const busy = deps.gate.isBusy();
    const entry = view === 'entry';
    field.disabled = busy || !entry;
    confirm.disabled = busy || !entry;
    passkey.disabled = busy || !entry || pk === null;
    back.disabled = busy || !entry;
    shown(passkey, pk !== null);
  };
  const helper = (text: string, error: boolean) => {
    setText(byId('rp-helper'), text);
    byId('rp-helper').classList.toggle('error', error);
    field.classList.toggle('is-error', error);
  };
  /** The password step, empty. */
  const toEntry = () => {
    view = 'entry';
    field.value = '';
    helper('', false);
    showScreen('v-retry');
    render();
    field.focus();
  };
  /** Ends the run on #8: the line (and help) in place of the field, at most one action. */
  const notice = (line: string, help: string, action: Action | null) => {
    end();
    view = 'import';
    screen.show();
    screen.notice(line, help, action);
  };

  /** The factor proof, under the backoff; the proof is kept only while the page is still this run's. */
  const proved = async (factor: ReauthFactor) => {
    const started = generation;
    const r = await backoff.run(
      async () => {
        const out = await proveFactor(deps.store.readEnvelope, factor);
        if (out.outcome === 'proven' && started === generation) proof = out.proof;
        return out.outcome;
      },
      () => {
        if (started === generation) helper(COMMON.waitConfirm, true);
      },
    );
    if (started !== generation) return;
    field.value = '';
    if (r === 'proven') {
      helper('', false);
      view = 'import';
      return screen.show();
    }
    if (r === 'wrong') return helper(COMMON.wrongConfirm, true);
    if (r === 'no-wallet') return notice(COMMON.noWallet, '', setUp);
    if (r === 'damaged') return notice(COMMON.damaged, COMMON.damagedHelp, null);
    helper(COMMON.failedTryAgain, false);
  };

  const proveWithPassword = () => {
    if (view !== 'entry' || field.value === '') return;
    void exclusive(deps, render, async () => {
      if (view !== 'entry' || field.value === '') return;
      // The typed password leaves the field at the click and goes to the attempt in the same turn (#9, #10).
      const password = field.value;
      field.value = '';
      await proved({password, kdf: deps.kdf});
    });
  };
  const proveWithPasskey = () => {
    if (view !== 'entry' || pk === null) return;
    void exclusive(deps, render, async () => {
      const key = pk;
      if (view !== 'entry' || key === null) return;
      field.value = '';
      const started = generation;
      let prfOutput: Uint8Array | null;
      try {
        prfOutput = await evaluatePrf(deps.credentials, unb64(key.credentialId), unb64(key.prfSalt));
      } catch {
        prfOutput = null;
      }
      if (started !== generation) {
        prfOutput?.fill(0);
        return;
      }
      if (prfOutput === null) return helper(COMMON.passkeyUnavailableConfirm, false);
      // proveFactor zeroes the PRF output on every path.
      await proved({prfOutput});
    });
  };

  /** The delete-then-store, or what a [Try again] after an earlier answer still needs. */
  const write = async (wallet: PreparedWallet, held: FactorProof): Promise<ReplaceOutcome> => {
    const send = {...deps.store, send: deps.send};
    if (deleted) return commitWallet(send, wallet);
    if (uncertain) {
      let raw: unknown;
      try {
        raw = await deps.store.readEnvelope();
      } catch {
        return 'failed';
      }
      const stored = storedVault(raw);
      if (stored.kind === 'none') {
        // The delete landed; its reply was lost. Never a second delete: the store alone.
        uncertain = false;
        deleted = true;
        const out = await commitWallet(send, wallet);
        return out === 'failed' ? 'store-failed' : out;
      }
      if (stored.kind === 'damaged') return 'damaged';
      if (envelopeRevision(stored.env) !== held.revision) return 'busy';
      uncertain = false;
    }
    return replaceEmptyWallet(send, held, wallet);
  };

  /** #5's finish: B encrypted (once per password), then the write. */
  const finish = async (password: string, scheme: Scheme, indexes: number[]): Promise<PasswordRefusal | null> => {
    const held = proof;
    const words = phrase;
    if (held === null || words === null) {
      end();
      return {line: COMMON.failedTryAgain, then: 'stop'};
    }
    const started = generation;
    const seen = leaves;
    let wallet = next;
    if (wallet === null) {
      try {
        wallet = await prepareWallet(deps.kdf, {mnemonic: words, password, scheme, indexes});
      } catch {
        wallet = null;
      }
      // The page was left (pagehide) while B was encrypted: the run was dropped; nothing is sent.
      if (started !== generation) return null;
      if (wallet === null) return {line: COMMON.failedTryAgain, then: 'retype'};
    }
    // Held only while the write runs and behind its [Try again]; a hidden tab takes it (onLeave).
    next = seen === leaves ? wallet : null;
    const out = await write(wallet, held);
    // The page was left (pagehide) while this ran: the run was dropped; a restored page starts again.
    if (started !== generation) return null;
    /** A [Try again] answer: B prepared stays only if the tab was not hidden meanwhile (its password went then). */
    const retry = (line: string): PasswordRefusal => {
      next = seen === leaves ? wallet : null;
      return {line, then: 'retry'};
    };
    const stop = (line: string): PasswordRefusal => {
      end();
      return {line, then: 'stop'};
    };
    switch (out) {
      case 'created':
      case 'created-locked':
        end();
        view = 'off';
        deps.go('wallet.html#/imported');
        return null;
      case 'store-failed':
        deleted = true;
        return retry(RETRY.storeFailed);
      case 'exists': {
        // R2-L6: another tab created a wallet — said, and the run stops: no loop, no second delete.
        end();
        const lines = await existsLines(deps);
        return started === generation ? lines : null;
      }
      case 'send-open':
        return retry(RESTORE.sendOpen);
      case 'funded':
        return stop(RETRY.funded);
      case 'unreachable':
        return stop(RETRY.unreachable);
      case 'coordinator-refused':
        return stop(RETRY.refused);
      // Nothing was deleted: back to #8, which says so; [Start again] → the retry path's start.
      case 'busy':
        notice(RESTORE.busy, '', startAgain);
        return null;
      case 'unlocked':
        notice(RESTORE.unlocked, '', startAgain);
        return null;
      case 'no-wallet':
        notice(COMMON.noWallet, '', setUp);
        return null;
      case 'damaged':
        notice(COMMON.damaged, COMMON.damagedHelp, null);
        return null;
      default:
        // After the delete, a failed store is 'store-failed' above; here the delete itself may have landed.
        if (deleted) return retry(RETRY.storeFailed);
        uncertain = true;
        return retry(COMMON.failedTryAgain);
    }
  };

  const toPassword = (scheme: Scheme, candidates: Candidate[], probe: ProbeResult) => {
    const indexes = indexesFor(scheme, candidates, probe);
    screen.clear();
    next = null;
    o.password.show({
      eyebrow: PASSWORD.onboarding,
      step: PASSWORD.stepImport,
      back: () => {
        // Back from #5 (or from its [Try again]): the phrase goes back into #8's field, not memory.
        const words = phrase;
        phrase = null;
        next = null;
        screen.show({phrase: words ?? ''});
      },
      finish: password => finish(password, scheme, indexes),
    });
  };
  /** The scheme choice ends #8's Continue (the gate frees for the pick); the phrase waits here. */
  const choose = async (why: string, started: number, candidates: Candidate[], probe: ProbeResult) => {
    const scheme = await screen.choose(why);
    if (scheme === null || started !== generation || phrase === null) {
      phrase = null;
      return;
    }
    toPassword(scheme, candidates, probe);
  };

  const screen = mountImport(deps, {
    back: () => {
      // Back from #8 (a notice included): to the password step; the proof is proven again.
      end();
      toEntry();
    },
    // The idle wipe (60 s) on #8 — a hung probe or an open choice included: the attempt ends here.
    wiped: () => {
      phrase = null;
      generation += 1;
    },
    next: async typed => {
      const started = generation;
      screen.line(IMPORT.checking);
      const detected = await detectImport(deps.send, typed);
      if (started !== generation) return;
      if (detected.outcome === 'invalid-mnemonic') {
        screen.line(IMPORT.invalid);
        return;
      }
      screen.line(null);
      const {candidates, probe, choice} = detected;
      phrase = typed;
      if ('choose' in choice) void choose(choice.choose === 'both-funded' ? IMPORT.bothFunded : IMPORT.unresolved, started, candidates, probe);
      else toPassword(choice.scheme, candidates, probe);
    },
  });

  /** The run's start: the stored vault read first; no wallet and a damaged one are said before anything is typed. */
  const start = async () => {
    generation += 1;
    const started = generation;
    end();
    deleted = false;
    uncertain = false;
    pk = null;
    view = 'off';
    field.value = '';
    helper('', false);
    showScreen('v-retry');
    render();
    let raw: unknown;
    try {
      raw = await deps.store.readEnvelope();
    } catch {
      if (started === generation) notice(COMMON.unreadable, '', null);
      return;
    }
    if (started !== generation) return;
    const stored = storedVault(raw);
    if (stored.kind === 'none') return notice(COMMON.noWallet, '', setUp);
    if (stored.kind === 'damaged') return notice(COMMON.damaged, COMMON.damagedHelp, null);
    pk = stored.env.passkey ?? null;
    toEntry();
  };

  deps.gate.onIdle(render);
  byId('rp-form').addEventListener('submit', e => {
    e.preventDefault();
    proveWithPassword();
  });
  confirm.addEventListener('click', proveWithPassword);
  passkey.addEventListener('click', proveWithPasskey);
  back.addEventListener('click', () => {
    if (view !== 'entry') return;
    void exclusive(deps, render, async () => {
      if (view !== 'entry') return;
      end();
      view = 'off';
      deps.go('wallet.html#/imported');
    });
  });
  deps.onLeave(why => {
    field.value = '';
    leaves += 1;
    // B prepared goes with the password it was encrypted under (§3.5 drops that password now).
    next = null;
    if (why !== 'pagehide') return;
    // The page may sit in the back/forward cache: nothing of the run stays behind.
    end();
    view = 'off';
    generation += 1;
  });
  deps.onReturn(why => {
    if (why === 'restored') void start();
  });

  return {
    show: start,
    holds: () => ({phrase: phrase !== null, prepared: next !== null, proof: proof !== null}),
  };
}
