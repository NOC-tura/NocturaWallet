import {handleWallet} from '../walletApi';
import {handleMessage} from '../messages';
import {SETTINGS_KEY, readSettings, updateSettings} from '../settings';
import {VAULT_KEY} from '../accountsStore';
import {setSession} from '../session';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, unlocked} from './fixtures';

// B1b-2b E14 (D17, C7): the display order lives in v1_settings, outside the envelope; every settings write keeps
// every field.
const THIRD = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const ENV = {
  v: 1,
  scheme: 'slip10',
  accounts: [
    {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
    {index: 1, name: 'Savings', publicKey: RECIPIENT},
    {index: 2, name: 'Third', publicKey: THIRD},
  ],
};
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const web = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: 'https://evil.example', url: 'https://evil.example/', tab: {}, frameId: 0};
const popup = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/popup.html`};

async function wallet() {
  const ext = fakeExt();
  await ext.local.set(VAULT_KEY, ENV);
  return ext;
}
const indexesOf = (r: {data?: unknown}) => (r.data as {accounts: {index: number}[]}).accounts.map(a => a.index);

describe('accounts.order and the display order (E14)', () => {
  it('a permutation of the stored indexes is kept, and wallet.state answers in that order', async () => {
    const ext = await wallet();
    expect(await handleWallet(ext, fakeDeps(), 'accounts.order', {order: [2, 0, 1]})).toEqual({ok: true});
    expect((await readSettings(ext)).accountOrder).toEqual([2, 0, 1]);
    expect(indexesOf(await handleWallet(ext, fakeDeps(), 'wallet.state', {}))).toEqual([2, 0, 1]);
  });

  it('refuses duplicates and non-indexes (malformed), another set (stale), and no wallet (no-wallet); nothing is written', async () => {
    const ext = await wallet();
    for (const order of [[0, 0, 1], [0, 1, -1], [0, 1, 1.5], 'x', null, [0, 1, '2']]) {
      expect(await handleWallet(ext, fakeDeps(), 'accounts.order', {order})).toEqual({ok: false, error: 'malformed'});
    }
    expect(await handleWallet(ext, fakeDeps(), 'accounts.order', {order: [0, 1]})).toEqual({ok: false, error: 'stale'});
    expect(await handleWallet(ext, fakeDeps(), 'accounts.order', {order: [0, 1, 3]})).toEqual({ok: false, error: 'stale'});
    expect(await handleWallet(ext, fakeDeps(), 'accounts.order', {order: [0, 1, 2, 3]})).toEqual({ok: false, error: 'stale'});
    expect(await ext.local.get(SETTINGS_KEY)).toBeUndefined();
    expect(await handleWallet(fakeExt(), fakeDeps(), 'accounts.order', {order: [0]})).toEqual({ok: false, error: 'no-wallet'});
  });

  it('allowed while locked (like accounts.select), and refused from a web page', async () => {
    const ext = await wallet();
    expect(await handleMessage(ext, {type: 'accounts.order', order: [1, 0, 2]}, popup, fakeDeps())).toEqual({ok: true});
    expect(await handleMessage(ext, {type: 'accounts.order', order: [0, 1, 2]}, web, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
    expect((await readSettings(ext)).accountOrder).toEqual([1, 0, 2]);
  });

  it('an order naming an index the envelope lost is read past it; an account it does not name comes after, in envelope order', async () => {
    const ext = await wallet();
    await ext.local.set(SETTINGS_KEY, {accountOrder: [2, 7]});
    expect(indexesOf(await handleWallet(ext, fakeDeps(), 'wallet.state', {}))).toEqual([2, 0, 1]);
  });

  it('a stored order that is not a list of unique indexes reads as no order (never repaired)', async () => {
    const ext = await wallet();
    for (const accountOrder of [[1, 1], [0, -1], 'x', [0.5], Array.from({length: 101}, (_, i) => i)]) {
      await ext.local.set(SETTINGS_KEY, {accountOrder});
      expect((await readSettings(ext)).accountOrder).toBeNull();
      expect(indexesOf(await handleWallet(ext, fakeDeps(), 'wallet.state', {}))).toEqual([0, 1, 2]);
    }
  });

  it('the selection falls back to the first account of the display order the session holds', async () => {
    const ext = await wallet();
    await ext.local.set(SETTINGS_KEY, {selectedAccount: 9, accountOrder: [2, 1, 0]});
    // Locked: the first of the display order.
    expect((await handleWallet(ext, fakeDeps(), 'wallet.state', {})).data).toMatchObject({selected: 2});
    // Unlocked with accounts 0 and 1 only: the first of the display order the session holds.
    await setSession(ext, [ACCOUNT, {index: 1, publicKey: RECIPIENT, secretKey: ACCOUNT.secretKey}]);
    expect((await handleWallet(ext, fakeDeps(), 'wallet.state', {})).data).toMatchObject({selected: 1});
  });

  it('C7: accounts.select and settings.set keep accountOrder, phraseVerifiedAt and passwordChangedAt', async () => {
    const ext = await wallet();
    await unlocked(ext);
    await updateSettings(ext, s => ({...s, accountOrder: [2, 1, 0], phraseVerifiedAt: 111, passwordChangedAt: 222}));
    expect(await handleWallet(ext, fakeDeps(), 'accounts.select', {index: 1})).toEqual({ok: true});
    expect(await handleWallet(ext, fakeDeps(), 'settings.set', {patch: {autoLockMinutes: 2}})).toMatchObject({ok: true});
    expect(await readSettings(ext)).toEqual({autoLockMinutes: 2, reauthUsdCents: 10_000, selectedAccount: 1, accountOrder: [2, 1, 0], phraseVerifiedAt: 111, passwordChangedAt: 222});
  });

  it('updateSettings writes one change at a time: two concurrent changes both land', async () => {
    const ext = await wallet();
    await Promise.all([updateSettings(ext, s => ({...s, phraseVerifiedAt: 5})), updateSettings(ext, s => ({...s, accountOrder: [0, 2, 1]}))]);
    expect(await readSettings(ext)).toMatchObject({phraseVerifiedAt: 5, accountOrder: [0, 2, 1]});
  });
});
