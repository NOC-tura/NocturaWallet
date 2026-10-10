import {base64} from '@scure/base';
import {MAX_ACCOUNTS, VAULT_KEY, cleanName, readWalletView, renameAccount, storeEnvelope} from '../accountsStore';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {fakeExt} from './fakeExt';

/** n bytes of `fill`, base64: every byte string in these fixtures has the length a real envelope's has. */
const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
// The public keys SLIP-0010 accounts 0, 1, 2 of the "abandon … about" test phrase derive.
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const K1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const K2 = '7WktogJEd2wQ9eH2oWusmcoFTgeYi6rS632UviTBJ2jm';

const ENV = {
  v: 1,
  scheme: 'slip10',
  kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)},
  seed: {iv: B(12, 2), ct: B(48, 3)},
  password: {wrapped: B(40, 4)},
  accounts: [
    {index: 0, name: 'Account 1', publicKey: K0},
    {index: 1, name: 'Account 2', publicKey: K1},
  ],
};
/** The revision of ENV: what the vault page sends after opening it. */
const REV = envelopeRevision(ENV as Parameters<typeof envelopeRevision>[0]);

describe('accountsStore', () => {
  it('reads the scheme and the accounts, or null without a (well-shaped) wallet', async () => {
    const ext = fakeExt();
    expect(await readWalletView(ext)).toBeNull();
    await ext.local.set(VAULT_KEY, {...ENV, accounts: 'x'});
    expect(await readWalletView(ext)).toBeNull();
    await ext.local.set(VAULT_KEY, ENV);
    expect(await readWalletView(ext)).toEqual({scheme: 'slip10', accounts: ENV.accounts, passkey: false});
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

  // B1b-2b C19: an account name takes the contacts' rule — a zero-width or format character is refused.
  it('C19: a rename carrying a format character (U+200B, U+00AD, U+FEFF) is malformed, nothing written', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    for (const bad of ['Sa​vings', 'Sa­vings', 'Sa﻿vings']) {
      expect(await renameAccount(ext, 1, bad)).toBe('malformed');
      expect(await ext.local.get(VAULT_KEY)).toEqual(ENV);
    }
  });

  // …and a stored name that predates the rule is carried, never refused: storeEnvelope keeps the stored name of every
  // account present in both envelopes (spec C19).
  it('C19: a stored name that predates the rule is kept by an account change', async () => {
    const old = {...ENV, accounts: [{...ENV.accounts[0]!, name: 'Mo​m'}, ENV.accounts[1]!]};
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, old);
    const next = {...old, seed: {iv: B(12, 21), ct: B(48, 22)}, accounts: [...old.accounts, {index: 2, name: 'Account 3', publicKey: K2}]};
    expect(await storeEnvelope(ext, envelopeRevision(old as Parameters<typeof envelopeRevision>[0]), next)).toBe('stored');
    expect(((await ext.local.get(VAULT_KEY)) as typeof ENV).accounts.map(a => a.name)).toEqual(['Mo​m', 'Account 2', 'Account 3']);
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
      seed: {iv: B(12, 5), ct: B(48, 6)},
      accounts: [...ENV.accounts, {index: 2, name: 'Account 3', publicKey: K2}],
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
      const REMOVED = {...ENV, seed: {iv: B(12, 7), ct: B(48, 8)}, accounts: [ENV.accounts[0]]};
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
  const NEXT = {...ENV, seed: {iv: B(12, 5), ct: B(48, 6)}, accounts: [...ENV.accounts, {index: 2, name: 'Account 3', publicKey: K2}]};
  const PASSKEY = {credentialId: B(16, 7), prfSalt: B(32, 8), wrapped: B(40, 9)};

  it('writes the envelope when the stored one is the revision the vault page opened (positive control)', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    expect(await storeEnvelope(ext, REV, NEXT)).toBe('stored');
    expect(await ext.local.get(VAULT_KEY)).toEqual(NEXT);
  });

  it("refuses as 'busy' when the stored envelope changed since the vault page opened it, and writes nothing", async () => {
    const ext = fakeExt();
    const OTHER_WRITE = {...ENV, seed: {iv: B(12, 10), ct: B(48, 11)}};
    await ext.local.set(VAULT_KEY, OTHER_WRITE);
    expect(await storeEnvelope(ext, REV, NEXT)).toBe('busy');
    expect(await ext.local.get(VAULT_KEY)).toEqual(OTHER_WRITE);
  });

  it("a passkey enrolment between open and store (same seed ciphertext, a new wrap) makes the store 'busy'", async () => {
    const ext = fakeExt();
    const ENROLLED = {...ENV, passkey: PASSKEY};
    await ext.local.set(VAULT_KEY, ENROLLED);
    expect(ENROLLED.seed).toEqual(ENV.seed);
    expect(await storeEnvelope(ext, REV, NEXT)).toBe('busy');
    expect(await ext.local.get(VAULT_KEY)).toEqual(ENROLLED);
    // …and so does a changed password wrap.
    const REWRAPPED = {...ENV, password: {wrapped: B(40, 12)}};
    await ext.local.set(VAULT_KEY, REWRAPPED);
    expect(await storeEnvelope(ext, REV, NEXT)).toBe('busy');
    expect(await ext.local.get(VAULT_KEY)).toEqual(REWRAPPED);
  });

  it("a rename between open and store does not make it 'busy' (names are outside the revision), and the new name is kept", async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    expect(await renameAccount(ext, 0, 'Savings')).toBe('renamed');
    expect(await storeEnvelope(ext, REV, NEXT)).toBe('stored');
    expect(((await ext.local.get(VAULT_KEY)) as typeof NEXT).accounts.map(a => a.name)).toEqual(['Savings', 'Account 2', 'Account 3']);
  });

  it("refuses without a wallet: 'no-wallet', and nothing is written", async () => {
    const ext = fakeExt();
    expect(await storeEnvelope(ext, REV, NEXT)).toBe('no-wallet');
    expect(await ext.local.get(VAULT_KEY)).toBeUndefined();
  });

  it("refuses a change of scheme or of the KDF salt against the stored envelope as 'malformed'", async () => {
    for (const env of [
      {...NEXT, kdf: {...NEXT.kdf, salt: B(16, 13)}},
      {...NEXT, scheme: 'cli', accounts: [{index: 0, name: 'Account 1', publicKey: K0}]},
    ]) {
      const ext = fakeExt();
      await ext.local.set(VAULT_KEY, ENV);
      expect(await storeEnvelope(ext, REV, env)).toBe('malformed');
      expect(await ext.local.get(VAULT_KEY)).toEqual(ENV);
    }
  });

  it("refuses a change of kdf m/t/p, of an existing account's public key, or of the password wrap — nothing written, the stored envelope byte-identical", async () => {
    for (const env of [
      {...NEXT, kdf: {...NEXT.kdf, t: 4}},
      {...NEXT, kdf: {...NEXT.kdf, m: 131072}},
      {...NEXT, kdf: {...NEXT.kdf, p: 2}},
      {...NEXT, accounts: [{...NEXT.accounts[0]!, publicKey: K2}, NEXT.accounts[1]!, {...NEXT.accounts[2]!, publicKey: K0}]},
      {...NEXT, accounts: [NEXT.accounts[0]!, {...NEXT.accounts[1]!, publicKey: K2}]},
      {...NEXT, password: {wrapped: B(40, 14)}},
    ]) {
      const ext = fakeExt();
      await ext.local.set(VAULT_KEY, ENV);
      const before = JSON.stringify(await ext.local.get(VAULT_KEY));
      expect([env, await storeEnvelope(ext, REV, env)]).toEqual([env, 'malformed']);
      expect(JSON.stringify(await ext.local.get(VAULT_KEY))).toBe(before);
    }
  });

  it("answers 'stored-invalid' (not 'busy') when the stored envelope itself is not well formed, and writes nothing", async () => {
    for (const stored of [{...ENV, seed: 'damaged'}, {...ENV, kdf: {...ENV.kdf, m: 1}}, {...ENV, accounts: []}, {...ENV, password: {wrapped: B(39, 4)}}]) {
      const ext = fakeExt();
      await ext.local.set(VAULT_KEY, stored);
      const before = JSON.stringify(await ext.local.get(VAULT_KEY));
      expect(await storeEnvelope(ext, REV, NEXT)).toBe('stored-invalid');
      expect(JSON.stringify(await ext.local.get(VAULT_KEY))).toBe(before);
    }
  });

  it('a passkey enrolment (only the passkey wrap changes) and a removal still store (positive controls)', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    expect(await storeEnvelope(ext, REV, {...ENV, passkey: PASSKEY})).toBe('stored');
    const enrolled = {...ENV, passkey: PASSKEY};
    expect(await ext.local.get(VAULT_KEY)).toEqual(enrolled);
    const reEnrolled = {...ENV, passkey: {...PASSKEY, wrapped: B(40, 15), prfSalt: B(32, 16)}};
    expect(await storeEnvelope(ext, envelopeRevision(enrolled as Parameters<typeof envelopeRevision>[0]), reEnrolled)).toBe('stored');
    const removed = {...reEnrolled, seed: {iv: B(12, 17), ct: B(48, 18)}, accounts: [ENV.accounts[0]!]};
    expect(await storeEnvelope(ext, envelopeRevision(reEnrolled as Parameters<typeof envelopeRevision>[0]), removed)).toBe('stored');
    expect(await ext.local.get(VAULT_KEY)).toEqual(removed);
  });

  it('the first write (expectedRevision null) stores the envelope while no wallet exists, every name cleaned', async () => {
    const ext = fakeExt();
    const sent = {...NEXT, accounts: [{...NEXT.accounts[0]!, name: '  Main  '}, NEXT.accounts[1]!, NEXT.accounts[2]!]};
    expect(await storeEnvelope(ext, null, sent)).toBe('stored');
    expect(await ext.local.get(VAULT_KEY)).toEqual({...NEXT, accounts: [{...NEXT.accounts[0]!, name: 'Main'}, NEXT.accounts[1]!, NEXT.accounts[2]!]});
    const cli = fakeExt();
    const CLI = {...ENV, scheme: 'cli', accounts: [{index: 0, name: 'Account 1', publicKey: K0}]};
    expect(await storeEnvelope(cli, null, CLI)).toBe('stored');
    expect(await cli.local.get(VAULT_KEY)).toEqual(CLI);
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
    const other = {...NEXT, seed: {iv: B(12, 10), ct: B(48, 11)}};
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
    expect(await storeEnvelope(ext, REV, NEXT)).toBe('stored');
    const after = (await ext.local.get(VAULT_KEY)) as typeof NEXT;
    expect(after.accounts.map(a => a.name)).toEqual(['Savings', 'Account 2', 'Account 3']);
    expect(after.seed).toEqual(NEXT.seed);
  });

  it("a new account's name is stored cleaned; an existing account's stored name is kept even if a rename would refuse it", async () => {
    const ext = fakeExt();
    const legacy = {...ENV, accounts: [{...ENV.accounts[0]!, name: ''}, ENV.accounts[1]!]};
    await ext.local.set(VAULT_KEY, legacy);
    const sent = {...NEXT, accounts: [{...NEXT.accounts[0]!, name: ''}, NEXT.accounts[1]!, {...NEXT.accounts[2]!, name: '  Trading  '}]};
    expect(await storeEnvelope(ext, REV, sent)).toBe('stored');
    expect(((await ext.local.get(VAULT_KEY)) as typeof NEXT).accounts.map(a => a.name)).toEqual(['', 'Account 2', 'Trading']);
  });

  it('keeps no field the vault page added beyond the envelope shape', async () => {
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, ENV);
    const extra = {...NEXT, mnemonic: 'abandon', accounts: NEXT.accounts.map(a => ({...a, secretKey: 'k'}))};
    expect(await storeEnvelope(ext, REV, extra)).toBe('stored');
    expect(await ext.local.get(VAULT_KEY)).toEqual(NEXT);
    const withPasskey = {...NEXT, passkey: {...PASSKEY, x: 1}};
    await ext.local.set(VAULT_KEY, ENV);
    expect(await storeEnvelope(ext, REV, withPasskey)).toBe('stored');
    expect(((await ext.local.get(VAULT_KEY)) as {passkey: unknown}).passkey).toEqual(PASSKEY);
  });

  it("refuses anything not envelope-shaped — the vault's own bounds and lengths — as 'malformed', and writes nothing", async () => {
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
      {...NEXT, kdf: {...NEXT.kdf, t: 3.5}},
      {...NEXT, kdf: {...NEXT.kdf, m: 65535}},
      {...NEXT, kdf: {...NEXT.kdf, m: 1024 * 1024 + 1}},
      {...NEXT, kdf: {...NEXT.kdf, t: 2}},
      {...NEXT, kdf: {...NEXT.kdf, t: 11}},
      {...NEXT, kdf: {...NEXT.kdf, p: 0}},
      {...NEXT, kdf: {...NEXT.kdf, p: 5}},
      {...NEXT, kdf: {...NEXT.kdf, salt: 1}},
      {...NEXT, kdf: {...NEXT.kdf, salt: B(15, 1)}},
      {...NEXT, kdf: {...NEXT.kdf, salt: B(17, 1)}},
      {...NEXT, kdf: {...NEXT.kdf, salt: 'not base64!'}},
      {...NEXT, seed: {iv: B(12, 5)}},
      {...NEXT, seed: {iv: 1, ct: B(48, 6)}},
      {...NEXT, seed: {iv: B(11, 5), ct: B(48, 6)}},
      {...NEXT, seed: {iv: B(13, 5), ct: B(48, 6)}},
      {...NEXT, seed: {iv: B(12, 5), ct: B(16, 6)}},
      {...NEXT, password: undefined},
      {...NEXT, password: {wrapped: 7}},
      {...NEXT, password: {wrapped: B(39, 4)}},
      {...NEXT, password: {wrapped: B(41, 4)}},
      {...NEXT, passkey: {credentialId: PASSKEY.credentialId, prfSalt: PASSKEY.prfSalt}},
      {...NEXT, passkey: null},
      {...NEXT, passkey: {...PASSKEY, credentialId: ''}},
      {...NEXT, passkey: {...PASSKEY, prfSalt: B(31, 8)}},
      {...NEXT, passkey: {...PASSKEY, wrapped: B(39, 9)}},
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
      expect([env, await storeEnvelope(ext, REV, env)]).toEqual([env, 'malformed']);
      expect(await ext.local.get(VAULT_KEY)).toEqual(ENV);
    }
    for (const revision of [7, undefined, 'abc', REV.toUpperCase(), `${REV}0`]) {
      const ext = fakeExt();
      await ext.local.set(VAULT_KEY, ENV);
      expect(await storeEnvelope(ext, revision, NEXT)).toBe('malformed');
      expect(await ext.local.get(VAULT_KEY)).toEqual(ENV);
    }
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
      const store = () => storeEnvelope(ext, REV, NEXT);
      const [a, b] = renameFirst ? await Promise.all([rename(), store()]) : (await Promise.all([store(), rename()])).reverse();
      expect([a, b]).toEqual(['renamed', 'stored']);
      const after = (await get(VAULT_KEY)) as typeof NEXT;
      expect(after.seed).toEqual(NEXT.seed);
      expect(after.accounts.map(x => x.name)).toEqual(['Account 1', 'Savings', 'Account 3']);
    }
  });
});
