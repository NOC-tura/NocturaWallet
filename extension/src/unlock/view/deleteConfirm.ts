import type {Timers} from '../page';
import {TYPED_DELETE} from '../strings';
import {h, setText, shown} from './dom';

/** #37's word and hold (DeleteWallet.tsx WORD, HOLD_MS; HoldButton.tsx HOLD_TICK_MS). */
export const CONFIRM_WORD = 'DELETE';
export const HOLD_MS = 1_000;
export const HOLD_TICK_MS = 30;

/** The elements of one typed-word-and-hold confirmation in unlock.html. */
export interface ConfirmParts {
  field: HTMLInputElement;
  /** The "Type DELETE to confirm" eyebrow, and the "Confirmation matched" one that replaces it. */
  eyebrow: HTMLElement;
  matched: HTMLElement;
  box: HTMLElement;
  check: HTMLElement;
  help: HTMLElement;
  caption: HTMLElement;
  button: HTMLButtonElement;
  fill: HTMLElement;
  count: HTMLElement;
}

export interface DeleteConfirm {
  /** Every entry to the screen: the word emptied, a hold in progress ended, the confirmation armed again. */
  reset(): void;
  /** Re-reads `allowed()` and the word: a refused press ends a hold in progress. */
  render(): void;
}

/** The fill's share as the `--vlt-hold` value: always a number from 0 to 1 (the vault-isolation gate's rule, cooldown.ts). */
function holdShare(share: number): string {
  return String(Math.min(1, Math.max(0, share)));
}

/**
 * #37's two gates of friction (B1b-2b §5, D9) in plain DOM for the vault page (B1e §2.2, E11): DELETE typed exactly
 * (case-sensitive), then the button held for HOLD_MS — the pointer's primary button, or Space / Enter held on the focused
 * button (repeats ignored); pointer up, leave or cancel, keyup and blur release it, and a release before HOLD_MS confirms
 * nothing. Enter in the field activates nothing. `onConfirmed` runs once per completed hold, and never again until
 * `reset()`. `allowed()` is the screen's own phase and the page's gate: while it is false the button refuses a press.
 * B1e §3's checkbox path (Task 3) joins here, beside the hold.
 */
export function mountDeleteConfirm(parts: ConfirmParts, timers: Timers, o: {allowed(): boolean; onConfirmed(): void; onPressing?(pressing: boolean): void}): DeleteConfirm {
  let stop: (() => void) | null = null;
  let done = false;
  /** The press in progress (0: none); a tick of a press that already ended completes nothing (HoldButton's M4). */
  let pressId = 0;
  let presses = 0;

  const matched = () => parts.field.value === CONFIRM_WORD;
  const paintHold = (share: number | null) => {
    parts.fill.style.setProperty('--vlt-hold', holdShare(share ?? 0));
    const left = share === null ? null : Math.max(0, HOLD_MS - share * HOLD_MS) / 1000;
    parts.count.replaceChildren(...(left === null ? [] : [document.createTextNode(' · '), h('span', 'noc-numeral', `${left.toFixed(1)} s`)]));
  };
  const release = () => {
    pressId = 0;
    if (stop === null) return;
    stop();
    stop = null;
    paintHold(null);
    o.onPressing?.(false);
  };
  const render = () => {
    const typed = parts.field.value;
    const ok = matched();
    const partial = typed !== '' && !ok;
    shown(parts.eyebrow, !ok);
    shown(parts.matched, ok);
    shown(parts.check, ok);
    parts.box.classList.toggle('vlt-pw-ok', ok);
    parts.box.classList.toggle('vlt-pw-active', partial);
    shown(parts.caption, ok);
    if (typed === '') {
      setText(parts.help, TYPED_DELETE.caseSensitive);
      parts.help.classList.remove('vlt-danger');
    } else if (partial && CONFIRM_WORD.startsWith(typed)) {
      parts.help.replaceChildren(...TYPED_DELETE.keepGoing(typed.length).map((p, i) => (i === 0 || i === 2 ? h('span', 'noc-numeral', p) : document.createTextNode(p))));
      parts.help.classList.remove('vlt-danger');
    } else if (partial) {
      setText(parts.help, TYPED_DELETE.notAPrefix);
      parts.help.classList.add('vlt-danger');
    }
    shown(parts.help, !ok);
    const armed = ok && !done && o.allowed();
    if (!armed && stop !== null) release();
    parts.button.disabled = !armed;
  };
  const press = () => {
    if (!matched() || done || stop !== null || !o.allowed()) return;
    const started = timers.now();
    presses += 1;
    const id = presses;
    pressId = id;
    paintHold(0);
    o.onPressing?.(true);
    const interval = timers.setInterval(() => {
      if (pressId !== id) return;
      const held = timers.now() - started;
      if (held < HOLD_MS) return paintHold(held / HOLD_MS);
      pressId = 0;
      stop?.();
      stop = null;
      done = true;
      paintHold(1);
      o.onPressing?.(false);
      render();
      o.onConfirmed();
    }, HOLD_TICK_MS);
    stop = () => timers.clearInterval(interval);
  };

  parts.field.addEventListener('input', render);
  parts.button.addEventListener('pointerdown', e => {
    if (e.button === 0) press();
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'blur'] as const) parts.button.addEventListener(ev, release);
  parts.button.addEventListener('keydown', e => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (!e.repeat) press();
  });
  parts.button.addEventListener('keyup', e => {
    if (e.key === ' ' || e.key === 'Enter') release();
  });
  parts.button.addEventListener('contextmenu', e => e.preventDefault());

  return {
    reset() {
      release();
      done = false;
      parts.field.value = '';
      render();
    },
    render,
  };
}
