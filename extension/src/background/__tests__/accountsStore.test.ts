import {VAULT_KEY, cleanName, readWalletView, renameAccount} from '../accountsStore';
import {fakeExt} from './fakeExt';

const ENV = {
  v: 1,
  scheme: 'slip10',
  kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: 'c2FsdHNhbHRzYWx0c2FsdA=='},
  seed: {iv: 'aXZpdml2aXZpdml2', ct: 'Y3Q='},
  password: {wrapped: 'd3JhcHBlZA=='},
  accounts: [
    {index: 0, name: 'Account 1', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'},
    {index: 1, name: 'Account 2', publicKey: 'EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o'},
  ],
};

describe('accountsStore', () => {
  it('reads the scheme and the accounts, or null without a (well-shaped) wallet', async () => {
    const ext = fakeExt();
    expect(await readWalletView(ext)).toBeNull();
    await ext.local.set(VAULT_KEY, {...ENV, accounts: 'x'});
    expect(await readWalletView(ext)).toBeNull();
    await ext.local.set(VAULT_KEY, ENV);
    expect(await readWalletView(ext)).toEqual({scheme: 'slip10', accounts: ENV.accounts});
  });

  it('cleanName trims, and refuses empty, long, control and bidi-override names', () => {
    expect(cleanName('  Savings  ')).toBe('Savings');
    for (const bad of ['', '   ', 'x'.repeat(33), 'a\nb', 'a\u202eb', 'a\u2066b', 3]) expect(cleanName(bad)).toBeNull();
  });

  it('renames one account and leaves every other byte of the envelope as it was', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    expect(await renameAccount(ext, 1, 'Savings')).toBe(true);
    const after = (await ext.local.get(VAULT_KEY)) as typeof ENV;
    expect(after).toEqual({...ENV, accounts: [ENV.accounts[0], {...ENV.accounts[1], name: 'Savings'}]});
  });

  it('refuses an unknown index and a missing wallet', async () => {
    const ext = fakeExt();
    expect(await renameAccount(ext, 0, 'x')).toBe(false);
    await ext.local.set(VAULT_KEY, ENV);
    expect(await renameAccount(ext, 7, 'x')).toBe(false);
    expect(await ext.local.get(VAULT_KEY)).toEqual(ENV);
  });
});
