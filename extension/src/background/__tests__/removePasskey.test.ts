import {base64} from '@scure/base';
import {VAULT_KEY, readWalletView, removePasskey, storeEnvelope} from '../accountsStore';
import {handleMessage} from '../messages';
import {handleWallet} from '../walletApi';
import {lock} from '../autolock';
import {getSession} from '../session';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {unlocked} from './fixtures';

// B1b-2b E12 (D12, C3): the passkey's state in wallet.state, its removal by the background, and storeEnvelope never
// dropping it.
const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const K1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const PASSKEY = {credentialId: B(16, 7), prfSalt: B(32, 8), wrapped: B(40, 9)};
const WITH = {
  v: 1,
  scheme: 'slip10',
  kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)},
  seed: {iv: B(12, 2), ct: B(48, 3)},
  password: {wrapped: B(40, 4)},
  passkey: PASSKEY,
  accounts: [{index: 0, name: 'Main', publicKey: K0}],
};
const {passkey: _dropped, ...WITHOUT} = WITH;
const rev = (e: object) => envelopeRevision(e as Parameters<typeof envelopeRevision>[0]);
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const unlockPage = {id: ID, origin: ORIGIN, url: `${ORIGIN}/unlock.html`, tab: {}, frameId: 0};

async function stored(env: object = WITH, session = true) {
  const ext = fakeExt();
  await ext.local.set(VAULT_KEY, env);
  if (session) await unlocked(ext);
  return ext;
}

describe('E12: passkey state and removal', () => {
  it('wallet.state.passkey: true with a passkey, false without one, false without a wallet (answered while locked)', async () => {
    expect((await handleWallet(await stored(WITH, false), fakeDeps(), 'wallet.state', {})).data).toMatchObject({passkey: true, unlocked: false});
    expect((await handleWallet(await stored(WITHOUT, false), fakeDeps(), 'wallet.state', {})).data).toMatchObject({passkey: false});
    expect((await handleWallet(fakeExt(), fakeDeps(), 'wallet.state', {})).data).toMatchObject({hasWallet: false, passkey: false});
    expect(await readWalletView(await stored())).toMatchObject({passkey: true});
  });

  it('removes only the passkey: every other field and every name as stored', async () => {
    const ext = await stored();
    expect(await removePasskey(ext, rev(WITH))).toBe('removed');
    expect(await ext.local.get(VAULT_KEY)).toEqual(WITHOUT);
  });

  it('refusals: no-passkey (nothing written), busy, locked, no-wallet, stored-invalid, malformed', async () => {
    const none = await stored(WITHOUT);
    expect(await removePasskey(none, rev(WITHOUT))).toBe('no-passkey');
    expect(await none.local.get(VAULT_KEY)).toEqual(WITHOUT);
    expect(await removePasskey(await stored(), rev(WITHOUT))).toBe('busy');
    expect(await removePasskey(await stored(WITH, false), rev(WITH))).toBe('locked');
    const empty = fakeExt();
    await unlocked(empty);
    expect(await removePasskey(empty, rev(WITH))).toBe('no-wallet');
    expect(await removePasskey(await stored({...WITH, seed: 7}), rev(WITH))).toBe('stored-invalid');
    expect(await removePasskey(await stored(), 'x')).toBe('malformed');
  });

  it('C3: storeEnvelope refuses an envelope that drops the stored passkey, and accepts one that replaces it', async () => {
    const ext = await stored();
    const added = {...WITH, seed: {iv: B(12, 5), ct: B(48, 6)}, accounts: [...WITH.accounts, {index: 1, name: 'Two', publicKey: K1}]};
    const {passkey: _p, ...addedWithout} = added;
    expect(await storeEnvelope(ext, rev(WITH), addedWithout)).toBe('malformed');
    expect(await ext.local.get(VAULT_KEY)).toEqual(WITH);
    const replaced = {...WITH, passkey: {...PASSKEY, credentialId: B(20, 1), wrapped: B(40, 2)}};
    expect(await storeEnvelope(ext, rev(WITH), replaced)).toBe('stored');
    // Carried (an account change with the passkey kept) stays accepted too.
    const carried = {...replaced, seed: {iv: B(12, 5), ct: B(48, 6)}, accounts: added.accounts};
    expect(await storeEnvelope(ext, rev(replaced), carried)).toBe('stored');
  });

  it('the message: vault page only (popup, wallet.html and a web origin refused); a storage failure is failed', async () => {
    const msg = {type: 'vault.removePasskey', expectedRevision: rev(WITH)};
    const ext = await stored();
    for (const sender of [
      {id: ID, origin: ORIGIN, url: `${ORIGIN}/popup.html`},
      {id: ID, origin: ORIGIN, url: `${ORIGIN}/wallet.html`},
      {id: ID, origin: 'https://evil.example', url: 'https://evil.example/', tab: {}, frameId: 0},
    ]) {
      expect(await handleMessage(ext, msg, sender, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
    }
    expect(await ext.local.get(VAULT_KEY)).toEqual(WITH);
    expect(await handleMessage(ext, msg, unlockPage, fakeDeps())).toEqual({ok: true});
    const broken = await stored();
    broken.local.set = async () => {
      throw new Error('quota');
    };
    expect(await handleMessage(broken, msg, unlockPage, fakeDeps())).toEqual({ok: false, error: 'failed'});
  });

  it('the message relays each refusal as its error and writes nothing (wrong revision, no passkey, locked, no wallet)', async () => {
    const send = (ext: ReturnType<typeof fakeExt>, expectedRevision: unknown) => handleMessage(ext, {type: 'vault.removePasskey', expectedRevision}, unlockPage, fakeDeps());
    const moved = await stored();
    expect(await send(moved, rev(WITHOUT))).toEqual({ok: false, error: 'busy'});
    expect(await moved.local.get(VAULT_KEY)).toEqual(WITH);
    const none = await stored(WITHOUT);
    expect(await send(none, rev(WITHOUT))).toEqual({ok: false, error: 'no-passkey'});
    expect(await none.local.get(VAULT_KEY)).toEqual(WITHOUT);
    const locked = await stored(WITH, false);
    expect(await send(locked, rev(WITH))).toEqual({ok: false, error: 'locked'});
    expect(await locked.local.get(VAULT_KEY)).toEqual(WITH);
    const empty = fakeExt();
    await unlocked(empty);
    expect(await send(empty, rev(WITH))).toEqual({ok: false, error: 'no-wallet'});
    expect(await send(await stored(), undefined)).toEqual({ok: false, error: 'malformed'});
  });

  it('a lock fired between the session check and the write never lands between them (serial → sessionMutex)', async () => {
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
    const r = await removePasskey(ext, rev(WITH));
    await autolock;
    expect(autolock).toBeDefined();
    if (r === 'removed') {
      expect(sessionAtWrite).toHaveLength(1);
      expect(sessionAtWrite[0]).not.toBeNull();
    } else {
      expect(r).toBe('locked');
      expect(await realGet(VAULT_KEY)).toEqual(WITH);
    }
    expect(await getSession(ext)).toBeNull();
  });
});
