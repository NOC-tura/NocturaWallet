// @vitest-environment happy-dom
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {addPasskeyWrap, createEnvelope, unlockWithPassword, type EnvelopeV1} from '../../vault/envelope';
import {derivePublicKeys} from '../../vault/accounts';
import {reencryptForAccounts} from '../../vault/reencrypt';
import {VAULT_KEY} from '../../background/accountsStore';
import {PENDING_KEY} from '../../background/pendingStore';
import {pendingRecord} from '../../background/__tests__/fixtures';
import type {CredentialsApi} from '../../vault/passkey';
import {firstAccount, mountDelete} from '../screens/delete';
import {pageMode} from '../mode';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

// Fix round 1 (I3): the real evaluatePrf, with each PRF output it hands the page kept so a test can see it zeroed.
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

// B1b-2b §3.2 (#37's proof, E11, C17) against the REAL background.
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const PW = 'correct horse battery';
const PRF = crypto.getRandomValues(new Uint8Array(32));

beforeEach(loadPage);

async function wallet(mnemonic = M, indexes = [0], o: {passkey?: boolean} = {}): Promise<EnvelopeV1> {
  const keys = await derivePublicKeys(mnemonic, 'slip10', indexes);
  let env = await createEnvelope({mnemonic, password: PW, scheme: 'slip10', accounts: indexes.map((index, i) => ({index, name: `Account ${index + 1}`, publicKey: keys[i] ?? ''})), kdf: testKdf});
  if (o.passkey === true) env = await addPasskeyWrap(env, await unlockWithPassword(env, PW, testKdf), PRF.slice(), crypto.getRandomValues(new Uint8Array(16)), crypto.getRandomValues(new Uint8Array(32)));
  return env;
}
/** A passkey authenticator that answers with PRF. */
const prfCredentials = (): CredentialsApi => ({
  create: async () => null,
  get: async () => ({getClientExtensionResults: () => ({prf: {results: {first: PRF.slice().buffer}}})}) as unknown as Credential,
});
async function shown(env: EnvelopeV1 | undefined, o: {holdSleep?: boolean; credentials?: CredentialsApi} = {}) {
  const h = await harness({vault: env, deleteMode: true, ...o});
  let kdfRuns = 0;
  h.deps.kdf = async (pw, salt, p) => (kdfRuns++, testKdf(pw, salt, p));
  // Every wait the page asks for (the 500 ms floor, a backoff wait): read before mountDelete, which hands it to the backoff.
  const sleeps: number[] = [];
  const sleep = h.deps.sleep;
  h.deps.sleep = ms => (sleeps.push(ms), sleep(ms));
  const screen = mountDelete(h.deps);
  await screen.show();
  return {h, screen, kdfRuns: () => kdfRuns, backoffWaits: () => sleeps.filter(ms => ms >= 1000)};
}
const forgets = (h: Harness) => h.sent.filter(m => m.type === 'vault.forgetWallet');
const idle = (h: Harness) => h.until(() => !h.deps.gate.isBusy());

describe('#37’s proof: the delete page', () => {
  it('idle: its copy, the first account’s address in groups of four (the LOWEST index, not list order), the passkey button when stored', async () => {
    // Envelope order 2, 0: the first account is index 0's, never the first listed (rev 3, review M1).
    const env = await wallet(M, [2, 0], {passkey: true});
    await shown(env);
    expect(pageMode('?mode=delete')).toEqual({mode: 'delete'});
    const k0 = env.accounts.find(a => a.index === 0)?.publicKey ?? '';
    expect(firstAccount(env)).toBe(k0);
    expect([...el('dl-address').querySelectorAll('.addr-groups span')].map(s => s.textContent).join('')).toBe(k0);
    expect(text(el('v-delete').querySelector('h2'))).toBe('Delete this wallet?');
    expect(text(el('dl-entry'))).toContain("This wallet's first account");
    expect(text(el('dl-entry'))).toContain('Enter your password to delete this wallet from this browser. Your funds stay on Solana; your recovery phrase still controls them.');
    expect(text(el('dl-delete'))).toBe('Delete wallet');
    // Fix round 1 (review M3): the design's trash icon before the label (ix:15000), from the page's sprite.
    expect(el('dl-delete').querySelector('svg use')?.getAttribute('href')).toBe('#i-trash');
    expect(document.getElementById('i-trash')?.tagName.toLowerCase()).toBe('symbol');
    expect(visible(el('dl-passkey'))).toBe(true);
    expect(text(el('dl-passkey'))).toBe('Confirm with passkey');
    expect(text(el('dl-cancel'))).toBe('Cancel');
    expect(unstyled('v-delete')).toEqual([]);
  });

  it('the right password deletes the wallet — one forget with neither field — and lands on welcome, no toast', async () => {
    const {h} = await shown(await wallet());
    type(el<HTMLInputElement>('dl-password'), PW);
    click(el('dl-delete'));
    expect(el<HTMLInputElement>('dl-password').value).toBe('');
    await h.until(() => h.went.length === 1);
    expect(h.went).toEqual(['unlock.html?mode=welcome']);
    expect(forgets(h)).toHaveLength(1);
    expect(Object.keys(forgets(h)[0] ?? {}).sort()).toEqual(['expectedRevision', 'type']);
    expect(await h.ext.local.get(VAULT_KEY)).toBeUndefined();
  });

  it('a wrong password: "That did not confirm it." and the wallet stays', async () => {
    const {h} = await shown(await wallet());
    type(el<HTMLInputElement>('dl-password'), 'nope nope nope nope');
    click(el('dl-delete'));
    await h.until(() => text(el('dl-helper')) === 'That did not confirm it.');
    expect(forgets(h)).toEqual([]);
    expect(await h.ext.local.get(VAULT_KEY)).toBeDefined();
  });

  it('C17 rev 3: the wallet REPLACED under the tab — the old password is `changed`, no KDF run, not charged, the new address shown', async () => {
    const a = await wallet(M);
    const b = await wallet(OTHER);
    const {h, kdfRuns, backoffWaits} = await shown(a);
    await h.ext.local.set(VAULT_KEY, b);
    type(el<HTMLInputElement>('dl-password'), PW);
    click(el('dl-delete'));
    await h.until(() => text(el('dl-helper')) === 'The wallet in this browser changed. Check the address and try again.' && !h.deps.gate.isBusy());
    expect(kdfRuns()).toBe(0);
    expect([...el('dl-address').querySelectorAll('.addr-groups span')].map(s => s.textContent).join('')).toBe(firstAccount(b));
    expect(visible(el('dl-cooldown'))).toBe(false);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(b);
    expect(forgets(h)).toEqual([]);
    // Never charged: a wrong guess right after waits nothing (the first wrong in a streak has no wait).
    type(el<HTMLInputElement>('dl-password'), 'nope nope nope nope');
    click(el('dl-delete'));
    await h.until(() => text(el('dl-helper')) === 'That did not confirm it.' && !h.deps.gate.isBusy());
    expect(visible(el('dl-cooldown'))).toBe(false);
    // The harness's sleep resolves at once (the cooldown ends before the helper shows), so the wait itself is the
    // evidence: none after `changed` + one wrong; the positive control — a second wrong in the streak waits 1 s.
    expect(backoffWaits()).toEqual([]);
    type(el<HTMLInputElement>('dl-password'), 'nope nope nope nope');
    click(el('dl-delete'));
    await h.until(() => backoffWaits().length === 1 && !h.deps.gate.isBusy());
    expect(backoffWaits()).toEqual([1000]);
    expect(kdfRuns()).toBe(2);
  });

  it('C17: the same wallet at a new revision (an account added) is `changed` too; a new proof then deletes the wallet now shown', async () => {
    const a = await wallet(M, [0]);
    const {h} = await shown(a);
    const moved = await reencryptForAccounts(a, await unlockWithPassword(a, PW, testKdf), [{index: 0, name: 'Account 1'}, {index: 1, name: 'Account 2'}]);
    await h.ext.local.set(VAULT_KEY, moved);
    type(el<HTMLInputElement>('dl-password'), PW);
    click(el('dl-delete'));
    await h.until(() => text(el('dl-helper')).startsWith('The wallet in this browser changed.') && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('dl-password'), PW);
    click(el('dl-delete'));
    await h.until(() => h.went.length === 1);
    expect(await h.ext.local.get(VAULT_KEY)).toBeUndefined();
  });

  it('send-open: the pending line + O15, [Unlock] → ?mode=unlock and [Close this tab]; the vault intact', async () => {
    const env = await wallet();
    const {h} = await shown(env);
    await h.ext.local.set(PENDING_KEY, [pendingRecord({account: env.accounts[0]?.publicKey})]);
    type(el<HTMLInputElement>('dl-password'), PW);
    click(el('dl-delete'));
    await h.until(() => visible(el('dl-notice')));
    expect(text(el('dl-notice-line'))).toBe('A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.');
    expect(text(el('dl-notice-help'))).toBe('The wallet has been locked. Nothing was deleted.');
    expect([visible(el('dl-unlock')), visible(el('dl-close')), visible(el('dl-cancel'))]).toEqual([true, true, false]);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(env);
    await idle(h);
    click(el('dl-unlock'));
    await h.until(() => h.went.length === 1);
    expect(h.went).toEqual(['unlock.html?mode=unlock']);
  });

  it('a damaged vault: the damaged lines, no delete (D10); no wallet: the notice and [Set up a wallet]', async () => {
    await shown({...(await wallet()), seed: 'x'} as unknown as EnvelopeV1);
    expect(text(el('dl-notice-line'))).toBe("This wallet's stored data is damaged.");
    expect(visible(el('dl-delete'))).toBe(false);
    loadPage();
    await shown(undefined);
    expect(text(el('dl-notice-line'))).toBe('No wallet on this browser yet.');
    expect(visible(el('dl-setup'))).toBe(true);
  });

  it('the passkey: unavailable says so; with PRF output it deletes (the PRF zeroed by the proof)', async () => {
    const none = await shown(await wallet(M, [0], {passkey: true}));
    click(el('dl-passkey'));
    await none.h.until(() => text(el('dl-helper')) === 'This device cannot confirm with a passkey; your password still works.');
    loadPage();
    const yes = await shown(await wallet(M, [0], {passkey: true}), {credentials: prfCredentials()});
    click(el('dl-passkey'));
    await yes.h.until(() => yes.h.went.length === 1);
    expect(await yes.h.ext.local.get(VAULT_KEY)).toBeUndefined();
  });

  it('rule 6: a second Delete inside the floor (`disabled` lifted) sends no second proof', async () => {
    const {h, kdfRuns} = await shown(await wallet(), {holdSleep: true});
    type(el<HTMLInputElement>('dl-password'), PW);
    click(el('dl-delete'));
    el<HTMLButtonElement>('dl-delete').disabled = false;
    el<HTMLInputElement>('dl-password').disabled = false;
    type(el<HTMLInputElement>('dl-password'), PW);
    click(el('dl-delete'));
    await h.until(() => forgets(h).length === 1);
    await new Promise(r => setTimeout(r, 20));
    expect(kdfRuns()).toBe(1);
    expect(forgets(h)).toHaveLength(1);
    h.wake();
  });

  // Fix round 1 (review I2): the passkey path's compare runs BEFORE the OS prompt — a changed wallet never prompts.
  it('C17 on the passkey path: the wallet changed before the click → `changed`, credentials.get never called, nothing charged', async () => {
    const a = await wallet(M, [0], {passkey: true});
    let prompts = 0;
    const credentials: CredentialsApi = {create: async () => null, get: async o => (prompts++, prfCredentials().get(o))};
    const {h, kdfRuns, backoffWaits} = await shown(a, {credentials});
    await h.ext.local.set(VAULT_KEY, await wallet(OTHER, [0], {passkey: true}));
    click(el('dl-passkey'));
    await h.until(() => text(el('dl-helper')) === 'The wallet in this browser changed. Check the address and try again.' && !h.deps.gate.isBusy());
    expect([prompts, kdfRuns(), backoffWaits().length, forgets(h).length]).toEqual([0, 0, 0, 0]);
  });

  // Fix round 1 (review I1, the reviewer's probe A): the compare and the proof are two reads; the OS prompt lies between.
  it('C17 mid-prompt (probe A): account 0 removed while the passkey prompt is open → `changed`, no forget, v1_vault intact, the new first address shown', async () => {
    const a = await wallet(M, [0, 1], {passkey: true});
    const moved = await reencryptForAccounts(a, await unlockWithPassword(a, PW, testKdf), [{index: 1, name: 'Account 2'}]);
    let h: Harness | null = null;
    const credentials: CredentialsApi = {
      create: async () => null,
      get: async o => {
        await h?.ext.local.set(VAULT_KEY, moved);
        return prfCredentials().get(o);
      },
    };
    const s1 = await shown(a, {credentials});
    h = s1.h;
    click(el('dl-passkey'));
    await s1.h.until(() => text(el('dl-helper')) === 'The wallet in this browser changed. Check the address and try again.' && !s1.h.deps.gate.isBusy());
    expect(forgets(s1.h)).toEqual([]);
    expect(await s1.h.ext.local.get(VAULT_KEY)).toEqual(moved);
    expect([...el('dl-address').querySelectorAll('.addr-groups span')].map(x => x.textContent).join('')).toBe(firstAccount(moved));
    expect(firstAccount(moved)).not.toBe(firstAccount(a));
    expect(s1.backoffWaits()).toEqual([]);
  });

  it('C17 on the password path, between the click\'s compare and the proof\'s read → `changed`, no forget, v1_vault intact', async () => {
    const a = await wallet(M, [0, 1]);
    const moved = await reencryptForAccounts(a, await unlockWithPassword(a, PW, testKdf), [{index: 1, name: 'Account 2'}]);
    const {h, backoffWaits} = await shown(a);
    const read = h.deps.store.readEnvelope;
    let reads = 0;
    // The click's compare reads first; the wallet changes before proveFactor's own read.
    h.deps.store.readEnvelope = async () => {
      const r = await read();
      if (++reads === 1) await h.ext.local.set(VAULT_KEY, moved);
      return r;
    };
    type(el<HTMLInputElement>('dl-password'), PW);
    click(el('dl-delete'));
    await h.until(() => text(el('dl-helper')) === 'The wallet in this browser changed. Check the address and try again.' && !h.deps.gate.isBusy());
    expect(forgets(h)).toEqual([]);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(moved);
    expect([...el('dl-address').querySelectorAll('.addr-groups span')].map(x => x.textContent).join('')).toBe(firstAccount(moved));
    expect(backoffWaits()).toEqual([]);
  });

  it('C17 on the password path, mid-KDF (after the proof\'s read): E5 refuses the stale revision — `busy`, v1_vault intact', async () => {
    const a = await wallet(M, [0, 1]);
    const moved = await reencryptForAccounts(a, await unlockWithPassword(a, PW, testKdf), [{index: 1, name: 'Account 2'}]);
    const {h} = await shown(a);
    const kdf = h.deps.kdf;
    h.deps.kdf = async (pw, salt, p) => {
      await h.ext.local.set(VAULT_KEY, moved);
      return kdf(pw, salt, p);
    };
    type(el<HTMLInputElement>('dl-password'), PW);
    click(el('dl-delete'));
    await h.until(() => visible(el('dl-notice')));
    expect(text(el('dl-notice-line'))).toBe('The wallet changed while you were typing. Start again.');
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(moved);
  });

  // Fix round 1 (review I3, the controller's ruling): the click is the decision; leaving the page is not.
  it('pagehide during the KDF: no forget, the wallet stays', async () => {
    const {h} = await shown(await wallet());
    const kdf = h.deps.kdf;
    h.deps.kdf = async (pw, salt, p) => {
      h.leave('pagehide');
      return kdf(pw, salt, p);
    };
    type(el<HTMLInputElement>('dl-password'), PW);
    click(el('dl-delete'));
    await idle(h);
    await new Promise(r => setTimeout(r, 20));
    expect(forgets(h)).toEqual([]);
    expect(h.went).toEqual([]);
    expect(await h.ext.local.get(VAULT_KEY)).toBeDefined();
  });

  it('pagehide during the passkey prompt: no forget, the PRF output zeroed', async () => {
    const out = PRF.slice();
    let h: Harness | null = null;
    const credentials: CredentialsApi = {
      create: async () => null,
      get: async () => {
        h?.leave('pagehide');
        return {getClientExtensionResults: () => ({prf: {results: {first: out.buffer}}})} as unknown as Credential;
      },
    };
    const s1 = await shown(await wallet(M, [0], {passkey: true}), {credentials});
    h = s1.h;
    click(el('dl-passkey'));
    await idle(s1.h);
    await new Promise(r => setTimeout(r, 20));
    expect(forgets(s1.h)).toEqual([]);
    expect(await s1.h.ext.local.get(VAULT_KEY)).toBeDefined();
    const prf = prfs.outs.at(-1);
    expect(prf?.length).toBe(32);
    expect(prf?.every(b => b === 0)).toBe(true);
  });

  it('a hidden tab during the KDF does not cancel the delete already clicked', async () => {
    const {h} = await shown(await wallet());
    const kdf = h.deps.kdf;
    h.deps.kdf = async (pw, salt, p) => {
      h.leave('hidden');
      return kdf(pw, salt, p);
    };
    type(el<HTMLInputElement>('dl-password'), PW);
    click(el('dl-delete'));
    await h.until(() => h.went.length === 1);
    expect(h.went).toEqual(['unlock.html?mode=welcome']);
    expect(await h.ext.local.get(VAULT_KEY)).toBeUndefined();
  });

  // Fix round 1 (review M1): the backoff's wait holds the gate; [Cancel] must still close the tab.
  it('[Cancel] during the cooldown closes the tab', async () => {
    const {h} = await shown(await wallet(), {holdSleep: true});
    type(el<HTMLInputElement>('dl-password'), 'nope nope nope nope');
    click(el('dl-delete'));
    await h.until(() => text(el('dl-helper')) === 'That did not confirm it.');
    h.wake();
    await idle(h);
    type(el<HTMLInputElement>('dl-password'), 'nope nope nope nope');
    click(el('dl-delete'));
    await h.until(() => visible(el('dl-cooldown')));
    expect(h.deps.gate.isBusy()).toBe(true);
    expect(visible(el('dl-cancel'))).toBe(true);
    click(el('dl-cancel'));
    expect(h.closed).toBe(1);
    h.wake();
    await h.until(() => !h.deps.gate.isBusy() || (h.wake(), false));
    expect(forgets(h)).toEqual([]);
  });

  it('a hidden tab empties the field', async () => {
    const {h, screen} = await shown(await wallet());
    type(el<HTMLInputElement>('dl-password'), PW);
    h.leave();
    expect(screen.holds()).toBe(false);
  });
});

// E11: deleteWallet is reachable from ONE screen — the delete page. Every other src/unlock file is held away from it.
describe('the deleteWallet boundary (source)', () => {
  it('only screens/delete.ts (and forgetFlow.ts, which defines it) names deleteWallet', () => {
    const root = join(__dirname, '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) {
          if (e !== '__tests__') walk(p);
        } else if (/\.ts$/.test(e)) files.push(relative(root, p).split(sep).join('/'));
      }
    };
    walk(root);
    expect(files.filter(f => /\bdeleteWallet\b/.test(readFileSync(join(root, f), 'utf8'))).sort()).toEqual(['forgetFlow.ts', 'screens/delete.ts']);
  });
});
