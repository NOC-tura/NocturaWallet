import type {Timers} from '../page';
import {TYPED_DELETE} from '../strings';
import {h, setText, shown} from './dom';

/** #37's word and hold (DeleteWallet.tsx WORD, HOLD_MS; HoldButton.tsx HOLD_TICK_MS). */
export const CONFIRM_WORD = 'DELETE';
export const HOLD_MS = 1_000;
export const HOLD_TICK_MS = 30;

/** The elements of one typed-word-and-hold-or-checkbox confirmation in unlock.html. */
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
  /** The button's words: its accessible name — the hold's, or `onceName` while the checkbox is checked. */
  name: HTMLElement;
  fill: HTMLElement;
  count: HTMLElement;
  /** B1e §3: the native checkbox directly above the button (before it in tab order), and its labelled row. */
  understood: HTMLInputElement;
  understoodRow: HTMLElement;
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
 * B1e §3 (E6, E11): or, with the checkbox above the button checked, ONE activation — a click, or Space / Enter pressed on
 * the button — confirms, and a press starts no hold. The checkbox shows only while the word matches, clears whenever
 * it stops matching and on every `reset()`; unchecked, the hold is the way again. `way()` is the rule, in one place.
 */
export function mountDeleteConfirm(parts: ConfirmParts, timers: Timers, o: {allowed(): boolean; onConfirmed(): void; onPressing?(pressing: boolean): void; onceName: string}): DeleteConfirm {
  let stop: (() => void) | null = null;
  let done = false;
  /** The press in progress (0: none); a tick of a press that already ended completes nothing (HoldButton's M4). */
  let pressId = 0;
  let presses = 0;

  const matched = () => parts.field.value === CONFIRM_WORD;
  /** B1e §3: DELETE typed exactly, and then the hold — or the checkbox and one activation. Null: neither may confirm. */
  const way = (): 'hold' | 'once' | null => (!matched() || done || !o.allowed() ? null : parts.understood.checked ? 'once' : 'hold');
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
    if (!ok) parts.understood.checked = false;
    const checked = parts.understood.checked;
    shown(parts.understoodRow, ok);
    setText(parts.name, checked ? o.onceName : TYPED_DELETE.hold);
    shown(parts.caption, ok && !checked);
    const now = way();
    if (now !== 'hold' && stop !== null) release();
    parts.button.disabled = now === null;
  };
  const press = () => {
    if (way() !== 'hold' || stop !== null) return;
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
  const once = () => {
    if (way() !== 'once') return;
    release();
    done = true;
    render();
    o.onConfirmed();
  };

  parts.field.addEventListener('input', render);
  parts.understood.addEventListener('change', render);
  parts.button.addEventListener('click', once);
  parts.button.addEventListener('pointerdown', e => {
    if (e.button === 0) press();
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'blur'] as const) parts.button.addEventListener(ev, release);
  parts.button.addEventListener('keydown', e => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (e.repeat) return;
    if (way() === 'once') once();
    else press();
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
