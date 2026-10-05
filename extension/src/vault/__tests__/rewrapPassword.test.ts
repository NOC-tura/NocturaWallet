import {vi} from 'vitest';
import {argon2idAsync} from '@noble/hashes/argon2.js';
import {WrongPassword, addPasskeyWrap, createEnvelope, decryptMnemonic, rewrapPassword, unlockWithPassword, unlockWithPrf, type Kdf} from '../envelope';

// B1b-2b E10: a new password wrap of the same data key, at the stored cost, proven before it is returned.
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const kdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const OLD = 'correct horse battery';
const NEW = 'a brand new long password';
const make = (mnemonic = MNEMONIC) => createEnvelope({mnemonic, password: OLD, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf});

describe('rewrapPassword', () => {
  it('the new wrap opens with the new password and not the old; the seed still decrypts; the cost is unchanged; the salt is fresh', async () => {
    const env = await make();
    const dk = await unlockWithPassword(env, OLD, kdf);
    const {salt, wrapped} = await rewrapPassword(env, dk, NEW, kdf);
    const next = {...env, kdf: {...env.kdf, salt}, password: {wrapped}};
    expect(salt).not.toBe(env.kdf.salt);
    expect(wrapped).not.toBe(env.password.wrapped);
    expect([next.kdf.m, next.kdf.t, next.kdf.p]).toEqual([env.kdf.m, env.kdf.t, env.kdf.p]);
    const opened = await unlockWithPassword(next, NEW, kdf);
    expect(await decryptMnemonic(next, opened)).toBe(MNEMONIC);
    await expect(unlockWithPassword(next, OLD, kdf)).rejects.toBeInstanceOf(WrongPassword);
    // The caller's data key is left as it was (the caller zeroes it).
    expect(dk.some(b => b !== 0)).toBe(true);
  });

  it('uses the stored cost: the KDF is asked for exactly the envelope’s m, t, p', async () => {
    const env = await make();
    const dk = await unlockWithPassword(env, OLD, kdf);
    const asked: {m: number; t: number; p: number}[] = [];
    await rewrapPassword(env, dk, NEW, async (pw, salt, params) => (asked.push(params), kdf(pw, salt, params)));
    expect(asked).toEqual([{m: env.kdf.m, t: env.kdf.t, p: env.kdf.p}]);
  });

  it('a passkey wrap keeps working after the password changes (it wraps the same key)', async () => {
    const env = await make();
    const dk = await unlockWithPassword(env, OLD, kdf);
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const withPk = await addPasskeyWrap(env, dk, prf, crypto.getRandomValues(new Uint8Array(16)), crypto.getRandomValues(new Uint8Array(32)));
    const {salt, wrapped} = await rewrapPassword(withPk, dk, NEW, kdf);
    const next = {...withPk, kdf: {...withPk.kdf, salt}, password: {wrapped}};
    expect(await decryptMnemonic(next, await unlockWithPrf(next, prf))).toBe(MNEMONIC);
  });

  it('refuses a data key that does not open THIS seed: nothing is returned (the self-check)', async () => {
    const env = await make();
    const other = await make(OTHER);
    const wrongKey = await unlockWithPassword(other, OLD, kdf);
    await expect(rewrapPassword(env, wrongKey, NEW, kdf)).rejects.toThrow();
  });

  it('review M4: refuses a wrap that does not open to the data key it was given — the unwrap half of the self-check', async () => {
    // AES-KW is deterministic, so a correct WebCrypto never produces this; the test makes the platform wrap a DIFFERENT
    // key. The seed half of the self-check alone would pass (it decrypts with the caller's key, not the wrap's).
    const env = await make();
    const dk = await unlockWithPassword(env, OLD, kdf);
    const proto = Object.getPrototypeOf(crypto.subtle) as SubtleCrypto;
    const real = proto.wrapKey;
    const stranger = await crypto.subtle.importKey('raw', crypto.getRandomValues(new Uint8Array(32)), 'AES-GCM', true, ['encrypt', 'decrypt']);
    const spy = vi.spyOn(proto, 'wrapKey').mockImplementation(function (this: SubtleCrypto, format, _key, wrappingKey, alg) {
      return real.call(this, format, stranger, wrappingKey, alg);
    });
    try {
      await expect(rewrapPassword(env, dk, NEW, kdf)).rejects.toThrow('does not open to the same data key');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('fix round 1: zeroes every data-key copy it made — the unwrapped check and the slice — on success and on a refusal', async () => {
    const proto = Object.getPrototypeOf(crypto.subtle) as SubtleCrypto;
    const realExport = proto.exportKey;
    const exported: ArrayBuffer[] = [];
    const exportSpy = vi.spyOn(proto, 'exportKey').mockImplementation(async function (this: SubtleCrypto, format: KeyFormat, key: CryptoKey) {
      const out = (await realExport.call(this, format as 'raw', key)) as ArrayBuffer;
      exported.push(out);
      return out;
    } as SubtleCrypto['exportKey']);
    const allZero = (b: ArrayBuffer | Uint8Array) => (b instanceof Uint8Array ? b : new Uint8Array(b)).every(x => x === 0);
    /** Runs rewrapPassword with `key`, returning the copies it sliced from it and the keys it exported. */
    const run = async (env: Awaited<ReturnType<typeof make>>, key: Uint8Array, refused: boolean) => {
      exported.length = 0;
      const slice = vi.spyOn(key, 'slice');
      const call = rewrapPassword(env, key, NEW, kdf);
      if (refused) await expect(call).rejects.toThrow();
      else await call;
      const copies = slice.mock.results.map(r => r.value as Uint8Array);
      slice.mockRestore();
      return {copies, keys: [...exported]};
    };
    try {
      const env = await make();
      const dk = await unlockWithPassword(env, OLD, kdf);
      // Success.
      const ok = await run(env, dk, false);
      expect(ok.copies).toHaveLength(1);
      expect(ok.keys).toHaveLength(1);
      expect([...ok.copies, ...ok.keys].every(allZero)).toBe(true);
      expect(dk.some(b => b !== 0)).toBe(true);
      // Refusal: a key that does not open this seed (the unwrap check passes, the seed check throws).
      const wrongKey = await unlockWithPassword(await make(OTHER), OLD, kdf);
      const bad = await run(env, wrongKey, true);
      expect(bad.copies).toHaveLength(1);
      expect(bad.keys).toHaveLength(1);
      expect([...bad.copies, ...bad.keys].every(allZero)).toBe(true);
    } finally {
      exportSpy.mockRestore();
    }
  });

  it('zeroes the KEK it derived', async () => {
    const env = await make();
    const dk = await unlockWithPassword(env, OLD, kdf);
    const keks: Uint8Array[] = [];
    await rewrapPassword(env, dk, NEW, async (pw, salt, params) => {
      const k = await kdf(pw, salt, params);
      keks.push(k);
      return k;
    });
    expect(keks).toHaveLength(1);
    expect(keks[0]?.every(b => b === 0)).toBe(true);
  });
});
