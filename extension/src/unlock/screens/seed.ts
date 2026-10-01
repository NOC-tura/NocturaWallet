import {exclusive, type PageDeps} from '../page';
import {SEED} from '../strings';
import {createHold, type Hold, type HoldState} from '../view/hold';
import {byId, setText, showScreen, shown} from '../view/dom';
import {seedWordCells} from '../view/words';

export interface SeedScreen {
  /** Opens #3 at its pre-reveal gate for this phrase (whatever an earlier show() left is taken out first). */
  show(words: readonly string[]): void;
  /** Whether the screen still references a phrase (plan-2 review H2): false after every way out of #3. */
  holds(): boolean;
}

/**
 * #3 seed-display (spec §3.3). The phrase is the user's own words, generated in this page (create run)
 * and never sent anywhere. The pre-reveal gate comes first, and the word grid is not in the DOM until it
 * is passed; leaving the step (back, Continue, the gate's Cancel or backdrop) takes the cells out of the
 * DOM, clears every timer and drops the screen's own reference to the phrase. Mechanics: hold 2 s (30 ms
 * ticks) → revealed with the 20 s countdown; release → confirmed; the auto-blur fires even while held →
 * "Still looking?", and only a release and a new press hold again. Pointer and keyboard (Space/Enter
 * held) both hold; pointerup/leave/cancel, keyup, the grid or the window losing focus and the tab being
 * hidden all release.
 *
 * Task 4 carry: the blur is CSS only, so the words are in the DOM exactly while `revealed` — every other
 * state's cells hold SEED.blurredTerm, and each state change rebuilds them (`paint`).
 *
 * The chip shows every second; screen readers hear it at 10 s and 5 s only (a separate live region,
 * the chip itself aria-hidden — the design's TalkBack throttle).
 *
 * Rule 6 (spec §7.6): every button runs through the page's one `exclusive()` gate. `phase` is the
 * `offered`-style guard (welcome.ts): a button acts only on the step it belongs to, whatever its
 * `hidden`/`disabled` say. The grid's press-and-hold is not a click action and is not gated.
 */
export function mountSeed(deps: PageDeps, next: {back(): void; done(): void}): SeedScreen {
  const grid = byId('seed-grid');
  const cta = byId<HTMLButtonElement>('seed-cta');
  const gateContinue = byId<HTMLButtonElement>('sg-continue');
  const gateCancel = byId<HTMLButtonElement>('sg-cancel');
  const back = byId<HTMLButtonElement>('seed-back');
  const live = byId('seed-live');
  let phase: 'off' | 'gate' | 'seed' = 'off';
  let hold: Hold | null = null;
  let words: readonly string[] = [];

  const render = () => {
    const busy = deps.gate.isBusy();
    gateContinue.disabled = busy;
    gateCancel.disabled = busy;
    back.disabled = busy;
    cta.disabled = busy || hold === null || !hold.revealedOnce();
  };
  /** The 24 cells: the words while revealed, the fixed stand-in otherwise. */
  const cells = (revealed: boolean) => {
    grid.querySelectorAll('.word').forEach(w => w.remove());
    grid.prepend(...seedWordCells(revealed ? words : words.map(() => SEED.blurredTerm)));
  };
  const paint = (state: HoldState) => {
    const revealed = state === 'revealed';
    cells(revealed);
    grid.classList.toggle('is-blurred', !revealed);
    shown(byId('seed-chip'), revealed);
    shown(byId('seed-helper'), revealed);
    shown(byId('seed-stamp'), state === 'confirmed');
    shown(byId('seed-overlay'), state === 'blurred' || state === 'still-looking');
    const still = state === 'still-looking';
    byId('seed-overlay').classList.toggle('is-still-looking', still);
    byId('seed-overlay-icon').setAttribute('href', still ? '#i-clock' : '#i-eye-off');
    setText(byId('seed-overlay-title'), still ? SEED.stillTitle : SEED.holdTitle);
    setText(byId('seed-overlay-body'), still ? SEED.stillBody : SEED.holdBody);
    setText(byId('seed-lede'), state === 'confirmed' ? SEED.ledeConfirmed : SEED.lede);
    // A new countdown may announce 10 s again; an ended one leaves nothing for a screen reader to find.
    setText(live, '');
    setText(cta, state === 'confirmed' ? SEED.continue : SEED.written);
    render();
  };
  const tick = (seconds: number) => {
    const late = seconds <= 5;
    byId('seed-chip').classList.toggle('is-danger', late);
    setText(byId('seed-chip-n'), SEED.chip(seconds));
    setText(byId('seed-chip-tail'), late ? SEED.chipLate : SEED.chipTail);
    if (seconds === 10 || seconds === 5) setText(live, `${SEED.chip(seconds)} ${late ? SEED.chipLate : SEED.chipTail}`);
  };

  /**
   * Out of the DOM, timers cleared, and the screen's own reference dropped (H2 of the plan review): after
   * any way out of #3 the phrase is held only by the create run, which drops it once the wallet is stored.
   */
  const clear = () => {
    hold?.dispose();
    hold = null;
    words = [];
    phase = 'off';
    grid.querySelectorAll('.word').forEach(w => w.remove());
    setText(live, '');
  };
  const press = () => hold?.press();
  const release = () => hold?.release();

  // Only the primary button (mouse left, touch, pen tip) holds: a right or middle press opens a menu or
  // scrolls, never the phrase. A context menu (a long press on touch included) releases (review follow-up 1).
  grid.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    press();
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'contextmenu']) grid.addEventListener(ev, release);
  grid.addEventListener('keydown', e => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      press();
    }
  });
  grid.addEventListener('keyup', e => {
    if (e.key === ' ' || e.key === 'Enter') release();
  });
  grid.addEventListener('blur', release);
  window.addEventListener('blur', release);
  deps.onLeave(release);
  // Scope 15 (Task 7 carry): show() may run while another screen's action holds the page gate (#1's Create
  // → #2 → #3 inside #1's 500 ms floor); the gate's own release then re-renders #3's buttons.
  deps.gate.onIdle(render);

  /** A click that acts only on its own step, under the page gate. */
  const button = (target: HTMLElement, on: 'gate' | 'seed', act: () => void) =>
    target.addEventListener('click', () => {
      if (phase === on) void exclusive(deps, render, async () => act());
    });
  const leave = () => {
    clear();
    next.back();
  };
  button(gateCancel, 'gate', leave);
  button(byId('sg-backdrop'), 'gate', leave);
  button(gateContinue, 'gate', () => {
    phase = 'seed';
    hold = createHold(deps.timers, {state: paint, tick});
    paint('blurred');
    showScreen('v-seed');
  });
  button(back, 'seed', leave);
  button(cta, 'seed', () => {
    if (hold === null || !hold.revealedOnce()) return;
    clear();
    next.done();
  });

  return {
    show(w) {
      clear();
      words = w;
      phase = 'gate';
      showScreen('v-seed-gate');
      render();
    },
    holds: () => words.length > 0,
  };
}
