// @vitest-environment happy-dom
import {createEnvelope, type EnvelopeV1} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {VAULT_KEY} from '../../background/accountsStore';
import {setSession} from '../../background/session';
import {mountAccounts} from '../screens/accounts';
import {startMode} from '../modes';
import {SCREENS} from '../view/dom';
import type {PageMode} from '../mode';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible} from './pageHarness';

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

  it('remove with no valid number still takes the typed password out of the field', async () => {
    const h = await unlockedWallet();
    mountAccounts(h.deps).show();
    type(el<HTMLInputElement>('acc-password'), PW);
    type(el<HTMLInputElement>('acc-remove-index'), '0');
    click(el('acc-remove'));
    expect(el<HTMLInputElement>('acc-password').value).toBe('');
    expect(carries(PASSWORD)).toEqual([]);
    await h.until(() => text(el('acc-helper')) === 'Enter the number of the account to remove (1, 2, …).');
    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(0);
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

describe('the two password fields are labelled where a sighted user sees it (Task 18 visual pass)', () => {
  it('accounts, the phrase proof, #36 and the delete page: a visible <label for> "Password", no aria-label standing in, no minlength or required', () => {
    for (const id of ['acc-password', 'pp-password', 'cp-field', 'dl-password']) {
      const field = el<HTMLInputElement>(id);
      const label = document.querySelector<HTMLLabelElement>(`label[for="${id}"]`);
      expect(text(label)).toBe('Password');
      expect(field.hasAttribute('aria-label')).toBe(false);
      // The page's own checks answer a short or empty password in its helper line; the browser's
      // validation bubble would answer instead, with words the spec does not have.
      expect(field.hasAttribute('minlength')).toBe(false);
      expect(field.hasAttribute('required')).toBe(false);
    }
  });
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
    [{mode: 'reveal'}, 'v-phrase-proof'],
    [{mode: 'verify'}, 'v-phrase-proof'],
    [{mode: 'password'}, 'v-change-password'],
    [{mode: 'delete'}, 'v-delete'],
    [{mode: 'passkey', op: 'add'}, 'v-passkey-manage'],
    [{mode: 'passkey', op: 'remove'}, 'v-passkey-manage'],
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
