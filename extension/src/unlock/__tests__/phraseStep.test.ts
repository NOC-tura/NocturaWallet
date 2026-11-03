// @vitest-environment happy-dom
import {VAULT_KEY} from '../../background/accountsStore';
import {PHRASE_KEY} from '../../background/phraseKey';
import {getSession} from '../../background/session';
import {createCreateRun, type PhraseStep} from '../screens/createRun';
import {createImportRun} from '../screens/importRun';
import {mountPassword} from '../screens/password';
import {HOLD_MS, TICK_MS} from '../view/hold';
import {click, el, harness, loadPage, text, type, visible, type Harness} from './pageHarness';

// B1e §1.3 (I6): onboarding's anti-phishing step runs only once the new wallet is stored and its keys are in the
// session — after commitWallet, whose first write (storeEnvelope(null, …)) removes every WALLET_DATA_KEYS key, the
// phrase's among them. The step itself is Task 5's screen; here a stand-in sets the phrase the way it will.
const PHRASE = 'wonder sauce regret hover leopard hundred luxury home wise frost naive body company wedding want sponsor buyer birth february friend frequent neglect draw pond';
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PW = 'a long enough password';
const BLUE = 'Blue horse 42';
const HELD = HOLD_MS + TICK_MS;

beforeEach(() => loadPage());

async function press(h: Harness, id: string): Promise<void> {
  await h.until(() => !el<HTMLButtonElement>(id).disabled);
  click(el(id));
}

interface Seen {
  path: 'create' | 'import';
  /** At the step: the stored vault, the session's keys, where the run had gone. */
  stored: boolean;
  unlocked: boolean;
  went: number;
  answer: unknown;
}
/** A stand-in for Task 5's screen: sets the phrase as the step will (settings.phrase from the vault page), then continues. */
function stepThatSets(h: Harness, seen: Seen[]): PhraseStep {
  return ({path, then}) => {
    void (async () => {
      const stored = (await h.ext.local.get(VAULT_KEY)) !== undefined;
      const unlocked = (await getSession(h.ext)) !== null;
      const went = h.went.length;
      const answer = await h.deps.send({type: 'settings.phrase', phrase: BLUE});
      seen.push({path, stored, unlocked, went, answer});
      then();
    })();
  };
}
const phraseRead = async (h: Harness) => ((await h.deps.send({type: 'vault.status'})).data as {phrase?: unknown}).phrase;

/** #1 → #2 → #3 → #4 → #5 with the password typed twice (the second time not yet confirmed). */
async function toPassword(h: Harness): Promise<void> {
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
  type(el<HTMLInputElement>('pw-field'), PW);
  await press(h, 'pw-cta');
  await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
  type(el<HTMLInputElement>('pw-field'), PW);
}

describe('create: the phrase step after #6, before wallet.html#/created (B1e §1.3)', () => {
  it('runs once #6 ends, with the wallet stored and its keys in the session; the phrase it sets survives; then #7', async () => {
    const h = await harness({mnemonic: PHRASE});
    const seen: Seen[] = [];
    createCreateRun(h.deps, {password: mountPassword(h.deps), importRun: () => undefined, phraseStep: stepThatSets(h, seen)}).start('welcome');
    await h.until(() => visible(el('wel-actions')));
    await toPassword(h);
    click(el('pw-cta'));
    await h.until(() => visible(el('v-passkey')));
    // Not before #6: the step waits for it (#6 holds the typed password; the step must not hold it longer).
    expect(seen).toEqual([]);
    await press(h, 'pk-skip');
    await h.until(() => h.went.length === 1);
    expect(seen).toEqual([{path: 'create', stored: true, unlocked: true, went: 0, answer: {ok: true, data: {outcome: 'set'}}}]);
    expect(h.went).toEqual(['wallet.html#/created']);
    expect(await phraseRead(h)).toBe(BLUE);
  }, 30_000);

  it('negative control — why the order matters: a phrase in storage before the first write is gone after it', async () => {
    const h = await harness({mnemonic: PHRASE});
    createCreateRun(h.deps, {password: mountPassword(h.deps), importRun: () => undefined}).start('welcome');
    await h.until(() => visible(el('wel-actions')));
    await toPassword(h);
    await h.ext.local.set(PHRASE_KEY, BLUE);
    click(el('pw-cta'));
    await h.until(() => visible(el('v-passkey')));
    expect(await h.ext.local.get(PHRASE_KEY)).toBeUndefined();
    expect(await phraseRead(h)).toBeNull();
  }, 30_000);

  it('created-locked (the keys did not reach the background): no step — `set` would answer `locked`; straight to #7', async () => {
    const h = await harness({
      mnemonic: PHRASE,
      send: inner => async m => ((m as {type: string}).type === 'vault.setKeys' ? {ok: false, error: 'failed'} : inner(m)),
    });
    const seen: Seen[] = [];
    createCreateRun(h.deps, {password: mountPassword(h.deps), importRun: () => undefined, phraseStep: stepThatSets(h, seen)}).start('welcome');
    await h.until(() => visible(el('wel-actions')));
    await toPassword(h);
    click(el('pw-cta'));
    await h.until(() => h.went.length === 1);
    expect(h.went).toEqual(['wallet.html#/created']);
    expect(seen).toEqual([]);
    expect(h.sent.map(m => m.type)).not.toContain('settings.phrase');
  }, 30_000);
});

describe('import: the phrase step after the wallet is stored, before wallet.html#/imported (B1e §1.3)', () => {
  const none = {getMultipleLamports: async (keys: readonly unknown[]) => keys.map(() => 0n)};
  async function importRun(o: {send?: NonNullable<Parameters<typeof harness>[0]>['send']; step: boolean}) {
    const h = await harness({reader: none, send: o.send});
    const seen: Seen[] = [];
    createImportRun(h.deps, {password: mountPassword(h.deps), back: () => undefined, ...(o.step ? {phraseStep: stepThatSets(h, seen)} : {})}).show();
    type(el<HTMLTextAreaElement>('imp-phrase'), M);
    click(el('imp-continue'));
    await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), PW);
    click(el('pw-cta'));
    await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), PW);
    click(el('pw-cta'));
    await h.until(() => h.went.length > 0);
    return {h, seen};
  }

  it('runs with the wallet stored and its keys in the session; the phrase survives; then #40', async () => {
    const {h, seen} = await importRun({step: true});
    expect(seen).toEqual([{path: 'import', stored: true, unlocked: true, went: 0, answer: {ok: true, data: {outcome: 'set'}}}]);
    expect(h.went).toEqual(['wallet.html#/imported']);
    expect(await phraseRead(h)).toBe(BLUE);
  });

  it('created-locked: no step; straight to #40', async () => {
    const {h, seen} = await importRun({step: true, send: inner => async m => ((m as {type: string}).type === 'vault.setKeys' ? {ok: false, error: 'failed'} : inner(m))});
    expect(seen).toEqual([]);
    expect(h.went).toEqual(['wallet.html#/imported']);
  });

  it('without a step (the page passes none): unchanged — straight to #40', async () => {
    const {h} = await importRun({step: false});
    expect(h.went).toEqual(['wallet.html#/imported']);
    expect(await phraseRead(h)).toBeNull();
  });
});
