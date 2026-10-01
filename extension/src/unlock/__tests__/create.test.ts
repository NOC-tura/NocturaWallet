// @vitest-environment happy-dom
import {wordlist} from '@scure/bip39/wordlists/english.js';
import {createEnvelope, decryptMnemonic, unlockWithPassword, unlockWithPrf, type EnvelopeV1} from '../../vault/envelope';
import type {CredentialsApi} from '../../vault/passkey';
import {VAULT_KEY} from '../../background/accountsStore';
import {getSession} from '../../background/session';
import {RESET_MS, confirmPlan, mountConfirm, randomBelow} from '../screens/confirm';
import {MISMATCH_CLEAR_MS, mountPassword} from '../screens/password';
import {mountPasskey} from '../screens/passkey';
import {startCreateRun} from '../screens/createRun';
import {mountSeed} from '../screens/seed';
import {HOLD_MS, TICK_MS} from '../view/hold';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

// A valid 24-word BIP-39 phrase with 24 distinct words (generated once for this test).
const PHRASE = 'wonder sauce regret hover leopard hundred luxury home wise frost naive body company wedding want sponsor buyer birth february friend frequent neglect draw pond';
const WORDS = PHRASE.split(' ');
const PW = 'a long enough password';
const ACCOUNT = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const HELD = HOLD_MS + TICK_MS;

/** Seeded random bytes (xorshift32): many different plans, the same on every run. */
function seededBytes(seed: number) {
  let x = seed >>> 0 || 1;
  return (n: number) =>
    Uint8Array.from({length: n}, () => {
      x ^= x << 13;
      x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5;
      x >>>= 0;
      return x & 0xff;
    });
}
/**
 * Can every slot be filled with its own word from a pool button no other slot used (I1: picks go by pool
 * index)? Greedy is exact here: buttons with the same word are interchangeable.
 */
function completable(plan: {slots: {word: string}[]; pool: string[]}): boolean {
  const free = plan.pool.map(() => true);
  return plan.slots.every(s => {
    const at = plan.pool.findIndex((w, i) => w === s.word && free.at(i) === true);
    if (at < 0) return false;
    free.splice(at, 1, false);
    return true;
  });
}
/** A phrase that repeats words (BIP-39 allows it): six words, four times each. */
const REPEATS = Array.from({length: 24}, (_, i) => ['legal', 'legal', 'zoo', 'zone', 'legal', 'zebra'].at(i % 6) ?? '');
/** The repo's test vector: 23 × "abandon" and "art" — fewer than three distinct words. */
const ABANDON = [...Array.from({length: 23}, () => 'abandon'), 'art'];

/** Deterministic "random" bytes: a counter, so a plan is reproducible. */
function counterBytes() {
  let c = 7;
  return (n: number) => Uint8Array.from({length: n}, () => (c = (c * 131 + 17) % 256));
}

/**
 * Everything the page carries as strings: document.body's text (hidden sections included) and every
 * attribute value of every element in it (as seed.test.ts's leak detector: a word in a data-* attribute,
 * an aria-label or a title is in the DOM as much as one in a text node).
 */
const pageStrings = (): string => {
  // Text node by text node: body.textContent runs adjacent buttons together ("birthbuyer"), hiding a word.
  const texts: string[] = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) texts.push(n.nodeValue ?? '');
  return [...texts, ...[...document.body.querySelectorAll('*')].flatMap(e => [...e.attributes].map(a => a.value))].join('\n');
};
/**
 * How often each phrase word occurs in the page's strings. Letters and hyphens bound a word: a cell reads
 * "01legend", while a class such as "noc-body-sm" is the design's, not the phrase word "body".
 */
const counts = (): number[] => {
  const all = pageStrings();
  return WORDS.map(w => (all.match(new RegExp(`(?<![a-z-])${w}(?![a-z-])`, 'g')) ?? []).length);
};
let baseline: number[] = [];
/** The phrase words the page carries beyond its own static copy, each as often as it is over. */
const leaked = (): string[] => {
  const now = counts();
  return WORDS.flatMap((w, i) => Array.from({length: Math.max(0, (now.at(i) ?? 0) - (baseline.at(i) ?? 0))}, () => w));
};

beforeEach(() => {
  loadPage();
  baseline = counts();
});

/** Rule 6: every vault-page button runs under the page's one gate with a 500 ms floor; wait for it to free. */
const idle = (h: Harness) => h.until(() => !h.deps.gate.isBusy());
/** Waits until the button is enabled — what a person (and Playwright) waits for — then clicks it. */
async function press(h: Harness, id: string): Promise<void> {
  await h.until(() => !el<HTMLButtonElement>(id).disabled);
  click(el(id));
}

describe('#4 seed-confirm: the plan', () => {
  it('three distinct positions, ascending; a pool of nine — each row its slot’s word and two same-letter BIP-39 words not in the phrase', () => {
    for (let run = 0; run < 20; run++) {
      const plan = confirmPlan(WORDS, counterBytes());
      const positions = plan.slots.map(s => s.position);
      expect(new Set(positions).size).toBe(3);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
      for (const [i, s] of plan.slots.entries()) {
        expect(s.position).toBeGreaterThanOrEqual(1);
        expect(s.position).toBeLessThanOrEqual(24);
        expect(s.word).toBe(WORDS[s.position - 1]);
        const row = plan.pool.slice(i * 3, i * 3 + 3);
        expect(row).toContain(s.word);
        for (const w of row.filter(x => x !== s.word)) {
          expect(wordlist).toContain(w);
          expect(WORDS).not.toContain(w);
          expect(w[0]).toBe(s.word[0]);
        }
      }
      expect(new Set(plan.pool).size).toBe(9);
    }
  });

  it('the correct word lands at every place in its row, and every position of the 24 can be asked (crypto bytes)', () => {
    const places = new Set<number>();
    const asked = new Set<number>();
    const bytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
    for (let run = 0; run < 400; run++) {
      const plan = confirmPlan(WORDS, bytes);
      plan.slots.forEach((s, i) => {
        places.add(plan.pool.slice(i * 3, i * 3 + 3).indexOf(s.word));
        asked.add(s.position);
      });
    }
    expect([...places].sort()).toEqual([0, 1, 2]);
    expect(asked.size).toBe(24);
  });

  it('I1: a phrase that repeats words — slot words always distinct, the pool nine distinct words, every plan completable (1000 seeded plans)', () => {
    const bad: number[] = [];
    for (let seed = 1; seed <= 1000; seed++) {
      const plan = confirmPlan(REPEATS, seededBytes(seed));
      const ok =
        new Set(plan.slots.map(x => x.word)).size === 3 &&
        new Set(plan.pool).size === 9 &&
        plan.slots.every(x => x.word === REPEATS[x.position - 1]) &&
        completable(plan);
      if (!ok) bad.push(seed);
    }
    expect(bad).toEqual([]);
  }, 30_000);

  it('I1: fewer than three distinct words (23 × abandon + art, or 24 × abandon) — distinct positions, and every plan still completable (1000 seeded plans each)', () => {
    const bad: string[] = [];
    for (const [name, phrase] of [['abandon+art', ABANDON], ['24 abandon', Array.from({length: 24}, () => 'abandon')]] as const) {
      for (let seed = 1; seed <= 1000; seed++) {
        const plan = confirmPlan(phrase, seededBytes(seed));
        if (new Set(plan.slots.map(x => x.position)).size !== 3 || plan.pool.length !== 9 || !completable(plan)) bad.push(`${name}/${seed}`);
      }
    }
    expect(bad).toEqual([]);
  }, 30_000);

  it('randomBelow rejects the biased top of the range instead of folding it (no modulo bias)', () => {
    const seq = [Uint8Array.of(0xff, 0xff, 0xff, 0xff), Uint8Array.of(0, 0, 0, 5)];
    expect(randomBelow(() => seq.shift() ?? Uint8Array.of(0, 0, 0, 0), 3)).toBe(2);
    expect(seq).toEqual([]);
  });
});

describe('#4 seed-confirm: the screen', () => {
  async function shown() {
    const h = await harness();
    const calls: string[] = [];
    const screen = mountConfirm(h.deps, {back: () => calls.push('back'), done: () => calls.push('done')});
    screen.show(WORDS);
    const slots = () => [...el('cnf-slots').querySelectorAll('.slot')];
    const position = (i: number) => Number(/#(\d+)/.exec(text(slots()[i]?.querySelector('.label') ?? null))?.[1]);
    const button = (w: string) => [...el('cnf-pool').querySelectorAll('button')].find(b => text(b) === w) as HTMLButtonElement;
    const right = (i: number) => WORDS[position(i) - 1] ?? '';
    /** Picks a word as a person would: once the pool is enabled again. */
    const pick = async (w: string) => {
      await h.until(() => !button(w).disabled);
      click(button(w));
    };
    return {h, calls, screen, slots, position, button, right, pick};
  }

  it('empty: "Confirm phrase", three "Word #N" slots on "— select —", nine words, Confirm disabled; the only phrase words in the DOM are the pool’s three', async () => {
    const {slots, right} = await shown();
    expect(visible(el('v-confirm'))).toBe(true);
    expect(text(el('v-confirm').querySelector('.top-bar .step'))).toBe('3 / 5');
    expect(text(el('v-confirm').querySelector('h1'))).toBe('Confirm phrase');
    expect(text(el('cnf-lede'))).toBe('Tap the correct word for each position.');
    expect(slots().map(s => [s.className, text(s.querySelector('.value'))])).toEqual([
      ['slot empty', '— select —'],
      ['slot empty', '— select —'],
      ['slot empty', '— select —'],
    ]);
    expect(el('cnf-pool').querySelectorAll('button.word-btn')).toHaveLength(9);
    expect(el<HTMLButtonElement>('cnf-cta').disabled).toBe(true);
    expect(text(el('cnf-cta'))).toBe('Confirm');
    expect(leaked().sort()).toEqual([right(0), right(1), right(2)].sort());
    expect(unstyled('v-confirm')).toEqual([]);
  });

  it('a right word fills its slot and dims its button (partial-correct)', async () => {
    const {slots, right, button, pick} = await shown();
    const w = right(0);
    await pick(w);
    expect(slots()[0]?.classList.contains('filled')).toBe(true);
    expect(text(slots()[0]?.querySelector('.value') ?? null)).toBe(w);
    expect(button(w).className).toBe('word-btn used dim');
    expect(el<HTMLButtonElement>('cnf-cta').disabled).toBe(true);
    expect(unstyled('v-confirm')).toEqual([]);
  });

  it('a wrong word: the danger lede, the slot shakes, "Word #N was wrong…", and ~700 ms later every slot resets — the DOM then holds the pool’s words only', async () => {
    const {h, slots, position, button, right, pick} = await shown();
    await pick(right(0));
    await idle(h);
    const wrong = [...el('cnf-pool').querySelectorAll('button')].map(text).find(w => w !== right(1) && !button(w).disabled) ?? '';
    await pick(wrong);
    expect(text(el('cnf-lede'))).toBe("That's not the right word — let's start over.");
    expect(el('cnf-lede').classList.contains('vlt-danger')).toBe(true);
    expect(slots()[1]?.classList.contains('wrong')).toBe(true);
    expect(text(el('cnf-helper'))).toBe(`Word #${position(1)} was wrong. Slots will reset in a moment.`);
    expect(visible(el('cnf-helper'))).toBe(true);
    expect(button(wrong).classList.contains('vlt-wrong-word')).toBe(true);
    // While the slots reset, no pick is taken.
    await idle(h);
    click(button(right(1)));
    expect(text(slots()[2]?.querySelector('.value') ?? null)).toBe('— select —');
    expect(unstyled('v-confirm')).toEqual([]);
    h.timers.advance(RESET_MS);
    expect(slots().every(s => s.classList.contains('empty'))).toBe(true);
    expect(text(el('cnf-lede'))).toBe('Tap the correct word for each position.');
    expect(visible(el('cnf-helper'))).toBe(false);
    expect([...el('cnf-pool').querySelectorAll('button')].every(b => b.className === 'word-btn' && !b.disabled)).toBe(true);
    expect(leaked().sort()).toEqual([right(0), right(1), right(2)].sort());
  });

  it('three right words → Confirm → "Phrase verified" (adapted, D7) with no word left in the DOM → Continue → #5', async () => {
    const {h, calls, screen, right, pick} = await shown();
    for (let i = 0; i < 3; i++) await pick(right(i));
    await idle(h);
    expect(el<HTMLButtonElement>('cnf-cta').disabled).toBe(false);
    click(el('cnf-cta'));
    expect(visible(el('cnf-success'))).toBe(true);
    expect(visible(el('cnf-main'))).toBe(false);
    expect(text(el('cnf-success'))).toBe('Phrase verified All three words matched. Now lock the wallet with a password.');
    expect(text(el('cnf-cta'))).toBe('Continue');
    expect(leaked()).toEqual([]);
    expect(screen.holds()).toBe(false);
    expect(unstyled('v-confirm')).toEqual([]);
    await press(h, 'cnf-cta');
    expect(calls).toEqual(['done']);
    expect(el('cnf-slots').children).toHaveLength(0);
    expect(el('cnf-pool').children).toHaveLength(0);
  });

  it('rule 6 (spec §7.6): a second pick inside the floor, a double Confirm, and Back while busy do nothing; each button acts on its own phase only', async () => {
    const {h, calls, slots, right, button, pick} = await shown();
    click(button(right(0)));
    click(button(right(1)));
    expect(text(slots()[1]?.querySelector('.value') ?? null)).toBe('— select —');
    expect([...el('cnf-pool').querySelectorAll('button')].every(b => b.disabled)).toBe(true);
    click(el('cnf-back'));
    expect(calls).toEqual([]);
    await pick(right(1));
    await pick(right(2));
    await idle(h);
    click(el('cnf-cta'));
    click(el('cnf-cta'));
    expect(calls).toEqual([]);
    expect(visible(el('cnf-success'))).toBe(true);
    // Success: the pool is gone, and a stray pick changes nothing.
    await idle(h);
    click(el('cnf-cta'));
    click(el('cnf-cta'));
    await idle(h);
    expect(calls).toEqual(['done']);
    // #4 has ended: its buttons do nothing until it is shown again — even with `disabled` lifted (a stray
    // event; happy-dom, like a browser, drops a click on a disabled button, so only the phase guard is tested here).
    el<HTMLButtonElement>('cnf-cta').disabled = false;
    el<HTMLButtonElement>('cnf-back').disabled = false;
    click(el('cnf-cta'));
    click(el('cnf-back'));
    await idle(h);
    expect(calls).toEqual(['done']);
  });

  it('a used word cannot be picked again, even when its button is not disabled (a stray event)', async () => {
    const {h, slots, right, button, pick} = await shown();
    await pick(right(0));
    await idle(h);
    button(right(0)).disabled = false;
    click(button(right(0)));
    expect(text(slots()[1]?.querySelector('.value') ?? null)).toBe('— select —');
    expect(slots()[1]?.classList.contains('empty')).toBe(true);
  });

  it('the tab hidden (onLeave) takes every word out of the DOM, a pending reset included; shown again (onReturn), the same plan and progress come back', async () => {
    const {h, slots, position, right, pick} = await shown();
    const asked = [position(0), position(1), position(2)];
    await pick(right(0));
    await idle(h);
    h.leave();
    expect(leaked()).toEqual([]);
    expect(el('cnf-slots').children).toHaveLength(0);
    expect(el('cnf-pool').children).toHaveLength(0);
    h.back();
    expect([position(0), position(1), position(2)]).toEqual(asked);
    expect(text(slots()[0]?.querySelector('.value') ?? null)).toBe(right(0));
    // A wrong pick, then hidden before the reset fires: the reset runs, and still nothing is in the DOM.
    const wrong = [...el('cnf-pool').querySelectorAll('button')].map(text).find(w => w !== right(1) && w !== right(0)) ?? '';
    await pick(wrong);
    h.leave();
    h.timers.advance(RESET_MS);
    expect(leaked()).toEqual([]);
    expect(el('cnf-pool').children).toHaveLength(0);
    h.back();
    expect(slots().every(s => s.classList.contains('empty'))).toBe(true);
    expect(leaked().sort()).toEqual([right(0), right(1), right(2)].sort());
  });
});

describe('#4 seed-confirm: a repeated word (I1)', () => {
  it('23 × abandon + art: picks go by pool index, so a word that fills one slot is still offered for the next', async () => {
    const h = await harness();
    const calls: string[] = [];
    mountConfirm(h.deps, {back: () => undefined, done: () => calls.push('done')}).show(ABANDON);
    for (const label of [...el('cnf-slots').querySelectorAll('.label')].map(text)) {
      const word = ABANDON[Number(/#(\d+)/.exec(label)?.[1]) - 1];
      await idle(h);
      const b = [...el('cnf-pool').querySelectorAll('button')].find(x => text(x) === word && !x.classList.contains('used')) as HTMLButtonElement;
      expect(b).toBeDefined();
      click(b);
    }
    await idle(h);
    expect(el<HTMLButtonElement>('cnf-cta').disabled).toBe(false);
    click(el('cnf-cta'));
    expect(visible(el('cnf-success'))).toBe(true);
  });
});

describe('#3 seed-display: pagehide (fix round 1)', () => {
  it('a hidden tab only re-blurs #3; pagehide also drops its phrase (the page may sit in the back/forward cache)', async () => {
    const h = await harness();
    const seed = mountSeed(h.deps, {back: () => undefined, done: () => undefined});
    seed.show(WORDS);
    await press(h, 'sg-continue');
    el('seed-grid').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    h.timers.advance(HOLD_MS + TICK_MS);
    h.leave('hidden');
    expect(leaked()).toEqual([]);
    expect(seed.holds()).toBe(true);
    h.leave('pagehide');
    expect(seed.holds()).toBe(false);
    expect(el('seed-grid').querySelectorAll('.word')).toHaveLength(0);
  });
});

describe('#4 seed-confirm: leaving', () => {
  it('pagehide: #4 ends and drops its plan; the page restored shows no word again', async () => {
    const h = await harness();
    const screen = mountConfirm(h.deps, {back: () => undefined, done: () => undefined});
    screen.show(WORDS);
    h.leave('pagehide');
    expect(screen.holds()).toBe(false);
    expect(leaked()).toEqual([]);
    h.back('restored');
    h.back('visible');
    expect(leaked()).toEqual([]);
    expect(el('cnf-pool').children).toHaveLength(0);
  });

  it('back → #3: the words are out of the DOM and the screen holds no plan', async () => {
    const h = await harness();
    const calls: string[] = [];
    const screen = mountConfirm(h.deps, {back: () => calls.push('back'), done: () => calls.push('done')});
    screen.show(WORDS);
    expect(screen.holds()).toBe(true);
    await press(h, 'cnf-back');
    expect(calls).toEqual(['back']);
    expect(leaked()).toEqual([]);
    expect(screen.holds()).toBe(false);
    expect(el('cnf-slots').children).toHaveLength(0);
    expect(el('cnf-pool').children).toHaveLength(0);
  });
});

describe('#5 create password (D7)', () => {
  async function shown(finish: (pw: string) => Promise<{line: string; stop: boolean} | null> = async () => null, o: {holdSleep?: boolean} = {}) {
    const h = await harness(o);
    const finished: string[] = [];
    const backs: number[] = [];
    const screen = mountPassword(h.deps);
    screen.show({eyebrow: 'Onboarding', step: '4 / 5', back: () => backs.push(1), finish: async pw => (finished.push(pw), finish(pw))});
    return {h, screen, finished, backs, field: el<HTMLInputElement>('pw-field'), cta: el<HTMLButtonElement>('pw-cta')};
  }
  /** Enter, then on to the confirm step once the gate frees. */
  async function toConfirm(h: Harness, field: HTMLInputElement, cta: HTMLButtonElement) {
    type(field, PW);
    click(cta);
    await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
  }

  it('enter: the adapted copy, the field (new-password) and the length meter; Continue only from 12 characters', async () => {
    const {field, cta} = await shown();
    expect(text(el('pw-eyebrow'))).toBe('Onboarding');
    expect(text(el('pw-step'))).toBe('4 / 5');
    expect(text(el('pw-title'))).toBe('Create a password');
    expect(text(el('pw-lede'))).toBe("At least 12 characters. You'll need it to unlock the wallet and to confirm risky sends.");
    expect(text(el('pw-helper'))).toBe('Choose something long and memorable — a few unrelated words work well.');
    expect(field.getAttribute('autocomplete')).toBe('new-password');
    expect(text(el('pw-meter-label'))).toBe('0 of 12 characters');
    expect(cta.disabled).toBe(true);
    type(field, 'a'.repeat(9));
    expect(text(el('pw-meter-label'))).toBe('9 of 12 characters');
    expect(el('pw-meter').querySelectorAll('i.filled')).toHaveLength(3);
    expect(cta.disabled).toBe(true);
    type(field, PW);
    expect(text(el('pw-meter-label'))).toBe('Long enough');
    expect(el('pw-meter').querySelectorAll('i.filled')).toHaveLength(4);
    expect(cta.disabled).toBe(false);
    expect(el('pw-dot-1').classList.contains('active')).toBe(true);
    expect(el('pw-dot-2').classList.contains('active')).toBe(false);
    expect(text(document.body)).not.toMatch(/PIN|111111/);
    expect(unstyled('v-password')).toEqual([]);
  });

  it('show/hide toggles the field; confirm asks for the same password', async () => {
    const {h, field, cta} = await shown();
    click(el('pw-toggle'));
    expect(field.type).toBe('text');
    expect(el('pw-toggle').getAttribute('aria-label')).toBe('Hide password');
    expect(el('pw-toggle-icon').getAttribute('href')).toBe('#i-eye-off');
    await idle(h);
    click(el('pw-toggle'));
    expect(field.type).toBe('password');
    expect(el('pw-toggle').getAttribute('aria-label')).toBe('Show password');
    await idle(h);
    await toConfirm(h, field, cta);
    expect(text(el('pw-lede'))).toBe('Enter the same password to verify.');
    expect(field.value).toBe('');
    expect(el('pw-dot-1').classList.contains('active')).toBe(false);
    expect(el('pw-dot-2').classList.contains('active')).toBe(true);
    expect(visible(el('pw-meter'))).toBe(false);
    expect(unstyled('v-password')).toEqual([]);
  });

  it('mismatch: "Passwords don’t match — try again.", the shake, and the field cleared after 600 ms', async () => {
    const {h, field, cta, finished} = await shown();
    await toConfirm(h, field, cta);
    type(field, `${PW}!`);
    click(cta);
    await h.until(() => text(el('pw-helper')) !== '');
    expect(text(el('pw-helper'))).toBe("Passwords don't match — try again.");
    expect(el('pw-helper').classList.contains('error')).toBe(true);
    expect(field.classList.contains('is-error')).toBe(true);
    // The design's mismatch state: both step dots wide.
    expect(el('pw-dot-1').classList.contains('active')).toBe(true);
    expect(el('pw-dot-2').classList.contains('active')).toBe(true);
    expect(unstyled('v-password')).toEqual([]);
    h.timers.advance(MISMATCH_CLEAR_MS - 1);
    expect(field.value).toBe(`${PW}!`);
    h.timers.advance(1);
    expect(field.value).toBe('');
    expect(field.classList.contains('is-error')).toBe(false);
    expect(el('pw-dot-1').classList.contains('active')).toBe(false);
    expect(text(el('pw-title'))).toBe('Confirm your password');
    expect(finished).toEqual([]);
    // The confirm step goes on: the same password now matches.
    await idle(h);
    type(field, PW);
    click(cta);
    await h.until(() => finished.length === 1);
    expect(finished).toEqual([PW]);
  });

  it('creating: "Creating your wallet…" with the progress bar, every control disabled — and rule 6’s lock itself, tested past a lifted `disabled`', async () => {
    let release: () => void = () => undefined;
    const {h, field, cta, finished, screen} = await shown(() => new Promise(r => (release = () => r({line: 'Something went wrong. Nothing was saved.', stop: false}))), {holdSleep: true});
    type(field, PW);
    click(cta);
    // Inside the floor of the enter step's Continue: a second click (disabled lifted, as a stray event would)
    // must not run the confirm step — no mismatch from an empty confirm field.
    cta.disabled = false;
    click(cta);
    expect(text(el('pw-helper'))).toBe('');
    expect(field.classList.contains('is-error')).toBe(false);
    h.wake();
    await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
    type(field, PW);
    click(cta);
    await h.until(() => finished.length === 1);
    expect(visible(el('pw-creating'))).toBe(true);
    expect(text(el('pw-creating'))).toBe('Creating your wallet… Securing your password takes a few seconds.');
    expect(el('pw-creating').querySelector('progress.noc-progress')).not.toBeNull();
    expect(cta.disabled).toBe(true);
    expect(field.disabled).toBe(true);
    expect(el<HTMLButtonElement>('pw-back').disabled).toBe(true);
    expect(el<HTMLButtonElement>('pw-toggle').disabled).toBe(true);
    expect(screen.holds()).toBe(false);
    cta.disabled = false;
    click(cta);
    click(cta);
    expect(finished).toEqual([PW]);
    expect(unstyled('v-password')).toEqual([]);
    // The store settles with a refusal that can be retried; inside the 500 ms floor a new attempt is refused…
    release();
    await h.until(() => text(el('pw-helper')) === 'Something went wrong. Nothing was saved.');
    type(field, PW);
    cta.disabled = false;
    click(cta);
    expect(text(el('pw-title'))).toBe('Create a password');
    expect(field.value).toBe(PW);
    // …and taken once the floor has passed.
    h.wake();
    await h.until(() => !h.deps.gate.isBusy());
    click(cta);
    expect(text(el('pw-title'))).toBe('Confirm your password');
    expect(finished).toEqual([PW]);
  });

  it('M2: keystrokes typed right after Continue (inside the floor) are kept; only Continue waits', async () => {
    const {h, field, cta, finished} = await shown(async () => null, {holdSleep: true});
    type(field, PW);
    click(cta);
    expect(text(el('pw-title'))).toBe('Confirm your password');
    expect(h.deps.gate.isBusy()).toBe(true);
    expect(field.disabled).toBe(false);
    type(field, PW);
    expect(field.value).toBe(PW);
    expect(cta.disabled).toBe(true);
    h.wake();
    await h.until(() => !cta.disabled);
    click(cta);
    await h.until(() => finished.length === 1);
    expect(finished).toEqual([PW]);
  });

  it('a refusal that stops: its line and help replace the field; no CTA; nothing held', async () => {
    const {h, field, cta, screen} = await shown(async () => ({line: 'A wallet already exists in this browser. Nothing was changed.', help: 'Open the Noctura icon to use it.', stop: true}));
    await toConfirm(h, field, cta);
    type(field, PW);
    click(cta);
    await h.until(() => visible(el('pw-notice')));
    expect(text(el('pw-notice'))).toBe('A wallet already exists in this browser. Nothing was changed. Open the Noctura icon to use it.');
    expect(visible(cta)).toBe(false);
    expect(visible(el('pw-form'))).toBe(false);
    expect(visible(el('pw-helper'))).toBe(false);
    expect(field.disabled).toBe(true);
    expect(el<HTMLButtonElement>('pw-back').disabled).toBe(true);
    expect(screen.holds()).toBe(false);
    expect(unstyled('v-password')).toEqual([]);
  });

  it('a refusal that can be retried starts again at enter, with nothing typed kept', async () => {
    const {h, field, cta, screen} = await shown(async () => ({line: 'Something went wrong. Nothing was saved.', stop: false}));
    await toConfirm(h, field, cta);
    type(field, PW);
    click(cta);
    await h.until(() => text(el('pw-helper')) === 'Something went wrong. Nothing was saved.' && !h.deps.gate.isBusy());
    expect(text(el('pw-title'))).toBe('Create a password');
    expect(field.value).toBe('');
    expect(field.disabled).toBe(false);
    expect(visible(cta)).toBe(true);
    expect(screen.holds()).toBe(false);
  });

  it('back: from confirm to enter (the first password dropped), from enter to the run’s back; never inside the floor', async () => {
    const {h, field, cta, backs, screen} = await shown();
    await toConfirm(h, field, cta);
    expect(screen.holds()).toBe(true);
    click(el('pw-back'));
    expect(text(el('pw-title'))).toBe('Create a password');
    expect(screen.holds()).toBe(false);
    click(el('pw-back'));
    expect(backs).toEqual([]);
    await idle(h);
    click(el('pw-back'));
    expect(backs).toEqual([1]);
  });

  it('the tab hidden drops what was typed (§3.5, review L5): "Enter a new password to try again." — on enter and on confirm', async () => {
    const {h, field, cta, screen} = await shown();
    type(field, PW);
    expect(screen.holds()).toBe(true);
    h.leave();
    expect(field.value).toBe('');
    expect(screen.holds()).toBe(false);
    expect(text(el('pw-helper'))).toBe('Enter a new password to try again.');
    expect(text(el('pw-meter-label'))).toBe('0 of 12 characters');
    await toConfirm(h, field, cta);
    type(field, 'half typed');
    h.leave();
    expect(field.value).toBe('');
    expect(screen.holds()).toBe(false);
    expect(text(el('pw-title'))).toBe('Create a password');
    expect(el('pw-dot-1').classList.contains('active')).toBe(true);
    expect(text(el('pw-helper'))).toBe('Enter a new password to try again.');
    expect(unstyled('v-password')).toEqual([]);
    // Typing again clears the line back to the helper's own.
    type(field, 'x');
    expect(text(el('pw-helper'))).toBe('Choose something long and memorable — a few unrelated words work well.');
  });

  it('a screen shown while the gate is held (an action begun on #4) enables its controls once the gate frees (Scope 15)', async () => {
    const h = await harness();
    h.deps.gate.setBusy(true);
    mountPassword(h.deps).show({eyebrow: 'Onboarding', step: '4 / 5', back: () => undefined, finish: async () => null});
    type(el<HTMLInputElement>('pw-field'), PW);
    expect(el<HTMLButtonElement>('pw-cta').disabled).toBe(true);
    expect(el<HTMLButtonElement>('pw-back').disabled).toBe(true);
    h.deps.gate.setBusy(false);
    expect(el<HTMLButtonElement>('pw-cta').disabled).toBe(false);
    expect(el<HTMLButtonElement>('pw-back').disabled).toBe(false);
  });
});

describe('#6 passkey (D9)', () => {
  /** A WebAuthn stand-in with PRF: create() then get() return the same PRF output (onboarding.test.ts). */
  function prfCredentials(prf: Uint8Array): CredentialsApi & {creates: number} {
    const cred = (withPrf: boolean) =>
      ({
        rawId: new Uint8Array([1, 2, 3, 4]).buffer,
        getClientExtensionResults: () => (withPrf ? {prf: {results: {first: prf.slice().buffer}}} : {}),
      }) as unknown as Credential;
    const api = {
      creates: 0,
      create: async () => (api.creates++, cred(false)),
      get: async () => cred(true),
    };
    return api;
  }
  const wallet = () => createEnvelope({mnemonic: PHRASE, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: ACCOUNT}], kdf: testKdf});
  /** The run's hold on #5's password, with a record of every drop. */
  function heldPassword(pw: string | null) {
    let v = pw;
    const drops: number[] = [];
    return {drops, held: {get: () => v, drop: () => void (drops.push(1), (v = null))}, holds: () => v !== null};
  }

  it('idle: the adapted copy (no "PIN still wins"), Add a passkey and Skip; Skip → #7 and the password is dropped', async () => {
    const h = await harness();
    const done: number[] = [];
    const p = heldPassword(PW);
    const screen = mountPasskey(h.deps, {done: () => done.push(1)});
    screen.show(p.held);
    const v = el('v-passkey');
    expect(visible(v)).toBe(true);
    expect(text(v.querySelector('.top-bar .step'))).toBe('5 / 5');
    expect(v.querySelector('.top-bar .icon-btn')).toBeNull();
    expect(text(v.querySelector('h1'))).toBe('Unlock Noctura with a passkey');
    expect(text(v.querySelector('h1 + p'))).toBe('Adds convenience. Your password always works too — keep it safe.');
    expect([...v.querySelectorAll('.feature-row')].map(r => text(r))).toEqual([
      'Faster unlock Use your fingerprint, face or security key instead of typing your password.',
      'Password still works If the passkey is unavailable, your password unlocks the wallet and confirms everything.',
      "Where your passkey lives A passkey synced to Google, Apple or a password manager keeps its secret in that provider's cloud. Other extensions allowed on wallet.noc-tura.io can ask for it too.",
    ]);
    expect(text(v)).not.toMatch(/PIN|fingerprint\b.*Enable|Resets on enrollment/);
    expect(text(el('pk-add'))).toBe('Add a passkey');
    expect(text(el('pk-skip'))).toBe('Skip — use password only');
    expect(visible(el('pk-continue'))).toBe(false);
    expect(visible(el('pk-ask'))).toBe(false);
    expect(unstyled('v-passkey')).toEqual([]);
    click(el('pk-skip'));
    await h.until(() => done.length === 1);
    expect(p.holds()).toBe(false);
    expect(screen.holds()).toBe(false);
  });

  it('added: "Waiting for your passkey…", then "Passkey added." + Continue → #7; the stored wallet now opens with the passkey', async () => {
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const h = await harness({vault: await wallet(), credentials: prfCredentials(prf)});
    const done: number[] = [];
    const p = heldPassword(PW);
    const screen = mountPasskey(h.deps, {done: () => done.push(1)});
    screen.show(p.held);
    click(el('pk-add'));
    expect(text(el('pk-line'))).toBe('Waiting for your passkey…');
    expect(el<HTMLButtonElement>('pk-skip').disabled).toBe(true);
    await h.until(() => visible(el('pk-continue')));
    expect(text(el('pk-line'))).toBe('Passkey added.');
    expect(visible(el('pk-add'))).toBe(false);
    expect(visible(el('pk-skip'))).toBe(false);
    expect(p.holds()).toBe(false);
    expect(screen.holds()).toBe(false);
    const env = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    expect(await decryptMnemonic(env, await unlockWithPrf(env, prf))).toBe(PHRASE);
    expect(unstyled('v-passkey')).toEqual([]);
    await press(h, 'pk-continue');
    expect(done).toEqual([1]);
  });

  it('a device without PRF: "Waiting for your passkey…", then unsupported + Continue → #7', async () => {
    const h = await harness({vault: await wallet(), credentials: {create: async () => null, get: async () => null}});
    const done: number[] = [];
    const p = heldPassword(PW);
    mountPasskey(h.deps, {done: () => done.push(1)}).show(p.held);
    click(el('pk-add'));
    expect(text(el('pk-line'))).toBe('Waiting for your passkey…');
    await h.until(() => visible(el('pk-continue')));
    expect(text(el('pk-line'))).toBe('This device cannot unlock the wallet with a passkey; your password still works.');
    expect(p.holds()).toBe(false);
    await press(h, 'pk-continue');
    expect(done).toEqual([1]);
  });

  it('no wallet stored (the store never landed): the failed line + Continue → #7', async () => {
    const h = await harness({vault: undefined});
    const done: number[] = [];
    const p = heldPassword(PW);
    mountPasskey(h.deps, {done: () => done.push(1)}).show(p.held);
    click(el('pk-add'));
    await h.until(() => visible(el('pk-continue')));
    expect(text(el('pk-line'))).toBe('Something went wrong. Your password still works.');
    expect(p.holds()).toBe(false);
    await press(h, 'pk-continue');
    expect(done).toEqual([1]);
  });

  it('rule 6: a second [Add a passkey] before the first settles prompts nothing more; Skip while it runs does nothing', async () => {
    let creates = 0;
    const h = await harness({vault: await wallet(), credentials: {create: async () => (creates++, null), get: async () => null}});
    const done: number[] = [];
    mountPasskey(h.deps, {done: () => done.push(1)}).show(heldPassword(PW).held);
    click(el('pk-add'));
    click(el('pk-add'));
    click(el('pk-skip'));
    await h.until(() => visible(el('pk-continue')));
    expect(text(el('pk-line'))).toBe('This device cannot unlock the wallet with a passkey; your password still works.');
    expect(creates).toBe(1);
    expect(done).toEqual([]);
    // Ended: Add and Skip do nothing more; Continue goes once.
    await idle(h);
    click(el('pk-add'));
    click(el('pk-skip'));
    await idle(h);
    expect(creates).toBe(1);
    expect(done).toEqual([]);
    click(el('pk-continue'));
    click(el('pk-continue'));
    await idle(h);
    expect(done).toEqual([1]);
  });

  it('when the tab was hidden after #5, it asks for the password once more; the typed one adds the passkey', async () => {
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const h = await harness({vault: await wallet(), credentials: prfCredentials(prf)});
    const screen = mountPasskey(h.deps, {done: () => undefined});
    screen.show(heldPassword(null).held);
    click(el('pk-add'));
    await h.until(() => visible(el('pk-ask')) && !h.deps.gate.isBusy());
    expect(text(el('pk-ask'))).toBe('Enter your password to add the passkey.');
    expect(el('pk-password').getAttribute('autocomplete')).toBe('current-password');
    expect(unstyled('v-passkey')).toEqual([]);
    type(el<HTMLInputElement>('pk-password'), PW);
    expect(screen.holds()).toBe(true);
    click(el('pk-add'));
    expect(el<HTMLInputElement>('pk-password').value).toBe('');
    await h.until(() => visible(el('pk-continue')));
    expect(text(el('pk-line'))).toBe('Passkey added.');
    expect(screen.holds()).toBe(false);
  });

  it('a re-typed password that is wrong: "That did not confirm it." and the field again; nothing stored', async () => {
    const env = await wallet();
    const h = await harness({vault: env, credentials: prfCredentials(crypto.getRandomValues(new Uint8Array(32)))});
    mountPasskey(h.deps, {done: () => undefined}).show(heldPassword(null).held);
    click(el('pk-add'));
    await h.until(() => visible(el('pk-ask')) && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pk-password'), 'not the password at all');
    click(el('pk-add'));
    await h.until(() => text(el('pk-line')) === 'That did not confirm it.');
    expect(visible(el('pk-ask'))).toBe(true);
    expect(visible(el('pk-continue'))).toBe(false);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(env);
  });

  it('the tab hidden on #6 clears a re-typed password (the run drops the held one: createRun’s test)', async () => {
    const h = await harness();
    const screen = mountPasskey(h.deps, {done: () => undefined});
    screen.show(heldPassword(null).held);
    click(el('pk-add'));
    await h.until(() => visible(el('pk-ask')) && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pk-password'), PW);
    h.leave();
    expect(el<HTMLInputElement>('pk-password').value).toBe('');
    expect(screen.holds()).toBe(false);
  });

  it('shown while the gate is held (#5’s store ends on #6): Add and Skip come back once the gate frees (Scope 15)', async () => {
    const h = await harness();
    h.deps.gate.setBusy(true);
    mountPasskey(h.deps, {done: () => undefined}).show(heldPassword(PW).held);
    expect(el<HTMLButtonElement>('pk-skip').disabled).toBe(true);
    h.deps.gate.setBusy(false);
    expect(el<HTMLButtonElement>('pk-skip').disabled).toBe(false);
    expect(el<HTMLButtonElement>('pk-add').disabled).toBe(false);
  });
});

describe('the create run, end to end in one page, against the real background', () => {
  /** #1 → #2 → #3 (revealed and confirmed) → #4 (three right words) → #5's confirm step; returns the 24 words #3 showed. */
  async function toPassword(h: Harness): Promise<string[]> {
    await press(h, 'wel-create');
    click(el('int-continue'));
    await press(h, 'sg-continue');
    el('seed-grid').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    h.timers.advance(HELD);
    const shownWords = [...el('seed-grid').querySelectorAll('.term')].map(text);
    el('seed-grid').dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
    await press(h, 'seed-cta');
    for (const s of [...el('cnf-slots').querySelectorAll('.label')].map(text)) {
      const n = Number(/#(\d+)/.exec(s)?.[1]);
      const b = () => [...el('cnf-pool').querySelectorAll('button')].find(x => text(x) === shownWords[n - 1]) as HTMLButtonElement;
      await h.until(() => !b().disabled);
      click(b());
    }
    await press(h, 'cnf-cta');
    await press(h, 'cnf-cta');
    // M2: the field takes typing at once; Continue waits for the gate (#4's Continue floor).
    type(el<HTMLInputElement>('pw-field'), PW);
    await press(h, 'pw-cta');
    await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), PW);
    return shownWords;
  }

  it('#1 → #2 → #3 → #4 → #5 → #6 → Skip → wallet.html#/created; the stored wallet is the phrase shown on #3; nothing holds it after', async () => {
    const h = await harness({mnemonic: PHRASE});
    const run = startCreateRun(h.deps, {at: 'welcome', importRun: () => undefined});
    expect(run.holds()).toEqual({phrase: false, password: false});
    await h.until(() => visible(el('wel-actions')));
    const shownWords = await toPassword(h);
    expect(shownWords).toEqual(WORDS);
    expect(run.holds()).toEqual({phrase: true, password: false});
    click(el('pw-cta'));
    await h.until(() => visible(el('v-passkey')));
    const env = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    expect(await decryptMnemonic(env, await unlockWithPassword(env, PW, testKdf))).toBe(PHRASE);
    expect((await getSession(h.ext))?.map(a => a.publicKey)).toEqual(env.accounts.map(a => a.publicKey));
    // H2: the phrase is dropped once stored; #5's password is held for #6 only.
    expect(run.holds()).toEqual({phrase: false, password: true});
    // No word of the phrase is left in the DOM — text or attribute: #3 and #4 took theirs out when the run moved on.
    expect(leaked()).toEqual([]);
    await press(h, 'pk-skip');
    expect(h.went).toEqual(['wallet.html#/created']);
    expect(run.holds()).toEqual({phrase: false, password: false});
  }, 30_000);

  it('Scope 15, with the real gate and no manual idle: #1’s Create → #2 → #3’s gate shows Continue disabled while #1’s floor runs, then enables it', async () => {
    const h = await harness({mnemonic: PHRASE});
    startCreateRun(h.deps, {at: 'welcome', importRun: () => undefined});
    await h.until(() => visible(el('wel-actions')) && !el<HTMLButtonElement>('wel-create').disabled);
    click(el('wel-create'));
    expect(h.deps.gate.isBusy()).toBe(true);
    click(el('int-continue'));
    expect(visible(el('v-seed-gate'))).toBe(true);
    expect(el<HTMLButtonElement>('sg-continue').disabled).toBe(true);
    // Only the gate's onIdle can enable it: #3's show() ran while #1's action held the gate.
    await h.until(() => !el<HTMLButtonElement>('sg-continue').disabled);
    click(el('sg-continue'));
    expect(visible(el('v-seed'))).toBe(true);
    expect(el('seed-grid').querySelectorAll('.word')).toHaveLength(24);
  });

  it('Scope 15 backwards: #3’s Cancel → #2 → back → #1 enables Create once the gate frees', async () => {
    const h = await harness({mnemonic: PHRASE});
    startCreateRun(h.deps, {at: 'intro', importRun: () => undefined});
    click(el('int-continue'));
    await h.until(() => !el<HTMLButtonElement>('sg-cancel').disabled);
    click(el('sg-cancel'));
    expect(visible(el('v-intro'))).toBe(true);
    click(el('int-back'));
    await h.until(() => visible(el('wel-actions')) && !el<HTMLButtonElement>('wel-create').disabled);
    expect(visible(el('v-welcome'))).toBe(true);
  });

  it('starts at #2 for ?mode=create; #1’s Import hands over to the import run', async () => {
    const h = await harness();
    const imports: number[] = [];
    startCreateRun(h.deps, {at: 'intro', importRun: () => imports.push(1)});
    expect(visible(el('v-intro'))).toBe(true);
    click(el('int-back'));
    await press(h, 'wel-import');
    expect(imports).toEqual([1]);
  });

  it('back from #5 → #4 (a new plan for the same phrase), back from #4 → #3: the same phrase throughout', async () => {
    const h = await harness({mnemonic: PHRASE});
    const run = startCreateRun(h.deps, {at: 'welcome', importRun: () => undefined});
    await h.until(() => visible(el('wel-actions')));
    await toPassword(h);
    await press(h, 'pw-back');
    expect(text(el('pw-title'))).toBe('Create a password');
    await press(h, 'pw-back');
    expect(visible(el('v-confirm'))).toBe(true);
    expect(el('cnf-pool').querySelectorAll('button')).toHaveLength(9);
    await press(h, 'cnf-back');
    expect(visible(el('v-seed-gate'))).toBe(true);
    await press(h, 'sg-continue');
    el('seed-grid').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    h.timers.advance(HELD);
    expect([...el('seed-grid').querySelectorAll('.term')].map(text)).toEqual(WORDS);
    el('seed-grid').dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
    expect(run.holds().phrase).toBe(true);
  }, 30_000);

  it('the tab hidden while the wallet is stored: #6 does not hold the password; it asks for it again', async () => {
    const h = await harness({mnemonic: PHRASE});
    const run = startCreateRun(h.deps, {at: 'welcome', importRun: () => undefined});
    await h.until(() => visible(el('wel-actions')));
    await toPassword(h);
    click(el('pw-cta'));
    await h.until(() => visible(el('pw-creating')));
    h.leave();
    await h.until(() => visible(el('v-passkey')));
    expect(run.holds()).toEqual({phrase: false, password: false});
    await press(h, 'pk-add');
    await h.until(() => visible(el('pk-ask')));
    expect(text(el('pk-ask'))).toBe('Enter your password to add the passkey.');
  }, 30_000);

  it('the tab hidden on #6 drops the held password; Add then asks for it', async () => {
    const h = await harness({mnemonic: PHRASE});
    const run = startCreateRun(h.deps, {at: 'welcome', importRun: () => undefined});
    await h.until(() => visible(el('wel-actions')));
    await toPassword(h);
    click(el('pw-cta'));
    await h.until(() => visible(el('v-passkey')));
    expect(run.holds().password).toBe(true);
    h.leave();
    expect(run.holds()).toEqual({phrase: false, password: false});
    await press(h, 'pk-add');
    await h.until(() => visible(el('pk-ask')));
  }, 30_000);

  it('created-locked (the keys did not reach the background): straight to wallet.html#/created; nothing held', async () => {
    const h = await harness({
      mnemonic: PHRASE,
      send: inner => async m => ((m as {type: string}).type === 'vault.setKeys' ? {ok: false, error: 'failed'} : inner(m)),
    });
    const run = startCreateRun(h.deps, {at: 'welcome', importRun: () => undefined});
    await h.until(() => visible(el('wel-actions')));
    await toPassword(h);
    click(el('pw-cta'));
    await h.until(() => h.went.length === 1);
    expect(h.went).toEqual(['wallet.html#/created']);
    expect(run.holds()).toEqual({phrase: false, password: false});
    expect(visible(el('v-passkey'))).toBe(false);
  }, 30_000);

  it('M1: a wallet stored meanwhile (exists): "Open the Noctura icon to use it." as #1 says it, no CTA, the phrase dropped', async () => {
    const h = await harness({mnemonic: PHRASE});
    const run = startCreateRun(h.deps, {at: 'welcome', importRun: () => undefined});
    await h.until(() => visible(el('wel-actions')));
    await toPassword(h);
    // Another tab finished first.
    await h.ext.local.set(VAULT_KEY, await createEnvelope({mnemonic: PHRASE, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: ACCOUNT}], kdf: testKdf}));
    click(el('pw-cta'));
    await h.until(() => visible(el('pw-notice')));
    expect(text(el('pw-notice'))).toBe('A wallet already exists in this browser. Nothing was changed. Open the Noctura icon to use it.');
    expect(visible(el('pw-cta'))).toBe(false);
    expect(visible(el('pw-form'))).toBe(false);
    expect(run.holds()).toEqual({phrase: false, password: false});
    expect(h.went).toEqual([]);
    expect(unstyled('v-password')).toEqual([]);
  }, 30_000);

  it('M4: a damaged vault stored meanwhile (null): the damaged lines, never "A wallet already exists"', async () => {
    const h = await harness({mnemonic: PHRASE});
    const run = startCreateRun(h.deps, {at: 'welcome', importRun: () => undefined});
    await h.until(() => visible(el('wel-actions')));
    await toPassword(h);
    await h.ext.local.set(VAULT_KEY, null);
    click(el('pw-cta'));
    await h.until(() => visible(el('pw-notice')));
    expect(text(el('pw-notice-line'))).toBe("This wallet's stored data is damaged.");
    expect(text(el('pw-notice-help'))).toBe(
      'Your funds stay on Solana; your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase.',
    );
    expect(text(el('v-password'))).not.toMatch(/already exists/);
    expect(visible(el('pw-cta'))).toBe(false);
    expect(run.holds()).toEqual({phrase: false, password: false});
  }, 30_000);

  it('pagehide (the page may go into the back/forward cache): the run drops the phrase and the password, no word left in the DOM; restored, it starts again at #1', async () => {
    const h = await harness({mnemonic: PHRASE});
    const run = startCreateRun(h.deps, {at: 'welcome', importRun: () => undefined});
    await h.until(() => visible(el('wel-actions')));
    await press(h, 'wel-create');
    click(el('int-continue'));
    await press(h, 'sg-continue');
    el('seed-grid').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    h.timers.advance(HELD);
    expect(leaked().length).toBeGreaterThan(0);
    // A hidden tab keeps the phrase (Scope 19) …
    h.leave('hidden');
    expect(run.holds().phrase).toBe(true);
    // … pagehide does not.
    h.leave('pagehide');
    expect(run.holds()).toEqual({phrase: false, password: false});
    expect(leaked()).toEqual([]);
    h.back('restored');
    await h.until(() => visible(el('wel-actions')));
    expect(visible(el('v-welcome'))).toBe(true);
    // A new run: a new phrase is generated when #3 is reached again.
    await press(h, 'wel-create');
    click(el('int-continue'));
    await press(h, 'sg-continue');
    expect(run.holds().phrase).toBe(true);
  }, 30_000);

  it('pagehide while the wallet is stored: the run drops the phrase; the store that lands afterwards does not move the run on', async () => {
    const h = await harness({mnemonic: PHRASE});
    const run = startCreateRun(h.deps, {at: 'welcome', importRun: () => undefined});
    await h.until(() => visible(el('wel-actions')));
    await toPassword(h);
    click(el('pw-cta'));
    await h.until(() => visible(el('pw-creating')));
    h.leave('pagehide');
    expect(run.holds()).toEqual({phrase: false, password: false});
    // The store lands (it was already running), but the run was dropped: no #6, no password held.
    // The gate frees only once the store has settled (and its floor passed).
    await h.until(() => !h.deps.gate.isBusy());
    expect(await h.ext.local.get(VAULT_KEY)).toBeDefined();
    expect(visible(el('v-passkey'))).toBe(false);
    expect(run.holds()).toEqual({phrase: false, password: false});
    h.back('restored');
    await h.until(() => visible(el('wel-notice')));
    expect(text(el('wel-notice-line'))).toBe('A wallet already exists in this browser. Nothing was changed.');
  }, 30_000);

  it('a store that fails keeps the phrase for another try and holds no password', async () => {
    const h = await harness({
      mnemonic: PHRASE,
      send: inner => async m => ((m as {type: string}).type === 'vault.storeEnvelope' ? {ok: false, error: 'failed'} : inner(m)),
    });
    const run = startCreateRun(h.deps, {at: 'welcome', importRun: () => undefined});
    await h.until(() => visible(el('wel-actions')));
    await toPassword(h);
    click(el('pw-cta'));
    await h.until(() => text(el('pw-helper')) === 'Something went wrong. Nothing was saved.' && !h.deps.gate.isBusy());
    expect(text(el('pw-title'))).toBe('Create a password');
    expect(run.holds()).toEqual({phrase: true, password: false});
  }, 30_000);
});
