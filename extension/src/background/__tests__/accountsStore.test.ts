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
    expect(await renameAccount(ext, 1, 'Savings')).toBe('renamed');
    const after = (await ext.local.get(VAULT_KEY)) as typeof ENV;
    expect(after).toEqual({...ENV, accounts: [ENV.accounts[0], {...ENV.accounts[1], name: 'Savings'}]});
  });

  it('cleans the name itself: stores it trimmed, and refuses a control or bidi-override name untouched', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    for (const bad of ['a\u202eb', 'a\u2066b', 'a\nb', '   ', 'x'.repeat(33)]) {
      expect(await renameAccount(ext, 1, bad)).toBe('malformed');
      expect(await ext.local.get(VAULT_KEY)).toEqual(ENV);
    }
    expect(await renameAccount(ext, 1, '  Savings  ')).toBe('renamed');
    expect(((await ext.local.get(VAULT_KEY)) as typeof ENV).accounts[1]?.name).toBe('Savings');
  });

  it('refuses an unknown index and a missing wallet', async () => {
    const ext = fakeExt();
    expect(await renameAccount(ext, 0, 'x')).toBe('unknown-account');
    await ext.local.set(VAULT_KEY, ENV);
    expect(await renameAccount(ext, 7, 'x')).toBe('unknown-account');
    expect(await ext.local.get(VAULT_KEY)).toEqual(ENV);
  });

  describe('compare-and-set against the vault page (ruling 7)', () => {
    // The vault page (Task 11) rewrites v1_vault when it adds or removes an account. A rename that
    // read the envelope before that write must not put the old envelope back after it.
    const ADDED = {
      ...ENV,
      seed: {iv: 'bmV3bmV3bmV3bmV3', ct: 'bmV3'},
      accounts: [...ENV.accounts, {index: 2, name: 'Account 3', publicKey: '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4'}],
    };

    /** The vault page's write lands right after the rename's first read of v1_vault. */
    function interleaved(write: unknown) {
      const ext = fakeExt();
      const get = ext.local.get;
      let first = true;
      ext.local.get = async k => {
        const v = await get(k);
        if (k === VAULT_KEY && first) {
          first = false;
          await ext.local.set(VAULT_KEY, write);
        }
        return v;
      };
      return ext;
    }

    it('a concurrent add is kept: the rename is redone on the fresh envelope', async () => {
      const ext = interleaved(ADDED);
      await ext.local.set(VAULT_KEY, ENV);
      expect(await renameAccount(ext, 1, 'Savings')).toBe('renamed');
      expect(await ext.local.get(VAULT_KEY)).toEqual({...ADDED, accounts: [ADDED.accounts[0], {...ADDED.accounts[1], name: 'Savings'}, ADDED.accounts[2]]});
    });

    it('a concurrent remove of the renamed account renames nothing and restores nothing', async () => {
      const REMOVED = {...ENV, seed: {iv: 'b2xkb2xkb2xkb2xk', ct: 'b2xk'}, accounts: [ENV.accounts[0]]};
      const ext = interleaved(REMOVED);
      await ext.local.set(VAULT_KEY, ENV);
      expect(await renameAccount(ext, 1, 'Savings')).toBe('unknown-account');
      expect(await ext.local.get(VAULT_KEY)).toEqual(REMOVED);
    });

    it('an envelope that changes on every read is refused as busy after one retry, and left as the vault page wrote it', async () => {
      const ext = fakeExt();
      await ext.local.set(VAULT_KEY, ENV);
      const get = ext.local.get;
      let rev = 0;
      let reads = 0;
      ext.local.get = async k => {
        const v = await get(k);
        if (k === VAULT_KEY) {
          reads += 1;
          await ext.local.set(VAULT_KEY, {...ENV, rev: ++rev});
        }
        return v;
      };
      expect(await renameAccount(ext, 1, 'Savings')).toBe('busy');
      expect(reads).toBe(3);
      expect(await get(VAULT_KEY)).toEqual({...ENV, rev: 3});
    });
  });
});
