import {addPasskeyWrap, createEnvelope, decryptMnemonic, unlockWithPassword, type EnvelopeV1} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {VAULT_KEY} from '../../background/accountsStore';
import {lock} from '../../background/autolock';
import {setSession} from '../../background/session';
import {changePassword, isCurrentPassword, proveCurrent} from '../passwordFlow';
import {harness, testKdf} from './pageHarness';

// B1b-2b E10: the vault page's half of a password change — against the REAL background (pageHarness).
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const OLD = 'correct horse battery';
const NEW = 'a brand new long password';

async function setup(o: {session?: string | null; passkey?: boolean} = {}) {
  let env: EnvelopeV1 = await createEnvelope({mnemonic: M, password: OLD, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: K0}], kdf: testKdf});
  if (o.passkey === true) {
    const dk = await unlockWithPassword(env, OLD, testKdf);
    env = await addPasskeyWrap(env, dk, crypto.getRandomValues(new Uint8Array(32)), crypto.getRandomValues(new Uint8Array(16)), crypto.getRandomValues(new Uint8Array(32)));
  }
  const h = await harness({vault: env});
  const session = o.session === undefined ? M : o.session;
  if (session !== null) await setSession(h.ext, await deriveSessionAccounts(session, 'slip10', [0]));
  const deps = {readEnvelope: h.deps.store.readEnvelope, send: h.deps.send};
  return {h, env, deps};
}

describe('proveCurrent (step 1)', () => {
  it('proven: holds the envelope, its revision and the data key — and no phrase', async () => {
    const {deps} = await setup();
    const r = await proveCurrent(deps, OLD, testKdf);
    expect(r.outcome).toBe('proven');
    if (r.outcome !== 'proven') return;
    expect(Object.keys(r.held).sort()).toEqual(['dataKey', 'env', 'revision']);
    expect(JSON.stringify({...r.held, dataKey: null})).not.toContain('abandon');
    expect(Object.isFrozen(r.held)).toBe(true);
    expect(r.held.dataKey).toHaveLength(32);
  });

  it('wrong, not-unlocked, mismatch-locked (the vault locks), damaged, no-wallet', async () => {
    expect((await proveCurrent((await setup()).deps, 'nope nope nope nope', testKdf)).outcome).toBe('wrong');
    expect((await proveCurrent((await setup({session: null})).deps, OLD, testKdf)).outcome).toBe('not-unlocked');
    const mismatch = await setup({session: OTHER});
    expect((await proveCurrent(mismatch.deps, OLD, testKdf)).outcome).toBe('mismatch-locked');
    expect(mismatch.h.sent.map(m => m.type)).toContain('vault.lock');
    const damaged = await setup();
    await damaged.h.ext.local.set(VAULT_KEY, {...damaged.env, seed: 'x'});
    expect((await proveCurrent(damaged.deps, OLD, testKdf)).outcome).toBe('damaged');
    const none = await setup();
    await none.h.ext.local.remove(VAULT_KEY);
    expect((await proveCurrent(none.deps, OLD, testKdf)).outcome).toBe('no-wallet');
  });
});

describe('isCurrentPassword (step 2 `same`, review H2)', () => {
  it('true for the current password, false for another; the KEK is zeroed both ways', async () => {
    const {env} = await setup();
    const keks: Uint8Array[] = [];
    const kdf: typeof testKdf = async (pw, salt, p) => {
      const k = await testKdf(pw, salt, p);
      keks.push(k);
      return k;
    };
    expect(await isCurrentPassword(env, OLD, kdf)).toBe(true);
    expect(await isCurrentPassword(env, NEW, kdf)).toBe(false);
    expect(keks).toHaveLength(2);
    expect(keks.every(k => k.every(b => b === 0))).toBe(true);
  });
});

describe('changePassword (step 3)', () => {
  it('changed: only the salt and the wrap move; the new password opens the wallet, the old does not; the proof is spent', async () => {
    const {h, env, deps} = await setup({passkey: true});
    const r = await proveCurrent(deps, OLD, testKdf);
    if (r.outcome !== 'proven') throw new Error(r.outcome);
    expect(await changePassword({send: h.deps.send, kdf: testKdf}, r.held, NEW)).toBe('changed');
    const after = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    expect(after.seed).toEqual(env.seed);
    expect(after.accounts).toEqual(env.accounts);
    expect(after.passkey).toEqual(env.passkey);
    expect(after.kdf.salt).not.toBe(env.kdf.salt);
    expect(after.password.wrapped).not.toBe(env.password.wrapped);
    expect(await decryptMnemonic(after, await unlockWithPassword(after, NEW, testKdf))).toBe(M);
    await expect(unlockWithPassword(after, OLD, testKdf)).rejects.toThrow();
    expect(r.held.dataKey.every(b => b === 0)).toBe(true);
    expect(await h.ext.local.get('v1_settings')).toMatchObject({passwordChangedAt: h.wallet.now()});
  });

  it('weak-password: nothing is sent, the key is zeroed', async () => {
    const {h, deps} = await setup();
    const r = await proveCurrent(deps, OLD, testKdf);
    if (r.outcome !== 'proven') throw new Error(r.outcome);
    const before = h.sent.length;
    expect(await changePassword({send: h.deps.send, kdf: testKdf}, r.held, 'short')).toBe('weak-password');
    expect(h.sent.length).toBe(before);
    expect(r.held.dataKey.every(b => b === 0)).toBe(true);
  });

  it('busy when the envelope moved after step 1; locked when the session went', async () => {
    const moved = await setup();
    const r1 = await proveCurrent(moved.deps, OLD, testKdf);
    if (r1.outcome !== 'proven') throw new Error(r1.outcome);
    // Another tab enrolled a passkey meanwhile: a new revision.
    const dk = await unlockWithPassword(moved.env, OLD, testKdf);
    await moved.h.ext.local.set(VAULT_KEY, await addPasskeyWrap(moved.env, dk, crypto.getRandomValues(new Uint8Array(32)), crypto.getRandomValues(new Uint8Array(16)), crypto.getRandomValues(new Uint8Array(32))));
    expect(await changePassword({send: moved.h.deps.send, kdf: testKdf}, r1.held, NEW)).toBe('busy');

    const locked = await setup();
    const r2 = await proveCurrent(locked.deps, OLD, testKdf);
    if (r2.outcome !== 'proven') throw new Error(r2.outcome);
    await lock(locked.h.ext);
    expect(await changePassword({send: locked.h.deps.send, kdf: testKdf}, r2.held, NEW)).toBe('locked');
    expect(r2.held.dataKey.every(b => b === 0)).toBe(true);
  });
});
