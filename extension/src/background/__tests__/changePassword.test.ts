import {base64} from '@scure/base';
import {VAULT_KEY, changePassword, onlyPasswordChanged, storeEnvelope, type StoredEnvelope} from '../accountsStore';
import {handleMessage} from '../messages';
import {readSettings} from '../settings';
import {lock} from '../autolock';
import {getSession} from '../session';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {unlocked} from './fixtures';

// B1b-2b E10 (C2): vault.changePassword accepts exactly a new salt and a new password wrap — nothing else.
const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const K1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const K2 = '7WktogJEd2wQ9eH2oWusmcoFTgeYi6rS632UviTBJ2jm';
const PASSKEY = {credentialId: B(16, 7), prfSalt: B(32, 8), wrapped: B(40, 9)};
const STORED = {
  v: 1,
  scheme: 'slip10',
  kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)},
  seed: {iv: B(12, 2), ct: B(48, 3)},
  password: {wrapped: B(40, 4)},
  passkey: PASSKEY,
  accounts: [
    {index: 0, name: 'Main', publicKey: K0},
    {index: 1, name: 'Savings', publicKey: K1},
  ],
};
type Env = typeof STORED;
const REV = envelopeRevision(STORED as Parameters<typeof envelopeRevision>[0]);
/** A well-formed change: a new salt and a new wrap, names as the page knows them. */
const CHANGED: Env = {...STORED, kdf: {...STORED.kdf, salt: B(16, 11)}, password: {wrapped: B(40, 12)}};
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const unlockPage = {id: ID, origin: ORIGIN, url: `${ORIGIN}/unlock.html`, tab: {}, frameId: 0};

async function stored(o: {session?: boolean; env?: unknown} = {}) {
  const ext = fakeExt();
  await ext.local.set(VAULT_KEY, o.env ?? STORED);
  if (o.session !== false) await unlocked(ext);
  return ext;
}

describe('vault.changePassword (E10)', () => {
  it('accepted when only the salt and the wrap change: stored, names carried over, passwordChangedAt written', async () => {
    const ext = await stored();
    const renamedByPage = {...CHANGED, accounts: CHANGED.accounts.map(a => ({...a, name: 'whatever the page says'}))};
    expect(await changePassword(ext, 4242, REV, renamedByPage)).toBe('changed');
    expect(await ext.local.get(VAULT_KEY)).toEqual(CHANGED);
    expect((await readSettings(ext)).passwordChangedAt).toBe(4242);
  });

  const refused: [string, Env][] = [
    ['the same salt', {...CHANGED, kdf: {...CHANGED.kdf, salt: STORED.kdf.salt}}],
    ['the same wrap', {...CHANGED, password: {wrapped: STORED.password.wrapped}}],
    ['the seed ciphertext changed', {...CHANGED, seed: {...STORED.seed, ct: B(48, 13)}}],
    ['the seed IV changed', {...CHANGED, seed: {...STORED.seed, iv: B(12, 14)}}],
    ['the passkey dropped', (({passkey: _p, ...rest}) => rest as Env)(CHANGED)],
    ['the passkey changed', {...CHANGED, passkey: {...PASSKEY, wrapped: B(40, 15)}}],
    ['the accounts reordered', {...CHANGED, accounts: [STORED.accounts[1], STORED.accounts[0]] as Env['accounts']}],
    ['a key changed', {...CHANGED, accounts: [STORED.accounts[0], {index: 1, name: 'Savings', publicKey: K2}] as Env['accounts']}],
    ['an account added', {...CHANGED, accounts: [...STORED.accounts, {index: 2, name: 'Third', publicKey: K2}]}],
    ['the cost changed', {...CHANGED, kdf: {...CHANGED.kdf, t: 4}}],
    // Review M4: one case per remaining clause of onlyPasswordChanged, each differing in that field alone.
    ['the envelope version changed', {...CHANGED, v: 2}],
    ['the KDF algorithm changed', {...CHANGED, kdf: {...CHANGED.kdf, alg: 'scrypt'}}],
    ['the memory cost changed', {...CHANGED, kdf: {...CHANGED.kdf, m: 131072}}],
    ['the parallelism changed', {...CHANGED, kdf: {...CHANGED.kdf, p: 2}}],
    ['the passkey credential changed', {...CHANGED, passkey: {...PASSKEY, credentialId: B(16, 16)}}],
    ['the passkey PRF salt changed', {...CHANGED, passkey: {...PASSKEY, prfSalt: B(32, 17)}}],
    ['an account removed', {...CHANGED, accounts: [STORED.accounts[0]] as Env['accounts']}],
    ['an index changed under the same key', {...CHANGED, accounts: [STORED.accounts[0], {index: 5, name: 'Savings', publicKey: K1}] as Env['accounts']}],
  ];
  for (const [what, env] of refused) {
    it(`malformed: ${what} — nothing is written`, async () => {
      const ext = await stored();
      expect(await changePassword(ext, 1, REV, env)).toBe('malformed');
      expect(await ext.local.get(VAULT_KEY)).toEqual(STORED);
      expect((await readSettings(ext)).passwordChangedAt).toBeNull();
    });
  }

  // Review M4: the shape check (envelopeShape: v 1, alg argon2id) refuses these before the rule runs, so through the message
  // they cannot fail; the rule is exported and its own clauses are held here, directly.
  it('onlyPasswordChanged itself refuses a changed envelope version and a changed KDF algorithm', () => {
    const cur = STORED as unknown as StoredEnvelope;
    expect(onlyPasswordChanged(cur, CHANGED as unknown as StoredEnvelope)).toBe(true);
    expect(onlyPasswordChanged(cur, {...CHANGED, v: 2} as unknown as StoredEnvelope)).toBe(false);
    expect(onlyPasswordChanged(cur, {...CHANGED, kdf: {...CHANGED.kdf, alg: 'scrypt'}} as unknown as StoredEnvelope)).toBe(false);
  });

  it('malformed: the scheme changed (a one-account wallet, so nothing but the scheme differs)', async () => {
    const one = {...STORED, accounts: [STORED.accounts[0]] as Env['accounts']};
    const ext = await stored({env: one});
    const rev = envelopeRevision(one as Parameters<typeof envelopeRevision>[0]);
    expect(await changePassword(ext, 1, rev, {...CHANGED, accounts: one.accounts, scheme: 'cli'})).toBe('malformed');
    expect(await ext.local.get(VAULT_KEY)).toEqual(one);
    expect(await changePassword(ext, 1, rev, {...CHANGED, accounts: one.accounts})).toBe('changed');
  });

  it('a wallet without a passkey: accepted only while the passkey stays absent', async () => {
    const {passkey: _p, ...noPk} = STORED;
    const {passkey: _q, ...changedNoPk} = CHANGED;
    const ext = await stored({env: noPk});
    const rev = envelopeRevision(noPk as Parameters<typeof envelopeRevision>[0]);
    expect(await changePassword(ext, 1, rev, {...changedNoPk, passkey: PASSKEY})).toBe('malformed');
    expect(await changePassword(ext, 1, rev, changedNoPk)).toBe('changed');
  });

  it('busy on a stale revision; locked with no session; no-wallet; stored-invalid; malformed revision or shape', async () => {
    expect(await changePassword(await stored(), 1, 'f'.repeat(64), CHANGED)).toBe('busy');
    expect(await changePassword(await stored({session: false}), 1, REV, CHANGED)).toBe('locked');
    const none = fakeExt();
    await unlocked(none);
    expect(await changePassword(none, 1, REV, CHANGED)).toBe('no-wallet');
    expect(await changePassword(await stored({env: {...STORED, seed: 'x'}}), 1, REV, CHANGED)).toBe('stored-invalid');
    expect(await changePassword(await stored(), 1, 'nope', CHANGED)).toBe('malformed');
    expect(await changePassword(await stored(), 1, REV, {...CHANGED, v: 2})).toBe('malformed');
  });

  it('fix round 1: an autolock fired between the session check and the write never lands between them', async () => {
    // The lock fires while changePassword reads the stored envelope — after its session check, before its write.
    // Held under sessionMutex, the lock waits for the write: the vault is never written on a locked session.
    const ext = await stored();
    const realGet = ext.local.get;
    const realSet = ext.local.set;
    let autolock: Promise<void> | undefined;
    const sessionAtWrite: unknown[] = [];
    ext.local.get = async k => {
      if (k === VAULT_KEY && autolock === undefined) autolock = lock(ext);
      return realGet(k);
    };
    ext.local.set = async (k, v) => {
      if (k === VAULT_KEY) sessionAtWrite.push(await getSession(ext));
      return realSet(k, v);
    };
    const r = await changePassword(ext, 1, REV, CHANGED);
    await autolock;
    expect(autolock).toBeDefined();
    if (r === 'changed') {
      expect(sessionAtWrite).toHaveLength(1);
      expect(sessionAtWrite[0]).not.toBeNull();
    } else {
      expect(r).toBe('locked');
      expect(await realGet(VAULT_KEY)).toEqual(STORED);
    }
    expect(await getSession(ext)).toBeNull();
  });

  it('storeEnvelope still refuses a password change (C2: sameWallet is unchanged)', async () => {
    const ext = await stored();
    expect(await storeEnvelope(ext, REV, CHANGED)).toBe('malformed');
    expect(await ext.local.get(VAULT_KEY)).toEqual(STORED);
  });

  it('the message: only from the vault page (popup, wallet.html and a web origin refused); a storage failure is failed', async () => {
    const msg = {type: 'vault.changePassword', expectedRevision: REV, envelope: CHANGED};
    const popup = {id: ID, origin: ORIGIN, url: `${ORIGIN}/popup.html`};
    const tab = {id: ID, origin: ORIGIN, url: `${ORIGIN}/wallet.html`};
    const web = {id: ID, origin: 'https://evil.example', url: 'https://evil.example/', tab: {}, frameId: 0};
    const ext = await stored();
    for (const sender of [popup, tab, web]) expect(await handleMessage(ext, msg, sender, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
    expect(await ext.local.get(VAULT_KEY)).toEqual(STORED);
    expect(await handleMessage(ext, msg, unlockPage, fakeDeps())).toEqual({ok: true});
    const broken = await stored();
    broken.local.set = async () => {
      throw new Error('quota');
    };
    expect(await handleMessage(broken, msg, unlockPage, fakeDeps())).toEqual({ok: false, error: 'failed'});
  });
});
