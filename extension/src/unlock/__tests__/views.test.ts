// @vitest-environment happy-dom
import {addressGroups, phraseCells, phraseWords, seedWordCells} from '../view/words';
import {HOLD_MS, REVEAL_MS, TICK_MS, createHold, type HoldState} from '../view/hold';
import {lengthMeter, renderMeter} from '../view/meter';
import {startCooldown} from '../view/cooldown';
import {closeOrHide, h} from '../view/dom';
import {fakeTimers} from './fakeTimers';

describe('the vault page’s DOM twins of the design', () => {
  const ADDR = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
  it('addressGroups: the full address in groups of four at equal weight, and selecting it copies the exact address', () => {
    const el = addressGroups(ADDR);
    expect(el.className).toBe('addr-groups noc-mono');
    expect([...el.children].map(c => c.textContent)).toEqual(ADDR.match(/.{1,4}/g));
    expect(el.textContent).toBe(ADDR);
  });

  it('seedWordCells: "01"…"24" with the word, in DOM order 1…24 (the grid flows them column-major)', () => {
    const words = Array.from({length: 24}, (_, i) => `w${i}`);
    const cells = seedWordCells(words);
    expect(cells).toHaveLength(24);
    expect(cells[0]?.className).toBe('word');
    expect([...(cells[0]?.children ?? [])].map(c => [c.className, c.textContent])).toEqual([['num', '01'], ['term', 'w0']]);
    expect(cells[23]?.querySelector('.num')?.textContent).toBe('24');
  });

  it('phraseCells: the words typed so far, then empty cells to 12 — or to 24 past 12 words', () => {
    expect(phraseCells(['legend', 'frost']).map(c => [c.className, c.textContent])).toEqual([
      ['w', '01 legend'],
      ['w', '02 frost'],
      ...Array.from({length: 10}, (_, i) => ['w empty', `${String(i + 3).padStart(2, '0')} …`]),
    ]);
    expect(phraseCells(Array.from({length: 13}, () => 'x'))).toHaveLength(24);
    expect(phraseWords('  Legend, FROST\nmarble ')).toEqual(['legend', 'frost', 'marble']);
  });

  it('lengthMeter: four bars at 3/6/9/12 characters; "N of 12 characters", then "Long enough"', () => {
    expect([0, 2, 3, 8, 9, 11, 12, 40].map(n => lengthMeter(n))).toEqual([
      {filled: 0, label: '0 of 12 characters'},
      {filled: 0, label: '2 of 12 characters'},
      {filled: 1, label: '3 of 12 characters'},
      {filled: 2, label: '8 of 12 characters'},
      {filled: 3, label: '9 of 12 characters'},
      {filled: 3, label: '11 of 12 characters'},
      {filled: 4, label: 'Long enough'},
      {filled: 4, label: 'Long enough'},
    ]);
    const bars = h('div');
    for (let i = 0; i < 4; i++) bars.append(h('i'));
    const label = h('span');
    renderMeter(bars, label, 7);
    expect([...bars.children].map(b => b.classList.contains('filled'))).toEqual([true, true, false, false]);
    expect(label.textContent).toBe('7 of 12 characters');
  });

  it('startCooldown: counts the wait down once a second as "0:12" with the design’s helper line, and stops', () => {
    const t = fakeTimers();
    const parts = {timer: h('div'), label: h('div'), ring: h('div')};
    const stop = startCooldown(t, 12_000, parts);
    expect(parts.timer.textContent).toBe('0:12');
    expect(parts.label.textContent).toBe('Cooldown · 0 minutes 12 seconds remaining');
    expect(parts.ring.style.getPropertyValue('--vlt-ring')).toBe('1');
    t.advance(3_000);
    expect(parts.timer.textContent).toBe('0:09');
    expect(parts.ring.style.getPropertyValue('--vlt-ring')).toBe('0.75');
    stop();
    expect(t.pending()).toBe(0);
  });

  it('startCooldown: the helper line\'s minute and second integers are .noc-numeral spans (design annotation B), set as text', () => {
    const t = fakeTimers();
    const parts = {timer: h('div'), label: h('div'), ring: h('div')};
    startCooldown(t, 75_000, parts);
    const numerals = () => [...parts.label.children].map(c => [c.tagName, c.className, c.textContent]);
    expect(numerals()).toEqual([
      ['SPAN', 'noc-numeral', '1'],
      ['SPAN', 'noc-numeral', '15'],
    ]);
    expect(parts.label.textContent).toBe('Cooldown · 1 minutes 15 seconds remaining');
    expect(parts.label.querySelectorAll('*')).toHaveLength(2);
    t.advance(16_000);
    expect(numerals()).toEqual([
      ['SPAN', 'noc-numeral', '0'],
      ['SPAN', 'noc-numeral', '59'],
    ]);
    expect(parts.label.textContent).toBe('Cooldown · 0 minutes 59 seconds remaining');
  });

  it('closeOrHide: closes, and hides the button when the tab is still here afterwards', () => {
    const t = fakeTimers();
    const button = h('button');
    let closed = 0;
    closeOrHide(() => closed++, f => void t.setTimeout(f, 500), button);
    expect(closed).toBe(1);
    expect(button.hidden).toBe(false);
    t.advance(500);
    expect(button.hidden).toBe(true);
  });
});

describe('#3’s press-and-hold (spec §3.3)', () => {
  // 30 ms ticks: the reveal lands on the first tick at or past 2 s.
  const HELD = HOLD_MS + TICK_MS;
  function setup() {
    const t = fakeTimers();
    const states: HoldState[] = [];
    const ticks: number[] = [];
    const hold = createHold(t, {state: s => states.push(s), tick: s => ticks.push(s)});
    return {t, hold, states, ticks};
  }

  it('reveals after a 2 s hold; a release before that reveals nothing', () => {
    const {t, hold, states} = setup();
    hold.press();
    t.advance(HOLD_MS - 30);
    hold.release();
    expect(states).toEqual([]);
    expect(hold.revealedOnce()).toBe(false);
    hold.press();
    t.advance(HELD);
    expect(states).toEqual(['revealed']);
    expect(hold.revealedOnce()).toBe(true);
  });

  it('counts 20 … 1 while revealed; release is "confirmed"', () => {
    const {t, hold, states, ticks} = setup();
    hold.press();
    t.advance(HELD);
    t.advance(7_000);
    expect(ticks).toEqual([20, 19, 18, 17, 16, 15, 14, 13]);
    hold.release();
    expect(states).toEqual(['revealed', 'confirmed']);
    expect(t.pending()).toBe(0);
  });

  it('auto-blurs at 20 s even while held ("Still looking?"); only a release and a new press hold again', () => {
    const {t, hold, states} = setup();
    hold.press();
    t.advance(HELD + REVEAL_MS);
    expect(states).toEqual(['revealed', 'still-looking']);
    hold.press(); // still held: ignored
    t.advance(HOLD_MS * 2);
    expect(states).toEqual(['revealed', 'still-looking']);
    hold.release(); // the forced release
    hold.press();
    t.advance(HELD);
    expect(states).toEqual(['revealed', 'still-looking', 'revealed']);
  });

  it('after a full hold, a short press and release rests at "confirmed"; dispose clears every timer', () => {
    const {t, hold, states} = setup();
    hold.press();
    t.advance(HELD + REVEAL_MS);
    hold.release();
    hold.press();
    t.advance(500);
    hold.release();
    expect(states).toEqual(['revealed', 'still-looking', 'confirmed']);
    hold.press();
    hold.dispose();
    expect(t.pending()).toBe(0);
  });
});
