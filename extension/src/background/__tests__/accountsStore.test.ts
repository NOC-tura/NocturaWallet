import {MAX_ACCOUNTS, VAULT_KEY, cleanName, readWalletView, renameAccount, storeEnvelope} from '../accountsStore';
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
    // Since Task 11 the background is the one writer of v1_vault (storeEnvelope, under the same
    // mutex), so these simulate a writer outside that mutex: the compare-and-set is a second line.
    // A rename that read the envelope before such a write must not put the old envelope back after it.
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

describe('storeEnvelope (the vault page hands the background a re-encrypted envelope; the background is the one writer)', () => {
  // What the vault page sends after adding account 2: a new seed ciphertext, the same wraps.
  const NEXT = {
    ...ENV,
    seed: {iv: 'bmV3bmV3bmV3bmV3', ct: 'bmV3Y3Q='},
    accounts: [...ENV.accounts, {index: 2, name: 'Account 3', publicKey: '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4'}],
  };

  it('writes the envelope when the stored seed is the one the vault page re-encrypted (positive control)', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    expect(await storeEnvelope(ext, ENV.seed.ct, NEXT)).toBe('stored');
    expect(await ext.local.get(VAULT_KEY)).toEqual(NEXT);
  });

  it("refuses as 'busy' when the stored seed changed since the vault page read it, and writes nothing", async () => {
    const ext = fakeExt();
    const OTHER_WRITE = {...ENV, seed: {iv: 'b3RoZXJvdGhlcm90', ct: 'b3RoZXI='}};
    await ext.local.set(VAULT_KEY, OTHER_WRITE);
    expect(await storeEnvelope(ext, ENV.seed.ct, NEXT)).toBe('busy');
    expect(await ext.local.get(VAULT_KEY)).toEqual(OTHER_WRITE);
  });

  it("refuses without a wallet: 'no-wallet', and nothing is written", async () => {
    const ext = fakeExt();
    expect(await storeEnvelope(ext, ENV.seed.ct, NEXT)).toBe('no-wallet');
    expect(await ext.local.get(VAULT_KEY)).toBeUndefined();
  });

  it('the first write (expectedSeedCt null) stores the envelope while no wallet exists, every name cleaned', async () => {
    const ext = fakeExt();
    const sent = {...NEXT, accounts: [{...NEXT.accounts[0]!, name: '  Main  '}, NEXT.accounts[1]!, NEXT.accounts[2]!]};
    expect(await storeEnvelope(ext, null, sent)).toBe('stored');
    expect(await ext.local.get(VAULT_KEY)).toEqual({...NEXT, accounts: [{...NEXT.accounts[0]!, name: 'Main'}, NEXT.accounts[1]!, NEXT.accounts[2]!]});
  });

  it("the first write never overwrites a wallet: 'wallet-exists', the stored envelope byte-identical", async () => {
    for (const stored of [ENV, {...ENV, seed: 'damaged'}, 'not an envelope', null]) {
      const ext = fakeExt();
      await ext.local.set(VAULT_KEY, stored);
      const before = JSON.stringify(await ext.local.get(VAULT_KEY));
      expect(await storeEnvelope(ext, null, NEXT)).toBe('wallet-exists');
      expect(JSON.stringify(await ext.local.get(VAULT_KEY))).toBe(before);
    }
  });

  it('two first writes racing: exactly one is stored, the other is refused as wallet-exists', async () => {
    const ext = fakeExt();
    const {get, set} = ext.local;
    const tick = () => new Promise(r => setTimeout(r, 0));
    ext.local.get = async k => {
      await tick();
      return get(k);
    };
    ext.local.set = async (k, v) => {
      await tick();
      await tick();
      return set(k, v);
    };
    const other = {...NEXT, seed: {iv: 'b3RoZXJvdGhlcm90', ct: 'b3RoZXI='}};
    expect(await Promise.all([storeEnvelope(ext, null, NEXT), storeEnvelope(ext, null, other)])).toEqual(['stored', 'wallet-exists']);
    expect(await get(VAULT_KEY)).toEqual(NEXT);
  });

  it("the first write cleans every name: one a rename would refuse is 'malformed', and nothing is written", async () => {
    const ext = fakeExt();
    for (const name of ['a\u202eb', '   ', 'x'.repeat(33)]) {
      expect(await storeEnvelope(ext, null, {...NEXT, accounts: [{...NEXT.accounts[0]!, name}]})).toBe('malformed');
      expect(await ext.local.get(VAULT_KEY)).toBeUndefined();
    }
    expect(await storeEnvelope(ext, null, {...NEXT, v: 2})).toBe('malformed');
    expect(await ext.local.get(VAULT_KEY)).toBeUndefined();
  });

  it('keeps the current name of every account present in both (names are outside the AAD); new accounts keep theirs', async () => {
    const ext = fakeExt();
    const renamed = {...ENV, accounts: [{...ENV.accounts[0]!, name: 'Savings'}, ENV.accounts[1]!]};
    await ext.local.set(VAULT_KEY, renamed);
    expect(await storeEnvelope(ext, ENV.seed.ct, NEXT)).toBe('stored');
    const after = (await ext.local.get(VAULT_KEY)) as typeof NEXT;
    expect(after.accounts.map(a => a.name)).toEqual(['Savings', 'Account 2', 'Account 3']);
    expect(after.seed).toEqual(NEXT.seed);
  });

  it("a new account's name is stored cleaned; an existing account's stored name is kept even if a rename would refuse it", async () => {
    const ext = fakeExt();
    const legacy = {...ENV, accounts: [{...ENV.accounts[0]!, name: ''}, ENV.accounts[1]!]};
    await ext.local.set(VAULT_KEY, legacy);
    const sent = {...NEXT, accounts: [{...NEXT.accounts[0]!, name: ''}, NEXT.accounts[1]!, {...NEXT.accounts[2]!, name: '  Trading  '}]};
    expect(await storeEnvelope(ext, ENV.seed.ct, sent)).toBe('stored');
    expect(((await ext.local.get(VAULT_KEY)) as typeof NEXT).accounts.map(a => a.name)).toEqual(['', 'Account 2', 'Trading']);
  });

  it('keeps no field the vault page added beyond the envelope shape', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    const extra = {...NEXT, mnemonic: 'abandon', accounts: NEXT.accounts.map(a => ({...a, secretKey: 'k'}))};
    expect(await storeEnvelope(ext, ENV.seed.ct, extra)).toBe('stored');
    expect(await ext.local.get(VAULT_KEY)).toEqual(NEXT);
    const withPasskey = {...NEXT, passkey: {credentialId: 'Y3JlZA==', prfSalt: 'c2FsdA==', wrapped: 'd3JhcA==', x: 1}};
    await ext.local.set(VAULT_KEY, ENV);
    expect(await storeEnvelope(ext, ENV.seed.ct, withPasskey)).toBe('stored');
    expect(((await ext.local.get(VAULT_KEY)) as {passkey: unknown}).passkey).toEqual({credentialId: 'Y3JlZA==', prfSalt: 'c2FsdA==', wrapped: 'd3JhcA=='});
  });

  it("refuses anything not envelope-shaped as 'malformed', and writes nothing", async () => {
    const acc = NEXT.accounts[0]!;
    const many = Array.from({length: MAX_ACCOUNTS + 1}, (_, i) => ({index: i, name: `Account ${i + 1}`, publicKey: `k${i}`}));
    const bad: unknown[] = [
      null,
      'x',
      [],
      {...NEXT, v: 2},
      {...NEXT, scheme: 'bip32'},
      {...NEXT, kdf: {...NEXT.kdf, alg: 'scrypt'}},
      {...NEXT, kdf: {...NEXT.kdf, m: '65536'}},
      {...NEXT, kdf: {...NEXT.kdf, t: 1.5}},
      {...NEXT, kdf: {...NEXT.kdf, salt: 1}},
      {...NEXT, seed: {iv: 'aXY='}},
      {...NEXT, seed: {iv: 1, ct: 'Y3Q='}},
      {...NEXT, password: undefined},
      {...NEXT, password: {wrapped: 7}},
      {...NEXT, passkey: {credentialId: 'x', prfSalt: 'y'}},
      {...NEXT, passkey: null},
      {...NEXT, accounts: []},
      {...NEXT, accounts: many},
      {...NEXT, accounts: 'x'},
      {...NEXT, accounts: [{...acc, index: -1}]},
      {...NEXT, accounts: [{...acc, index: 0.5}]},
      {...NEXT, accounts: [{...acc, name: 3}]},
      {...NEXT, accounts: [acc, NEXT.accounts[1]!, {...NEXT.accounts[2]!, name: 'a\u202eb'}]},
      {...NEXT, accounts: [acc, NEXT.accounts[1]!, {...NEXT.accounts[2]!, name: '   '}]},
      {...NEXT, accounts: [{...acc, publicKey: ''}]},
      {...NEXT, accounts: [acc, {...NEXT.accounts[1]!, index: 0}]},
      {...NEXT, scheme: 'cli'},
    ];
    for (const env of bad) {
      const ext = fakeExt();
      await ext.local.set(VAULT_KEY, ENV);
      expect(await storeEnvelope(ext, ENV.seed.ct, env)).toBe('malformed');
      expect(await ext.local.get(VAULT_KEY)).toEqual(ENV);
    }
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    expect(await storeEnvelope(ext, 7, NEXT)).toBe('malformed');
    expect(await ext.local.get(VAULT_KEY)).toEqual(ENV);
  });

  it('a rename and a store that interleave lose neither: the new account and the new name both survive, in either order', async () => {
    for (const renameFirst of [true, false]) {
      const ext = fakeExt();
      await ext.local.set(VAULT_KEY, ENV);
      // Storage is slow, writes slower than reads (one task per read, two per write): unserialised,
      // a store's write would land between a rename's compare and its write, and be undone by it.
      const {get, set} = ext.local;
      const tick = () => new Promise(r => setTimeout(r, 0));
      ext.local.get = async k => {
        await tick();
        return get(k);
      };
      ext.local.set = async (k, v) => {
        await tick();
        await tick();
        return set(k, v);
      };
      const rename = () => renameAccount(ext, 1, 'Savings');
      const store = () => storeEnvelope(ext, ENV.seed.ct, NEXT);
      const [a, b] = renameFirst ? await Promise.all([rename(), store()]) : (await Promise.all([store(), rename()])).reverse();
      expect([a, b]).toEqual(['renamed', 'stored']);
      const after = (await get(VAULT_KEY)) as typeof NEXT;
      expect(after.seed).toEqual(NEXT.seed);
      expect(after.accounts.map(x => x.name)).toEqual(['Account 1', 'Savings', 'Account 3']);
    }
  });
});
