import {base58, base64} from '@scure/base';
import {ed25519} from '@noble/curves/ed25519.js';
import {handleMessage} from '../messages';
import {VAULT_KEY} from '../accountsStore';
import {SESSION_KEY} from '../session';
import {fakeExt} from './fakeExt';

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
const envelopeOf = (...accounts: {index: number; publicKey: string}[]) => ({v: 1, scheme: 'slip10', accounts: accounts.map(a => ({index: a.index, name: `Account ${a.index + 1}`, publicKey: a.publicKey}))});
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
