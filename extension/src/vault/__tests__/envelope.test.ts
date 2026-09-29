import {argon2idAsync} from '@noble/hashes/argon2.js';
import {
  createEnvelope, unlockWithPassword, decryptMnemonic, addPasskeyWrap, unlockWithPrf,
  CorruptEnvelope, UnsafeKdfParams, WrongPassword, WrongPasskey, KDF_CAP, PRODUCTION_KDF, type EnvelopeV1, type Kdf,
} from '../envelope';
import {reencryptForAccounts} from '../reencrypt';
import {MAX_ACCOUNTS} from '../../shared/envelopeRules';
import * as accountsModule from '../accounts';
import * as transparentModule from '../../../../core/keys/transparent';
import * as mnemonicModule from '../../../../core/keys/mnemonic';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
// The envelope refuses Argon2id parameters below production (spec §2), so every envelope here
// DECLARES the production cost; this test KDF computes Argon2id at a tiny cost instead, so a
// test runs in milliseconds. The production KDF's parameter mapping is pinned by envelopeKat.
const kdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});
// The public keys the "abandon … about" phrase derives: SLIP-0010 accounts 0 and 1, and cli.
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const K1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const KCLI = 'EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o';
const accounts = [{index: 0, name: 'Account 1', publicKey: K0}];

describe('vault envelope', () => {
  it('production Argon2id parameters are the spec values', () => {
    expect(PRODUCTION_KDF).toEqual({m: 65536, t: 3, p: 1});
  });

  it('round-trips the mnemonic with the right password', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    expect(await decryptMnemonic(env, dk)).toBe(MNEMONIC);
  });

  it('refuses the wrong password', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    await expect(unlockWithPassword(env, 'wrong horse battery!', kdf)).rejects.toBeInstanceOf(WrongPassword);
  });

  // Fable re-review: an envelope always carries at least one account from creation — nothing
  // downstream (unlockFlow's account-matching, the popup's account list) is meant to handle a
  // wallet with zero accounts, so refuse to create one rather than store data nothing can use.
  it('refuses to create an envelope with no accounts', async () => {
    await expect(createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts: [], kdf})).rejects.toThrow(
      /at least one account/,
    );
  });

  it('stores nothing in the clear', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const json = JSON.stringify(env);
    expect(json).not.toContain('abandon');
    expect(json).not.toContain('correct horse');
  });

  it('two envelopes of one seed share no salt, IV or ciphertext', async () => {
    const a = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const b = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.seed.iv).not.toBe(b.seed.iv);
    expect(a.seed.ct).not.toBe(b.seed.ct);
  });

  it('a passkey wrap unlocks the same data key; a different PRF output does not', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const withPk = await addPasskeyWrap(env, dk, prf, new Uint8Array([1, 2, 3]), crypto.getRandomValues(new Uint8Array(32)));
    expect(await decryptMnemonic(withPk, await unlockWithPrf(withPk, prf))).toBe(MNEMONIC);
    await expect(unlockWithPrf(withPk, crypto.getRandomValues(new Uint8Array(32)))).rejects.toBeInstanceOf(WrongPasskey);
  });

  it('refuses a PRF salt or PRF output that is not exactly 32 bytes', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    const goodPrf = crypto.getRandomValues(new Uint8Array(32));
    const goodSalt = crypto.getRandomValues(new Uint8Array(32));
    const shortPrf = crypto.getRandomValues(new Uint8Array(16));
    const shortSalt = crypto.getRandomValues(new Uint8Array(16));
    await expect(addPasskeyWrap(env, dk, shortPrf, new Uint8Array([1, 2, 3]), goodSalt)).rejects.toThrow();
    await expect(addPasskeyWrap(env, dk, goodPrf, new Uint8Array([1, 2, 3]), shortSalt)).rejects.toThrow();
  });

  it('refuses to wrap a data key that does not decrypt this envelope', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const wrongDataKey = crypto.getRandomValues(new Uint8Array(32));
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(32));
    await expect(addPasskeyWrap(env, wrongDataKey, prf, new Uint8Array([1, 2, 3]), salt)).rejects.toThrow();
  });

  it('does not zero the caller\'s data key when wrapping it for a passkey', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    const dkCopy = dk.slice();
    const prf = crypto.getRandomValues(new Uint8Array(32));
    await addPasskeyWrap(env, dk, prf, new Uint8Array([1, 2, 3]), crypto.getRandomValues(new Uint8Array(32)));
    expect(Array.from(dk)).toEqual(Array.from(dkCopy));
  });

  it('refuses a tampered ciphertext', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    const ct = env.seed.ct;
    const flipped = {...env, seed: {...env.seed, ct: (ct[0] === 'A' ? 'B' : 'A') + ct.slice(1)}};
    await expect(decryptMnemonic(flipped, dk)).rejects.toThrow();
  });

  it('zeroes the array the KDF returned to createEnvelope, not a copy of it', async () => {
    let captured: Uint8Array | undefined;
    const spyKdf: Kdf = async (pw, salt, p) => {
      const out = await kdf(pw, salt, p);
      captured = out;
      return out;
    };
    await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf: spyKdf});
    if (!captured) throw new Error('kdf was not called');
    expect(Array.from(captured)).toEqual(new Array(captured.length).fill(0));
  });

  it('zeroes the array the KDF returned to unlockWithPassword, on the right password and on the wrong one', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});

    let capturedOk: Uint8Array | undefined;
    const spyKdfOk: Kdf = async (pw, salt, p) => {
      const out = await kdf(pw, salt, p);
      capturedOk = out;
      return out;
    };
    await unlockWithPassword(env, 'correct horse battery', spyKdfOk);
    if (!capturedOk) throw new Error('kdf was not called');
    expect(Array.from(capturedOk)).toEqual(new Array(capturedOk.length).fill(0));

    let capturedWrong: Uint8Array | undefined;
    const spyKdfWrong: Kdf = async (pw, salt, p) => {
      const out = await kdf(pw, salt, p);
      capturedWrong = out;
      return out;
    };
    await expect(unlockWithPassword(env, 'wrong horse battery!', spyKdfWrong)).rejects.toBeInstanceOf(WrongPassword);
    if (!capturedWrong) throw new Error('kdf was not called');
    expect(Array.from(capturedWrong)).toEqual(new Array(capturedWrong.length).fill(0));
  });

  it('zeroes the decrypted plaintext bytes after decoding them', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    const seen: Uint8Array[] = [];
    const real = TextDecoder.prototype.decode;
    const spy = vi.spyOn(TextDecoder.prototype, 'decode').mockImplementation(function (this: TextDecoder, input?: AllowSharedBufferSource) {
      if (input instanceof Uint8Array) seen.push(input);
      else if (input instanceof ArrayBuffer) seen.push(new Uint8Array(input));
      return real.call(this, input);
    });
    try {
      expect(await decryptMnemonic(env, dk)).toBe(MNEMONIC);
    } finally {
      spy.mockRestore();
    }
    expect(seen).toHaveLength(1);
    expect(seen[0]?.length).toBe(MNEMONIC.length);
    expect(Array.from(seen[0] ?? [])).toEqual(new Array(MNEMONIC.length).fill(0));
  });

  it('zeroes the encoded mnemonic bytes once createEnvelope has encrypted them', async () => {
    const seen: Uint8Array[] = [];
    const real = TextEncoder.prototype.encode;
    const spy = vi.spyOn(TextEncoder.prototype, 'encode').mockImplementation(function (this: TextEncoder, input?: string) {
      const out = real.call(this, input);
      if (input === MNEMONIC) seen.push(out);
      return out;
    });
    let env: Awaited<ReturnType<typeof createEnvelope>>;
    try {
      env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    } finally {
      spy.mockRestore();
    }
    expect(seen).toHaveLength(1);
    expect(Array.from(seen[0] ?? [])).toEqual(new Array(MNEMONIC.length).fill(0));
    // Zeroing happened after encryption, not before: the envelope still opens to the phrase.
    expect(await decryptMnemonic(env, await unlockWithPassword(env, 'correct horse battery', kdf))).toBe(MNEMONIC);
  });

  it('zeroes the encoded mnemonic bytes even when createEnvelope fails', async () => {
    const seen: Uint8Array[] = [];
    const real = TextEncoder.prototype.encode;
    const spy = vi.spyOn(TextEncoder.prototype, 'encode').mockImplementation(function (this: TextEncoder, input?: string) {
      const out = real.call(this, input);
      if (input === MNEMONIC) seen.push(out);
      return out;
    });
    const failing: Kdf = async () => {
      throw new Error('kdf failed');
    };
    try {
      await expect(createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf: failing})).rejects.toThrow('kdf failed');
    } finally {
      spy.mockRestore();
    }
    expect(seen).toHaveLength(1);
    expect(Array.from(seen[0] ?? [])).toEqual(new Array(MNEMONIC.length).fill(0));
  });
});

// Fable review (Minor 12): only an AES-KW integrity failure on a WELL-FORMED wrapped key means
// a wrong password or passkey. Damaged stored data must say so, not look like a typo: the
// person would otherwise keep retrying (and walk into the wrong-password backoff) forever.
describe('a malformed envelope is CorruptEnvelope, never a wrong factor', () => {
  let env: EnvelopeV1;
  const prf = new Uint8Array(32).fill(5);
  beforeAll(async () => {
    const base = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const dk = await unlockWithPassword(base, 'correct horse battery', kdf);
    env = await addPasskeyWrap(base, dk, prf.slice(), new Uint8Array([1, 2, 3]), new Uint8Array(32).fill(9));
  });
  const neverKdf: Kdf = async () => {
    throw new Error('the KDF must not run on a malformed envelope');
  };
  const edit = (f: (e: Record<string, unknown>) => void): EnvelopeV1 => {
    const copy = JSON.parse(JSON.stringify(env)) as Record<string, unknown>;
    f(copy);
    return copy as unknown as EnvelopeV1;
  };

  it.each(['AAAA', '!!!not-base64', '', 'AA=='])('password.wrapped %j → CorruptEnvelope, without running the KDF', async wrapped => {
    await expect(unlockWithPassword({...env, password: {wrapped}}, 'correct horse battery', neverKdf)).rejects.toBeInstanceOf(CorruptEnvelope);
  });

  it.each(['AAAA', '!!!not-base64'])('passkey.wrapped %j → CorruptEnvelope', async wrapped => {
    const pk = env.passkey;
    if (!pk) throw new Error('no passkey wrap');
    await expect(unlockWithPrf({...env, passkey: {...pk, wrapped}}, prf.slice())).rejects.toBeInstanceOf(CorruptEnvelope);
  });

  it.each<[string, (e: Record<string, unknown>) => void]>([
    ['v is not 1', e => void (e.v = 2)],
    ['an unknown scheme', e => void (e.scheme = 'bip44')],
    ['no kdf', e => void delete e.kdf],
    ['a kdf.alg other than argon2id', e => void ((e.kdf as Record<string, unknown>).alg = 'scrypt')],
    ['kdf.m as a string', e => void ((e.kdf as Record<string, unknown>).m = '65536')],
    ['kdf.t fractional', e => void ((e.kdf as Record<string, unknown>).t = 1.5)],
    ['a short kdf.salt', e => void ((e.kdf as Record<string, unknown>).salt = 'AAAA')],
    ['kdf.salt not base64', e => void ((e.kdf as Record<string, unknown>).salt = '!!!not-base64')],
    ['a short seed.iv', e => void ((e.seed as Record<string, unknown>).iv = 'AAAA')],
    ['seed.ct not base64', e => void ((e.seed as Record<string, unknown>).ct = '!!!not-base64')],
    ['a seed.ct shorter than the GCM tag', e => void ((e.seed as Record<string, unknown>).ct = 'AAAA')],
    ['no password wrap', e => void delete e.password],
    ['accounts not an array', e => void (e.accounts = {})],
    ['accounts is empty', e => void (e.accounts = [])],
    ['an account with a negative index', e => void (e.accounts = [{index: -1, name: 'a', publicKey: 'x'}])],
    ['an account without a public key', e => void (e.accounts = [{index: 0, name: 'a'}])],
    ['a short passkey.prfSalt', e => void ((e.passkey as Record<string, unknown>).prfSalt = 'AAAA')],
    ['an empty passkey.credentialId', e => void ((e.passkey as Record<string, unknown>).credentialId = '')],
  ])('%s → CorruptEnvelope on the password path, the passkey path and decrypt', async (_, f) => {
    const bad = edit(f);
    await expect(unlockWithPassword(bad, 'correct horse battery', neverKdf)).rejects.toBeInstanceOf(CorruptEnvelope);
    await expect(unlockWithPrf(bad, prf.slice())).rejects.toBeInstanceOf(CorruptEnvelope);
    await expect(decryptMnemonic(bad, new Uint8Array(32))).rejects.toBeInstanceOf(CorruptEnvelope);
  });

  it('refuses a stored value that is not an object at all', async () => {
    await expect(unlockWithPassword(null as unknown as EnvelopeV1, 'x', neverKdf)).rejects.toBeInstanceOf(CorruptEnvelope);
    await expect(unlockWithPassword('v1' as unknown as EnvelopeV1, 'x', neverKdf)).rejects.toBeInstanceOf(CorruptEnvelope);
  });

  it('a well-formed envelope still says WrongPassword / WrongPasskey for a wrong factor (negative control)', async () => {
    await expect(unlockWithPassword(env, 'wrong horse battery!', kdf)).rejects.toBeInstanceOf(WrongPassword);
    await expect(unlockWithPrf(env, new Uint8Array(32).fill(6))).rejects.toBeInstanceOf(WrongPasskey);
    expect(await decryptMnemonic(env, await unlockWithPrf(env, prf.slice()))).toBe(MNEMONIC);
  });
});

// Fable review (Minor 3): the seed ciphertext is bound to the envelope header, and the declared
// Argon2id cost is bounded on both sides.
describe('the envelope header is bound to the seed ciphertext (AES-GCM additionalData)', () => {
  const pubkey = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
  const real = [{index: 0, name: 'Account 1', publicKey: pubkey}];
  async function opened() {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts: real, kdf});
    return {env, dk: await unlockWithPassword(env, 'correct horse battery', kdf)};
  }

  it('declares the production cost by default', async () => {
    const {env} = await opened();
    expect(env.kdf).toMatchObject({alg: 'argon2id', ...PRODUCTION_KDF});
  });

  it.each<[string, (e: EnvelopeV1) => EnvelopeV1]>([
    ['scheme', e => ({...e, scheme: 'cli'})],
    ['accounts[0].index', e => ({...e, accounts: [{...real[0]!, index: 1}]})],
    ['accounts[0].publicKey', e => ({...e, accounts: [{...real[0]!, publicKey: '11111111111111111111111111111111'}]})],
    ['an added account', e => ({...e, accounts: [...real, {index: 1, name: 'Account 2', publicKey: pubkey}]})],
    ['kdf.m', e => ({...e, kdf: {...e.kdf, m: e.kdf.m + 1}})],
    ['kdf.t', e => ({...e, kdf: {...e.kdf, t: e.kdf.t + 1}})],
  ])('a stored envelope with %s changed no longer decrypts, even with the right data key', async (_, change) => {
    const {env, dk} = await opened();
    await expect(decryptMnemonic(change(env), dk.slice())).rejects.toThrow();
    expect(await decryptMnemonic(env, dk)).toBe(MNEMONIC); // positive control
  });

  it('renaming an account needs no re-encryption (names are not in the header)', async () => {
    const {env, dk} = await opened();
    expect(await decryptMnemonic({...env, accounts: [{...real[0]!, name: 'Savings'}]}, dk)).toBe(MNEMONIC);
  });
});

describe('Argon2id parameters are bounded: production floor, cap above', () => {
  const neverKdf: Kdf = async () => {
    throw new Error('the KDF must not run on refused parameters');
  };
  it('the cap is m 1 GiB (in KiB), t 10, p 4', () => {
    expect(KDF_CAP).toEqual({m: 1024 * 1024, t: 10, p: 4});
  });

  it.each([
    ['m below production', {m: 65535}],
    ['t below production', {t: 2}],
    ['p below production', {p: 0}],
    ['the old test cost', {m: 64, t: 1, p: 1}],
    ['m above the cap', {m: 1024 * 1024 + 1}],
    ['t above the cap', {t: 11}],
    ['p above the cap', {p: 5}],
  ])('%s: unlock throws UnsafeKdfParams (not WrongPassword) without running the KDF; create refuses too', async (_, change) => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const bad = {...env, kdf: {...env.kdf, ...change}};
    await expect(unlockWithPassword(bad, 'correct horse battery', neverKdf)).rejects.toBeInstanceOf(UnsafeKdfParams);
    await expect(unlockWithPrf(bad, new Uint8Array(32))).rejects.toBeInstanceOf(UnsafeKdfParams);
    const params = {...PRODUCTION_KDF, ...change};
    await expect(createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params})).rejects.toBeInstanceOf(UnsafeKdfParams);
  });

  it('accepts exactly the production floor and exactly the cap (boundary positive control)', async () => {
    for (const params of [PRODUCTION_KDF, KDF_CAP]) {
      const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params});
      expect(await decryptMnemonic(env, await unlockWithPassword(env, 'correct horse battery', kdf))).toBe(MNEMONIC);
    }
  });
});

describe('reencryptForAccounts (adding or removing an account, spec §2)', () => {
  const two = [
    {index: 0, name: 'Account 1'},
    {index: 1, name: 'Account 2'},
  ];
  const withKeys = [
    {index: 0, name: 'Account 1', publicKey: K0},
    {index: 1, name: 'Account 2', publicKey: K1},
  ];

  it('re-encrypts under the same data key: the password still unlocks, the new header decrypts (positive control)', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    const next = await reencryptForAccounts(env, dk, two);
    expect(next.accounts).toEqual(withKeys);
    expect(next.password).toEqual(env.password);
    expect(next.kdf).toEqual(env.kdf);
    const dk2 = await unlockWithPassword(next, 'correct horse battery', kdf);
    expect(await decryptMnemonic(next, dk2)).toBe(MNEMONIC);
  });

  it('derives every public key from the seed: a caller-supplied one is ignored', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    const smuggled = [{index: 0, name: 'Account 1', publicKey: 'attacker'}, {index: 1, name: 'Account 2', publicKey: 'attacker'}];
    expect((await reencryptForAccounts(env, dk, smuggled)).accounts).toEqual(withKeys);
    const cli = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'cli', accounts, kdf});
    const cliKey = await unlockWithPassword(cli, 'correct horse battery', kdf);
    expect((await reencryptForAccounts(cli, cliKey, [{index: 0, name: 'Main'}])).accounts).toEqual([{index: 0, name: 'Main', publicKey: KCLI}]);
  });

  it('derives public keys only: equal to the session derivation, every secret key and the seed zeroed, no secret-key string made', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    const session = await accountsModule.deriveSessionAccounts(MNEMONIC, 'slip10', [0, 1]);
    const secretKeys: Uint8Array[] = [];
    const seeds: Uint8Array[] = [];
    const derive = transparentModule.deriveTransparentKeypair;
    const toSeed = mnemonicModule.mnemonicToSeed;
    const spies = [
      vi.spyOn(transparentModule, 'deriveTransparentKeypair').mockImplementation((...args) => {
        const kp = derive(...args);
        secretKeys.push(kp.secretKey);
        return kp;
      }),
      vi.spyOn(mnemonicModule, 'mnemonicToSeed').mockImplementation(async (...args) => {
        const seed = await toSeed(...args);
        seeds.push(seed);
        return seed;
      }),
      vi.spyOn(accountsModule, 'deriveSessionAccounts'),
    ];
    try {
      const next = await reencryptForAccounts(env, dk, two);
      expect(next.accounts.map(a => a.publicKey)).toEqual(session.map(a => a.publicKey));
      expect(next.accounts.map(a => a.publicKey)).toEqual([K0, K1]);
      expect(secretKeys).toHaveLength(2);
      for (const sk of secretKeys) expect([sk.length, sk.every(b => b === 0)]).toEqual([64, true]);
      expect(seeds).toHaveLength(1);
      expect([seeds[0]!.length, seeds[0]!.every(b => b === 0)]).toEqual([64, true]);
      expect(spies[2]).not.toHaveBeenCalled();
    } finally {
      for (const s of spies) s.mockRestore();
    }
  });

  it('returns exactly the envelope fields: nothing stray from the stored envelope or the account list', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const withPasskey = await addPasskeyWrap(env, dk, prf, crypto.getRandomValues(new Uint8Array(16)), crypto.getRandomValues(new Uint8Array(32)));
    const stray = {...withPasskey, extra: 'x', kdf: {...withPasskey.kdf, extra: 1}, seed: {...withPasskey.seed, extra: 1}, password: {...withPasskey.password, extra: 1}, passkey: {...withPasskey.passkey!, extra: 1}};
    const next = await reencryptForAccounts(stray as EnvelopeV1, dk, two.map(a => ({...a, secretKey: 'k'})));
    expect(Object.keys(next).sort()).toEqual(['accounts', 'kdf', 'passkey', 'password', 'scheme', 'seed', 'v']);
    expect(Object.keys(next.kdf).sort()).toEqual(['alg', 'm', 'p', 'salt', 't']);
    expect(Object.keys(next.seed).sort()).toEqual(['ct', 'iv']);
    expect(next.password).toEqual(withPasskey.password);
    expect(next.passkey).toEqual(withPasskey.passkey);
    expect(next.accounts).toEqual(withKeys);
    expect('passkey' in (await reencryptForAccounts(env, dk, two))).toBe(false);
  });

  it('uses a fresh IV, and the old ciphertext does not decrypt under the new header', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    const next = await reencryptForAccounts(env, dk, two);
    expect(next.seed.iv).not.toBe(env.seed.iv);
    await expect(decryptMnemonic({...next, seed: env.seed}, dk)).rejects.toThrow();
  });

  it('keeps a passkey wrap working', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const withPasskey = await addPasskeyWrap(env, dk, prf, crypto.getRandomValues(new Uint8Array(16)), crypto.getRandomValues(new Uint8Array(32)));
    const next = await reencryptForAccounts(withPasskey, dk, two);
    expect(await decryptMnemonic(next, await unlockWithPrf(next, prf))).toBe(MNEMONIC);
  });

  it('cleans names: a new one must be one a rename would accept; a stored one comes back unchanged', async () => {
    const legacy = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts: [{index: 0, name: '', publicKey: K0}], kdf});
    const dk = await unlockWithPassword(legacy, 'correct horse battery', kdf);
    const next = await reencryptForAccounts(legacy, dk, [{index: 0, name: ''}, {index: 1, name: '  Trading  '}]);
    expect(next.accounts.map(a => a.name)).toEqual(['', 'Trading']);
    for (const name of ['', '   ', 'a\u202eb', 'x'.repeat(33)]) {
      await expect(reencryptForAccounts(legacy, dk, [{index: 0, name: ''}, {index: 1, name}])).rejects.toThrow(/malformed account/);
    }
    await expect(reencryptForAccounts(legacy, dk, [{index: 0, name: 'a\nb'}])).rejects.toThrow(/malformed account/);
  });

  it('refuses no accounts, too many, a bad or duplicate index, a second cli account and the wrong data key', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    await expect(reencryptForAccounts(env, dk, [])).rejects.toThrow(/at least one account/);
    const many = Array.from({length: MAX_ACCOUNTS + 1}, (_, i) => ({index: i, name: `Account ${i + 1}`}));
    await expect(reencryptForAccounts(env, dk, many)).rejects.toThrow(/at most 100 accounts/);
    await expect(reencryptForAccounts(env, dk, [two[0]!, {...two[1]!, index: 0}])).rejects.toThrow(/malformed account/);
    for (const index of [-1, 0.5, Number.NaN]) await expect(reencryptForAccounts(env, dk, [{index, name: 'x'}])).rejects.toThrow(/malformed account/);
    const cli = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'cli', accounts, kdf});
    const cliKey = await unlockWithPassword(cli, 'correct horse battery', kdf);
    await expect(reencryptForAccounts(cli, cliKey, two)).rejects.toThrow(/cli wallet has exactly one account/);
    await expect(reencryptForAccounts(cli, cliKey, [{index: 1, name: 'x'}])).rejects.toThrow(/cli wallet has exactly one account/);
    await expect(reencryptForAccounts(env, crypto.getRandomValues(new Uint8Array(32)), two)).rejects.toThrow();
  });
});
