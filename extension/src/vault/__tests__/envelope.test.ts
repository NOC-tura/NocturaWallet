import {argon2idAsync} from '@noble/hashes/argon2.js';
import {
  createEnvelope, unlockWithPassword, decryptMnemonic, addPasskeyWrap, unlockWithPrf,
  WrongPassword, WrongPasskey, PRODUCTION_KDF, type Kdf,
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
});
