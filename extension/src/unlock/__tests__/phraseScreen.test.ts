// @vitest-environment happy-dom
import {addPasskeyWrap, createEnvelope, unlockWithPassword, type EnvelopeV1} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {setSession} from '../../background/session';
import {HOLD_MS, REVEAL_MS, TICK_MS} from '../view/hold';
import {showScreen} from '../view/dom';
import {mountPhrase} from '../screens/reveal';
import {confirmPlan, randomBelow} from '../screens/confirm';
import {CLOSE_CHECK_MS} from '../page';
import {pageMode} from '../mode';
import type {Send} from '../types';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

// B1b-2b §3.4 / §3.5 (D14, D15, D23, C9): the reveal and verify modes, against the REAL background and unlock.html.
const M = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const OTHER = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const WORDS = M.split(' ');
const PW = 'correct horse battery';
const HELD = HOLD_MS + TICK_MS;

beforeEach(loadPage);

/** Every place the page carries `word` (text, attribute, field value), hidden sections included. */
const carries = (word: string): number => {
  const re = new RegExp(`(?<![a-z])${word}(?![a-z])`);
  let n = 0;
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walk.nextNode(); t !== null; t = walk.nextNode()) if (re.test(t.nodeValue ?? '')) n += 1;
  for (const e of document.body.querySelectorAll('*')) for (const a of e.attributes) if (re.test(a.value)) n += 1;
  for (const f of document.body.querySelectorAll<HTMLInputElement>('input, textarea')) if (re.test(f.value)) n += 1;
  return n;
};
/** "sausage" and "useful" appear once in the phrase and in no static copy: their count is the leak detector. */
const leaked = () => carries('sausage') + carries('useful');

async function shown(kind: 'reveal' | 'verify', o: {session?: string | null; passkey?: boolean; send?: (inner: Send) => Send; holdSleep?: boolean} = {}) {
  const keys = await deriveSessionAccounts(M, 'slip10', [0]);
  let env: EnvelopeV1 = await createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: keys[0]?.publicKey ?? ''}], kdf: testKdf});
  if (o.passkey === true) env = await addPasskeyWrap(env, await unlockWithPassword(env, PW, testKdf), crypto.getRandomValues(new Uint8Array(32)), new Uint8Array([1]), crypto.getRandomValues(new Uint8Array(32)));
  const h = await harness({vault: env, ...(o.send === undefined ? {} : {send: o.send}), ...(o.holdSleep === true ? {holdSleep: true} : {})});
  const session = o.session === undefined ? M : o.session;
  if (session !== null) await setSession(h.ext, await deriveSessionAccounts(session, 'slip10', [0]));
  const run = mountPhrase(h.deps, kind);
  run.show();
  return {h, run};
}
const idle = (h: Harness) => h.until(() => !h.deps.gate.isBusy());
async function press(h: Harness, id: string): Promise<void> {
  await h.until(() => !el<HTMLButtonElement>(id).disabled);
  click(el(id));
}
async function prove(h: Harness, password = PW): Promise<void> {
  type(el<HTMLInputElement>('pp-password'), password);
  click(el('pp-continue'));
}
/** The check: the three right words from the pool, then Confirm. */
async function check(h: Harness): Promise<void> {
  for (const s of [...el('cnf-slots').querySelectorAll('.label')].map(text)) {
    const n = Number(/#(\d+)/.exec(s)?.[1]);
    const b = () => [...el('cnf-pool').querySelectorAll('button')].find(x => text(x) === WORDS[n - 1] && !x.classList.contains('used')) as HTMLButtonElement;
    await h.until(() => !b().disabled);
    click(b());
  }
  await press(h, 'cnf-cta');
  await h.until(() => visible(el('cnf-success')));
}
const cancelable = (target: Element, type: string) => {
  const e = new Event(type, {bubbles: true, cancelable: true});
  target.dispatchEvent(e);
  return e.defaultPrevented;
};

describe('the reveal and verify proofs (D23: password only)', () => {
  it('?mode=verify and ?mode=reveal are modes; reveal’s proof: O27, O28, the "Recovery phrase" bar, Continue — no passkey button with a passkey stored', async () => {
    expect(pageMode('?mode=verify')).toEqual({mode: 'verify'});
    expect(pageMode('?mode=reveal')).toEqual({mode: 'reveal'});
    await shown('reveal', {passkey: true});
    expect(text(el('pp-title'))).toBe('Show your recovery phrase');
    expect(text(el('pp-lede'))).toBe('Enter your password first. Nothing is shown until you press and hold.');
    expect(text(el('v-phrase-proof').querySelector('.top-bar .title'))).toBe('Recovery phrase');
    expect(text(el('pp-continue'))).toBe('Continue');
    expect(text(el('v-phrase-proof'))).not.toMatch(/passkey/i);
    expect(document.querySelector('#v-phrase-proof [id*="passkey"]')).toBeNull();
    expect(unstyled('v-phrase-proof')).toEqual([]);
  });

  it('verify’s proof: O30, O31; no passkey button either', async () => {
    await shown('verify', {passkey: true});
    expect(text(el('pp-title'))).toBe('Verify your recovery phrase');
    expect(text(el('pp-lede'))).toBe('Enter your password, then pick three words from your written copy.');
    expect(text(el('v-phrase-proof'))).not.toMatch(/passkey/i);
  });

  it('wrong: the helper; not unlocked: the notice + [Unlock]; a mismatch locks', async () => {
    const wrong = await shown('reveal');
    await prove(wrong.h, 'nope nope nope nope');
    await wrong.h.until(() => text(el('pp-helper')) === 'That did not confirm it.');
    loadPage();
    const locked = await shown('reveal', {session: null});
    await prove(locked.h);
    await locked.h.until(() => text(el('pp-notice-line')) === 'The wallet is locked. Unlock it first, then try again.');
    expect(visible(el('pp-unlock'))).toBe(true);
    loadPage();
    const mismatch = await shown('verify', {session: OTHER});
    await prove(mismatch.h);
    await mismatch.h.until(() => text(el('pp-notice-line')) === 'That did not match this wallet, so the wallet has been locked.');
    expect(leaked()).toBe(0);
  });
});

describe('reveal: #3’s mechanics on the proven phrase, then #4’s check (C9)', () => {
  it('proof → the pre-reveal modal (count adapted) → #3 framed "Recovery phrase", no step, 2 × 6 → hold → the words → check → verified and recorded', async () => {
    const {h, run} = await shown('reveal');
    expect(leaked()).toBe(0);
    await prove(h);
    await h.until(() => visible(el('v-seed-gate')));
    expect(text(el('sg-body'))).toBe('Move to a private place. Anyone who sees these 12 words can spend everything in this wallet, forever.');
    expect(leaked()).toBe(0);
    await press(h, 'sg-continue');
    expect(text(el('seed-eyebrow'))).toBe('Recovery phrase');
    expect(visible(el('seed-step'))).toBe(false);
    expect(text(el('seed-lede'))).toBe('12 words. Write them down on paper, in order. This is the only backup.');
    expect(el('seed-grid').classList.contains('vlt-grid-12')).toBe(true);
    // Blurred: the stand-in, never a word.
    expect(leaked()).toBe(0);
    el('seed-grid').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    h.timers.advance(HELD);
    expect([...el('seed-grid').querySelectorAll('.term')].map(text)).toEqual(WORDS);
    el('seed-grid').dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
    expect(leaked()).toBe(0);
    await press(h, 'seed-cta');
    await h.until(() => visible(el('v-confirm')));
    expect(text(el('cnf-eyebrow'))).toBe('Recovery phrase');
    expect(visible(el('cnf-step'))).toBe(false);
    await check(h);
    expect(text(el('cnf-success-title'))).toBe('Recovery phrase verified');
    expect(text(el('cnf-success-body'))).toBe('All three words matched. You can close this tab.');
    expect(text(el('cnf-cta'))).toBe('Close this tab');
    await h.until(() => h.sent.some(m => m.type === 'vault.phraseVerified'));
    await vi.waitFor(async () => expect(await h.ext.local.get('v1_settings')).toMatchObject({phraseVerifiedAt: h.wallet.now()}));
    expect(run.holds().phrase).toBe(false);
    expect(leaked()).toBe(0);
    // No message carries a word of the phrase.
    for (const m of h.sent) expect(JSON.stringify(m)).not.toMatch(/sausage|useful/);
    await press(h, 'cnf-cta');
    await h.until(() => h.closed === 1);
  });

  it('D14: on the grid copy, cut, drag, select and the context menu are cancelled — only while the grid is up, never on the password field', async () => {
    const {h} = await shown('reveal');
    // Before the proof: nothing is cancelled, the proof field takes a selection.
    expect(cancelable(el('seed-grid'), 'copy')).toBe(false);
    expect(cancelable(el('pp-password'), 'selectstart')).toBe(false);
    await prove(h);
    await h.until(() => visible(el('v-seed-gate')));
    await press(h, 'sg-continue');
    for (const ev of ['copy', 'cut', 'dragstart', 'selectstart', 'contextmenu']) expect(cancelable(el('seed-grid'), ev)).toBe(true);
    expect(cancelable(el('pp-password'), 'selectstart')).toBe(false);
    // Revealed too.
    el('seed-grid').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    h.timers.advance(HELD);
    expect(cancelable(el('seed-grid'), 'copy')).toBe(true);
    el('seed-grid').dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
  });

  it('the modal’s Cancel: the phrase dropped, the tab asked to close, O29 if it stays', async () => {
    const {h, run} = await shown('reveal');
    await prove(h);
    await h.until(() => visible(el('v-seed-gate')));
    await press(h, 'sg-cancel');
    await h.until(() => h.closed === 1);
    expect(text(el('pp-notice-line'))).toBe('Nothing is shown. You can close this tab.');
    expect(run.holds().phrase).toBe(false);
  });

  it('the backdrop is the Cancel too (review L6)', async () => {
    const {h} = await shown('reveal');
    await prove(h);
    await h.until(() => visible(el('v-seed-gate')));
    await idle(h);
    click(el('sg-backdrop'));
    await h.until(() => h.closed === 1);
  });

  it('pagehide drops the phrase; a restore from the back/forward cache starts again at the proof', async () => {
    const {h, run} = await shown('reveal');
    await prove(h);
    await h.until(() => visible(el('v-seed-gate')));
    await press(h, 'sg-continue');
    h.leave('pagehide');
    expect(run.holds().phrase).toBe(false);
    expect(leaked()).toBe(0);
    h.back('restored');
    expect(visible(el('v-phrase-proof'))).toBe(true);
  });

  it('a hidden tab re-blurs (#3’s rule) and keeps the phrase in the run for the check', async () => {
    const {h, run} = await shown('reveal');
    await prove(h);
    await h.until(() => visible(el('v-seed-gate')));
    await press(h, 'sg-continue');
    el('seed-grid').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    h.timers.advance(HELD);
    h.leave('hidden');
    expect(leaked()).toBe(0);
    expect(run.holds().phrase).toBe(true);
  });
});

describe('verify: the check, never the grid', () => {
  it('proof → #4 directly (#3 never shown) → verified; the phrase never rendered beyond the pool', async () => {
    const {h} = await shown('verify');
    await prove(h);
    await h.until(() => visible(el('v-confirm')));
    expect(visible(el('v-seed'))).toBe(false);
    expect(el('seed-grid').querySelectorAll('.term')).toHaveLength(0);
    await check(h);
    expect(text(el('cnf-success-title'))).toBe('Recovery phrase verified');
    // 04r: the green ring with the check (D25 keeps it for the recorded success only).
    expect(el('cnf-success').classList.contains('vlt-neutral')).toBe(false);
    expect(el('cnf-success-icon').getAttribute('href')).toBe('#i-check');
  });

  it('success-not-recorded: the background refused the fact — O32', async () => {
    const {h} = await shown('verify', {send: inner => async m => ((m as {type: string}).type === 'vault.phraseVerified' ? {ok: false, error: 'locked'} : inner(m))});
    await prove(h);
    await h.until(() => visible(el('v-confirm')));
    await check(h);
    await h.until(() => text(el('cnf-success-body')) === 'All three words matched, but this could not be saved. Try again later.');
    // D25 (owner, 2026-10-08): a neutral hero — the secondary tint and the info icon, never the green success ring. The
    // copy is unchanged.
    expect(text(el('cnf-success-title'))).toBe('Recovery phrase verified');
    expect(el('cnf-success').classList.contains('vlt-neutral')).toBe(true);
    expect(el('cnf-success-icon').getAttribute('href')).toBe('#i-info');
    expect(unstyled('v-confirm')).toEqual([]);
  });

  // The final review's m7 (a controller ruling): the fact is bound to the wallet whose phrase was checked. This tab sat
  // in #4 while another tab deleted the wallet, created another and unlocked it: the real background refuses, O32 shows.
  it('m7: the wallet replaced while the check was open — the background refuses (busy), O32, nothing recorded', async () => {
    const {h} = await shown('verify');
    await prove(h);
    await h.until(() => visible(el('v-confirm')));
    const keys = await deriveSessionAccounts(OTHER, 'slip10', [0]);
    const other = await createEnvelope({mnemonic: OTHER, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: keys[0]?.publicKey ?? ''}], kdf: testKdf});
    await h.ext.local.set('v1_vault', other);
    await setSession(h.ext, keys);
    await check(h);
    await h.until(() => text(el('cnf-success-body')) === 'All three words matched, but this could not be saved. Try again later.');
    const sent = h.sent.find(m => m.type === 'vault.phraseVerified') as {expectedRevision?: unknown} | undefined;
    expect(sent?.expectedRevision).toMatch(/^[0-9a-f]{64}$/);
    expect(((await h.ext.local.get('v1_settings')) as {phraseVerifiedAt?: unknown} | undefined)?.phraseVerifiedAt ?? null).toBeNull();
  });

  it('Back from the check closes the tab (nothing to go back to) and drops the phrase', async () => {
    const {h, run} = await shown('verify');
    await prove(h);
    await h.until(() => visible(el('v-confirm')));
    await press(h, 'cnf-back');
    await h.until(() => h.closed === 1);
    expect(run.holds().phrase).toBe(false);
  });

  it('rule 6: a second Continue inside the floor (`disabled` lifted) runs no second proof', async () => {
    const {h} = await shown('verify', {holdSleep: true});
    await prove(h);
    el<HTMLButtonElement>('pp-continue').disabled = false;
    el<HTMLInputElement>('pp-password').disabled = false;
    await prove(h);
    await h.until(() => h.sent.some(m => m.type === 'vault.status'));
    await new Promise(r => setTimeout(r, 20));
    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(1);
    h.wake();
  });
});

// Task 11 additions (the Task 8–10 reviews' lessons, applied to the most secret-sensitive screen).
describe('leaving, the cooldown, and the words only where they are shown', () => {
  it('X during the cooldown closes the tab; the wrong outcome that ends the wait shows nothing', async () => {
    const {h} = await shown('reveal', {holdSleep: true});
    await prove(h, 'nope nope nope nope');
    await h.until(() => text(el('pp-helper')) === 'That did not confirm it.');
    h.wake();
    await h.until(() => !h.deps.gate.isBusy() || (h.wake(), false));
    await prove(h, 'nope nope nope nope');
    await h.until(() => visible(el('pp-cooldown')));
    expect(h.deps.gate.isBusy()).toBe(true);
    expect(el<HTMLButtonElement>('pp-x').disabled).toBe(false);
    click(el('pp-x'));
    expect(h.closed).toBe(1);
    await h.until(() => !h.deps.gate.isBusy() || (h.wake(), false));
    expect(text(el('pp-helper'))).toBe('');
    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(2);
  });

  it('pagehide while the proof runs: nothing more is asked of the background, nothing is shown; a restore shows the proof', async () => {
    const {h, run} = await shown('reveal');
    await prove(h);
    h.leave('pagehide');
    await idle(h);
    expect(h.sent.filter(m => m.type === 'vault.status')).toEqual([]);
    expect(visible(el('v-seed-gate'))).toBe(false);
    expect(visible(el('pp-notice'))).toBe(false);
    expect(run.holds()).toEqual({phrase: false, password: false});
    expect(leaked()).toBe(0);
    h.back('restored');
    expect(visible(el('v-phrase-proof'))).toBe(true);
    expect(visible(el('pp-entry'))).toBe(true);
  });

  it('pagehide after the session was read: a mismatch found by the running proof still locks (vault.lock passes)', async () => {
    let leave = () => {};
    const {h} = await shown('verify', {
      session: OTHER,
      send: inner => async m => {
        const r = await inner(m);
        if ((m as {type: string}).type === 'vault.status') leave();
        return r;
      },
    });
    leave = () => h.leave('pagehide');
    await prove(h);
    await h.until(() => h.sent.some(m => m.type === 'vault.lock'));
    await idle(h);
    expect((await h.deps.send({type: 'vault.status'})) as {data?: {unlocked?: boolean}}).toMatchObject({data: {unlocked: false}});
    // Left: the notice is not drawn into the page that may sit in the back/forward cache.
    expect(visible(el('pp-notice'))).toBe(false);
  });

  it('verify: a proof that settles while the tab is hidden puts no word in the DOM until the tab is shown', async () => {
    const {h} = await shown('verify');
    await prove(h);
    h.leave('hidden');
    await idle(h);
    expect(visible(el('v-confirm'))).toBe(true);
    expect(el('cnf-pool').children).toHaveLength(0);
    expect(el('cnf-slots').children).toHaveLength(0);
    h.back('visible');
    expect(el('cnf-pool').children).toHaveLength(9);
  });

  it('reveal: the words leave the DOM in the same turn when another screen is shown, and when #v-seed is hidden by anything else', async () => {
    const {h, run} = await shown('reveal');
    await prove(h);
    await h.until(() => visible(el('v-seed-gate')));
    await press(h, 'sg-continue');
    el('seed-grid').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    h.timers.advance(HELD);
    expect(leaked()).toBe(2);
    showScreen('v-phrase-proof');
    expect(leaked()).toBe(0);
    expect(run.holds().phrase).toBe(true);
    // Tampering: the section hidden directly (no showScreen) — the observer re-blurs a microtask later.
    showScreen('v-seed');
    el('seed-grid').dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
    el('seed-grid').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    h.timers.advance(HELD);
    expect(leaked()).toBe(2);
    el('v-seed').hidden = true;
    await new Promise(r => setTimeout(r, 0));
    expect(leaked()).toBe(0);
  });

  it('the 20 s auto-blur takes the words out of the DOM even while held', async () => {
    const {h} = await shown('reveal');
    await prove(h);
    await h.until(() => visible(el('v-seed-gate')));
    await press(h, 'sg-continue');
    el('seed-grid').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    h.timers.advance(HELD);
    expect(leaked()).toBe(2);
    h.timers.advance(REVEAL_MS);
    expect(text(el('seed-overlay-title'))).toBe('Still looking?');
    expect(leaked()).toBe(0);
  });

  it('O32 is not written into a page left while the fact was being sent', async () => {
    const pending: {answer?: (r: {ok: boolean; error?: string}) => void} = {};
    const {h} = await shown('verify', {
      send: inner => async m => ((m as {type: string}).type === 'vault.phraseVerified' ? new Promise(r => (pending.answer = r)) : inner(m)),
    });
    await prove(h);
    await h.until(() => visible(el('v-confirm')));
    await check(h);
    await h.until(() => pending.answer !== undefined);
    h.leave('pagehide');
    pending.answer?.({ok: false, error: 'locked'});
    await new Promise(r => setTimeout(r, 0));
    expect(text(el('cnf-success-body'))).toBe('All three words matched. You can close this tab.');
  });
});

// Fix round 1 (Task 11 review I1, I2, M1, M2).
describe('fix round 1: the end of the check, 3 of 3, the plan’s range, the guards removed', () => {
  it.each(['reveal', 'verify'] as const)('%s: Back on the success closes the tab — never #3 again, never a hang', async kind => {
    const {h, run} = await shown(kind);
    await prove(h);
    if (kind === 'reveal') {
      await h.until(() => visible(el('v-seed-gate')));
      await press(h, 'sg-continue');
      el('seed-grid').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
      h.timers.advance(HELD);
      el('seed-grid').dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
      await press(h, 'seed-cta');
    }
    await h.until(() => visible(el('v-confirm')));
    await check(h);
    await press(h, 'cnf-back');
    await h.until(() => h.closed === 1);
    await idle(h);
    expect(visible(el('v-seed-gate'))).toBe(false);
    expect(visible(el('cnf-success'))).toBe(true);
    expect(text(el('pp-notice-line'))).toBe('');
    expect(run.holds().phrase).toBe(false);
  });

  it('[Close this tab] refused: the button is hidden, the success stays on screen', async () => {
    const {h} = await shown('verify');
    await prove(h);
    await h.until(() => visible(el('v-confirm')));
    await check(h);
    await press(h, 'cnf-cta');
    await h.until(() => h.closed === 1);
    // The gate's release re-renders: the success must survive it.
    await idle(h);
    h.timers.advance(CLOSE_CHECK_MS);
    expect(visible(el('cnf-cta'))).toBe(false);
    expect(visible(el('cnf-success'))).toBe(true);
    expect(text(el('cnf-success-title'))).toBe('Recovery phrase verified');
    expect(text(el('cnf-success-body'))).toBe('All three words matched. You can close this tab.');
  });

  it('I2 (probe P4): two right words and Confirm with `disabled` lifted — not verified, nothing sent', async () => {
    const {h} = await shown('verify');
    await prove(h);
    await h.until(() => visible(el('v-confirm')));
    for (const s of [...el('cnf-slots').querySelectorAll('.label')].slice(0, 2).map(text)) {
      const n = Number(/#(\d+)/.exec(s)?.[1]);
      const b = () => [...el('cnf-pool').querySelectorAll('button')].find(x => text(x) === WORDS[n - 1] && !x.classList.contains('used')) as HTMLButtonElement;
      await h.until(() => !b().disabled);
      click(b());
    }
    await idle(h);
    expect(el<HTMLButtonElement>('cnf-cta').disabled).toBe(true);
    el<HTMLButtonElement>('cnf-cta').disabled = false;
    click(el('cnf-cta'));
    await idle(h);
    await new Promise(r => setTimeout(r, 20));
    expect(visible(el('cnf-success'))).toBe(false);
    expect(h.sent.filter(m => m.type === 'vault.phraseVerified')).toEqual([]);
  });

  it('confirmPlan refuses fewer than three words and randomBelow an empty range — throws, never loops', () => {
    const rb = (n: number) => crypto.getRandomValues(new Uint8Array(n));
    expect(() => confirmPlan([], rb)).toThrow(RangeError);
    expect(() => confirmPlan(['legal', 'winner'], rb)).toThrow(RangeError);
    expect(() => randomBelow(rb, 0)).toThrow(RangeError);
    expect(() => randomBelow(rb, -1)).toThrow(RangeError);
    expect(() => randomBelow(rb, 1.5)).toThrow(RangeError);
    expect(confirmPlan(WORDS, rb).slots).toHaveLength(3);
  });

  it('a plan that cannot be made is shown as a failure, the phrase dropped (the caller’s guard)', async () => {
    const {h, run} = await shown('verify');
    h.deps.randomBytes = () => {
      throw new Error('no randomness');
    };
    await prove(h);
    await h.until(() => text(el('pp-notice-line')) === 'Something went wrong. Try again.');
    expect(visible(el('v-phrase-proof'))).toBe(true);
    expect(run.holds().phrase).toBe(false);
  });

  it('M2: the grid guards are removed with the words — selectstart on the grid is allowed again after #3', async () => {
    const {h} = await shown('reveal');
    await prove(h);
    await h.until(() => visible(el('v-seed-gate')));
    await press(h, 'sg-continue');
    expect(cancelable(el('seed-grid'), 'selectstart')).toBe(true);
    el('seed-grid').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    h.timers.advance(HELD);
    el('seed-grid').dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
    await press(h, 'seed-cta');
    await h.until(() => visible(el('v-confirm')));
    for (const ev of ['copy', 'cut', 'dragstart', 'selectstart', 'contextmenu']) expect(cancelable(el('seed-grid'), ev)).toBe(false);
  });
});
