// @vitest-environment happy-dom
import {addPasskeyWrap, createEnvelope, unlockWithPassword, unlockWithPrf, type EnvelopeV1} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import type {CredentialsApi} from '../../vault/passkey';
import {VAULT_KEY} from '../../background/accountsStore';
import {setSession} from '../../background/session';
import {mountPasskeyManage} from '../screens/passkeyManage';
import {pageMode} from '../mode';
import type {Send} from '../types';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

// The real evaluatePrf, with each PRF output it hands the page kept so a test can see it zeroed.
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

// B1b-2b §3.3 (#6 "manage", E12, D12, D13, C3, C4) against the REAL background.
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const PW = 'correct horse battery';
const OLD_PRF = crypto.getRandomValues(new Uint8Array(32));
const NEW_PRF = crypto.getRandomValues(new Uint8Array(32));

beforeEach(loadPage);

/** An authenticator: create() makes credential `id`, get() answers `prf` (null: no PRF). */
function authenticator(prf: Uint8Array | null, id = new Uint8Array([7, 7, 7, 7])): CredentialsApi {
  return {
    create: async () => ({rawId: id.slice().buffer}) as unknown as Credential,
    get: async () => ({getClientExtensionResults: () => (prf === null ? {} : {prf: {results: {first: prf.slice().buffer}}})}) as unknown as Credential,
  };
}
async function shown(
  op: 'add' | 'remove',
  // Fix round 1: `session` — the mnemonic the session holds (a mismatch); `vault` — what v1_vault holds instead of the
  // wallet; `prepare` — runs on the harness before the screen mounts.
  o: {passkey?: boolean; unlocked?: boolean; credentials?: CredentialsApi; holdSleep?: boolean; send?: (inner: Send) => Send; session?: string; vault?: unknown; prepare?: (h: Harness) => void} = {},
) {
  let env: EnvelopeV1 = await createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: K0}], kdf: testKdf});
  if (o.passkey === true) env = await addPasskeyWrap(env, await unlockWithPassword(env, PW, testKdf), OLD_PRF.slice(), new Uint8Array([1, 2, 3]), crypto.getRandomValues(new Uint8Array(32)));
  const h = await harness({vault: 'vault' in o ? o.vault : env, ...(o.credentials === undefined ? {} : {credentials: o.credentials}), ...(o.holdSleep === true ? {holdSleep: true} : {}), ...(o.send === undefined ? {} : {send: o.send})});
  if (o.unlocked !== false) await setSession(h.ext, await deriveSessionAccounts(o.session ?? M, 'slip10', [0]));
  o.prepare?.(h);
  const screen = mountPasskeyManage(h.deps);
  await screen.show(op);
  return {h, screen, env};
}
const stored = async (h: Harness) => (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
const withPassword = (password = PW) => {
  type(el<HTMLInputElement>('pm-password'), password);
  click(el('pm-act'));
};

describe('#6 manage: add and replace (password only, C4)', () => {
  it('?mode=passkey&op=… is a closed enum (anything else is add)', () => {
    expect(pageMode('?mode=passkey&op=remove')).toEqual({mode: 'passkey', op: 'remove'});
    expect(pageMode('?mode=passkey&op=add')).toEqual({mode: 'passkey', op: 'add'});
    expect(pageMode('?mode=passkey&op=delete')).toEqual({mode: 'passkey', op: 'add'});
    expect(pageMode('?mode=passkey')).toEqual({mode: 'passkey', op: 'add'});
  });

  it('add, no passkey: #6’s copy, the password line, [Add a passkey], [Cancel]; no passkey button', async () => {
    await shown('add');
    expect(text(el('pm-title'))).toBe('Unlock Noctura with a passkey');
    expect(text(el('pm-lede'))).toBe('Adds convenience. Your password always works too — keep it safe.');
    expect(text(el('pm-ask'))).toBe('Enter your password to add the passkey.');
    expect(text(el('pm-act'))).toBe('Add a passkey');
    expect(visible(el('pm-passkey'))).toBe(false);
    expect(text(el('pm-cancel'))).toBe('Cancel');
    expect(unstyled('v-passkey-manage')).toEqual([]);
  });

  it('added: "Waiting for your passkey…", then "Passkey added." + O05 + [Close this tab]; the wallet opens with the new passkey', async () => {
    const {h} = await shown('add', {credentials: authenticator(NEW_PRF)});
    withPassword();
    expect(text(el('pm-line'))).toBe('Waiting for your passkey…');
    await h.until(() => text(el('pm-line')) === 'Passkey added.');
    expect(text(el('pm-line-help'))).toBe('You can close this tab.');
    expect(visible(el('pm-close'))).toBe(true);
    const env = await stored(h);
    expect(env.passkey).toBeDefined();
    expect((await unlockWithPrf(env, NEW_PRF.slice())).length).toBe(32);
  });

  it('replace (a passkey stored): O17/O18 and [Replace passkey]; replaced → O19 + O05; the new credential is the one stored', async () => {
    const {h, env} = await shown('add', {passkey: true, credentials: authenticator(NEW_PRF, new Uint8Array([9, 9]))});
    expect(text(el('pm-title'))).toBe('Replace your passkey');
    expect(text(el('pm-lede'))).toBe('The new passkey replaces the one this wallet uses now. The old one stays in your passkey manager until you delete it there.');
    expect(text(el('pm-act'))).toBe('Replace passkey');
    // C4: a replace is password only — the stored passkey is never offered as the factor that enrols its successor.
    expect(visible(el('pm-passkey'))).toBe(false);
    withPassword();
    await h.until(() => text(el('pm-line')) === 'Passkey replaced.');
    expect(text(el('pm-line-help'))).toBe('You can close this tab.');
    const after = await stored(h);
    expect(after.passkey?.credentialId).not.toBe(env.passkey?.credentialId);
    await expect(unlockWithPrf(after, OLD_PRF.slice())).rejects.toThrow();
  });

  it('unsupported (no PRF) and a wrong password', async () => {
    const none = await shown('add', {credentials: authenticator(null)});
    withPassword();
    await none.h.until(() => text(el('pm-line')) === 'This device cannot unlock the wallet with a passkey; your password still works.');
    loadPage();
    const wrong = await shown('add', {credentials: authenticator(NEW_PRF)});
    withPassword('nope nope nope nope');
    await wrong.h.until(() => text(el('pm-helper')) === 'That did not confirm it.');
    expect((await stored(wrong.h)).passkey).toBeUndefined();
  });
});

describe('#6 manage: remove (password or passkey, E12)', () => {
  it('idle: O20/O21, [Remove passkey], [Confirm with passkey]; no "add" line', async () => {
    await shown('remove', {passkey: true});
    expect(text(el('pm-title'))).toBe('Remove your passkey');
    expect(text(el('pm-lede'))).toBe('Confirm with your password or with the passkey itself. Your password keeps working.');
    expect(text(el('pm-act'))).toBe('Remove passkey');
    expect(visible(el('pm-passkey'))).toBe(true);
    expect(visible(el('pm-ask'))).toBe(false);
  });

  it('by password: "Removing the passkey…", then O23 + O24 + [Close this tab]; the envelope has no passkey', async () => {
    const {h} = await shown('remove', {passkey: true});
    withPassword();
    expect(text(el('pm-line'))).toBe('Removing the passkey…');
    await h.until(() => text(el('pm-line')) === 'Passkey removed.');
    expect(text(el('pm-line-help'))).toBe('It is still saved in your passkey manager (Google, Apple or your password manager). Delete it there if you no longer need it.');
    expect((await stored(h)).passkey).toBeUndefined();
  });

  it('by the passkey itself: removed', async () => {
    const {h} = await shown('remove', {passkey: true, credentials: authenticator(OLD_PRF)});
    click(el('pm-passkey'));
    await h.until(() => text(el('pm-line')) === 'Passkey removed.');
    expect((await stored(h)).passkey).toBeUndefined();
  });

  it('no passkey stored: O25; locked: the common notice + [Unlock]; busy twice: RESTORE busy + [Start again]', async () => {
    const none = await shown('remove');
    withPassword();
    await none.h.until(() => text(el('pm-line')) === 'This wallet has no passkey. Nothing was changed.');
    loadPage();
    const locked = await shown('remove', {passkey: true, unlocked: false});
    withPassword();
    await locked.h.until(() => text(el('pm-line')) === 'The wallet is locked. Unlock it first, then try again.');
    expect(visible(el('pm-unlock'))).toBe(true);
    loadPage();
    const busy = await shown('remove', {passkey: true, send: inner => async m => ((m as {type: string}).type === 'vault.removePasskey' ? {ok: false, error: 'busy'} : inner(m))});
    withPassword();
    await busy.h.until(() => text(el('pm-line')) === 'The wallet changed while you were typing. Start again.');
    expect(visible(el('pm-again'))).toBe(true);
    await busy.h.until(() => !busy.h.deps.gate.isBusy());
    click(el('pm-again'));
    await busy.h.until(() => visible(el('pm-act')));
  });

  it('a device that cannot evaluate the passkey says so; the passkey stays', async () => {
    const {h} = await shown('remove', {passkey: true, credentials: authenticator(null)});
    click(el('pm-passkey'));
    await h.until(() => text(el('pm-helper')) === 'This device cannot confirm with a passkey; your password still works.');
    expect((await stored(h)).passkey).toBeDefined();
  });

  it('rule 6: a second [Remove passkey] inside the floor (`disabled` lifted) runs no second proof', async () => {
    const {h} = await shown('remove', {passkey: true, holdSleep: true});
    withPassword();
    el<HTMLButtonElement>('pm-act').disabled = false;
    el<HTMLInputElement>('pm-password').disabled = false;
    withPassword();
    await h.until(() => h.sent.some(m => m.type === 'vault.removePasskey'));
    await new Promise(r => setTimeout(r, 20));
    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(1);
    h.wake();
  });
});

// Task 10's carried lessons (Task 4, 8 and 9 reviews): the busy retry keeps the PRF; pagehide aborts before the send;
// a hidden tab does not cancel an action already clicked; [Cancel] closes the tab during the backoff's cooldown.
describe('#6 manage: leaving, retries and the cooldown', () => {
  const idle = (h: Harness) => h.until(() => !h.deps.gate.isBusy());
  const removes = (h: Harness) => h.sent.filter(m => m.type === 'vault.removePasskey');

  it('by the passkey, busy once: the retry proves with the SAME PRF output (removed), which is zeroed afterwards', async () => {
    let busy = 1;
    const {h} = await shown('remove', {
      passkey: true,
      credentials: authenticator(OLD_PRF),
      send: inner => async m => ((m as {type: string}).type === 'vault.removePasskey' && busy-- > 0 ? {ok: false, error: 'busy'} : inner(m)),
    });
    click(el('pm-passkey'));
    await h.until(() => text(el('pm-line')) === 'Passkey removed.');
    // Two proofs (each reads the session), one prompt.
    expect(h.sent.filter(m => m.type === 'vault.status')).toHaveLength(2);
    expect((await stored(h)).passkey).toBeUndefined();
    const prf = prfs.outs.at(-1);
    expect(prf?.length).toBe(32);
    expect(prf?.every(b => b === 0)).toBe(true);
  });

  it('remove by password, pagehide during the KDF: no vault.removePasskey sent, the passkey stays', async () => {
    const {h} = await shown('remove', {passkey: true});
    const kdf = h.deps.kdf;
    h.deps.kdf = async (pw, salt, p) => {
      h.leave('pagehide');
      return kdf(pw, salt, p);
    };
    withPassword();
    await idle(h);
    await new Promise(r => setTimeout(r, 20));
    expect(removes(h)).toEqual([]);
    expect((await stored(h)).passkey).toBeDefined();
    expect(text(el('pm-line'))).not.toBe('Passkey removed.');
  });

  it('remove by the passkey, pagehide during the prompt: no proof runs, nothing sent, the PRF output zeroed', async () => {
    const out = OLD_PRF.slice();
    let h: Harness | null = null;
    const credentials: CredentialsApi = {
      create: async () => null,
      get: async () => {
        h?.leave('pagehide');
        return {getClientExtensionResults: () => ({prf: {results: {first: out.buffer}}})} as unknown as Credential;
      },
    };
    const s = await shown('remove', {passkey: true, credentials});
    h = s.h;
    const read = s.h.deps.store.readEnvelope;
    let reads = 0;
    s.h.deps.store.readEnvelope = async () => (reads++, read());
    click(el('pm-passkey'));
    await idle(s.h);
    await new Promise(r => setTimeout(r, 20));
    // Fix round 1 (m2): the one read is the reload after the drop — no proof ran (it reads the session first).
    expect(reads).toBe(1);
    expect(s.h.sent.filter(m => m.type === 'vault.status')).toEqual([]);
    expect(removes(s.h)).toEqual([]);
    expect((await stored(s.h)).passkey).toBeDefined();
    const prf = prfs.outs.at(-1);
    expect(prf?.length).toBe(32);
    expect(prf?.every(b => b === 0)).toBe(true);
  });

  it('a hidden tab during the KDF does not cancel the removal already clicked', async () => {
    const {h} = await shown('remove', {passkey: true});
    const kdf = h.deps.kdf;
    h.deps.kdf = async (pw, salt, p) => {
      h.leave('hidden');
      return kdf(pw, salt, p);
    };
    withPassword();
    await h.until(() => text(el('pm-line')) === 'Passkey removed.');
    expect((await stored(h)).passkey).toBeUndefined();
  });

  it('add, pagehide during the KDF: no passkey prompt, nothing stored', async () => {
    let creates = 0;
    const real = authenticator(NEW_PRF);
    const {h} = await shown('add', {credentials: {create: async o => (creates++, real.create(o)), get: real.get}});
    const kdf = h.deps.kdf;
    h.deps.kdf = async (pw, salt, p) => {
      h.leave('pagehide');
      return kdf(pw, salt, p);
    };
    withPassword();
    await idle(h);
    await new Promise(r => setTimeout(r, 20));
    expect(creates).toBe(0);
    expect(h.sent.filter(m => m.type === 'vault.storeEnvelope')).toEqual([]);
    expect((await stored(h)).passkey).toBeUndefined();
    expect(text(el('pm-line'))).not.toBe('Passkey added.');
  });

  it('replace, pagehide during the passkey prompt: nothing stored, the old passkey stays', async () => {
    let h: Harness | null = null;
    const real = authenticator(NEW_PRF, new Uint8Array([9, 9]));
    const s = await shown('add', {
      passkey: true,
      credentials: {
        create: real.create,
        get: async o => {
          h?.leave('pagehide');
          return real.get(o);
        },
      },
    });
    h = s.h;
    withPassword();
    await idle(s.h);
    await new Promise(r => setTimeout(r, 20));
    expect(s.h.sent.filter(m => m.type === 'vault.storeEnvelope')).toEqual([]);
    const after = await stored(s.h);
    expect(after.passkey?.credentialId).toBe(s.env.passkey?.credentialId);
    expect((await unlockWithPrf(after, OLD_PRF.slice())).length).toBe(32);
  });

  it('a hidden tab during the add does not cancel it', async () => {
    const {h} = await shown('add', {credentials: authenticator(NEW_PRF)});
    const kdf = h.deps.kdf;
    h.deps.kdf = async (pw, salt, p) => {
      h.leave('hidden');
      return kdf(pw, salt, p);
    };
    withPassword();
    await h.until(() => text(el('pm-line')) === 'Passkey added.');
    expect((await stored(h)).passkey).toBeDefined();
  });

  it('[Cancel] during the cooldown closes the tab', async () => {
    const {h} = await shown('remove', {passkey: true, holdSleep: true});
    withPassword('nope nope nope nope');
    await h.until(() => text(el('pm-helper')) === 'That did not confirm it.');
    h.wake();
    await idle(h);
    withPassword('nope nope nope nope');
    await h.until(() => visible(el('pm-cooldown')));
    expect(h.deps.gate.isBusy()).toBe(true);
    expect(visible(el('pm-cancel'))).toBe(true);
    click(el('pm-cancel'));
    expect(h.closed).toBe(1);
    h.wake();
    await h.until(() => !h.deps.gate.isBusy() || (h.wake(), false));
    expect(removes(h)).toEqual([]);
  });

  // Fix round 0b: #6's top bar with the X (spec §3's general rule), wired as [Cancel].
  it("the top bar's X closes the tab, the typed password emptied", async () => {
    const {h, screen} = await shown('add');
    expect(visible(el('pm-x'))).toBe(true);
    expect(el('pm-x').getAttribute('aria-label')).toBe('Close');
    type(el<HTMLInputElement>('pm-password'), PW);
    click(el('pm-x'));
    await h.until(() => h.closed === 1);
    expect(screen.holds()).toBe(false);
  });

  it("the X during the cooldown closes the tab, and the held wait's end shows and removes nothing (generation moved)", async () => {
    const {h} = await shown('remove', {passkey: true, holdSleep: true});
    withPassword('nope nope nope nope');
    await h.until(() => text(el('pm-helper')) === 'That did not confirm it.');
    h.wake();
    await idle(h);
    withPassword('nope nope nope nope');
    await h.until(() => visible(el('pm-cooldown')));
    expect(h.deps.gate.isBusy()).toBe(true);
    expect(el<HTMLButtonElement>('pm-x').disabled).toBe(false);
    click(el('pm-x'));
    expect(h.closed).toBe(1);
    h.wake();
    await h.until(() => !h.deps.gate.isBusy() || (h.wake(), false));
    expect(text(el('pm-helper'))).not.toBe('That did not confirm it.');
    expect(removes(h)).toEqual([]);
  });

  it('remove: the field has the vault pages\' visible "Password" label; add and replace keep their own line instead', async () => {
    await shown('remove', {passkey: true});
    const label = el<HTMLLabelElement>('pm-password-label');
    expect(visible(label)).toBe(true);
    expect(text(label)).toBe('Password');
    expect(label.htmlFor).toBe('pm-password');
    expect(visible(el('pm-ask'))).toBe(false);
  });

  it('add: the add line is the label; no second "Password" label', async () => {
    await shown('add');
    expect(visible(el('pm-ask'))).toBe(true);
    expect(visible(el('pm-password-label'))).toBe(false);
  });

  it('a hidden tab empties the field', async () => {
    const {h, screen} = await shown('remove', {passkey: true});
    type(el<HTMLInputElement>('pm-password'), PW);
    h.leave();
    expect(screen.holds()).toBe(false);
  });
});

// Task 10 fix round 1 (review I1, m1–m4, m6).
describe('#6 manage: fix round 1', () => {
  const idle = (h: Harness) => h.until(() => !h.deps.gate.isBusy());
  const removes = (h: Harness) => h.sent.filter(m => m.type === 'vault.removePasskey');
  const counting = (prf: Uint8Array, id = new Uint8Array([7, 7, 7, 7])) => {
    const real = authenticator(prf, id);
    const c = {gets: 0, creates: 0, titleAtCreate: ''};
    const credentials: CredentialsApi = {
      create: async opts => {
        c.creates += 1;
        c.titleAtCreate = text(el('pm-title'));
        return real.create(opts);
      },
      get: async opts => (c.gets++, real.get(opts)),
    };
    return {c, credentials};
  };

  it('I1 rule 6: a second [Confirm with passkey] inside the gate (`disabled` lifted) prompts once', async () => {
    const {c, credentials} = counting(OLD_PRF);
    const {h} = await shown('remove', {passkey: true, holdSleep: true, credentials});
    click(el('pm-passkey'));
    el<HTMLButtonElement>('pm-passkey').disabled = false;
    click(el('pm-passkey'));
    await h.until(() => removes(h).length > 0);
    await new Promise(r => setTimeout(r, 20));
    expect(c.gets).toBe(1);
    expect(removes(h)).toHaveLength(1);
    h.wake();
  });

  it('m1: a mismatch found after a pagehide still locks the session (vault.lock passes the guard); nothing removed', async () => {
    const {h} = await shown('remove', {passkey: true, session: OTHER});
    const kdf = h.deps.kdf;
    h.deps.kdf = async (pw, salt, p) => {
      h.leave('pagehide');
      return kdf(pw, salt, p);
    };
    withPassword();
    await idle(h);
    await new Promise(r => setTimeout(r, 20));
    expect(h.sent.filter(m => m.type === 'vault.lock')).toHaveLength(1);
    expect(removes(h)).toEqual([]);
    const status = await h.deps.send({type: 'vault.status'});
    expect((status.data as {unlocked?: unknown}).unlocked).toBe(false);
    expect((await stored(h)).passkey).toBeDefined();
  });

  it('m2: a removal that landed before the pagehide is not shown as the stale entry — the page reads the vault again', async () => {
    let hh: Harness | null = null;
    const s = await shown('remove', {
      passkey: true,
      send: inner => async m => {
        const r = await inner(m);
        if ((m as {type: string}).type === 'vault.removePasskey') hh?.leave('pagehide');
        return r;
      },
    });
    hh = s.h;
    withPassword();
    await idle(s.h);
    await s.h.until(() => visible(el('pm-act')));
    expect((await stored(s.h)).passkey).toBeUndefined();
    // The reload saw no passkey: no [Confirm with passkey] for a passkey that is gone.
    expect(visible(el('pm-passkey'))).toBe(false);
    expect(text(el('pm-line'))).toBe('');
  });

  it('m2: back from the back/forward cache, the vault is read again (another tab removed the passkey)', async () => {
    const {h, env} = await shown('remove', {passkey: true});
    expect(visible(el('pm-passkey'))).toBe(true);
    const {passkey: _p, ...rest} = await stored(h);
    expect(_p).toBeDefined();
    expect(env.passkey).toBeDefined();
    await h.ext.local.set(VAULT_KEY, rest);
    h.back('restored');
    await h.until(() => !visible(el('pm-passkey')));
    await idle(h);
    expect(visible(el('pm-act'))).toBe(true);
  });

  it('m3: add, while another tab added a passkey since load — worded as a replace before the prompt and reported as one (O17, O19)', async () => {
    const {c, credentials} = counting(NEW_PRF, new Uint8Array([9, 9]));
    const {h, env} = await shown('add', {credentials});
    expect(text(el('pm-title'))).toBe('Unlock Noctura with a passkey');
    await h.ext.local.set(VAULT_KEY, await addPasskeyWrap(env, await unlockWithPassword(env, PW, testKdf), OLD_PRF.slice(), new Uint8Array([1, 2, 3]), crypto.getRandomValues(new Uint8Array(32))));
    withPassword();
    await h.until(() => text(el('pm-line')) === 'Passkey replaced.');
    expect(c.titleAtCreate).toBe('Replace your passkey');
    expect(text(el('pm-title'))).toBe('Replace your passkey');
    await expect(unlockWithPrf(await stored(h), OLD_PRF.slice())).rejects.toThrow();
    expect((await unlockWithPrf(await stored(h), NEW_PRF.slice())).length).toBe(32);
  });

  it('m4 C4: on a replace the passkey button is disabled as well as hidden; forced shown and enabled, a click prompts nothing', async () => {
    const {c, credentials} = counting(OLD_PRF);
    const {h} = await shown('add', {passkey: true, credentials});
    const b = el<HTMLButtonElement>('pm-passkey');
    expect(visible(b)).toBe(false);
    expect(b.disabled).toBe(true);
    b.hidden = false;
    b.disabled = false;
    click(b);
    await idle(h);
    await new Promise(r => setTimeout(r, 20));
    expect(c.gets).toBe(0);
    expect(removes(h)).toEqual([]);
    expect((await stored(h)).passkey).toBeDefined();
  });

  it('m6: mismatch-locked', async () => {
    const {h} = await shown('remove', {passkey: true, session: OTHER});
    withPassword();
    await h.until(() => text(el('pm-line')) === 'That did not match this wallet, so the wallet has been locked.');
    expect((await stored(h)).passkey).toBeDefined();
  });

  it('m6: damaged (at load, and from the flow)', async () => {
    const atLoad = await shown('remove', {vault: null});
    expect(text(el('pm-line'))).toBe("This wallet's stored data is damaged.");
    expect(text(el('pm-line-help'))).toBe('Your funds stay on Solana; your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase.');
    expect(visible(el('pm-act'))).toBe(false);
    expect(visible(el('pm-cancel'))).toBe(true);
    expect(atLoad.h.sent).toEqual([]);
    loadPage();
    const {h} = await shown('remove', {passkey: true});
    await h.ext.local.set(VAULT_KEY, null);
    withPassword();
    await h.until(() => text(el('pm-line')) === "This wallet's stored data is damaged.");
    expect(removes(h)).toEqual([]);
  });

  it('m6: no wallet — the notice and [Set up a wallet] (at load, and from the flow)', async () => {
    const atLoad = await shown('add', {vault: undefined});
    expect(text(el('pm-line'))).toBe('No wallet on this browser yet.');
    expect(visible(el('pm-setup'))).toBe(true);
    expect(text(el('pm-setup'))).toBe('Set up a wallet');
    click(el('pm-setup'));
    await atLoad.h.until(() => atLoad.h.went.length === 1);
    expect(atLoad.h.went).toEqual(['unlock.html?mode=welcome']);
    loadPage();
    const {h} = await shown('remove', {passkey: true});
    await h.ext.local.remove(VAULT_KEY);
    withPassword();
    await h.until(() => text(el('pm-line')) === 'No wallet on this browser yet.');
    expect(visible(el('pm-setup'))).toBe(true);
  });

  it('m6: failed (O26) — the background refuses with an error it does not name', async () => {
    const {h} = await shown('remove', {passkey: true, send: inner => async m => ((m as {type: string}).type === 'vault.removePasskey' ? {ok: false, error: 'weird'} : inner(m))});
    withPassword();
    await h.until(() => text(el('pm-line')) === 'Something went wrong. Nothing was changed.');
    expect((await stored(h)).passkey).toBeDefined();
  });

  it('m6: unreadable — the read at load throws', async () => {
    await shown('remove', {
      passkey: true,
      prepare: h => {
        h.deps.store.readEnvelope = async () => {
          throw new Error('storage');
        };
      },
    });
    expect(text(el('pm-line'))).toBe("This wallet's stored data could not be read. Reload this page.");
    expect(visible(el('pm-act'))).toBe(false);
    expect(visible(el('pm-cancel'))).toBe(true);
  });
});
