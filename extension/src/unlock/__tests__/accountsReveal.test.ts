// @vitest-environment happy-dom
import {createEnvelope, type EnvelopeV1} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {VAULT_KEY} from '../../background/accountsStore';
import {setSession} from '../../background/session';
import {mountAccounts} from '../screens/accounts';
import {mountReveal, type RevealScreen} from '../screens/reveal';
import {startMode} from '../modes';
import {SCREENS, showScreen} from '../view/dom';
import type {PageMode} from '../mode';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const PW = 'correct horse battery';

/**
 * Everything the page carries as strings (Task 7's leak detector, as unlockScreen.test.ts has it): every
 * text node, every attribute value and every field's typed `value`, hidden sections included — a phrase
 * only CSS-hidden is still in the DOM. Returns where `secret` was found.
 */
const carries = (secret: RegExp): string[] => {
  const out: string[] = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) if (secret.test(n.nodeValue ?? '')) out.push('text');
  for (const e of document.body.querySelectorAll('*')) for (const a of e.attributes) if (secret.test(a.value)) out.push(`@${a.name}`);
  for (const f of document.body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')) if (secret.test(f.value)) out.push(`#${f.id}.value`);
  return out;
};
/** A word of the phrase ("abandon" is in no static copy of the page: the baseline below proves it). */
const PHRASE = /(?<![a-z])abandon(?![a-z])/;
const PASSWORD = /correct horse battery/;

beforeEach(loadPage);

async function unlockedWallet() {
  const env = await createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: K0}], kdf: testKdf});
  const h = await harness({vault: env});
  await setSession(h.ext, await deriveSessionAccounts(M, 'slip10', [0]));
  return h;
}

describe('the add-account form, restyled (spec §1.2 accounts)', () => {
  it('the design’s chrome around the B1b-1 form; the password adds account 2 and hands over its key', async () => {
    const h = await unlockedWallet();
    mountAccounts(h.deps).show();
    expect(text(el('v-accounts').querySelector('h1'))).toBe('Accounts');
    expect(text(el('acc-add'))).toBe('Add an account');
    expect(text(el('acc-remove'))).toBe('Remove the account');
    expect(unstyled('v-accounts')).toEqual([]);
    type(el<HTMLInputElement>('acc-password'), PW);
    click(el('acc-add'));
    // The password leaves the field at the click.
    expect(el<HTMLInputElement>('acc-password').value).toBe('');
    // Rule 6, proven by the gate and not by `disabled`: lift it, type again, click again inside the first run.
    el<HTMLButtonElement>('acc-add').disabled = false;
    el<HTMLInputElement>('acc-password').disabled = false;
    type(el<HTMLInputElement>('acc-password'), PW);
    click(el('acc-add'));
    await h.until(() => text(el('acc-helper')) === 'Done. The accounts are updated.');
    expect(((await h.ext.local.get(VAULT_KEY)) as EnvelopeV1).accounts.map(a => a.index)).toEqual([0, 1]);
    // The second click inside the first's run did nothing: exactly one addAccount — one proof (its one
    // vault.status, sent before any Argon2id, so a second run's would already be here) and one store.
    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(1);
    expect(h.sent.filter(m => m.type === 'vault.storeEnvelope')).toHaveLength(1);
  }, 30_000);

  it('remove asks for an account number first', async () => {
    const h = await unlockedWallet();
    mountAccounts(h.deps).show();
    click(el('acc-remove'));
    await h.until(() => text(el('acc-helper')) !== '');
    expect(text(el('acc-helper'))).toBe('Enter the number of the account to remove (1, 2, …).');
  });

  it('remove stays the B1b-1 flow: account 2 removed with the password', async () => {
    const h = await unlockedWallet();
    mountAccounts(h.deps).show();
    type(el<HTMLInputElement>('acc-password'), PW);
    click(el('acc-add'));
    await h.until(() => text(el('acc-helper')) === 'Done. The accounts are updated.');
    type(el<HTMLInputElement>('acc-remove-index'), '2');
    type(el<HTMLInputElement>('acc-password'), PW);
    click(el('acc-remove'));
    expect(text(el('acc-helper'))).toBe('Removing the account…');
    await h.until(() => text(el('acc-helper')) === 'Done. The accounts are updated.');
    expect(((await h.ext.local.get(VAULT_KEY)) as EnvelopeV1).accounts.map(a => a.index)).toEqual([0]);
  }, 30_000);

  it('a hidden tab empties the password field (§3.5)', async () => {
    const h = await unlockedWallet();
    mountAccounts(h.deps).show();
    type(el<HTMLInputElement>('acc-password'), PW);
    h.leave();
    expect(carries(PASSWORD)).toEqual([]);
  });
});

describe('the reveal form, restyled with the tokens (spec §1.2 reveal)', () => {
  /** The phrase shown after the proof: 12 words, as text. */
  async function shownPhrase(h: Harness, screen: RevealScreen): Promise<void> {
    type(el<HTMLInputElement>('rev-password'), PW);
    click(el('rev-show'));
    // The password leaves the field at the click; the page carries it nowhere.
    expect(el<HTMLInputElement>('rev-password').value).toBe('');
    expect(carries(PASSWORD)).toEqual([]);
    await h.until(() => el('rev-words').children.length === 12);
    expect(text(el('rev-helper'))).toBe('Write them down, in order, and keep them offline. Noctura never copies them anywhere.');
    expect([...el('rev-words').children].map(text)).toEqual(M.split(' '));
    expect(screen.holds()).toEqual({phrase: true, password: false});
  }
  /** Nothing of the phrase (or the password) left: not in the DOM in any form, not in the module. */
  function gone(screen: RevealScreen): void {
    expect(el('rev-words').children).toHaveLength(0);
    expect(carries(PHRASE)).toEqual([]);
    expect(carries(PASSWORD)).toEqual([]);
    expect(text(el('rev-helper'))).toBe('');
    expect(screen.holds()).toEqual({phrase: false, password: false});
  }

  it('the page carries no phrase word before the proof (the detector’s baseline)', async () => {
    await unlockedWallet();
    expect(carries(PHRASE)).toEqual([]);
  });

  it('the copy and the tokens; the phrase shown after the proof, as text', async () => {
    const h = await unlockedWallet();
    const screen = mountReveal(h.deps);
    screen.show();
    expect(text(el('v-reveal').querySelector('h1'))).toBe('Your recovery phrase');
    expect(text(el('rev-show'))).toBe('Show the phrase');
    expect(text(el('rev-hide'))).toBe('Hide');
    expect(unstyled('v-reveal')).toEqual([]);
    expect(screen.holds()).toEqual({phrase: false, password: false});
    await shownPhrase(h, screen);
    expect(carries(PHRASE)).toEqual(Array.from({length: 11}, () => 'text'));
    expect(unstyled('v-reveal')).toEqual([]);
  }, 30_000);

  it('[Hide] takes the phrase out of the DOM and the module', async () => {
    const h = await unlockedWallet();
    const screen = mountReveal(h.deps);
    screen.show();
    await shownPhrase(h, screen);
    type(el<HTMLInputElement>('rev-password'), PW);
    click(el('rev-hide'));
    gone(screen);
  }, 30_000);

  it('a hidden tab (visibilitychange) takes it out', async () => {
    const h = await unlockedWallet();
    const screen = mountReveal(h.deps);
    screen.show();
    await shownPhrase(h, screen);
    type(el<HTMLInputElement>('rev-password'), PW);
    h.leave('hidden');
    gone(screen);
  }, 30_000);

  it('pagehide takes it out', async () => {
    const h = await unlockedWallet();
    const screen = mountReveal(h.deps);
    screen.show();
    await shownPhrase(h, screen);
    type(el<HTMLInputElement>('rev-password'), PW);
    h.leave('pagehide');
    gone(screen);
  }, 30_000);

  it('leaving the screen (any other screen shown) takes it out', async () => {
    const h = await unlockedWallet();
    const screen = mountReveal(h.deps);
    screen.show();
    await shownPhrase(h, screen);
    type(el<HTMLInputElement>('rev-password'), PW);
    showScreen('v-unlock');
    await h.until(() => el('rev-words').children.length === 0);
    gone(screen);
  }, 30_000);

  it('a tab hidden while the proof runs: the phrase that arrives after is never put in the DOM', async () => {
    const h = await unlockedWallet();
    const screen = mountReveal(h.deps);
    screen.show();
    type(el<HTMLInputElement>('rev-password'), PW);
    click(el('rev-show'));
    expect(text(el('rev-helper'))).toBe('Checking…');
    h.leave('hidden');
    // The proof settles (the gate frees up) with the tab hidden: nothing rendered, nothing held.
    await h.until(() => !h.deps.gate.isBusy());
    gone(screen);
    // A new proof shows it again.
    await shownPhrase(h, screen);
  }, 30_000);

  it('a wrong password shows nothing', async () => {
    const h = await unlockedWallet();
    const screen = mountReveal(h.deps);
    screen.show();
    type(el<HTMLInputElement>('rev-password'), 'not the password at all');
    click(el('rev-show'));
    await h.until(() => text(el('rev-helper')) === 'That did not confirm it.');
    expect(carries(PHRASE)).toEqual([]);
    expect(screen.holds()).toEqual({phrase: false, password: false});
  }, 30_000);

  it('rule 6: a second Show inside the first run runs no second proof', async () => {
    const h = await unlockedWallet();
    const screen = mountReveal(h.deps);
    screen.show();
    type(el<HTMLInputElement>('rev-password'), PW);
    click(el('rev-show'));
    el<HTMLButtonElement>('rev-show').disabled = false;
    el<HTMLInputElement>('rev-password').disabled = false;
    type(el<HTMLInputElement>('rev-password'), PW);
    click(el('rev-show'));
    // The refused click left the field as typed: the gate refused it before it was read.
    expect(el<HTMLInputElement>('rev-password').value).toBe(PW);
    await h.until(() => el('rev-words').children.length === 12);
    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(1);
  }, 30_000);
});

describe('the dispatcher: each mode shows its one screen', () => {
  it.each<[PageMode, string]>([
    [{mode: 'welcome'}, 'v-welcome'],
    [{mode: 'create'}, 'v-intro'],
    [{mode: 'import', source: null}, 'v-import'],
    [{mode: 'import', source: 'forgot'}, 'v-import'],
    [{mode: 'import', source: 'retry'}, 'v-retry'],
    [{mode: 'forgot'}, 'v-forgot'],
    [{mode: 'reauth', challengeId: 'ab'.repeat(16)}, 'v-reauth'],
    [{mode: 'accounts'}, 'v-accounts'],
    [{mode: 'reveal'}, 'v-reveal'],
    [{mode: 'unlock', returnTo: null}, 'v-unlock'],
  ])('%j → #%s', async (mode, screen) => {
    const h = await unlockedWallet();
    startMode(mode, h.deps);
    await h.until(() => visible(el(screen)));
    expect(SCREENS.filter(s => visible(document.getElementById(s)))).toEqual([screen]);
  });

  it('no B1b-1 section and no shared #status line is left in unlock.html', () => {
    for (const id of ['status', 'import', 'accounts', 'reveal', 'choose', 'add-account', 'reveal-form', 'reveal-words']) expect(document.getElementById(id)).toBeNull();
    // Every section under main#vault is one of the page's screens.
    expect([...document.querySelectorAll('main > section')].map(s => s.id).sort()).toEqual([...SCREENS].sort());
  });
});
