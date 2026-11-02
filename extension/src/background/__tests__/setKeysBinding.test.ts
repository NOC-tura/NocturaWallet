import {base58, base64} from '@scure/base';
import {ed25519} from '@noble/curves/ed25519.js';
import {handleMessage} from '../messages';
import {VAULT_KEY} from '../accountsStore';
import {SESSION_KEY} from '../session';
import {fakeExt} from './fakeExt';
import {DELETABLE, F, F_WALLETS, FIXTURE_ACCOUNT, MNEMONIC, edited, fixtureEnvelope} from '../../shared/__tests__/vaultControls';
import {deriveSessionAccounts} from '../../vault/accounts';

// Review H1: vault.setKeys binds to the stored envelope — keys of no stored wallet never reach the session.
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const unlockPage = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/unlock.html`};
const key = (fill: number, index: number) => {
  const seed = new Uint8Array(32).fill(fill);
  const pub = ed25519.getPublicKey(seed);
  return {index, publicKey: base58.encode(pub), secretKey: base64.encode(new Uint8Array([...seed, ...pub]))};
};
const A0 = key(1, 0);
const A1 = key(2, 1);
// B1e §2.5 (R3): a whole envelope both sides accept (the committed fixture's), carrying these accounts.
const envelopeOf = (...accounts: {index: number; publicKey: string}[]) => ({...fixtureEnvelope(), accounts: accounts.map(a => ({index: a.index, name: `Account ${a.index + 1}`, publicKey: a.publicKey}))});
const setKeys = (ext: ReturnType<typeof fakeExt>, accounts: unknown) => handleMessage(ext, {type: 'vault.setKeys', accounts}, unlockPage);

describe('vault.setKeys binds to the stored envelope (review H1)', () => {
  it('accepts the stored wallet’s keys, all or some of them (positive control)', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, envelopeOf(A0, A1));
    expect(await setKeys(ext, [A0, A1])).toEqual({ok: true});
    expect(await setKeys(ext, [A1])).toEqual({ok: true});
  });

  it('refuses a key the envelope does not record, and writes no session', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, envelopeOf(A0));
    expect(await setKeys(ext, [A0, A1])).toEqual({ok: false, error: 'unknown-account'});
    expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
  });

  it('refuses a stored key under another index', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, envelopeOf(A0));
    expect(await setKeys(ext, [{...A0, index: 3}])).toEqual({ok: false, error: 'unknown-account'});
    expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
  });

  it('refuses any keys while no wallet is stored', async () => {
    const ext = fakeExt();
    expect(await setKeys(ext, [A0])).toEqual({ok: false, error: 'unknown-account'});
    expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
  });
});

describe('vault.setKeys binds through envelopeShape (B1e §2.5, R3)', () => {
  const fixtureKeys = () => deriveSessionAccounts(MNEMONIC, 'slip10', [0]);

  it('the fixture’s own key over the fixture: a session (positive control)', async () => {
    const ext = fakeExt();
    const keys = await fixtureKeys();
    expect(keys[0]?.publicKey).toBe(FIXTURE_ACCOUNT);
    await ext.local.set(VAULT_KEY, fixtureEnvelope());
    expect(await setKeys(ext, keys)).toEqual({ok: true});
    expect(await ext.session.get(SESSION_KEY)).toEqual({accounts: keys});
  });

  it('kdf.m = 32768 (refused by this version) and the key the envelope records: malformed, no session', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, edited(e => ((e.kdf as Record<string, unknown>).m = 32768)));
    expect(await setKeys(ext, await fixtureKeys())).toEqual({ok: false, error: 'malformed'});
    expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
  });

  it.each(F.filter(([name]) => ![...F_WALLETS, 'F7'].includes(name.split(' ')[0] ?? '')))('%s, whose accounts still record the key: malformed, no session', async (_, raw) => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, raw);
    expect(await setKeys(ext, await fixtureKeys())).toEqual({ok: false, error: 'malformed'});
    expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
  });

  it('F1, F9–F12 and F18 (wallets both sides accept) bind; F7 (no accounts) is refused', async () => {
    for (const [name, raw] of F.filter(([n]) => [...F_WALLETS.filter(w => w !== 'F0'), 'F7'].includes(n.split(' ')[0] ?? ''))) {
      const ext = fakeExt();
      await ext.local.set(VAULT_KEY, raw);
      expect([name, await setKeys(ext, await fixtureKeys())]).toEqual([name, name.startsWith('F7') ? {ok: false, error: 'malformed'} : {ok: true}]);
    }
  });

  it.each(DELETABLE)('an unreadable value (%s): malformed, no session', async (_, raw) => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, raw);
    const r = await setKeys(ext, await fixtureKeys());
    expect(r).toEqual({ok: false, error: 'malformed'});
    expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
  });
});
