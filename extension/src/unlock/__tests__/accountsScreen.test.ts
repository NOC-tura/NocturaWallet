// @vitest-environment happy-dom
import {addPasskeyWrap, createEnvelope, unlockWithPassword, type EnvelopeV1} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import type {CredentialsApi} from '../../vault/passkey';
import {VAULT_KEY} from '../../background/accountsStore';
import {PENDING_KEY} from '../../background/pendingStore';
import {setSession} from '../../background/session';
import {pendingRecord} from '../../background/__tests__/fixtures';
import {mountAccounts, type AccountsOp} from '../screens/accounts';
import type {Send} from '../types';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

// The real evaluatePrf, with each PRF output it hands the page kept so a test can see it zeroed (as passkeyManageScreen).
const prfs = vi.hoisted(() => ({outs: [] as Uint8Array[]}));
vi.mock('../../vault/passkey', async importOriginal => {
  const actual = await importOriginal<typeof import('../../vault/passkey')>();
  return {
    ...actual,
    evaluatePrf: async (...args: Parameters<typeof actual.evaluatePrf>) => {
      const r = await actual.evaluatePrf(...args);
      if (r !== null) prfs.outs.push(r);
      return r;
    },
  };
});

// B1b-2b §3.6 (D16, C6, C14, E13, E16): the accounts mode, against the REAL background.
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PW = 'correct horse battery';
const PRF = crypto.getRandomValues(new Uint8Array(32));

beforeEach(loadPage);

/** Every place the page carries `s` as text, attribute or field value. */
const carries = (s: string): boolean => {
  if (document.body.textContent?.includes(s) === true) return true;
  for (const e of document.body.querySelectorAll('*')) for (const a of e.attributes) if (a.value.includes(s)) return true;
  return [...document.body.querySelectorAll<HTMLInputElement>('input')].some(f => f.value.includes(s));
};

async function shown(
  op: AccountsOp,
  // Task 12 carries: `send` wraps the background; `vault` is what v1_vault holds instead of the wallet; `session` is the
  // mnemonic the session holds (a mismatch); `unlocked: false` leaves the session locked.
  o: {indexes?: number[]; names?: string[]; passkey?: boolean; credentials?: CredentialsApi; holdSleep?: boolean; send?: (inner: Send) => Send; vault?: unknown; session?: string; unlocked?: boolean} = {},
) {
  const indexes = o.indexes ?? [0];
  const keys = await deriveSessionAccounts(M, 'slip10', indexes);
  let env: EnvelopeV1 = await createEnvelope({
    mnemonic: M,
    password: PW,
    scheme: 'slip10',
    accounts: keys.map((k, i) => ({index: k.index, name: o.names?.[i] ?? `Account ${k.index + 1}`, publicKey: k.publicKey})),
    kdf: testKdf,
  });
  if (o.passkey === true) env = await addPasskeyWrap(env, await unlockWithPassword(env, PW, testKdf), PRF.slice(), new Uint8Array([3]), crypto.getRandomValues(new Uint8Array(32)));
  const h = await harness({vault: 'vault' in o ? o.vault : env, ...(o.credentials === undefined ? {} : {credentials: o.credentials}), ...(o.holdSleep === true ? {holdSleep: true} : {}), ...(o.send === undefined ? {} : {send: o.send})});
  if (o.unlocked !== false) await setSession(h.ext, o.session === undefined ? keys : await deriveSessionAccounts(o.session, 'slip10', indexes));
  const screen = mountAccounts(h.deps);
  await screen.show(op);
  return {h, screen, env, keys};
}
const stored = async (h: Harness) => (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
const withPassword = (password = PW) => {
  type(el<HTMLInputElement>('acc-password'), password);
  click(el('acc-act'));
};
const DONE = 'Done. The accounts are updated.';

describe('the accounts mode: add (C6)', () => {
  it('idle: O33, the lowest free account number pre-filled (1-based), O35, the extension-only notice, [Add an account]', async () => {
    await shown({op: 'add'}, {indexes: [0, 2]});
    expect(text(el('acc-title'))).toBe('Add an account');
    expect(text(document.querySelector('label[for="acc-index"]'))).toBe('Account number');
    expect(el<HTMLInputElement>('acc-index').value).toBe('2');
    expect(text(el('acc-add-fields'))).toContain('Adding a number this wallet had before brings back the same address.');
    expect(text(el('acc-only'))).toBe('Accounts after the first one exist only in this extension until the phone app supports more than one account.');
    expect(text(el('acc-act'))).toBe('Add an account');
    expect(visible(el('acc-passkey'))).toBe(false);
    expect(visible(el('acc-cancel'))).toBe(false);
    expect(unstyled('v-accounts')).toEqual([]);
  });

  it('adds the pre-filled number (a removed middle account comes back), and pre-fills the next free one after', async () => {
    const {h, keys} = await shown({op: 'add'}, {indexes: [0, 2]});
    withPassword();
    expect(el<HTMLInputElement>('acc-password').value).toBe('');
    await h.until(() => text(el('acc-helper')) === DONE);
    const env = await stored(h);
    expect(env.accounts.map(a => a.index)).toEqual([0, 2, 1]);
    expect(env.accounts.find(a => a.index === 1)?.publicKey).toBe((await deriveSessionAccounts(M, 'slip10', [1]))[0]?.publicKey);
    expect(keys).toHaveLength(2);
    await h.until(() => el<HTMLInputElement>('acc-index').value === '4');
  });

  it('a number taken: O36 (found after the proof); not a number: O37 — before any proof', async () => {
    const {h} = await shown({op: 'add'}, {indexes: [0, 1]});
    type(el<HTMLInputElement>('acc-index'), '2');
    withPassword();
    await h.until(() => text(el('acc-helper')) === 'That account is already in this wallet.');
    await h.until(() => !h.deps.gate.isBusy());
    // Fix round 1 (visual review M3): a refusal of the number is toned as the page's other refusals (2a's field error):
    // the helper in --danger, the NUMBER field bordered — not the password field.
    expect(el('acc-helper').classList.contains('error')).toBe(true);
    expect(el('acc-index').classList.contains('is-error')).toBe(true);
    expect(el('acc-password').classList.contains('is-error')).toBe(false);
    // index-taken is the flow's finding on the envelope it opened, after the proof: exactly one proof ran for it.
    const statuses = h.sent.filter(m => m.type === 'vault.status').length;
    expect(statuses).toBe(1);
    for (const bad of ['0', '1.5', '', '2147483649']) {
      type(el<HTMLInputElement>('acc-index'), bad);
      withPassword();
      await h.until(() => text(el('acc-helper')) === 'That is not an account number.' && !h.deps.gate.isBusy());
      expect(el('acc-helper').classList.contains('error')).toBe(true);
      expect(el('acc-index').classList.contains('is-error')).toBe(true);
      expect(el('acc-password').classList.contains('is-error')).toBe(false);
      el('acc-helper').textContent = '';
    }
    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(statuses);
  });

  it('E16: the passkey proves an add', async () => {
    const credentials: CredentialsApi = {create: async () => null, get: async () => ({getClientExtensionResults: () => ({prf: {results: {first: PRF.slice().buffer}}})}) as unknown as Credential};
    const {h} = await shown({op: 'add'}, {passkey: true, credentials});
    expect(visible(el('acc-passkey'))).toBe(true);
    click(el('acc-passkey'));
    await h.until(() => text(el('acc-helper')) === DONE);
    expect((await stored(h)).accounts.map(a => a.index)).toEqual([0, 1]);
  });
});

describe('the accounts mode: remove (C14)', () => {
  it('index=0 → "Remove Account 1?" (review L2); the address in groups of four, the D16 line — never the name', async () => {
    const {h, keys} = await shown({op: 'remove', index: 0}, {indexes: [0, 1], names: ['Grandma savings', 'Two']});
    expect(text(el('acc-title'))).toBe('Remove Account 1?');
    expect([...el('acc-address').querySelectorAll('.addr-groups span')].map(s => s.textContent).join('')).toBe(keys[0]?.publicKey);
    expect(text(el('acc-remove-info'))).toContain('Its funds stay on Solana; add it again to use them.');
    expect(carries('Grandma savings')).toBe(false);
    expect(text(el('acc-act'))).toBe('Remove the account');
    expect(visible(el('acc-cancel'))).toBe(true);
    expect(visible(el('acc-only'))).toBe(false);
    expect(unstyled('v-accounts')).toEqual([]);
    click(el('acc-cancel'));
    await h.until(() => h.closed === 1);
  });

  it('removes it with the password; the list keeps the others', async () => {
    const {h} = await shown({op: 'remove', index: 1}, {indexes: [0, 1, 2]});
    expect(text(el('acc-title'))).toBe('Remove Account 2?');
    withPassword();
    expect(text(el('acc-helper'))).toBe('Removing the account…');
    await h.until(() => text(el('acc-helper')) === DONE);
    expect((await stored(h)).accounts.map(a => a.index)).toEqual([0, 2]);
    expect(visible(el('acc-act'))).toBe(false);
  });

  it('C5: a send from it still open — the adapted send-open line; nothing changes', async () => {
    const {h, keys, env} = await shown({op: 'remove', index: 1}, {indexes: [0, 1]});
    await h.ext.local.set(PENDING_KEY, [pendingRecord({account: keys[1]?.publicKey})]);
    withPassword();
    await h.until(() => text(el('acc-helper')) === 'A transaction from this account is still pending. Wait until it confirms or expires — about two minutes — then try again.');
    expect(await stored(h)).toEqual(env);
  });

  it('unknown-index: an index the envelope does not hold, or one that did not parse — the line, no action', async () => {
    await shown({op: 'remove', index: 7}, {indexes: [0, 1]});
    expect(text(el('acc-helper'))).toBe('There is no account with that number.');
    expect(visible(el('acc-act'))).toBe(false);
    expect(visible(el('acc-form'))).toBe(false);
    loadPage();
    await shown({op: 'remove', index: null}, {indexes: [0, 1]});
    expect(text(el('acc-helper'))).toBe('There is no account with that number.');
    expect(visible(el('acc-act'))).toBe(false);
  });

  it('the last account: refused by the flow (the manager disables its trash button anyway)', async () => {
    const {h} = await shown({op: 'remove', index: 0}, {indexes: [0]});
    withPassword();
    await h.until(() => text(el('acc-helper')) === 'The last account cannot be removed.');
  });

  it('rule 6: a second [Remove the account] inside the floor (`disabled` lifted) runs no second proof', async () => {
    const {h} = await shown({op: 'remove', index: 1}, {indexes: [0, 1], holdSleep: true});
    withPassword();
    el<HTMLButtonElement>('acc-act').disabled = false;
    el<HTMLInputElement>('acc-password').disabled = false;
    withPassword();
    await h.until(() => h.sent.some(m => m.type === 'vault.status'));
    await new Promise(r => setTimeout(r, 20));
    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(1);
    // The run started above finishes inside this test (a run still going would draw on the next test's page).
    await h.until(() => !h.deps.gate.isBusy() || (h.wake(), false));
  });

  it('a hidden tab empties the password field', async () => {
    const {h, screen} = await shown({op: 'remove', index: 1}, {indexes: [0, 1]});
    type(el<HTMLInputElement>('acc-password'), PW);
    h.leave();
    expect(screen.holds()).toBe(false);
  });
});


// Task 12 carries: the Task 5 review (a read that throws), pre-flight F14 (the common notices), and the Task 8–11
// lessons (pagehide's generation, vault.lock through it, close during the cooldown, the PRF output's owner, rule 6 on
// every button, the back/forward cache).
describe('the accounts mode: carries', () => {
  const idle = (h: Harness) => h.until(() => !h.deps.gate.isBusy());
  const stores = (h: Harness) => h.sent.filter(m => m.type === 'vault.storeEnvelope');
  const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
  const authenticator = (prf: Uint8Array): CredentialsApi => ({
    create: async () => null,
    get: async () => ({getClientExtensionResults: () => ({prf: {results: {first: prf.slice().buffer}}})}) as unknown as Credential,
  });

  it('Task 5 carry: the read at load throws — the unreadable line, no form, the gate free (never stuck)', async () => {
    const env = await createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: (await deriveSessionAccounts(M, 'slip10', [0]))[0]?.publicKey ?? ''}], kdf: testKdf});
    const h = await harness({vault: env});
    h.deps.store.readEnvelope = async () => {
      throw new Error('storage');
    };
    await mountAccounts(h.deps).show({op: 'add'});
    expect(text(el('acc-helper'))).toBe("This wallet's stored data could not be read. Reload this page.");
    expect(visible(el('acc-form'))).toBe(false);
    expect(visible(el('acc-act'))).toBe(false);
    expect(h.deps.gate.isBusy()).toBe(false);
  });

  it('Task 5 carry: a read that throws inside the add — "Something went wrong.", never stuck at "Adding an account…"', async () => {
    const {h} = await shown({op: 'add'});
    h.deps.store.readEnvelope = async () => {
      throw new Error('storage');
    };
    withPassword();
    await idle(h);
    await h.until(() => text(el('acc-helper')) === 'Something went wrong.');
    expect(stores(h)).toEqual([]);
    expect(visible(el('acc-act'))).toBe(true);
  });

  it('F14: not-unlocked — the common notice + [Unlock] → ?mode=unlock', async () => {
    const {h} = await shown({op: 'add'}, {unlocked: false});
    withPassword();
    await h.until(() => text(el('acc-helper')) === 'The wallet is locked. Unlock it first, then try again.');
    await idle(h);
    expect(visible(el('acc-unlock'))).toBe(true);
    expect(text(el('acc-unlock'))).toBe('Unlock');
    expect(visible(el('acc-form'))).toBe(false);
    click(el('acc-unlock'));
    await h.until(() => h.went.length === 1);
    expect(h.went).toEqual(['unlock.html?mode=unlock']);
  });

  it('F14: no wallet — the notice + [Set up a wallet] → ?mode=welcome (at load, and from the flow)', async () => {
    const atLoad = await shown({op: 'remove', index: 0}, {vault: undefined});
    expect(text(el('acc-helper'))).toBe('No wallet on this browser yet.');
    expect(visible(el('acc-setup'))).toBe(true);
    expect(text(el('acc-setup'))).toBe('Set up a wallet');
    expect(visible(el('acc-act'))).toBe(false);
    click(el('acc-setup'));
    await atLoad.h.until(() => atLoad.h.went.length === 1);
    expect(atLoad.h.went).toEqual(['unlock.html?mode=welcome']);
    loadPage();
    const {h} = await shown({op: 'add'});
    await h.ext.local.remove(VAULT_KEY);
    withPassword();
    await h.until(() => text(el('acc-helper')) === 'No wallet on this browser yet.');
    expect(visible(el('acc-setup'))).toBe(true);
  });

  it('F14: damaged — the line + damagedHelp, no action (at load, and from the flow)', async () => {
    const HELP = 'Your funds stay on Solana; your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase.';
    const atLoad = await shown({op: 'add'}, {vault: null});
    expect(text(el('acc-helper'))).toBe("This wallet's stored data is damaged.");
    expect(text(el('acc-help'))).toBe(HELP);
    expect(visible(el('acc-help'))).toBe(true);
    expect(visible(el('acc-act'))).toBe(false);
    expect(atLoad.h.sent).toEqual([]);
    loadPage();
    const {h} = await shown({op: 'remove', index: 1}, {indexes: [0, 1]});
    expect(visible(el('acc-help'))).toBe(false);
    await h.ext.local.set(VAULT_KEY, null);
    withPassword();
    await h.until(() => text(el('acc-helper')) === "This wallet's stored data is damaged.");
    expect(text(el('acc-help'))).toBe(HELP);
    expect(stores(h)).toEqual([]);
  });

  it('mismatch-locked: the session holds another wallet — locked, nothing stored', async () => {
    const {h, env} = await shown({op: 'add'}, {session: OTHER});
    withPassword();
    await h.until(() => text(el('acc-helper')) === 'That did not match this wallet, so the wallet has been locked.');
    expect(await stored(h)).toEqual(env);
    expect(visible(el('acc-act'))).toBe(false);
  });

  it('pagehide during the KDF (add): nothing stored, no keys set, the page reads the vault again', async () => {
    const {h, env} = await shown({op: 'add'});
    const kdf = h.deps.kdf;
    h.deps.kdf = async (pw, salt, p) => {
      h.leave('pagehide');
      return kdf(pw, salt, p);
    };
    withPassword();
    await idle(h);
    await new Promise(r => setTimeout(r, 20));
    expect(stores(h)).toEqual([]);
    expect(h.sent.filter(m => m.type === 'vault.setKeys')).toEqual([]);
    expect(await stored(h)).toEqual(env);
    expect(text(el('acc-helper'))).not.toBe(DONE);
    await h.until(() => visible(el('acc-act')) && !el<HTMLButtonElement>('acc-act').disabled);
    expect(el<HTMLInputElement>('acc-index').value).toBe('2');
  });

  it('pagehide during the KDF (remove): nothing stored, the account stays', async () => {
    const {h, env} = await shown({op: 'remove', index: 1}, {indexes: [0, 1]});
    const kdf = h.deps.kdf;
    h.deps.kdf = async (pw, salt, p) => {
      h.leave('pagehide');
      return kdf(pw, salt, p);
    };
    withPassword();
    await idle(h);
    await new Promise(r => setTimeout(r, 20));
    expect(stores(h)).toEqual([]);
    expect(await stored(h)).toEqual(env);
    expect(text(el('acc-helper'))).not.toBe(DONE);
  });

  it('a hidden tab during the KDF does not cancel the add already clicked', async () => {
    const {h} = await shown({op: 'add'});
    const kdf = h.deps.kdf;
    h.deps.kdf = async (pw, salt, p) => {
      h.leave('hidden');
      return kdf(pw, salt, p);
    };
    withPassword();
    await h.until(() => text(el('acc-helper')) === DONE);
    expect((await stored(h)).accounts.map(a => a.index)).toEqual([0, 1]);
  });

  it('vault.lock passes after a pagehide: a mismatch found by a proof already running still locks; nothing stored', async () => {
    const {h, env} = await shown({op: 'remove', index: 1}, {indexes: [0, 1], session: OTHER});
    const kdf = h.deps.kdf;
    h.deps.kdf = async (pw, salt, p) => {
      h.leave('pagehide');
      return kdf(pw, salt, p);
    };
    withPassword();
    await idle(h);
    await new Promise(r => setTimeout(r, 20));
    expect(h.sent.filter(m => m.type === 'vault.lock')).toHaveLength(1);
    const status = await h.deps.send({type: 'vault.status'});
    expect((status.data as {unlocked?: unknown}).unlocked).toBe(false);
    expect(stores(h)).toEqual([]);
    expect(await stored(h)).toEqual(env);
  });

  it('the passkey, pagehide during the prompt: no proof runs, nothing sent, the PRF output zeroed by the screen', async () => {
    let h: Harness | null = null;
    const real = authenticator(PRF);
    const credentials: CredentialsApi = {
      create: async () => null,
      get: async o => {
        h?.leave('pagehide');
        return real.get(o);
      },
    };
    const s = await shown({op: 'remove', index: 1}, {indexes: [0, 1], passkey: true, credentials});
    h = s.h;
    click(el('acc-passkey'));
    await idle(s.h);
    await new Promise(r => setTimeout(r, 20));
    expect(s.h.sent.filter(m => m.type === 'vault.status')).toEqual([]);
    expect(stores(s.h)).toEqual([]);
    const prf = prfs.outs.at(-1);
    expect(prf?.length).toBe(32);
    expect(prf?.every(b => b === 0)).toBe(true);
  });

  it('the passkey, busy once: the retry proves with the SAME PRF output (never zeroed while in use), zeroed after', async () => {
    let busy = 1;
    const {h} = await shown(
      {op: 'remove', index: 1},
      {indexes: [0, 1], passkey: true, credentials: authenticator(PRF), send: inner => async m => ((m as {type: string}).type === 'vault.storeEnvelope' && busy-- > 0 ? {ok: false, error: 'busy'} : inner(m))},
    );
    click(el('acc-passkey'));
    await h.until(() => text(el('acc-helper')) === DONE);
    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(2);
    expect((await stored(h)).accounts.map(a => a.index)).toEqual([0]);
    const prf = prfs.outs.at(-1);
    expect(prf?.length).toBe(32);
    expect(prf?.every(b => b === 0)).toBe(true);
  });

  it('the passkey on add with a number that is not one: refused before any prompt (O37)', async () => {
    let gets = 0;
    const real = authenticator(PRF);
    const {h} = await shown({op: 'add'}, {passkey: true, credentials: {create: async () => null, get: async o => (gets++, real.get(o))}});
    type(el<HTMLInputElement>('acc-index'), '0');
    click(el('acc-passkey'));
    await h.until(() => text(el('acc-helper')) === 'That is not an account number.');
    expect(gets).toBe(0);
  });

  it('a device that cannot evaluate the passkey says so; nothing changes', async () => {
    const {h, env} = await shown({op: 'add'}, {passkey: true, credentials: {create: async () => null, get: async () => null}});
    click(el('acc-passkey'));
    await h.until(() => text(el('acc-helper')) === 'This device cannot confirm with a passkey; your password still works.');
    expect(await stored(h)).toEqual(env);
  });

  it('rule 6: a second [Confirm with passkey] inside the gate (`disabled` lifted) prompts once', async () => {
    let gets = 0;
    const real = authenticator(PRF);
    const {h} = await shown({op: 'add'}, {passkey: true, holdSleep: true, credentials: {create: async () => null, get: async o => (gets++, real.get(o))}});
    click(el('acc-passkey'));
    el<HTMLButtonElement>('acc-passkey').disabled = false;
    click(el('acc-passkey'));
    await h.until(() => stores(h).length > 0);
    await new Promise(r => setTimeout(r, 20));
    expect(gets).toBe(1);
    expect(stores(h)).toHaveLength(1);
    // The run started above finishes inside this test (a run still going would draw on the next test's page).
    await h.until(() => !h.deps.gate.isBusy() || (h.wake(), false));
  });

  it('rule 6: a second [Add an account] inside the floor (`disabled` lifted) runs no second proof', async () => {
    const {h} = await shown({op: 'add'}, {holdSleep: true});
    withPassword();
    el<HTMLButtonElement>('acc-act').disabled = false;
    el<HTMLInputElement>('acc-password').disabled = false;
    withPassword();
    await h.until(() => h.sent.some(m => m.type === 'vault.status'));
    await new Promise(r => setTimeout(r, 20));
    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(1);
    // The run started above finishes inside this test (a run still going would draw on the next test's page).
    await h.until(() => !h.deps.gate.isBusy() || (h.wake(), false));
  });

  it('a wrong password twice: the cooldown card and "Confirm paused"; [Cancel] (remove) closes the tab during it', async () => {
    const {h} = await shown({op: 'remove', index: 1}, {indexes: [0, 1], holdSleep: true});
    withPassword('nope nope nope nope');
    await h.until(() => text(el('acc-helper')) === 'That did not confirm it.');
    h.wake();
    await idle(h);
    withPassword('nope nope nope nope');
    await h.until(() => visible(el('acc-cooldown')));
    expect(visible(el('acc-paused'))).toBe(true);
    expect(visible(el('acc-act'))).toBe(false);
    expect(h.deps.gate.isBusy()).toBe(true);
    click(el('acc-cancel'));
    expect(h.closed).toBe(1);
    h.wake();
    await h.until(() => !h.deps.gate.isBusy() || (h.wake(), false));
    expect(stores(h)).toEqual([]);
  });

  it('X (add, which has no [Cancel]) closes the tab during the cooldown, and when idle', async () => {
    const {h} = await shown({op: 'add'}, {holdSleep: true});
    expect(el('acc-x').getAttribute('aria-label')).toBe('Close');
    withPassword('nope nope nope nope');
    await h.until(() => text(el('acc-helper')) === 'That did not confirm it.');
    h.wake();
    await idle(h);
    withPassword('nope nope nope nope');
    await h.until(() => visible(el('acc-cooldown')));
    click(el('acc-x'));
    expect(h.closed).toBe(1);
    h.wake();
    await h.until(() => !h.deps.gate.isBusy() || (h.wake(), false));
    await h.until(() => !visible(el('acc-cooldown')));
    click(el('acc-x'));
    await h.until(() => h.closed === 2 || (h.wake(), false));
    expect(stores(h)).toEqual([]);
  });

  it('back from the back/forward cache: the vault is read again — the pre-filled number moves on (add)', async () => {
    const {h, env} = await shown({op: 'add'});
    expect(el<HTMLInputElement>('acc-index').value).toBe('2');
    const two = await deriveSessionAccounts(M, 'slip10', [1]);
    await h.ext.local.set(VAULT_KEY, {...env, accounts: [...env.accounts, {index: 1, name: 'Account 2', publicKey: two[0]?.publicKey ?? ''}]});
    h.back('restored');
    await h.until(() => el<HTMLInputElement>('acc-index').value === '3');
  });

  it('back from the back/forward cache: an account removed elsewhere is no longer offered (remove)', async () => {
    const {h, env} = await shown({op: 'remove', index: 1}, {indexes: [0, 1]});
    expect(visible(el('acc-act'))).toBe(true);
    await h.ext.local.set(VAULT_KEY, {...env, accounts: env.accounts.filter(a => a.index !== 1)});
    h.back('restored');
    await h.until(() => text(el('acc-helper')) === 'There is no account with that number.');
    expect(visible(el('acc-act'))).toBe(false);
  });

  it('remove done is the end: no form, no [Cancel]; a back/forward-cache return keeps the outcome', async () => {
    const {h} = await shown({op: 'remove', index: 1}, {indexes: [0, 1]});
    withPassword();
    await h.until(() => text(el('acc-helper')) === DONE);
    await idle(h);
    expect(visible(el('acc-form'))).toBe(false);
    expect(visible(el('acc-cancel'))).toBe(false);
    h.back('restored');
    await new Promise(r => setTimeout(r, 20));
    expect(text(el('acc-helper'))).toBe(DONE);
  });
});

// Task 12 fix round 1 (review): the remove is bound to the address the page showed; two pins; the helper while cooling;
// the unknown-index heading; Enter in the number field.
describe('the accounts mode: fix round 1', () => {
  const idle = (h: Harness) => h.until(() => !h.deps.gate.isBusy());
  const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
  const CHANGED = 'The wallet in this browser changed. Check the address and try again.';
  const shownAddress = () => [...el('acc-address').querySelectorAll('.addr-groups span')].map(s => s.textContent).join('');
  /** Wallet B: another phrase under the SAME password, accounts 0 and 1. */
  async function walletB() {
    const keys = await deriveSessionAccounts(OTHER, 'slip10', [0, 1]);
    const env = await createEnvelope({mnemonic: OTHER, password: PW, scheme: 'slip10', accounts: keys.map(k => ({index: k.index, name: `Account ${k.index + 1}`, publicKey: k.publicKey})), kdf: testKdf});
    return {env, keys};
  }

  it('I1: another wallet swapped in after load (same password, unlocked) — nothing proven, O14, its address shown; never charged', async () => {
    // holdSleep: a backoff wait (a charge) would hold the cooldown card on screen until wake().
    const {h} = await shown({op: 'remove', index: 1}, {indexes: [0, 1], holdSleep: true});
    const settled = () => h.until(() => !h.deps.gate.isBusy() || (h.wake(), false));
    const b = await walletB();
    await h.ext.local.set(VAULT_KEY, b.env);
    await setSession(h.ext, b.keys);
    withPassword();
    await h.until(() => text(el('acc-helper')) === CHANGED);
    // Fix round 1 (visual review M3): O14 in the delete page's tone — a warning, no field error.
    expect(el('acc-helper').classList.contains('warn')).toBe(true);
    expect(el('acc-helper').classList.contains('error')).toBe(false);
    expect(el('acc-password').classList.contains('is-error')).toBe(false);
    await settled();
    expect(h.sent.filter(m => m.type === 'vault.status')).toEqual([]);
    expect(h.sent.filter(m => m.type === 'vault.storeEnvelope')).toEqual([]);
    expect(await stored(h)).toEqual(b.env);
    expect(shownAddress()).toBe(b.keys[1]?.publicKey);
    expect(visible(el('acc-act'))).toBe(true);
    // Never charged to the backoff: a wrong password after it, then another, are the FIRST and SECOND wrong ones — the
    // first gets no wait (a charge would have made it the second, with the cooldown card).
    withPassword('nope nope nope nope');
    await h.until(() => text(el('acc-helper')) === 'That did not confirm it.' || visible(el('acc-cooldown')));
    expect(visible(el('acc-cooldown'))).toBe(false);
    await settled();
    // The address now on screen is the one a proof removes.
    withPassword();
    await h.until(() => text(el('acc-helper')) === DONE || (h.wake(), false));
    await settled();
    expect((await stored(h)).accounts.map(a => a.publicKey)).toEqual([b.keys[0]?.publicKey]);
  });

  it('I1: the passkey path compares before the prompt — the authenticator is never asked', async () => {
    let gets = 0;
    const credentials: CredentialsApi = {create: async () => null, get: async () => (gets++, {getClientExtensionResults: () => ({prf: {results: {first: PRF.slice().buffer}}})}) as unknown as Credential};
    const {h} = await shown({op: 'remove', index: 1}, {indexes: [0, 1], passkey: true, credentials});
    const b = await walletB();
    await h.ext.local.set(VAULT_KEY, b.env);
    await setSession(h.ext, b.keys);
    click(el('acc-passkey'));
    await h.until(() => text(el('acc-helper')) === CHANGED);
    await idle(h);
    expect(gets).toBe(0);
    expect(h.sent.filter(m => m.type === 'vault.status')).toEqual([]);
    expect(shownAddress()).toBe(b.keys[1]?.publicKey);
    // B has no passkey: the reload offers none.
    expect(visible(el('acc-passkey'))).toBe(false);
  });

  it('I1: swapped between the click’s check and the flow’s own read — refused at that read, before any proof; nothing locked', async () => {
    const {h} = await shown({op: 'remove', index: 1}, {indexes: [0, 1]});
    const b = await walletB();
    const read = h.deps.store.readEnvelope;
    let reads = 0;
    h.deps.store.readEnvelope = async () => {
      reads += 1;
      if (reads === 2) await h.ext.local.set(VAULT_KEY, b.env);
      return read();
    };
    withPassword();
    await h.until(() => text(el('acc-helper')) === CHANGED);
    await idle(h);
    expect(h.sent.filter(m => m.type === 'vault.status')).toEqual([]);
    expect(h.sent.filter(m => m.type === 'vault.storeEnvelope')).toEqual([]);
    expect(h.sent.filter(m => m.type === 'vault.lock')).toEqual([]);
    expect(await stored(h)).toEqual(b.env);
    expect(shownAddress()).toBe(b.keys[1]?.publicKey);
  });

  it('pin (a): on an envelope ordered [0, 2, 1], index=1 shows AND removes envelope index 1 — never list position 1', async () => {
    const {h, keys} = await shown({op: 'remove', index: 1}, {indexes: [0, 2, 1]});
    const one = keys.find(k => k.index === 1)?.publicKey;
    expect(text(el('acc-title'))).toBe('Remove Account 2?');
    expect(shownAddress()).toBe(one);
    withPassword();
    await h.until(() => text(el('acc-helper')) === DONE);
    const after = await stored(h);
    expect(after.accounts.map(a => a.index)).toEqual([0, 2]);
    expect(after.accounts.some(a => a.publicKey === one)).toBe(false);
  });

  it('pin (b): pagehide inside the store’s answer — the only message after it is vault.lock (no vault.setKeys)', async () => {
    let hh: Harness | null = null;
    const s = await shown(
      {op: 'remove', index: 1},
      {
        indexes: [0, 1],
        send: inner => async m => {
          const r = await inner(m);
          if ((m as {type: string}).type === 'vault.storeEnvelope') hh?.leave('pagehide');
          return r;
        },
      },
    );
    hh = s.h;
    withPassword();
    await idle(s.h);
    await new Promise(r => setTimeout(r, 20));
    const types = s.h.sent.map(m => m.type);
    const at = types.indexOf('vault.storeEnvelope');
    expect(at).toBeGreaterThan(-1);
    // After the store: vault.lock, then only the reload's own read (no message — readEnvelope reads storage).
    expect(types.slice(at + 1)).toEqual(['vault.lock']);
  });

  it('the helper line is hidden while cooling (as delete and #6 manage)', async () => {
    const {h} = await shown({op: 'add'}, {holdSleep: true});
    withPassword('nope nope nope nope');
    await h.until(() => text(el('acc-helper')) === 'That did not confirm it.');
    h.wake();
    await idle(h);
    expect(visible(el('acc-helper'))).toBe(true);
    withPassword('nope nope nope nope');
    await h.until(() => visible(el('acc-cooldown')));
    expect(visible(el('acc-helper'))).toBe(false);
    h.wake();
    await h.until(() => !h.deps.gate.isBusy() || (h.wake(), false));
    expect(visible(el('acc-helper'))).toBe(true);
  });

  it('unknown-index leaves no empty heading', async () => {
    await shown({op: 'remove', index: 7}, {indexes: [0, 1]});
    expect(visible(el('acc-title'))).toBe(false);
    loadPage();
    await shown({op: 'remove', index: 1}, {indexes: [0, 1]});
    expect(visible(el('acc-title'))).toBe(true);
  });

  it('Enter in the "Account number" field submits (the same gated action)', async () => {
    const {h} = await shown({op: 'add'}, {indexes: [0, 1]});
    type(el<HTMLInputElement>('acc-password'), PW);
    type(el<HTMLInputElement>('acc-index'), '5');
    el('acc-index').dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
    await h.until(() => text(el('acc-helper')) === DONE);
    expect((await stored(h)).accounts.map(a => a.index)).toEqual([0, 1, 4]);
    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(1);
  });
});
