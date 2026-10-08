import {createWrongBackoff} from '../orchestrate';
import {CLOSE_CHECK_MS, exclusive, type PageDeps} from '../page';
import {recordVerified, runReveal} from '../revealFlow';
import {COMMON, PHRASE, REVEAL, cooldownLabel} from '../strings';
import type {Send} from '../types';
import {byId, closeOrHide, setText, showScreen, shown} from '../view/dom';
import {startCooldown} from '../view/cooldown';
import {mountConfirm} from './confirm';
import {mountSeed} from './seed';

export interface PhraseRun {
  show(): void;
  /** What the run still references: the phrase (its closure, #3's cells, #4's plan) and a typed password. */
  holds(): {phrase: boolean; password: boolean};
}

type Action = 'unlock' | 'setup';

/**
 * The reveal and verify modes (spec B1b-2b §3.4, §3.5; D14, D15, D23, C9), on #3's and #4's own mechanics.
 *
 * `reveal`: the PASSWORD proves the wallet against the session (runReveal: a mismatch locks; a passkey is refused at the
 * function boundary, D23 — and no passkey button is drawn, even when one is stored) → #3's pre-reveal modal → press and
 * hold 2 s → the 20 s auto-blur → "Still looking?"; the grid cancels copy, cut, drag, select and the context menu
 * (D14), and holds the words only while revealed. #3's [Continue] goes on to #4's check with the words already in
 * memory (C9: one proof for both). `verify`: the same proof → #4's check directly; the phrase is opened for the check and
 * never rendered — only #4's pool of nine.
 *
 * A passed check records `phraseVerifiedAt` (vault.phraseVerified, E15): "Recovery phrase verified", or O32 when the
 * background refused. The phrase stays in this closure until the check finishes or the page is left: `pagehide` drops it
 * (the page may sit in the back/forward cache, which then starts again at the proof); a hidden tab re-blurs #3 and
 * conceals #4 (their own rules). The modal's Cancel (or its backdrop) drops it and closes the tab — O29 if the browser
 * keeps the tab open. The password leaves the field at the click; a hidden tab or `pagehide` empties the field.
 * Rule 6: the page's one `exclusive()` gate on every button.
 */
export function mountPhrase(deps: PageDeps, kind: 'reveal' | 'verify'): PhraseRun {
  const field = byId<HTMLInputElement>('pp-password');
  const go = byId<HTMLButtonElement>('pp-continue');
  const x = byId<HTMLButtonElement>('pp-x');
  const buttons = {unlock: byId<HTMLButtonElement>('pp-unlock'), setup: byId<HTMLButtonElement>('pp-setup')};
  const helperEl = byId('pp-helper');
  const live = byId('pp-cooldown-live');
  const backoff = createWrongBackoff(deps.sleep);
  let view: 'proof' | 'notice' | 'phrase' = 'proof';
  let actions: readonly Action[] = [];
  let words: readonly string[] = [];
  /** The revision of the envelope the shown words were opened from: vault.phraseVerified's binding (the final review's m7). */
  let proven: string | null = null;
  /** Bumped whenever the phrase is dropped: a proof that settles after it shows nothing. */
  let generation = 0;
  let typed: string | null = null;
  let stopCooldown: (() => void) | null = null;

  const render = () => {
    const busy = deps.gate.isBusy();
    const proof = view === 'proof';
    const cooling = stopCooldown !== null;
    setText(byId('pp-title'), kind === 'reveal' ? PHRASE.revealTitle : PHRASE.verifyTitle);
    setText(byId('pp-lede'), kind === 'reveal' ? PHRASE.revealLede : PHRASE.verifyLede);
    shown(byId('pp-entry'), proof && !cooling);
    shown(helperEl, proof && !cooling);
    shown(byId('pp-cooldown'), cooling);
    shown(byId('pp-notice'), view === 'notice');
    shown(go, proof && !cooling);
    shown(byId('pp-paused'), cooling);
    field.disabled = busy || !proof;
    go.disabled = busy || !proof;
    x.disabled = busy && !cooling;
    for (const [name, b] of Object.entries(buttons)) {
      shown(b, view === 'notice' && actions.includes(name as Action));
      b.disabled = busy;
    }
  };
  const helper = (text: string, error: boolean) => {
    setText(helperEl, text);
    helperEl.classList.toggle('error', error);
    field.classList.toggle('is-error', error);
  };
  const notice = (line: string, help: string, next: readonly Action[]) => {
    view = 'notice';
    actions = next;
    field.value = '';
    setText(byId('pp-notice-line'), line);
    setText(byId('pp-notice-help'), help);
    shown(byId('pp-notice-help'), help !== '');
    showScreen('v-phrase-proof');
    render();
  };
  const toProof = () => {
    view = 'proof';
    actions = [];
    helper('', false);
    showScreen('v-phrase-proof');
    render();
    field.focus();
  };
  /**
   * The page was left (pagehide) or the phrase dropped since `mine`: the proof's calls to the outside world are refused
   * from here on (Task 9/10 rulings) — the envelope read and every message but `vault.lock` (a mismatch found by a proof
   * already running must still lock: it only moves the session the safe way). runReveal turns the refusal into `failed`.
   */
  const guarded = (mine: number): {readEnvelope(): Promise<unknown>; send: Send} => {
    const left = () => {
      if (mine !== generation) throw new Error('the page was left');
    };
    return {
      readEnvelope: async () => (left(), deps.store.readEnvelope()),
      send: async m => ((m as {type?: unknown}).type === 'vault.lock' ? deps.send(m) : (left(), deps.send(m))),
    };
  };
  /** The phrase out of this closure (#3 and #4 take theirs out of the DOM themselves). */
  const drop = () => {
    words = [];
    proven = null;
    generation += 1;
  };
  /** The modal's Cancel, its backdrop, #3's back: nothing is shown any more, and the tab closes. */
  const cancel = () => {
    drop();
    notice(PHRASE.nothingShown, '', []);
    deps.closeTab();
  };

  /** #4 on the proven phrase; a phrase that cannot make a plan (fix round 1, I1) is a failure, never a hung page. */
  const check = () => {
    try {
      confirm.show(words);
    } catch {
      drop();
      notice(REVEAL.outcome.failed, '', []);
    }
  };
  const seed = mountSeed(deps, {back: cancel, done: check}, {eyebrow: PHRASE.eyebrow, step: null});
  const confirm = mountConfirm(
    deps,
    {
      back: kind === 'reveal' ? () => seed.show(words) : cancel,
      // Fix round 1 (M1): a refused close hides [Close this tab]; the success (or O32) stays on screen.
      done: () => closeOrHide(deps.closeTab, f => void deps.timers.setTimeout(f, CLOSE_CHECK_MS), byId('cnf-cta')),
      verified: () => {
        // The check is finished: the phrase is no longer needed. The revision it was opened from is taken first.
        const revision = proven;
        drop();
        const mine = generation;
        void (revision === null ? Promise.resolve(false) : recordVerified(deps.send, revision)).then(ok => {
          // Left (pagehide) while the fact was being sent: the success state is gone, nothing is written to it.
          if (!ok && mine === generation) {
            setText(byId('cnf-success-body'), PHRASE.notRecorded);
            // D25 (owner, 2026-10-08): not recorded is no success — a neutral hero (the secondary tint, the info icon).
            byId('cnf-success').classList.add('vlt-neutral');
            byId('cnf-success-icon').setAttribute('href', '#i-info');
          }
        });
      },
    },
    {eyebrow: PHRASE.eyebrow, step: null, successTitle: PHRASE.verifiedTitle, successBody: PHRASE.verifiedBody, successCta: PHRASE.closeTab, final: true},
  );

  const endCooldown = () => {
    stopCooldown?.();
    stopCooldown = null;
    setText(live, '');
  };
  const cooldown = (ms: number) => {
    field.value = '';
    stopCooldown = startCooldown(deps.timers, ms, {timer: byId('pp-timer'), label: byId('pp-cooldown-label'), ring: byId('pp-ring')});
    setText(live, cooldownLabel(Math.ceil(ms / 1000)));
    render();
  };
  const prove = () => {
    if (view !== 'proof' || field.value === '') return;
    void exclusive(deps, render, async () => {
      if (view !== 'proof' || field.value === '') return;
      typed = field.value;
      field.value = '';
      helper(REVEAL.checking, false);
      const mine = generation;
      let shownWords: string[] = [];
      let shownRevision: string | null = null;
      const out = await backoff.run(async () => {
        const password = typed ?? '';
        typed = null;
        // Password only (D23): the factor type admits nothing else, and runReveal refuses a cast-in PRF output.
        const r = await runReveal(guarded(mine), {password, kdf: deps.kdf});
        if (r.outcome === 'shown') {
          shownWords = r.words;
          shownRevision = r.revision;
        }
        return r.outcome;
      }, cooldown);
      endCooldown();
      // Dropped (pagehide) while the proof ran: nothing of it is shown — no word, no notice (a back/forward-cache return
      // has already put the proof back).
      if (mine !== generation) return helper('', false);
      if (out === 'shown') {
        words = shownWords;
        proven = shownRevision;
        view = 'phrase';
        helper('', false);
        if (kind === 'reveal') seed.show(words);
        else check();
        return;
      }
      if (out === 'wrong') return helper(COMMON.wrongConfirm, true);
      if (out === 'not-unlocked') return notice(REVEAL.outcome['not-unlocked'], '', ['unlock']);
      if (out === 'mismatch-locked') return notice(REVEAL.outcome['mismatch-locked'], '', []);
      if (out === 'damaged') return notice(COMMON.damaged, COMMON.damagedHelp, []);
      if (out === 'no-wallet') return notice(COMMON.noWallet, '', ['setup']);
      helper(REVEAL.outcome.failed, false);
    });
  };

  deps.gate.onIdle(render);
  byId('pp-form').addEventListener('submit', e => {
    e.preventDefault();
    prove();
  });
  go.addEventListener('click', prove);
  const close = () => {
    drop();
    field.value = '';
    deps.closeTab();
  };
  x.addEventListener('click', () => {
    // During the cooldown the gate is held by the backoff's wait — X closes the tab regardless (the wait ends in a wrong
    // outcome, and the drop above makes the proof that ends it show nothing).
    if (stopCooldown !== null) return close();
    void exclusive(deps, render, async () => close());
  });
  buttons.unlock.addEventListener('click', () => {
    if (actions.includes('unlock')) void exclusive(deps, render, async () => deps.go('unlock.html?mode=unlock'));
  });
  buttons.setup.addEventListener('click', () => {
    if (actions.includes('setup')) void exclusive(deps, render, async () => deps.go('unlock.html?mode=welcome'));
  });
  deps.onLeave(why => {
    field.value = '';
    if (why === 'pagehide') drop();
  });
  // A page restored from the back/forward cache dropped its phrase on `pagehide`: it starts again at the proof.
  deps.onReturn(why => {
    if (why === 'restored') toProof();
  });

  return {
    show: toProof,
    holds: () => ({phrase: words.length > 0 || seed.holds() || confirm.holds(), password: typed !== null || field.value !== ''}),
  };
}
