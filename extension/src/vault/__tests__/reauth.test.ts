import {argon2idAsync} from '@noble/hashes/argon2.js';
import {addPasskeyWrap, createEnvelope, unlockWithPassword, type Kdf} from '../envelope';
import * as envelopeModule from '../envelope';
import {deriveSessionAccounts} from '../accounts';
import {proveWithPassword, proveWithPrf} from '../reauth';
import {openProven, reauthenticate} from '../reauth';
import {CorruptEnvelope} from '../envelope';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const accounts = [{index: 0, name: 'Account 1', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}];
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
// The envelope refuses Argon2id parameters below production (spec §2), so every envelope here
// DECLARES the production cost; this test KDF computes Argon2id at a tiny cost instead, so a
// test runs in milliseconds. The production KDF's parameter mapping is pinned by envelopeKat.
const kdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});
const randomBytes = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** A real envelope with a passkey wrap added on top of the password wrap, the way unlock.html would. */
async function passkeyEnvelope() {
  const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
  const dataKey = await unlockWithPassword(env, 'correct horse battery', kdf);
  const prfOutput = randomBytes(32);
  const prfSalt = randomBytes(32);
  const credentialId = randomBytes(16);
  const withPasskey = await addPasskeyWrap(env, dataKey, prfOutput, credentialId, prfSalt);
  return {env: withPasskey, prfOutput, prfSalt, credentialId};
}

describe('re-authentication is a proof', () => {
  it('passes with the right password against the right session', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const session = await deriveSessionAccounts(MNEMONIC, 'slip10', [0]);
    expect(await proveWithPassword(env, 'correct horse battery', kdf, session)).toBe(true);
  });

  it('fails with the wrong password', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const session = await deriveSessionAccounts(MNEMONIC, 'slip10', [0]);
    expect(await proveWithPassword(env, 'nope nope nope nope', kdf, session)).toBe(false);
  });

  it("fails when the session keys are not this vault's (a swapped session)", async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const foreign = await deriveSessionAccounts(OTHER, 'slip10', [0]);
    expect(await proveWithPassword(env, 'correct horse battery', kdf, foreign)).toBe(false);
  });

  it('fails a right-password proof against an empty session (vacuous truth guard)', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    expect(await proveWithPassword(env, 'correct horse battery', kdf, [])).toBe(false);
  });

  it('zeroes the unwrapped data key even when decryptMnemonic throws', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    // Corrupt only the seed ciphertext (not the password-wrapped data key), so
    // unlockWithPassword still succeeds but decryptMnemonic's AES-GCM tag check throws.
    const flip = env.seed.ct.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA';
    const corrupted = {...env, seed: {...env.seed, ct: env.seed.ct.slice(0, -4) + flip}};
    let captured: Uint8Array | undefined;
    const original = envelopeModule.unlockWithPassword;
    const spy = vi.spyOn(envelopeModule, 'unlockWithPassword').mockImplementation(async (...args) => {
      captured = await original(...args);
      return captured;
    });
    const session = await deriveSessionAccounts(MNEMONIC, 'slip10', [0]);
    try {
      expect(await proveWithPassword(corrupted, 'correct horse battery', kdf, session)).toBe(false);
      expect(captured).toBeDefined();
      expect(Array.from(captured ?? [])).toEqual(new Array(32).fill(0));
    } finally {
      spy.mockRestore();
    }
  });
});

describe('re-authentication is a proof — passkey (PRF) factor', () => {
  it('passes with the right PRF output against the right session', async () => {
    const {env, prfOutput} = await passkeyEnvelope();
    const session = await deriveSessionAccounts(MNEMONIC, 'slip10', [0]);
    expect(await proveWithPrf(env, prfOutput, session)).toBe(true);
  });

  it('fails with the wrong PRF output', async () => {
    const {env} = await passkeyEnvelope();
    const session = await deriveSessionAccounts(MNEMONIC, 'slip10', [0]);
    expect(await proveWithPrf(env, randomBytes(32), session)).toBe(false);
  });

  it("fails when the session keys are not this vault's (a swapped session)", async () => {
    const {env, prfOutput} = await passkeyEnvelope();
    const foreign = await deriveSessionAccounts(OTHER, 'slip10', [0]);
    expect(await proveWithPrf(env, prfOutput, foreign)).toBe(false);
  });

  it('fails a right-PRF proof against an empty session (vacuous truth guard)', async () => {
    const {env, prfOutput} = await passkeyEnvelope();
    expect(await proveWithPrf(env, prfOutput, [])).toBe(false);
  });

  it('fails when the envelope has no passkey wrap', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const session = await deriveSessionAccounts(MNEMONIC, 'slip10', [0]);
    expect(await proveWithPrf(env, randomBytes(32), session)).toBe(false);
  });
});

describe('re-authentication outcomes (B1b-1)', () => {
  it("'ok' for the right factor against this vault's session (positive control)", async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const session = await deriveSessionAccounts(MNEMONIC, 'slip10', [0]);
    expect(await reauthenticate(env, {password: 'correct horse battery', kdf}, session)).toBe('ok');
  });

  it("'wrong' for a wrong password — a typo, not a reason to lock", async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const session = await deriveSessionAccounts(MNEMONIC, 'slip10', [0]);
    expect(await reauthenticate(env, {password: 'nope nope nope nope', kdf}, session)).toBe('wrong');
  });

  it("'mismatch' when the session is not this vault's — the caller locks", async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const foreign = await deriveSessionAccounts(OTHER, 'slip10', [0]);
    expect(await reauthenticate(env, {password: 'correct horse battery', kdf}, foreign)).toBe('mismatch');
    expect(await reauthenticate(env, {password: 'correct horse battery', kdf}, [])).toBe('mismatch');
  });

  it("'damaged' for a stored envelope that is not well formed", async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const session = await deriveSessionAccounts(MNEMONIC, 'slip10', [0]);
    expect(await reauthenticate({...env, password: {wrapped: 'AAAA'}}, {password: 'correct horse battery', kdf}, session)).toBe('damaged');
    expect(new CorruptEnvelope('x')).toBeInstanceOf(Error);
  });

  it('openProven hands over the mnemonic and a live data key only on ok, and zeroes it otherwise', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const session = await deriveSessionAccounts(MNEMONIC, 'slip10', [0]);
    const ok = await openProven(env, {password: 'correct horse battery', kdf}, session);
    expect(ok.outcome).toBe('ok');
    if (ok.outcome === 'ok') {
      expect(ok.mnemonic).toBe(MNEMONIC);
      expect(ok.dataKey.some(b => b !== 0)).toBe(true);
      ok.dataKey.fill(0);
    }
    let captured: Uint8Array | undefined;
    const original = envelopeModule.unlockWithPassword;
    const spy = vi.spyOn(envelopeModule, 'unlockWithPassword').mockImplementation(async (...args) => {
      captured = await original(...args);
      return captured;
    });
    try {
      const foreign = await deriveSessionAccounts(OTHER, 'slip10', [0]);
      expect((await openProven(env, {password: 'correct horse battery', kdf}, foreign)).outcome).toBe('mismatch');
      expect(captured?.every(b => b === 0)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
