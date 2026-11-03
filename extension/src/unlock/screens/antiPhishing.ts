import {cleanPhrase} from '../../shared/envelopeRules';
import {exclusive, type PageDeps} from '../page';
import {COMMON} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';
import type {PhraseStep} from './createRun';

/**
 * B1e §1.3 (undrawn, §9): onboarding's skippable last step, "Set an anti-phishing phrase". The runs call it only once
 * the wallet is stored and its keys are in the session (createRun: when #6 ends; importRun: on `created`; never on
 * `created-locked`), so the one write here — settings.phrase, set-when-none — lands after the first write that would
 * have wiped it. [Set phrase] is enabled only for a value cleanPhrase accepts (the background cleans it again); a
 * refusal says so and keeps the step, where [Skip] still goes on. [Skip] writes nothing. Either way the run's own
 * `then` moves the tab on (#7 or #40). Rule 6: both buttons run through the page's one gate.
 */
export function mountAntiPhishing(deps: PageDeps): PhraseStep {
  const field = byId<HTMLInputElement>('ap-field');
  const set = byId<HTMLButtonElement>('ap-set');
  const skip = byId<HTMLButtonElement>('ap-skip');
  const line = byId('ap-line');
  /** The run's continuation while the step shows; null once it has gone on. */
  let then: (() => void) | null = null;
  /** The step came up while the gate was held (#6's own action ends here): the field takes the focus once it is enabled. */
  let focusPending = false;

  const render = () => {
    const busy = deps.gate.isBusy();
    const open = then !== null;
    field.disabled = busy || !open;
    set.disabled = busy || !open || typeof cleanPhrase(field.value) !== 'string';
    skip.disabled = busy || !open;
    if (focusPending && !field.disabled) {
      focusPending = false;
      field.focus();
    }
  };
  const say = (text: string | null) => {
    setText(line, text ?? '');
    shown(line, text !== null);
  };
  const goOn = () => {
    const next = then;
    then = null;
    focusPending = false;
    field.value = '';
    render();
    next?.();
  };
  const save = () => {
    if (then === null || typeof cleanPhrase(field.value) !== 'string') return;
    void exclusive(deps, render, async () => {
      const phrase = cleanPhrase(field.value);
      if (then === null || typeof phrase !== 'string') return;
      say(null);
      let outcome: unknown;
      try {
        const r = await deps.send({type: 'settings.phrase', phrase});
        outcome = r.ok && typeof r.data === 'object' && r.data !== null ? (r.data as {outcome?: unknown}).outcome : undefined;
      } catch {
        outcome = undefined;
      }
      if (outcome === 'set' || outcome === 'unchanged') return goOn();
      say(COMMON.failedTryAgain);
    });
  };

  deps.gate.onIdle(render);
  field.addEventListener('input', () => {
    say(null);
    render();
  });
  byId('ap-form').addEventListener('submit', e => {
    e.preventDefault();
    save();
  });
  set.addEventListener('click', save);
  skip.addEventListener('click', () => {
    if (then === null) return;
    void exclusive(deps, render, async () => {
      if (then !== null) goOn();
    });
  });

  return o => {
    then = o.then;
    field.value = '';
    say(null);
    showScreen('v-anti-phishing');
    focusPending = true;
    render();
  };
}
