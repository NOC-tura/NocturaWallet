// @vitest-environment happy-dom
import {HOLD_MS, REVEAL_MS, TICK_MS} from '../view/hold';
import {mountSeed} from '../screens/seed';
import {SEED} from '../strings';
import {click, el, harness, loadPage, text, unstyled, visible, type Harness} from './pageHarness';

const WORDS = 'legend frost marble river coral anchor valid echo raven melody praise voyage copper garden tribe modify banner spirit lift harvest thrive current siren beacon'.split(' ');
const HELD = HOLD_MS + TICK_MS;
const NUMS = WORDS.map((_, i) => String(i + 1).padStart(2, '0'));

/**
 * Everything the page carries as strings: document.body's text (hidden sections included) and every
 * attribute value of every element in it (review follow-up 2: a word in a data-* attribute, an aria-label
 * or a title is in the DOM as much as one in a text node).
 */
const pageStrings = (): string => [document.body.textContent ?? '', ...[...document.body.querySelectorAll('*')].flatMap(e => [...e.attributes].map(a => a.value))].join('\n');
/** How often each phrase word occurs in the page's strings (static copy may use some of them: "current", "valid"…). Letters only bound a word: a cell reads "01legend". */
const counts = (): number[] => {
  const all = pageStrings();
  return WORDS.map(w => (all.match(new RegExp(`(?<![a-z])${w}(?![a-z])`, 'g')) ?? []).length);
};
let baseline: number[] = [];
/**
 * The phrase words the page carries beyond its own static copy — anywhere in document.body, text or
 * attribute, hidden sections included (Task 4 carry: the blur is CSS only, so text in the DOM is text in the DOM).
 */
const leaked = (): string[] => {
  const now = counts();
  return WORDS.filter((_, i) => (now.at(i) ?? 0) > (baseline.at(i) ?? 0));
};

beforeEach(() => {
  loadPage();
  baseline = counts();
});

async function setup() {
  const h = await harness();
  const calls: string[] = [];
  const seed = mountSeed(h.deps, {back: () => calls.push('back'), done: () => calls.push('done')});
  seed.show(WORDS);
  return {h, calls, seed};
}
const grid = () => el('seed-grid');
const down = () => grid().dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
const up = () => grid().dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
/** Rule 6: every button runs under the page's one gate with a 500 ms floor; wait for it to free. */
const idle = (h: Harness) => h.until(() => !h.deps.gate.isBusy());
const cellTexts = () => [...grid().querySelectorAll('.word')].map(w => text(w));
/** Past the gate, held to the reveal. */
async function revealed() {
  const s = await setup();
  click(el('sg-continue'));
  await idle(s.h);
  down();
  s.h.timers.advance(HELD);
  expect(leaked()).toEqual(WORDS);
  return s;
}

describe('#3 seed-display: the pre-reveal gate', () => {
  it('shows the gate first, with no word in the DOM; the callout says nothing about screenshots (D1)', async () => {
    await setup();
    expect(visible(el('v-seed-gate'))).toBe(true);
    expect(visible(el('v-seed'))).toBe(false);
    const gate = el('v-seed-gate');
    expect(text(gate.querySelector('h2'))).toBe('About to show your recovery phrase');
    expect(text(gate.querySelector('.body'))).toBe('Move to a private place. Anyone who sees these 24 words can spend everything in this wallet, forever.');
    expect(text(gate.querySelector('.shield-callout'))).toBe("We can't recover this for you if someone takes it. Your only copy is the one you write by hand.");
    expect([...gate.querySelectorAll('button')].map(text)).toEqual(["I'm in a safe place — continue", 'Cancel — go back']);
    expect(document.querySelectorAll('.word')).toHaveLength(0);
    expect(leaked()).toEqual([]);
    expect(text(document.body)).not.toMatch(/Screenshots|blocked/);
    expect(unstyled('v-seed-gate')).toEqual([]);
  });

  it('Cancel and a backdrop click go back to #2', async () => {
    const {h, calls, seed} = await setup();
    click(el('sg-cancel'));
    await idle(h);
    seed.show(WORDS);
    click(el('sg-backdrop'));
    expect(calls).toEqual(['back', 'back']);
  });

  // Each way out of #3 also ends #3 (its `phase` guard), so a second click on the same button is refused twice
  // over; the page gate is what refuses the NEXT screen's button inside the 500 ms floor.
  it('rule 6 (spec §7.6): inside 500 ms of the gate’s Continue, #3’s back does nothing', async () => {
    const {h, calls} = await setup();
    click(el('sg-continue'));
    click(el('sg-continue'));
    expect(visible(el('v-seed'))).toBe(true);
    expect(el<HTMLButtonElement>('seed-back').disabled).toBe(true);
    click(el('seed-back'));
    expect(calls).toEqual([]);
    expect(visible(el('v-seed'))).toBe(true);
    await idle(h);
    expect(el<HTMLButtonElement>('seed-back').disabled).toBe(false);
    click(el('seed-back'));
    click(el('seed-back'));
    expect(calls).toEqual(['back']);
  });
  it('a button acts only on its own step (the `offered`-style guard): the gate’s buttons on #3, #3’s once it is left', async () => {
    const {h, calls} = await setup();
    click(el('seed-back'));
    click(el('seed-cta'));
    expect(calls).toEqual([]);
    click(el('sg-continue'));
    await idle(h);
    click(el('sg-cancel'));
    await idle(h);
    click(el('sg-backdrop'));
    await idle(h);
    expect(calls).toEqual([]);
    expect(visible(el('v-seed'))).toBe(true);
    click(el('seed-back'));
    await idle(h);
    click(el('seed-back'));
    await idle(h);
    click(el('sg-cancel'));
    expect(calls).toEqual(['back']);
  });
});

describe('#3 seed-display: blurred → revealed → confirmed', () => {
  it('blurred: 24 cells, column-major, blurred under "Press and hold to reveal" — no word in the DOM; the CTA disabled', async () => {
    const {h} = await setup();
    click(el('sg-continue'));
    await idle(h);
    expect(visible(el('v-seed'))).toBe(true);
    expect(text(el('v-seed').querySelector('.top-bar .step'))).toBe('2 / 5');
    expect(text(el('seed-lede'))).toBe('24 words. Write them down on paper, in order. This is the only backup.');
    expect(grid().classList.contains('is-blurred')).toBe(true);
    // Task 4 carry: the blur is CSS only, so the blurred cells carry a fixed stand-in, never the words.
    expect(cellTexts()).toEqual(NUMS.map(n => `${n}${SEED.blurredTerm}`));
    expect(leaked()).toEqual([]);
    expect(text(el('seed-overlay-title'))).toBe('Press and hold to reveal');
    expect(text(el('seed-overlay-body'))).toBe('Make sure no one is looking over your shoulder. Hold for 2 seconds. Auto re-blurs after 20 s for safety.');
    expect(el<HTMLButtonElement>('seed-cta').disabled).toBe(true);
    expect(text(el('seed-cta'))).toBe("I've written it down");
    expect(unstyled('v-seed')).toEqual([]);
  });

  it('revealed: the words, column-major; the chip counts down in --warning, "5 s — still memorizing?" in --danger; screen readers hear 10 s and 5 s only', async () => {
    const {h} = await setup();
    click(el('sg-continue'));
    await idle(h);
    down();
    h.timers.advance(HELD);
    expect(grid().classList.contains('is-blurred')).toBe(false);
    expect(cellTexts()).toEqual(WORDS.map((w, i) => `${NUMS.at(i) ?? ''}${w}`));
    expect(visible(el('seed-overlay'))).toBe(false);
    expect(visible(el('seed-helper'))).toBe(true);
    expect(text(el('seed-helper'))).toBe('Holding to reveal · Auto-blurs at 20 s for safety. Screen readers announce at 10 s and 5 s only.');
    expect(text(el('seed-chip'))).toBe('20 s· auto-blur');
    expect(el<HTMLButtonElement>('seed-cta').disabled).toBe(false);
    h.timers.advance(7_000);
    expect(text(el('seed-chip-n'))).toBe('13 s');
    expect(el('seed-chip').classList.contains('is-danger')).toBe(false);
    expect(text(el('seed-live'))).toBe('');
    h.timers.advance(3_000);
    expect(text(el('seed-live'))).toBe('10 s · auto-blur');
    h.timers.advance(5_000);
    expect(text(el('seed-chip'))).toBe('5 s— still memorizing?');
    expect(el('seed-chip').classList.contains('is-danger')).toBe(true);
    expect(text(el('seed-live'))).toBe('5 s — still memorizing?');
    expect(el('seed-chip').getAttribute('aria-hidden')).toBe('true');
    expect(unstyled('v-seed')).toEqual([]);
  });

  it('released after a full hold: "confirmed" — re-blurred, the words out of the DOM, "Acknowledged", the new lede, Continue → #4', async () => {
    const {h, calls, seed} = await revealed();
    up();
    expect(grid().classList.contains('is-blurred')).toBe(true);
    expect(leaked()).toEqual([]);
    expect(seed.holds()).toBe(true);
    expect(visible(el('seed-stamp'))).toBe(true);
    expect(text(el('seed-stamp'))).toBe('Acknowledged');
    expect(text(el('seed-lede'))).toBe('Phrase locked in. Tap continue to verify a few words.');
    expect(text(el('seed-cta'))).toBe('Continue');
    expect(unstyled('v-seed')).toEqual([]);
    click(el('seed-cta'));
    expect(calls).toEqual(['done']);
    // Leaving the step takes the cells out of the DOM, stops every timer and drops the phrase (H2).
    expect(document.querySelectorAll('.word')).toHaveLength(0);
    expect(h.timers.pending()).toBe(0);
    expect(seed.holds()).toBe(false);
  });

  it('"Still looking?" at 20 s even while held — the words out of the DOM; a release then a new press holds again', async () => {
    const {h} = await revealed();
    h.timers.advance(REVEAL_MS);
    expect(grid().classList.contains('is-blurred')).toBe(true);
    expect(leaked()).toEqual([]);
    expect(el('seed-overlay').classList.contains('is-still-looking')).toBe(true);
    expect(text(el('seed-overlay-title'))).toBe('Still looking?');
    expect(text(el('seed-overlay-body'))).toBe('Press and hold again to keep viewing. Releasing now is fine — your hand is remembering enough.');
    expect(el('seed-overlay-icon').getAttribute('href')).toBe('#i-clock');
    expect(el<HTMLButtonElement>('seed-cta').disabled).toBe(false);
    expect(text(el('seed-cta'))).toBe("I've written it down");
    expect(text(el('seed-live'))).toBe('');
    expect(unstyled('v-seed')).toEqual([]);
    // Still held: nothing comes back.
    h.timers.advance(HELD);
    expect(leaked()).toEqual([]);
    up();
    down();
    h.timers.advance(HELD);
    expect(grid().classList.contains('is-blurred')).toBe(false);
    expect(leaked()).toEqual(WORDS);
  });

  it('a release before 2 s, the window losing focus and the tab being hidden all re-blur; Space held reveals too', async () => {
    const {h} = await setup();
    click(el('sg-continue'));
    await idle(h);
    down();
    h.timers.advance(HOLD_MS - 100);
    up();
    expect(el<HTMLButtonElement>('seed-cta').disabled).toBe(true);
    expect(leaked()).toEqual([]);
    grid().dispatchEvent(new KeyboardEvent('keydown', {key: ' ', bubbles: true}));
    h.timers.advance(HELD);
    expect(grid().classList.contains('is-blurred')).toBe(false);
    window.dispatchEvent(new Event('blur'));
    expect(grid().classList.contains('is-blurred')).toBe(true);
    grid().dispatchEvent(new KeyboardEvent('keyup', {key: ' ', bubbles: true}));
    down();
    h.timers.advance(HELD);
    h.leave();
    expect(grid().classList.contains('is-blurred')).toBe(true);
  });

  it('only the primary button holds: a right-button press reveals nothing, even held past 2 s', async () => {
    const {h} = await setup();
    click(el('sg-continue'));
    await idle(h);
    grid().dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, button: 2}));
    h.timers.advance(HELD * 2);
    expect(grid().classList.contains('is-blurred')).toBe(true);
    expect(leaked()).toEqual([]);
    expect(h.timers.pending()).toBe(0);
    expect(el<HTMLButtonElement>('seed-cta').disabled).toBe(true);
  });

  it('a context menu during a hold releases it: no reveal, and a reveal already shown ends', async () => {
    const {h} = await setup();
    click(el('sg-continue'));
    await idle(h);
    down();
    h.timers.advance(HOLD_MS - 500);
    grid().dispatchEvent(new MouseEvent('contextmenu', {bubbles: true}));
    h.timers.advance(HELD);
    expect(grid().classList.contains('is-blurred')).toBe(true);
    expect(leaked()).toEqual([]);
    down();
    h.timers.advance(HELD);
    expect(leaked()).toEqual(WORDS);
    grid().dispatchEvent(new MouseEvent('contextmenu', {bubbles: true}));
    expect(leaked()).toEqual([]);
    expect(grid().classList.contains('is-blurred')).toBe(true);
  });

  it('the CTA acts only after a full hold, whatever its disabled says (a stray click on a re-enabled button)', async () => {
    const {h, calls, seed} = await setup();
    click(el('sg-continue'));
    await idle(h);
    const cta = el<HTMLButtonElement>('seed-cta');
    expect(cta.disabled).toBe(true);
    cta.disabled = false;
    click(cta);
    await idle(h);
    expect(calls).toEqual([]);
    expect(visible(el('v-seed'))).toBe(true);
    expect(seed.holds()).toBe(true);
  });

  it('back → #2, the words leave the DOM; showing #3 again starts at the gate', async () => {
    const {h, calls, seed} = await setup();
    click(el('sg-continue'));
    await idle(h);
    click(el('seed-back'));
    expect(calls).toEqual(['back']);
    expect(document.querySelectorAll('.word')).toHaveLength(0);
    await idle(h);
    seed.show(WORDS);
    expect(visible(el('v-seed-gate'))).toBe(true);
  });

  it('rule 6: a second click on the CTA inside 500 ms does nothing', async () => {
    const {h, calls} = await revealed();
    up();
    click(el('seed-cta'));
    click(el('seed-cta'));
    await idle(h);
    click(el('seed-cta'));
    expect(calls).toEqual(['done']);
  });
});

/**
 * Task 4 carry + H2: the blur is CSS only, so the words are in the DOM exactly while they are shown —
 * every way the reveal ends takes the text out — and leaving #3 drops the screen's own reference too.
 */
describe('#3 seed-display: the words are in the DOM only while revealed', () => {
  const releases: [string, () => void][] = [
    ['pointerup', () => up()],
    ['pointerleave', () => grid().dispatchEvent(new PointerEvent('pointerleave', {bubbles: true}))],
    ['pointercancel', () => grid().dispatchEvent(new PointerEvent('pointercancel', {bubbles: true}))],
    ['the grid losing focus', () => grid().dispatchEvent(new FocusEvent('blur'))],
    ['the window losing focus', () => window.dispatchEvent(new Event('blur'))],
  ];
  for (const [name, release] of releases) {
    it(`${name} takes the words out of the DOM`, async () => {
      const {seed} = await revealed();
      release();
      expect(leaked()).toEqual([]);
      expect(grid().querySelectorAll('.word')).toHaveLength(24);
      expect(seed.holds()).toBe(true);
    });
  }

  it('keyup of a held Space takes the words out of the DOM', async () => {
    const {h} = await setup();
    click(el('sg-continue'));
    await idle(h);
    grid().dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
    h.timers.advance(HELD);
    expect(leaked()).toEqual(WORDS);
    grid().dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter', bubbles: true}));
    expect(leaked()).toEqual([]);
  });

  it('the tab hidden, or the page going away (onLeave: pagehide, visibilitychange hidden), takes the words out of the DOM', async () => {
    const {h} = await revealed();
    h.leave();
    expect(leaked()).toEqual([]);
    expect(grid().classList.contains('is-blurred')).toBe(true);
  });

  it('the auto-blur takes the words out of the DOM even while held', async () => {
    const {h} = await revealed();
    h.timers.advance(REVEAL_MS);
    expect(leaked()).toEqual([]);
  });

  const exits: [string, (h: Harness) => Promise<void>][] = [
    ['back', async () => click(el('seed-back'))],
    ['Continue', async () => {
      up();
      click(el('seed-cta'));
    }],
  ];
  for (const [name, exit] of exits) {
    it(`leaving by ${name} while revealed takes the words out of the DOM and drops the phrase`, async () => {
      const {h, seed} = await revealed();
      await exit(h);
      expect(leaked()).toEqual([]);
      expect(document.querySelectorAll('.word')).toHaveLength(0);
      expect(seed.holds()).toBe(false);
      expect(h.timers.pending()).toBe(0);
    });
  }

  for (const id of ['sg-cancel', 'sg-backdrop']) {
    it(`the gate’s ${id === 'sg-cancel' ? 'Cancel' : 'backdrop'} drops the phrase`, async () => {
      const {seed} = await setup();
      expect(seed.holds()).toBe(true);
      click(el(id));
      expect(seed.holds()).toBe(false);
      expect(leaked()).toEqual([]);
    });
  }

  it('a new show() takes out what an earlier one left', async () => {
    const {h, seed} = await revealed();
    seed.show(WORDS);
    expect(leaked()).toEqual([]);
    expect(document.querySelectorAll('.word')).toHaveLength(0);
    expect(h.timers.pending()).toBe(0);
    expect(visible(el('v-seed-gate'))).toBe(true);
  });

  // H2 (plan review): leaving #3 drops the screen's own reference to the phrase, not only the DOM's —
  // the gate's Continue, reached without a new show(), has no word left to render.
  it('leaving #3 (Continue, back, the gate’s Cancel) drops the phrase: nothing is left to render', async () => {
    const {h, seed} = await setup();
    click(el('sg-continue'));
    await idle(h);
    down();
    h.timers.advance(HELD);
    up();
    click(el('seed-cta'));
    await idle(h);
    click(el('sg-continue'));
    await idle(h);
    expect(document.querySelectorAll('.word')).toHaveLength(0);
    expect(seed.holds()).toBe(false);
    seed.show(WORDS);
    click(el('sg-continue'));
    await idle(h);
    click(el('seed-back'));
    await idle(h);
    click(el('sg-continue'));
    await idle(h);
    expect(document.querySelectorAll('.word')).toHaveLength(0);
    expect(seed.holds()).toBe(false);
    seed.show(WORDS);
    click(el('sg-cancel'));
    await idle(h);
    click(el('sg-continue'));
    await idle(h);
    expect(document.querySelectorAll('.word')).toHaveLength(0);
    expect(seed.holds()).toBe(false);
    expect(leaked()).toEqual([]);
  });
});
