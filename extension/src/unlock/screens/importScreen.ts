import {acceptedPhrase} from '../onboarding';
import {exclusive, type PageDeps} from '../page';
import {IMPORT} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';
import {phraseCells, phraseWords} from '../view/words';

/** #8's idle timer (spec §3.8): the warning after 48 s without input, the wipe at 60 s. */
export const IDLE_WARN_MS = 48_000;
export const IDLE_WIPE_MS = 60_000;

export type Scheme = 'slip10' | 'cli';

export interface ImportScreen {
  /** Shows #8; `phrase` puts back what the run held (back from #5). */
  show(o?: {phrase?: string}): void;
  /** The status line under the field (checking, a refusal), or none. */
  line(text: string | null): void;
  /**
   * The scheme choice, in the design's chrome; resolves with the user's pick — or with null when the choice
   * ends without one (Back, the idle wipe, pagehide), so whoever waits on it lets the phrase go.
   */
  choose(why: string): Promise<Scheme | null>;
  /** Empties the field and its grid; the screen is no longer the run's (it moved on to #5). */
  clear(): void;
}

/**
 * #8 import (spec §3.8): the phrase field, its mono cell grid as the words are typed, the paste toast
 * that says Noctura cannot clear the clipboard, the idle timer that wipes the field after 60 s without
 * input, the D8 banner, and Continue — enabled only for 12 or 24 words with a valid checksum. What
 * Continue does belongs to the run (`next`): a plain import detects the scheme; #39's restore proves
 * the phrase against the stored wallet; #40's retry imports the new wallet. The page holds the phrase
 * in this field only; nothing here sends it anywhere, and nothing here reads the clipboard — a paste
 * is the browser's own, and the paste event only tells the screen to show the toast.
 *
 * Rule 6 (spec §7.6): Continue, Back, [Keep working] and the two scheme rows run through the page's one
 * `exclusive()` gate, each guarded by `phase` (the `offered`-style guard of welcome.ts): `off` before
 * show() and once the run has moved on or Back was taken, `typing`, `checking` (the run's `next` is
 * running), `choosing`. The field follows the phase, not the gate (Task 8's M2): keystrokes inside a
 * floor are kept. The scheme choice ends `next` (and so frees the gate) — a pick is its own gated action.
 *
 * The idle timer runs whenever the field holds something the user can act on (typing, choosing); at 60 s
 * the field and grid are emptied and an open choice ends with null. A hidden tab keeps the phrase (Scope 19,
 * review M4); `pagehide` empties everything (the page may sit in the back/forward cache).
 */
export function mountImport(deps: PageDeps, handlers: {back(): void; next(phrase: string): Promise<void>}): ImportScreen {
  const field = byId<HTMLTextAreaElement>('imp-phrase');
  const grid = byId('imp-grid');
  const cta = byId<HTMLButtonElement>('imp-continue');
  const back = byId<HTMLButtonElement>('imp-back');
  const keep = byId<HTMLButtonElement>('imp-keep');
  const slip10 = byId<HTMLButtonElement>('imp-choose-slip10');
  const cli = byId<HTMLButtonElement>('imp-choose-cli');
  let phase: 'off' | 'typing' | 'checking' | 'choosing' = 'off';
  let lastInput = deps.timers.now();
  let idle: number | null = null;
  let pasted = false;
  let choosing: ((s: Scheme | null) => void) | null = null;

  const render = () => {
    const busy = deps.gate.isBusy();
    const words = phraseWords(field.value);
    const valid = acceptedPhrase(field.value);
    grid.replaceChildren(...(words.length > 0 ? phraseCells(words) : []));
    shown(grid, words.length > 0);
    shown(byId('imp-valid'), valid);
    setText(byId('imp-valid-text'), valid ? IMPORT.valid(words.length) : '');
    shown(byId('imp-count'), words.length > 0 && !valid);
    setText(byId('imp-count'), words.length > 0 && !valid ? IMPORT.count(words.length, words.length <= 12 ? 12 : 24) : '');
    const open = phase === 'typing' || phase === 'choosing';
    field.disabled = phase !== 'typing';
    cta.disabled = busy || phase !== 'typing' || !valid;
    back.disabled = busy || !open;
    keep.disabled = busy || !open;
    slip10.disabled = busy || phase !== 'choosing';
    cli.disabled = busy || phase !== 'choosing';
  };
  const stopIdle = () => {
    if (idle !== null) deps.timers.clearInterval(idle);
    idle = null;
    shown(byId('imp-idle'), false);
    shown(keep, false);
  };
  const line = (text: string | null) => {
    setText(byId('imp-line'), text ?? '');
    shown(byId('imp-line'), text !== null);
  };
  /** Ends an open choice: the pick, or null (no pick) — the run then lets the phrase go. */
  const settle = (scheme: Scheme | null) => {
    const done = choosing;
    choosing = null;
    shown(byId('imp-choose'), false);
    done?.(scheme);
  };
  /** Empties the field, its grid, the toast and the line; an open choice ends with null. */
  const empty = () => {
    stopIdle();
    settle(null);
    field.value = '';
    pasted = false;
    shown(byId('imp-toast'), false);
    line(null);
  };
  /** The idle wipe (60 s): the field and grid emptied; the screen stays up, ready for a new phrase. */
  const wipe = () => {
    empty();
    if (phase === 'choosing') phase = 'typing';
    render();
  };
  /** The screen is no longer the run's: Back, the run moved on to #5, pagehide. */
  const end = () => {
    empty();
    phase = 'off';
    render();
  };
  const watchIdle = () => {
    lastInput = deps.timers.now();
    shown(byId('imp-idle'), false);
    shown(keep, false);
    if (field.value === '') return stopIdle();
    if (idle !== null) return;
    idle = deps.timers.setInterval(() => {
      const quiet = deps.timers.now() - lastInput;
      if (quiet >= IDLE_WIPE_MS) return wipe();
      if (quiet >= IDLE_WARN_MS) {
        setText(byId('imp-idle-title'), IMPORT.idleTitle(Math.ceil((IDLE_WIPE_MS - quiet) / 1000)));
        shown(byId('imp-idle'), true);
        shown(keep, true);
      }
    }, 1_000);
  };

  deps.gate.onIdle(render);
  // The browser pastes into the field itself; the event only marks the input that follows as a paste.
  field.addEventListener('paste', () => {
    pasted = true;
  });
  field.addEventListener('input', () => {
    if (phase !== 'typing') return;
    shown(byId('imp-toast'), pasted);
    pasted = false;
    line(null);
    watchIdle();
    render();
  });
  keep.addEventListener('click', () => {
    if (phase !== 'typing' && phase !== 'choosing') return;
    void exclusive(deps, render, async () => {
      if (phase !== 'typing' && phase !== 'choosing') return;
      watchIdle();
      if (phase === 'typing') field.focus();
    });
  });
  back.addEventListener('click', () => {
    if (phase !== 'typing' && phase !== 'choosing') return;
    void exclusive(deps, render, async () => {
      if (phase !== 'typing' && phase !== 'choosing') return;
      end();
      handlers.back();
    });
  });
  cta.addEventListener('click', () => {
    if (phase !== 'typing') return;
    void exclusive(deps, render, async () => {
      if (phase !== 'typing' || !acceptedPhrase(field.value)) return;
      stopIdle();
      phase = 'checking';
      render();
      try {
        await handlers.next(field.value);
      } finally {
        // Refused (an invalid phrase): typing again, the phrase still in the field and its timer running.
        // Otherwise the run opened the choice (`choosing`) or moved on (`off`).
        if (phase === 'checking') {
          phase = 'typing';
          watchIdle();
        }
      }
    });
  });
  const pick = (scheme: Scheme) => () => {
    if (phase !== 'choosing') return;
    void exclusive(deps, render, async () => {
      if (phase !== 'choosing' || choosing === null) return;
      stopIdle();
      // The run moves on to #5 with the pick (it calls clear()).
      phase = 'off';
      settle(scheme);
    });
  };
  slip10.addEventListener('click', pick('slip10'));
  cli.addEventListener('click', pick('cli'));
  deps.onLeave(why => {
    if (why === 'pagehide') end();
  });

  return {
    show(o = {}) {
      empty();
      field.value = o.phrase ?? '';
      phase = 'typing';
      if (field.value !== '') watchIdle();
      render();
      showScreen('v-import');
    },
    line,
    choose(why) {
      settle(null);
      setText(byId('imp-choose-why'), why);
      shown(byId('imp-choose'), true);
      phase = 'choosing';
      watchIdle();
      render();
      return new Promise(resolve => {
        choosing = resolve;
      });
    },
    clear: end,
  };
}
