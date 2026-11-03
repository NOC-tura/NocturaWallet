// @vitest-environment happy-dom
import {createEnvelope} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {issueChallenge} from '../../background/reauthChallenges';
import {handleMessage} from '../../background/messages';
import {setSession} from '../../background/session';
import {PHRASE_KEY} from '../../background/phraseKey';
import {PHRASE_TEXT} from '../../app/ui/PhraseLine';
import {SECURITY_TEXT} from '../../app/screens/Security';
import {startMode} from '../modes';
import {mountReauth} from '../screens/reauth';
import {mountUnlock} from '../screens/unlock';
import {COMMON, REAUTH} from '../strings';
import {HOLD_MS, TICK_MS} from '../view/hold';
import type {Send} from '../types';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

// B1e §1.2, §1.3 (undrawn, §9): the anti-phishing phrase on the vault page — the line on #9 (read in its `reading`
// phase, before the field shows) and on #10 (the CURRENT phrase; a phrase challenge described without its value), R9's
// line when the read fails, and onboarding's skippable step (only once the wallet is stored and its keys handed over).
// Against the real background and unlock.html. Strings that do not print are \u escapes printed by a generator.
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PHRASE = 'wonder sauce regret hover leopard hundred luxury home wise frost naive body company wedding want sponsor buyer birth february friend frequent neglect draw pond';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const PW = 'correct horse battery';
const NEW_PW = 'a long enough password';
const BLUE = 'Blue horse 42';
const GREEN = 'Green fox 7';
const MARKUP = '<b>x</b>';
/** An RTL phrase (Hebrew, then digits): \u escapes. */
const RTL = '\u05e9\u05dc\u05d5\u05dd \u05e2\u05d5\u05dc\u05dd 42';
const HELD = HOLD_MS + TICK_MS;
const POPUP = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop', url: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/popup.html'};

beforeEach(() => loadPage());

const wallet = () => createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf: testKdf});
/** What a screen's line shows: the phrase (null when its line is hidden) and whether R9's line shows. */
const line = (screen: 'unl' | 'ra') => ({phrase: visible(el(`${screen}-phrase`)) ? text(el(`${screen}-phrase-text`)) : null, failed: visible(el(`${screen}-phrase-failed`))});
const stored = async (h: Harness) => ((await h.deps.send({type: 'vault.status'})).data as {phrase?: unknown}).phrase;
const answering = (type: string, answer: () => Promise<{ok: boolean; error?: string; data?: unknown}>) => (inner: Send): Send => async m => ((m as {type: string}).type === type ? answer() : inner(m));
async function press(h: Harness, id: string): Promise<void> {
  await h.until(() => !el<HTMLButtonElement>(id).disabled);
  click(el(id));
}

describe('#9: the phrase line, read before the password field shows (B1e §1.2)', () => {
  async function unlockShown(phrase: unknown, send?: (inner: Send) => Send) {
    const h = await harness({vault: await wallet(), send});
    if (phrase !== undefined) await h.ext.local.set(PHRASE_KEY, phrase);
    await mountUnlock(h.deps).show(null);
    return h;
  }

  it('none set: no line — the screen is as before; the field shows', async () => {
    await unlockShown(undefined);
    expect([line('unl'), visible(el('unl-password'))]).toEqual([{phrase: null, failed: false}, true]);
  });

  it('set: the phrase beside the shield, named for a screen reader, BEFORE the password field (in the page and on screen)', async () => {
    await unlockShown(BLUE);
    expect([line('unl'), visible(el('unl-password'))]).toEqual([{phrase: BLUE, failed: false}, true]);
    expect(text(el('unl-phrase'))).toBe(`${PHRASE_TEXT.label}: ${BLUE}`);
    expect(el('unl-phrase').querySelector('.vlt-sr')?.textContent).toBe(`${PHRASE_TEXT.label}: `);
    expect(el('unl-phrase').compareDocumentPosition(el('unl-password')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(unstyled('v-unlock')).toEqual([]);
  });

  // Task 5 fix round 1 (Minor 4): the phrase is its own bidi run — an RTL phrase keeps its order inside the LTR line.
  it('an RTL phrase: its own isolated run (dir="auto"), as text — on #9 and #10 alike', async () => {
    await unlockShown(RTL);
    expect([line('unl'), el('unl-phrase-text').getAttribute('dir'), el('ra-phrase-text').getAttribute('dir')]).toEqual([{phrase: RTL, failed: false}, 'auto', 'auto']);
  });

  it('a phrase that looks like markup renders as its own text — no element is made of it', async () => {
    await unlockShown(MARKUP);
    expect(line('unl').phrase).toBe(MARKUP);
    expect(el('unl-phrase-text').childElementCount).toBe(0);
    expect(el('v-unlock').querySelector('b')).toBeNull();
  });

  it('the read is the `reading` phase: while vault.status has not answered, no field shows and none is enabled', async () => {
    let release: () => void = () => undefined;
    let asked = false;
    const h = await harness({
      vault: await wallet(),
      send: inner => async m => {
        if ((m as {type: string}).type === 'vault.status' && !asked) {
          asked = true;
          await new Promise<void>(r => (release = r));
        }
        return inner(m);
      },
    });
    await h.ext.local.set(PHRASE_KEY, BLUE);
    const showing = mountUnlock(h.deps).show(null);
    await h.until(() => asked);
    await new Promise(r => setTimeout(r, 5));
    expect([visible(el('unl-password')), el<HTMLInputElement>('unl-password').disabled, visible(el('unl-submit'))]).toEqual([false, true, false]);
    release();
    await showing;
    expect([line('unl'), visible(el('unl-password')), el<HTMLInputElement>('unl-password').disabled]).toEqual([{phrase: BLUE, failed: false}, true, false]);
  });

  it.each([
    ['the send throws', async () => Promise.reject(new Error('no answer'))],
    ['a refusal', async () => ({ok: false, error: 'failed'})],
    ['an answer without the field', async () => ({ok: true, data: {unlocked: false, accounts: []}})],
    ['a field that is not a phrase', async () => ({ok: true, data: {unlocked: false, accounts: [], phrase: 7}})],
  ] as const)('a read that fails (%s): R9’s line, never silence — the field still shows', async (_why, answer) => {
    await unlockShown(BLUE, answering('vault.status', answer));
    expect([line('unl'), visible(el('unl-password'))]).toEqual([{phrase: null, failed: true}, true]);
    expect(text(el('unl-phrase-failed'))).toBe(PHRASE_TEXT.failed);
  });

  // Task 4 review M3: after the accepted apply-vs-delete race (§1.4) a phrase is stored with no wallet, and vault.status
  // carries it. The no-wallet state draws no line (§1.2): #9 reads the phrase only once the stored vault is a wallet.
  it('a phrase stored with no wallet (the accepted apply-vs-delete race): the no-wallet notice, no line, no read', async () => {
    const h = await harness();
    await h.ext.local.set(PHRASE_KEY, BLUE);
    // The race's state, from the real background: vault.status carries the phrase with no wallet stored.
    expect(await stored(h)).toBe(BLUE);
    h.sent.length = 0;
    await mountUnlock(h.deps).show(null);
    expect([text(el('unl-notice-line')), line('unl'), visible(el('unl-password')), h.sent.map(m => m.type).includes('vault.status')]).toEqual([COMMON.noWallet, {phrase: null, failed: false}, false, false]);
  });
});

describe('#10: the current phrase; a phrase challenge described without its value (B1e §1.2, §1.3)', () => {
  /** The wallet stored and unlocked, the stored phrase `phrase`, #10 shown on the challenge `issue` returns. */
  async function reauthShown(phrase: unknown, issue: (h: Harness) => Promise<string>, send?: (inner: Send) => Send) {
    const h = await harness({vault: await wallet(), send});
    await setSession(h.ext, await deriveSessionAccounts(M, 'slip10', [0]));
    if (phrase !== undefined) await h.ext.local.set(PHRASE_KEY, phrase);
    const id = await issue(h);
    await mountReauth(h.deps).show(id);
    return {h, id};
  }
  const settings = (h: Harness) => issueChallenge(h.ext, h.wallet, 'digest', {kind: 'settings', autoLockMinutes: 15, reauthUsdCents: null});
  /** settings.phrase from the popup, answered reauth-required: the challenge's id. */
  const phraseChallenge = (value: string | null) => async (h: Harness) => {
    const r = await handleMessage(h.ext, {type: 'settings.phrase', phrase: value}, POPUP, h.wallet);
    expect(r).toMatchObject({ok: false, error: 'reauth-required'});
    return (r.data as {challengeId: string}).challengeId;
  };
  const rows = () => [...el('ra-rows').querySelectorAll('.intent-row')].map(r => text(r));
  const confirmWith = (password: string) => {
    type(el<HTMLInputElement>('ra-password'), password);
    click(el('ra-confirm'));
  };

  it('on any challenge: the stored phrase on the line under the top bar, before the field; none set: no line', async () => {
    await reauthShown(BLUE, settings);
    expect([line('ra'), visible(el('ra-password'))]).toEqual([{phrase: BLUE, failed: false}, true]);
    expect(el('ra-phrase').compareDocumentPosition(el('ra-password')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(unstyled('v-reauth')).toEqual([]);
    loadPage();
    await reauthShown(undefined, settings);
    expect([line('ra'), visible(el('ra-password'))]).toEqual([{phrase: null, failed: false}, true]);
  });

  it('a phrase that looks like markup renders as its own text; a read that fails is R9’s line', async () => {
    await reauthShown(MARKUP, settings);
    expect([line('ra').phrase, el('ra-phrase-text').childElementCount, el('v-reauth').querySelector('b')]).toEqual([MARKUP, 0, null]);
    loadPage();
    await reauthShown(BLUE, settings, answering('vault.status', async () => ({ok: false, error: 'failed'})));
    expect(line('ra')).toEqual({phrase: null, failed: true});
    expect(text(el('ra-phrase-failed'))).toBe(PHRASE_TEXT.failed);
  });

  it('change: "You are about to change" + "Change the anti-phishing phrase"; the new value nowhere; the line keeps the current one; proven → applied', async () => {
    const {h} = await reauthShown(BLUE, phraseChallenge(GREEN));
    expect([text(el('ra-about')), rows(), visible(el('ra-amount-row')), text(el('ra-reasons'))]).toEqual([REAUTH.aboutChange, [REAUTH.phraseChange], false, '']);
    expect(line('ra')).toEqual({phrase: BLUE, failed: false});
    expect(document.body.textContent).not.toContain(GREEN);
    expect([text(el('ra-cancel')), el('ra-x').getAttribute('aria-label')]).toEqual([REAUTH.cancel, REAUTH.close]);
    confirmWith(PW);
    await h.until(() => visible(el('ra-notice')));
    expect(text(el('ra-notice-line'))).toBe(REAUTH.settingsApplied);
    expect(await stored(h)).toBe(GREEN);
  });

  it('remove: "Remove the anti-phishing phrase"; proven → applied — no phrase is stored', async () => {
    const {h} = await reauthShown(BLUE, phraseChallenge(null));
    expect(rows()).toEqual([REAUTH.phraseRemove]);
    confirmWith(PW);
    await h.until(() => visible(el('ra-notice')));
    expect(text(el('ra-notice-line'))).toBe(REAUTH.settingsApplied);
    expect(await stored(h)).toBeNull();
  });

  // Task 5 fix round 1 (Minor 2): applied, the line reads again — it shows what is now stored, never the old phrase.
  it.each([
    ['change', GREEN, {phrase: GREEN, failed: false}],
    ['remove', null, {phrase: null, failed: false}],
  ] as const)('%s applied: the line shows what is now stored beside "Confirmed" — never the old phrase', async (_op, value, after) => {
    const {h} = await reauthShown(BLUE, phraseChallenge(value));
    expect(line('ra')).toEqual({phrase: BLUE, failed: false});
    confirmWith(PW);
    await h.until(() => visible(el('ra-notice')));
    expect([text(el('ra-notice-line')), line('ra'), await stored(h)]).toEqual([REAUTH.settingsApplied, after, value]);
    expect(text(el('v-reauth'))).not.toContain(BLUE);
  });

  it('a phrase proof the background did not say it applied is never "Confirmed" (fail closed); Cancel only closes the tab', async () => {
    const {h} = await reauthShown(BLUE, phraseChallenge(GREEN), answering('vault.reauthOk', async () => ({ok: true})));
    confirmWith(PW);
    await h.until(() => visible(el('ra-notice')));
    expect(text(el('ra-notice-line'))).toBe(REAUTH.settingsFailed);
    loadPage();
    const again = await reauthShown(BLUE, phraseChallenge(null));
    click(el('ra-cancel'));
    await again.h.until(() => again.h.closed === 1);
    expect([again.h.sent.map(m => m.type).filter(t => t === 'wallet.discardPrepared'), await stored(again.h)]).toEqual([[], BLUE]);
  });

  // Task 4 review M3: the race's state on #10 — a phrase stored, no wallet: the no-wallet notice, no line, no read.
  it('a phrase stored with no wallet (the accepted apply-vs-delete race): the no-wallet notice, no line, no read', async () => {
    const h = await harness();
    await h.ext.local.set(PHRASE_KEY, BLUE);
    expect(await stored(h)).toBe(BLUE);
    h.sent.length = 0;
    await mountReauth(h.deps).show('0123456789abcdef0123456789abcdef');
    expect([text(el('ra-notice-line')), line('ra'), visible(el('ra-password')), h.sent.map(m => m.type).includes('vault.status')]).toEqual([COMMON.noWallet, {phrase: null, failed: false}, false, false]);
  });
});

describe('onboarding’s anti-phishing step, as the page mounts it (B1e §1.3)', () => {
  /** #1 → … → #5 with the password typed twice, through the page's own startMode (the wiring under test). */
  async function created(o: {send?: (inner: Send) => Send} = {}): Promise<Harness> {
    const h = await harness({mnemonic: PHRASE, send: o.send});
    startMode({mode: 'welcome'}, h.deps);
    await h.until(() => visible(el('wel-actions')));
    await press(h, 'wel-create');
    click(el('int-continue'));
    await press(h, 'sg-continue');
    el('seed-grid').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    h.timers.advance(HELD);
    const words = [...el('seed-grid').querySelectorAll('.term')].map(text);
    el('seed-grid').dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
    await press(h, 'seed-cta');
    for (const s of [...el('cnf-slots').querySelectorAll('.label')].map(text)) {
      const n = Number(/#(\d+)/.exec(s)?.[1]);
      const b = () => [...el('cnf-pool').querySelectorAll('button')].find(x => text(x) === words[n - 1]) as HTMLButtonElement;
      await h.until(() => !b().disabled);
      click(b());
    }
    await press(h, 'cnf-cta');
    await press(h, 'cnf-cta');
    type(el<HTMLInputElement>('pw-field'), NEW_PW);
    await press(h, 'pw-cta');
    await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), NEW_PW);
    click(el('pw-cta'));
    return h;
  }
  const types = (h: Harness) => h.sent.map(m => m.type);

  it('create: not before #6; after it, the step — Skip writes nothing and goes on to #7', async () => {
    const h = await created();
    await h.until(() => visible(el('v-passkey')));
    expect(visible(el('v-anti-phishing'))).toBe(false);
    await press(h, 'pk-skip');
    await h.until(() => visible(el('v-anti-phishing')) && !h.deps.gate.isBusy());
    expect([h.went, el<HTMLButtonElement>('ap-set').disabled, document.activeElement === el('ap-field')]).toEqual([[], true, true]);
    expect(unstyled('v-anti-phishing')).toEqual([]);
    await press(h, 'ap-skip');
    await h.until(() => h.went.length === 1);
    expect(h.went).toEqual(['wallet.html#/created']);
    expect(types(h)).not.toContain('settings.phrase');
    expect(await stored(h)).toBeNull();
  }, 30_000);

  it('create: [Set phrase] writes once — after the wallet is stored and its keys handed over — then #7; the phrase survives', async () => {
    const h = await created();
    await h.until(() => visible(el('v-passkey')));
    await press(h, 'pk-skip');
    await h.until(() => visible(el('v-anti-phishing')));
    type(el<HTMLInputElement>('ap-field'), `  ${BLUE} `);
    await press(h, 'ap-set');
    await h.until(() => h.went.length === 1);
    expect(h.went).toEqual(['wallet.html#/created']);
    const t = types(h);
    expect(t.filter(x => x === 'settings.phrase')).toHaveLength(1);
    expect(t.indexOf('settings.phrase')).toBeGreaterThan(t.lastIndexOf('vault.storeEnvelope'));
    expect(t.indexOf('settings.phrase')).toBeGreaterThan(t.lastIndexOf('vault.setKeys'));
    expect(h.sent.find(m => m.type === 'settings.phrase')).toEqual({type: 'settings.phrase', phrase: BLUE});
    expect(await stored(h)).toBe(BLUE);
  }, 30_000);

  it('[Set phrase] only for a phrase the rules accept — empty, short, long, a bidi override: disabled; markup is a phrase like any other', async () => {
    const h = await created();
    await h.until(() => visible(el('v-passkey')));
    await press(h, 'pk-skip');
    await h.until(() => visible(el('v-anti-phishing')) && !h.deps.gate.isBusy());
    for (const bad of ['', '   ', 'ab', 'x'.repeat(33), 'Blue \u202ehorse 42']) {
      type(el<HTMLInputElement>('ap-field'), bad);
      expect([bad, el<HTMLButtonElement>('ap-set').disabled]).toEqual([bad, true]);
      click(el('ap-set'));
    }
    el<HTMLFormElement>('ap-form').dispatchEvent(new Event('submit', {cancelable: true}));
    await new Promise(r => setTimeout(r, 5));
    expect(types(h)).not.toContain('settings.phrase');
    type(el<HTMLInputElement>('ap-field'), MARKUP);
    await press(h, 'ap-set');
    await h.until(() => h.went.length === 1);
    expect(await stored(h)).toBe(MARKUP);
  }, 30_000);

  it('a refused write says so and keeps the step — nothing moves on until Skip', async () => {
    const h = await created({send: answering('settings.phrase', async () => ({ok: false, error: 'locked'}))});
    await h.until(() => visible(el('v-passkey')));
    await press(h, 'pk-skip');
    await h.until(() => visible(el('v-anti-phishing')));
    type(el<HTMLInputElement>('ap-field'), BLUE);
    await press(h, 'ap-set');
    await h.until(() => visible(el('ap-line')) && !h.deps.gate.isBusy());
    expect([text(el('ap-line')), h.went, visible(el('v-anti-phishing'))]).toEqual([COMMON.failedTryAgain, [], true]);
    await press(h, 'ap-skip');
    await h.until(() => h.went.length === 1);
    expect(h.went).toEqual(['wallet.html#/created']);
  }, 30_000);

  it('created-locked (the keys did not reach the background): no step — straight to #7', async () => {
    const h = await created({send: answering('vault.setKeys', async () => ({ok: false, error: 'failed'}))});
    await h.until(() => h.went.length === 1);
    expect([h.went, visible(el('v-anti-phishing')), types(h).includes('settings.phrase')]).toEqual([['wallet.html#/created'], false, false]);
  }, 30_000);

  it('import: once the wallet is stored, the step; [Set phrase] → #40 with the phrase stored', async () => {
    const h = await harness({reader: {getMultipleLamports: async (keys: readonly unknown[]) => keys.map(() => 0n)}});
    startMode({mode: 'import', source: null}, h.deps);
    type(el<HTMLTextAreaElement>('imp-phrase'), M);
    click(el('imp-continue'));
    await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), NEW_PW);
    click(el('pw-cta'));
    await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), NEW_PW);
    click(el('pw-cta'));
    await h.until(() => visible(el('v-anti-phishing')) && !h.deps.gate.isBusy());
    expect(h.went).toEqual([]);
    type(el<HTMLInputElement>('ap-field'), BLUE);
    await press(h, 'ap-set');
    await h.until(() => h.went.length === 1);
    expect(h.went).toEqual(['wallet.html#/imported']);
    expect(await stored(h)).toBe(BLUE);
  }, 30_000);

  it('the copy: one text for the step and #35’s card; R9’s line on #9 and #10 is the popup’s', () => {
    expect([text(document.querySelector('#v-anti-phishing .vlt-lede')), text(el('ap-helper')), text(el('ap-help'))]).toEqual([SECURITY_TEXT.phraseCaption, SECURITY_TEXT.phraseHelper, SECURITY_TEXT.phraseHelp]);
    // E20: the step comes after #6's "5 / 5" with no count of its own; its overline says what it is.
    expect([...document.querySelectorAll('#v-anti-phishing .top-bar > *')].map(text)).toEqual(['Optional']);
    expect([text(el('unl-phrase-failed')), text(el('ra-phrase-failed'))]).toEqual([PHRASE_TEXT.failed, PHRASE_TEXT.failed]);
  });
});
