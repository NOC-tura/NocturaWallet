import {MIN_PASSWORD_LENGTH} from '../onboarding';
import {exclusive, type PageDeps} from '../page';
import {PASSWORD} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';
import {renderMeter} from '../view/meter';

/** The design's 600 ms before the confirm field clears after a mismatch. */
export const MISMATCH_CLEAR_MS = 600;

export interface PasswordRun {
  /** "Onboarding" (create, import) or "Recovery" (#39's restore). */
  eyebrow: string;
  /** "4 / 5", "Import · 2 / 2" or "Restore · 2 / 2". */
  step: string;
  back(): void;
  /**
   * Stores the wallet with this password (seconds: Argon2id). Returns null when it went on (the caller
   * moved the page on), or the line to show; `stop` when nothing more can be tried here.
   */
  finish(password: string): Promise<{line: string; stop: boolean} | null>;
}

export interface PasswordScreen {
  show(run: PasswordRun): void;
  /** Whether the screen still references a typed password (plan-2 review H2): false after every terminal outcome. */
  holds(): boolean;
}

/**
 * #5 pin-create → create password (spec §3.5, D7): enter → confirm → creating. The field replaces the
 * design's 6 dots and keypad; the meter shows only the length rule. A mismatch says so, shakes the field
 * and clears it after 600 ms. While the wallet is created, every control is disabled (rule 6: the page's
 * one gate, ≥ 500 ms). The password lives in this closure only as long as one run needs it: the first
 * entry until the confirm step hands it to `finish` (or Back drops it), and both are dropped when the tab
 * is hidden or the page left (§3.5's memory rule; then "Enter a new password to try again."). JS strings
 * cannot be zeroed: dropping the reference is all a page can do.
 *
 * Rule 6 (spec §7.6): Continue and Back run through the page's one `exclusive()` gate; `step` is the
 * `offered`-style guard (welcome.ts) — 'off' before show() and once the run has moved on. The show/hide
 * toggle is the one control left outside the gate: it submits nothing, and holding the gate for it would
 * disable the field under the user's caret (a disabled field loses focus) — it acts on enter/confirm only.
 */
export function mountPassword(deps: PageDeps): PasswordScreen {
  const field = byId<HTMLInputElement>('pw-field');
  const cta = byId<HTMLButtonElement>('pw-cta');
  const back = byId<HTMLButtonElement>('pw-back');
  const toggle = byId<HTMLButtonElement>('pw-toggle');
  const helperEl = byId('pw-helper');
  let run: PasswordRun | null = null;
  let step: 'off' | 'enter' | 'confirm' | 'creating' | 'stopped' = 'off';
  let first = '';
  /** The helper shows a line typing should clear (a mismatch, a refusal, the hidden-tab line). */
  let note = false;
  let clearing: number | null = null;
  /** Focus the field once the gate frees (a disabled field cannot take focus). */
  let refocus = false;

  const render = () => {
    const busy = deps.gate.isBusy();
    byId('pw-dot-1').classList.toggle('active', step === 'enter');
    byId('pw-dot-2').classList.toggle('active', step !== 'enter');
    setText(byId('pw-title'), step === 'enter' ? PASSWORD.enterTitle : PASSWORD.confirmTitle);
    setText(byId('pw-lede'), step === 'enter' ? PASSWORD.enterLede : PASSWORD.confirmLede);
    shown(byId('pw-meter'), step === 'enter');
    shown(byId('pw-meter-label'), step === 'enter');
    renderMeter(byId('pw-meter'), byId('pw-meter-label'), field.value.length);
    shown(byId('pw-creating'), step === 'creating');
    const open = step === 'enter' || step === 'confirm';
    field.disabled = busy || !open;
    toggle.disabled = busy || !open;
    back.disabled = busy || !open;
    shown(cta, step !== 'stopped');
    cta.disabled = busy || !open || (step === 'enter' ? field.value.length < MIN_PASSWORD_LENGTH : field.value.length === 0);
    if (refocus && !field.disabled) {
      refocus = false;
      field.focus();
    }
  };
  const helper = (text: string, error: boolean) => {
    setText(helperEl, text);
    helperEl.classList.toggle('error', error);
  };
  const stopClearing = () => {
    if (clearing !== null) deps.timers.clearTimeout(clearing);
    clearing = null;
  };
  /** Drops everything typed: the first entry and the field. */
  const reset = () => {
    stopClearing();
    first = '';
    field.value = '';
    field.classList.remove('is-error');
    note = false;
  };

  const submit = () => {
    if (step !== 'enter' && step !== 'confirm') return;
    void exclusive(deps, render, async () => {
      const r = run;
      if (r === null) return;
      if (step === 'enter') {
        if (field.value.length < MIN_PASSWORD_LENGTH) return;
        first = field.value;
        field.value = '';
        step = 'confirm';
        note = false;
        helper('', false);
        refocus = true;
        render();
        return;
      }
      if (step !== 'confirm') return;
      const second = field.value;
      if (second !== first) {
        note = true;
        helper(PASSWORD.mismatch, true);
        field.classList.add('is-error');
        stopClearing();
        clearing = deps.timers.setTimeout(() => {
          clearing = null;
          field.value = '';
          field.classList.remove('is-error');
          refocus = true;
          render();
        }, MISMATCH_CLEAR_MS);
        return;
      }
      step = 'creating';
      helper('', false);
      field.value = '';
      render();
      const password = first;
      first = '';
      const out = await r.finish(password);
      if (out === null) {
        // The run moved the page on (#6, or the UI tab): this screen has ended.
        step = 'off';
        return;
      }
      helper(out.line, true);
      note = !out.stop;
      // A refusal that can be retried keeps nothing typed: the run starts again at enter.
      step = out.stop ? 'stopped' : 'enter';
      refocus = !out.stop;
    });
  };

  deps.gate.onIdle(render);
  field.addEventListener('input', () => {
    if (note) {
      note = false;
      field.classList.remove('is-error');
      helper(step === 'enter' ? PASSWORD.enterHelper : '', false);
    }
    render();
  });
  byId('pw-form').addEventListener('submit', e => {
    e.preventDefault();
    submit();
  });
  cta.addEventListener('click', submit);
  toggle.addEventListener('click', () => {
    if (step !== 'enter' && step !== 'confirm') return;
    const show = field.type === 'password';
    field.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-label', show ? PASSWORD.hide : PASSWORD.show);
    byId('pw-toggle-icon').setAttribute('href', show ? '#i-eye-off' : '#i-eye-on');
  });
  back.addEventListener('click', () => {
    if (step !== 'enter' && step !== 'confirm') return;
    void exclusive(deps, render, async () => {
      if (step === 'confirm') {
        reset();
        step = 'enter';
        helper(PASSWORD.enterHelper, false);
        refocus = true;
        render();
        return;
      }
      if (step !== 'enter') return;
      reset();
      step = 'off';
      run?.back();
    });
  });
  // Leaving or hiding the tab drops what was typed but not yet used (spec §3.5 memory rule; review L5).
  deps.onLeave(() => {
    if (step !== 'enter' && step !== 'confirm') return;
    const dropped = first !== '' || field.value !== '';
    reset();
    step = 'enter';
    if (dropped) {
      helper(PASSWORD.newPasswordToRetry, false);
      note = true;
    }
    render();
  });

  return {
    show(r) {
      run = r;
      reset();
      step = 'enter';
      field.type = 'password';
      toggle.setAttribute('aria-label', PASSWORD.show);
      byId('pw-toggle-icon').setAttribute('href', '#i-eye-on');
      setText(byId('pw-eyebrow'), r.eyebrow);
      setText(byId('pw-step'), r.step);
      helper(PASSWORD.enterHelper, false);
      refocus = true;
      render();
      showScreen('v-password');
    },
    holds: () => first !== '' || field.value !== '',
  };
}
