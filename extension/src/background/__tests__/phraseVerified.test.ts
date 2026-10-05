import {base64} from '@scure/base';
import {VAULT_KEY, forgetWallet, storeEnvelope} from '../accountsStore';
import {handleMessage} from '../messages';
import {SETTINGS_KEY, readSettings, updateSettings} from '../settings';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, unlocked} from './fixtures';

// B1b-2b E15 (D15, C8): vault.phraseVerified records a fact — vault page only, refused while locked; kept by the
// changes that keep the wallet, cleared by a delete and a first write.
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const unlockPage = {id: ID, origin: ORIGIN, url: `${ORIGIN}/unlock.html`, tab: {}, frameId: 0};
const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
const STORED = {
  v: 1,
  scheme: 'slip10',
  kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)},
  seed: {iv: B(12, 2), ct: B(48, 3)},
  password: {wrapped: B(40, 4)},
  accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}],
};
const REV = envelopeRevision(STORED as Parameters<typeof envelopeRevision>[0]);
const zero = () => fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => []});

describe('vault.phraseVerified (E15)', () => {
  it('sets phraseVerifiedAt to now; refused while locked (nothing written)', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    expect(await handleMessage(ext, {type: 'vault.phraseVerified'}, unlockPage, deps)).toEqual({ok: false, error: 'locked'});
    expect((await readSettings(ext)).phraseVerifiedAt).toBeNull();
    await unlocked(ext);
    deps.clock.t = 777;
    expect(await handleMessage(ext, {type: 'vault.phraseVerified'}, unlockPage, deps)).toEqual({ok: true});
    expect((await readSettings(ext)).phraseVerifiedAt).toBe(777);
  });

  it('only from the vault page: the popup, wallet.html and a web origin are refused', async () => {
    const ext = fakeExt();
    await unlocked(ext);
    for (const sender of [
      {id: ID, origin: ORIGIN, url: `${ORIGIN}/popup.html`},
      {id: ID, origin: ORIGIN, url: `${ORIGIN}/wallet.html`},
      {id: ID, origin: 'https://evil.example', url: 'https://evil.example/', tab: {}, frameId: 0},
    ]) {
      expect(await handleMessage(ext, {type: 'vault.phraseVerified'}, sender, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
    }
    expect((await readSettings(ext)).phraseVerifiedAt).toBeNull();
  });

  it('kept by a restore (a forget with a replacement); cleared by a delete and by a first write', async () => {
    const replacement = {...STORED, kdf: {...STORED.kdf, salt: B(16, 9)}, seed: {iv: B(12, 8), ct: B(48, 7)}, password: {wrapped: B(40, 6)}};
    const kept = fakeExt();
    await kept.local.set(VAULT_KEY, STORED);
    await updateSettings(kept, s => ({...s, phraseVerifiedAt: 5}));
    expect(await forgetWallet(kept, fakeDeps({reader: zero()}), {expectedRevision: REV, replacement})).toBe('forgotten');
    expect((await readSettings(kept)).phraseVerifiedAt).toBe(5);

    const deleted = fakeExt();
    await deleted.local.set(VAULT_KEY, STORED);
    await updateSettings(deleted, s => ({...s, phraseVerifiedAt: 5}));
    expect(await forgetWallet(deleted, fakeDeps({reader: zero()}), {expectedRevision: REV})).toBe('forgotten');
    expect((await readSettings(deleted)).phraseVerifiedAt).toBeNull();

    const first = fakeExt();
    await updateSettings(first, s => ({...s, phraseVerifiedAt: 5}));
    expect(await storeEnvelope(first, null, STORED)).toBe('stored');
    expect((await readSettings(first)).phraseVerifiedAt).toBeNull();
  });

  it('a delete fired between the session check and the settings write never leaves the fact behind (settingsMutex → sessionMutex)', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, STORED);
    await unlocked(ext);
    const deps = fakeDeps({reader: zero()});
    deps.clock.t = 777;
    const realGet = ext.local.get;
    let deleting: Promise<unknown> | undefined;
    ext.local.get = async k => {
      if (k === SETTINGS_KEY && deleting === undefined) {
        deleting = forgetWallet(ext, deps, {expectedRevision: REV});
        // Give the delete every chance to run to its end here, between the check and the write — it can only if the
        // check and the write do not share the section its lock waits on.
        for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0));
      }
      return realGet(k);
    };
    const r = await handleMessage(ext, {type: 'vault.phraseVerified'}, unlockPage, deps);
    expect(deleting).toBeDefined();
    expect(await deleting).toBe('forgotten');
    expect(r).toEqual({ok: true});
    // The delete was ordered after the write, so it removed what the write left: nothing reaches the next wallet.
    expect(await realGet(SETTINGS_KEY)).toBeUndefined();
    expect(await realGet(VAULT_KEY)).toBeUndefined();
  });
});

