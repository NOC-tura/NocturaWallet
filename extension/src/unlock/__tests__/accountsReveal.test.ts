// @vitest-environment happy-dom
import {createEnvelope} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {setSession} from '../../background/session';
import {startMode} from '../modes';
import {SCREENS} from '../view/dom';
import type {PageMode} from '../mode';
import {el, harness, loadPage, testKdf, text, visible} from './pageHarness';

// The vault page's modes and their password fields (B1b-2a §1.2, extended in B1b-2b §1.2). The accounts mode's own
// tests are accountsScreen.test.ts; the reveal and verify modes', phraseScreen.test.ts.
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const PW = 'correct horse battery';

beforeEach(loadPage);

async function unlockedWallet() {
  const env = await createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: K0}], kdf: testKdf});
  const h = await harness({vault: env});
  await setSession(h.ext, await deriveSessionAccounts(M, 'slip10', [0]));
  return h;
}

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
    [{mode: 'accounts', op: 'add'}, 'v-accounts'],
    [{mode: 'accounts', op: 'remove', index: 0}, 'v-accounts'],
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
