import {wordlist} from '@scure/bip39/wordlists/english.js';
import {exclusive, type PageDeps} from '../page';
import {CONFIRM} from '../strings';
import {byId, h, setText, showScreen, shown} from '../view/dom';

/** #4's three positions (1–24) and its pool: per slot the correct word and two distractors. */
export interface ConfirmPlan {
  slots: {position: number; word: string}[];
  /** Nine words, three per slot in slot order, the correct one at a random place in its row. */
  pool: string[];
}

/** A uniform integer in [0, n), from the page's random bytes (rejection sampling: no modulo bias). */
export function randomBelow(randomBytes: (n: number) => Uint8Array, n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  for (;;) {
    const b = randomBytes(4);
    const x = (((b[0] ?? 0) << 24) | ((b[1] ?? 0) << 16) | ((b[2] ?? 0) << 8) | (b[3] ?? 0)) >>> 0;
    if (x < limit) return x % n;
  }
}

/**
 * Spec §3.4 (as plan Scope 2 reads it): three distinct positions of the 24, and a pool of nine — for each
 * slot one correct word and eight that are not. As the design draws it (4a: "orchid coral circle / vendor
 * voyage vintage / lift linger latch"), each row is a slot's word with two BIP-39 distractors starting
 * with the same letter, none of them a word of this phrase. Generated once per visit of #4.
 *
 * A BIP-39 phrase may repeat a word (fix round 1, I1): the three positions are chosen so their WORDS differ,
 * which makes the nine pool words distinct. Only a phrase with fewer than three distinct words (the
 * "abandon … art" test vector) can repeat a slot word; the screen tracks picks by pool index, so even that
 * plan stays completable.
 */
export function confirmPlan(words: readonly string[], randomBytes: (n: number) => Uint8Array): ConfirmPlan {
  const repeatsAllowed = new Set(words).size < 3;
  const picked: number[] = [];
  while (picked.length < 3) {
    const position = randomBelow(randomBytes, words.length) + 1;
    const word = words[position - 1] ?? '';
    if (picked.includes(position)) continue;
    if (!repeatsAllowed && picked.some(p => words[p - 1] === word)) continue;
    picked.push(position);
  }
  const slots = picked.sort((a, b) => a - b).map(position => ({position, word: words[position - 1] ?? ''}));
  const used = new Set(words);
  const pool: string[] = [];
  for (const {word} of slots) {
    const pick = (): string => {
      const same = wordlist.filter(w => w[0] === word[0] && !used.has(w));
      const from = same.length > 0 ? same : wordlist.filter(w => !used.has(w));
      const w = from[randomBelow(randomBytes, from.length)] ?? '';
      used.add(w);
      return w;
    };
    const row = [pick(), pick()];
    // The correct word at a random place of its row (splice: the vault page writes no computed member).
    row.splice(randomBelow(randomBytes, 3), 0, word);
    pool.push(...row);
  }
  return {slots, pool};
}

/** The design's ~700 ms before the slots reset after a wrong pick. */
export const RESET_MS = 700;

/** What frames #4 (B1b-2b §3.5): onboarding's, or the verify check's (no step, its own success and a close). */
export interface ConfirmChrome {
  eyebrow: string;
  step: string | null;
  successTitle: string;
  successBody: string;
  successCta: string;
}
const ONBOARDING: ConfirmChrome = {eyebrow: CONFIRM.onboarding, step: CONFIRM.step, successTitle: CONFIRM.verifiedTitle, successBody: CONFIRM.verifiedBody, successCta: CONFIRM.continue};

export interface ConfirmScreen {
  /** Opens #4 with a new plan for this phrase. */
  show(words: readonly string[]): void;
  /** Whether the screen still references words of the phrase (plan-2 review H2): false after every way out. */
  holds(): boolean;
}

/**
 * #4 seed-confirm (spec §3.4): a pick fills the next empty slot. The right word → the slot is filled
 * and its button used and dimmed; the wrong one → "That's not the right word — let's start over." in
 * --danger, the slot shakes, "Word #N was wrong. Slots will reset in a moment.", and ~700 ms later
 * every slot and button resets. Three right words → [Confirm] → "Phrase verified" → [Continue] → #5.
 *
 * The phrase's words are in the DOM only while the pool is offered (the slots' values and the pool's
 * three right words): "Phrase verified" drops the plan and empties both; Back, Continue, and the tab
 * hidden (onLeave) take them out too — a hidden tab keeps the plan (the run holds the phrase anyway) and
 * puts it back when the tab is shown again (onReturn).
 *
 * Rule 6 (spec §7.6): every button — the nine words, Confirm/Continue, Back — runs through the page's one
 * `exclusive()` gate. `phase` is the `offered`-style guard (welcome.ts, seed.ts): a button acts only on
 * the step it belongs to, whatever its `hidden`/`disabled` say.
 */
export function mountConfirm(deps: PageDeps, next: {back(): void; done(): void; verified?(): void}, chrome: ConfirmChrome = ONBOARDING): ConfirmScreen {
  const cta = byId<HTMLButtonElement>('cnf-cta');
  const back = byId<HTMLButtonElement>('cnf-back');
  const slotsEl = byId('cnf-slots');
  const poolEl = byId('cnf-pool');
  const lede = byId('cnf-lede');
  const helper = byId('cnf-helper');
  let phase: 'off' | 'pick' | 'success' = 'off';
  let plan: ConfirmPlan = {slots: [], pool: []};
  /** Per slot, the pool index picked for it (an index, not a word: a pool may hold a word twice — I1). */
  let filled: (number | null)[] = [];
  let resetting: number | null = null;
  /** The tab is hidden: nothing of the phrase in the DOM until it is shown again. */
  let concealed = false;

  const wordAt = (i: number | null | undefined): string | null => (i === null || i === undefined ? null : (plan.pool.at(i) ?? null));
  const complete = () => plan.slots.length > 0 && plan.slots.every((s, i) => wordAt(filled.at(i)) === s.word);
  /** The slot holding a wrong pick, or -1. */
  const wrongSlot = () => filled.findIndex((x, i) => x !== null && wordAt(x) !== plan.slots.at(i)?.word);
  const slotCells = () =>
    plan.slots.map((s, i) => {
      const value = wordAt(filled.at(i));
      const wrong = value !== null && value !== s.word;
      const cell = h('div', 'slot');
      cell.classList.toggle('empty', value === null);
      cell.classList.toggle('filled', value !== null && !wrong);
      cell.classList.toggle('correct', value !== null && !wrong);
      cell.classList.toggle('wrong', wrong);
      const v = h('span', 'noc-mono value', value ?? CONFIRM.select);
      v.classList.toggle('placeholder', value === null);
      cell.append(h('span', 'noc-body-sm label', CONFIRM.slot(s.position)), v);
      return cell;
    });
  const poolButtons = (busy: boolean) => {
    const at = wrongSlot();
    const wrongIndex = at >= 0 ? (filled.at(at) ?? null) : null;
    return plan.pool.map((w, index) => {
      const used = filled.includes(index);
      const b = h('button', 'word-btn', w);
      b.type = 'button';
      b.classList.toggle('used', used);
      b.classList.toggle('dim', used);
      b.classList.toggle('vlt-wrong-word', index === wrongIndex);
      b.disabled = busy || used || resetting !== null;
      b.addEventListener('click', () => {
        if (phase === 'pick') void exclusive(deps, render, async () => pick(index));
      });
      return b;
    });
  };

  const render = () => {
    const busy = deps.gate.isBusy();
    const offered = phase === 'pick' && !concealed;
    slotsEl.replaceChildren(...(offered ? slotCells() : []));
    poolEl.replaceChildren(...(offered ? poolButtons(busy) : []));
    const wrongAt = wrongSlot();
    setText(lede, wrongAt >= 0 ? CONFIRM.wrongLede : CONFIRM.lede);
    lede.classList.toggle('vlt-danger', wrongAt >= 0);
    lede.classList.toggle('vlt-lede', wrongAt < 0);
    setText(helper, wrongAt >= 0 ? CONFIRM.wrongHelper(plan.slots.at(wrongAt)?.position ?? 0) : '');
    shown(helper, wrongAt >= 0);
    shown(byId('cnf-main'), phase !== 'success');
    shown(byId('cnf-success'), phase === 'success');
    cta.disabled = busy || !(phase === 'success' || (phase === 'pick' && resetting === null && complete()));
    back.disabled = busy || phase === 'off';
    setText(cta, phase === 'success' ? chrome.successCta : CONFIRM.confirm);
  };

  const stop = () => {
    if (resetting !== null) deps.timers.clearTimeout(resetting);
    resetting = null;
  };
  /** Drops the plan and takes every word out of the DOM. */
  const drop = () => {
    stop();
    plan = {slots: [], pool: []};
    filled = [];
    slotsEl.replaceChildren();
    poolEl.replaceChildren();
  };
  const pick = (index: number) => {
    if (resetting !== null || concealed || filled.includes(index)) return;
    const at = filled.findIndex(x => x === null);
    if (at < 0) return;
    filled.splice(at, 1, index);
    if (wordAt(index) !== plan.slots.at(at)?.word) {
      resetting = deps.timers.setTimeout(() => {
        resetting = null;
        filled = plan.slots.map(() => null);
        render();
      }, RESET_MS);
    }
    render();
  };

  back.addEventListener('click', () => {
    if (phase === 'off') return;
    void exclusive(deps, render, async () => {
      phase = 'off';
      drop();
      next.back();
    });
  });
  cta.addEventListener('click', () => {
    if (phase === 'success') {
      void exclusive(deps, render, async () => {
        phase = 'off';
        drop();
        next.done();
      });
    } else if (phase === 'pick') {
      void exclusive(deps, render, async () => {
        if (resetting !== null || !complete()) return;
        // Verified: the plan is no longer needed, and "Phrase verified" shows no word.
        phase = 'success';
        drop();
        render();
        // B1b-2b E15: the verify check records the fact (the success body says whether it could).
        next.verified?.();
      });
    }
  });
  deps.gate.onIdle(render);
  deps.onLeave(why => {
    concealed = true;
    // pagehide: the page may sit in the back/forward cache — #4 ends and drops its plan (the run restarts).
    if (why === 'pagehide') {
      phase = 'off';
      drop();
    }
    render();
  });
  deps.onReturn(() => {
    concealed = false;
    render();
  });

  return {
    show(words) {
      drop();
      setText(byId('cnf-eyebrow'), chrome.eyebrow);
      setText(byId('cnf-step'), chrome.step ?? '');
      shown(byId('cnf-step'), chrome.step !== null);
      setText(byId('cnf-success-title'), chrome.successTitle);
      setText(byId('cnf-success-body'), chrome.successBody);
      plan = confirmPlan(words, deps.randomBytes);
      filled = plan.slots.map(() => null);
      phase = 'pick';
      // `concealed` is the tab's state (onLeave / onReturn), not the screen's: a show() while the tab is hidden — the
      // verify proof settling in a background tab (B1b-2b §3.5) — puts no word in the DOM until the tab is shown again.
      render();
      showScreen('v-confirm');
    },
    holds: () => plan.slots.length > 0,
  };
}
