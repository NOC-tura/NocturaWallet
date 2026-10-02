import {exclusive, type PageDeps} from '../page';
import {FORGOT} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';

/**
 * #39 forgot-pin → "Forgot password?" (spec §3.11): all three cards visible, the highlighted one moving
 * 1 → 2 → 3, each step's own copy. Walked in order, so the step-2 warning (the wallet is replaced) is
 * always seen before #8 (review L1). [Continue to import] → #8 with `source=forgot`; [Cancel] and the
 * back arrow from step 1 → #9. No secret is on this screen; it reads nothing and sends nothing.
 *
 * Rule 6 (spec §7.6): the three buttons run through the page's one `exclusive()` gate, guarded by
 * `step` (0 before show() and once the screen has navigated away) — a second [Restore from seed] inside
 * the 500 ms floor cannot skip step 2's warning.
 */
export function mountForgot(deps: Pick<PageDeps, 'go' | 'gate' | 'sleep'>): {show(): void} {
  const next = byId<HTMLButtonElement>('fg-next');
  const back = byId<HTMLButtonElement>('fg-back');
  const cancel = byId<HTMLButtonElement>('fg-cancel');
  let step: 0 | 1 | 2 | 3 = 0;

  const render = () => {
    const busy = deps.gate.isBusy();
    next.disabled = busy || step === 0;
    back.disabled = busy || step === 0;
    cancel.disabled = busy || step === 0;
    if (step === 0) return;
    setText(byId('fg-step'), FORGOT.step(step));
    setText(byId('fg-title'), FORGOT.title[step]);
    setText(byId('fg-lede'), FORGOT.lede[step]);
    setText(byId('fg-card-1-body'), FORGOT.card1[step]);
    setText(byId('fg-card-2-body'), FORGOT.card2[step]);
    setText(byId('fg-card-3-body'), FORGOT.card3[step]);
    shown(byId('fg-card-1-hint'), step === 1);
    const cards = [byId('fg-card-1'), byId('fg-card-2'), byId('fg-card-3')];
    cards.forEach((card, i) => {
      card.classList.toggle('active', i + 1 === step);
      card.classList.toggle('vlt-done', i + 1 < step);
    });
    shown(byId('fg-warn'), step === 2);
    shown(byId('fg-foot'), step === 1);
    setText(byId('fg-next-label'), FORGOT.next[step]);
  };
  /** Leaves the screen for `target`: nothing on it acts again. */
  const leave = (target: 'unlock.html?mode=unlock' | 'unlock.html?mode=import&source=forgot') => {
    step = 0;
    deps.go(target);
  };

  deps.gate.onIdle(render);
  next.addEventListener('click', () => {
    if (step === 0) return;
    void exclusive(deps, render, async () => {
      if (step === 0) return;
      if (step === 3) return leave('unlock.html?mode=import&source=forgot');
      step = step === 1 ? 2 : 3;
      render();
    });
  });
  back.addEventListener('click', () => {
    if (step === 0) return;
    void exclusive(deps, render, async () => {
      if (step === 0) return;
      if (step === 1) return leave('unlock.html?mode=unlock');
      step = step === 3 ? 2 : 1;
      render();
    });
  });
  cancel.addEventListener('click', () => {
    if (step === 0) return;
    void exclusive(deps, render, async () => {
      if (step === 0) return;
      leave('unlock.html?mode=unlock');
    });
  });

  return {
    show() {
      step = 1;
      render();
      showScreen('v-forgot');
    },
  };
}
