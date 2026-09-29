import {argon2idAsync} from '@noble/hashes/argon2.js';
import {
  createEnvelope, unlockWithPassword, decryptMnemonic, addPasskeyWrap, unlockWithPrf,
  CorruptEnvelope, WrongPassword, WrongPasskey, PRODUCTION_KDF, type EnvelopeV1, type Kdf,
} from '../envelope';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
// Tiny parameters for speed; the production parameters are asserted below, not exercised.
const kdf: Kdf = (pw, salt, p) => argon2idAsync(pw, salt, {m: p.m, t: p.t, p: p.p, dkLen: 32});
const FAST = {m: 64, t: 1, p: 1};
const accounts = [{index: 0, name: 'Account 1', publicKey: 'x'}];

describe('vault envelope', () => {
  it('production Argon2id parameters are the spec values', () => {
    expect(PRODUCTION_KDF).toEqual({m: 65536, t: 3, p: 1});
  });

  it('round-trips the mnemonic with the right password', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    expect(await decryptMnemonic(env, dk)).toBe(MNEMONIC);
  });

  it('refuses the wrong password', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
    await expect(unlockWithPassword(env, 'wrong horse battery!', kdf)).rejects.toBeInstanceOf(WrongPassword);
  });

  it('stores nothing in the clear', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
    const json = JSON.stringify(env);
    expect(json).not.toContain('abandon');
    expect(json).not.toContain('correct horse');
  });

  it('two envelopes of one seed share no salt, IV or ciphertext', async () => {
    const a = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
    const b = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.seed.iv).not.toBe(b.seed.iv);
    expect(a.seed.ct).not.toBe(b.seed.ct);
  });

  it('a passkey wrap unlocks the same data key; a different PRF output does not', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const withPk = await addPasskeyWrap(env, dk, prf, new Uint8Array([1, 2, 3]), crypto.getRandomValues(new Uint8Array(32)));
    expect(await decryptMnemonic(withPk, await unlockWithPrf(withPk, prf))).toBe(MNEMONIC);
    await expect(unlockWithPrf(withPk, crypto.getRandomValues(new Uint8Array(32)))).rejects.toBeInstanceOf(WrongPasskey);
  });

  it('refuses a PRF salt or PRF output that is not exactly 32 bytes', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    const goodPrf = crypto.getRandomValues(new Uint8Array(32));
    const goodSalt = crypto.getRandomValues(new Uint8Array(32));
    const shortPrf = crypto.getRandomValues(new Uint8Array(16));
    const shortSalt = crypto.getRandomValues(new Uint8Array(16));
    await expect(addPasskeyWrap(env, dk, shortPrf, new Uint8Array([1, 2, 3]), goodSalt)).rejects.toThrow();
    await expect(addPasskeyWrap(env, dk, goodPrf, new Uint8Array([1, 2, 3]), shortSalt)).rejects.toThrow();
  });

  it('refuses to wrap a data key that does not decrypt this envelope', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
    const wrongDataKey = crypto.getRandomValues(new Uint8Array(32));
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(32));
    await expect(addPasskeyWrap(env, wrongDataKey, prf, new Uint8Array([1, 2, 3]), salt)).rejects.toThrow();
  });

  it('does not zero the caller\'s data key when wrapping it for a passkey', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    const dkCopy = dk.slice();
    const prf = crypto.getRandomValues(new Uint8Array(32));
    await addPasskeyWrap(env, dk, prf, new Uint8Array([1, 2, 3]), crypto.getRandomValues(new Uint8Array(32)));
    expect(Array.from(dk)).toEqual(Array.from(dkCopy));
  });

  it('refuses a tampered ciphertext', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
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
    await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf: spyKdf, params: FAST});
    if (!captured) throw new Error('kdf was not called');
    expect(Array.from(captured)).toEqual(new Array(captured.length).fill(0));
  });

  it('zeroes the array the KDF returned to unlockWithPassword, on the right password and on the wrong one', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});

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
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
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
      env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
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
      await expect(createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf: failing, params: FAST})).rejects.toThrow('kdf failed');
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
    const base = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
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
