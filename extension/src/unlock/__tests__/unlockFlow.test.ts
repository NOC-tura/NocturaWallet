import {argon2idAsync} from '@noble/hashes/argon2.js';
import {addPasskeyWrap, createEnvelope, unlockWithPassword, type EnvelopeV1, type Kdf} from '../../vault/envelope';
import * as envelopeModule from '../../vault/envelope';
import {unlockFlow} from '../unlockFlow';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
// The envelope refuses Argon2id parameters below production (spec §2), so every envelope here
// DECLARES the production cost; this test KDF computes Argon2id at a tiny cost instead, so a
// test runs in milliseconds. The production KDF's parameter mapping is pinned by envelopeKat.
const kdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});
const accounts = [{index: 0, name: 'Account 1', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}];
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

describe('unlockFlow', () => {
  it('sends the derived account keys, and nothing about the seed', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const sent: unknown[] = [];
    const r = await unlockFlow({env, send: async m => (sent.push(m), {ok: true})}, {password: 'correct horse battery', kdf});
    expect(r).toBe('unlocked');
    expect(sent).toHaveLength(1);
    const json = JSON.stringify(sent[0]);
    expect(json).toContain('"type":"vault.setKeys"');
    expect(json).toContain('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
    expect(json).not.toContain('abandon');
  });

  it('says wrong for a wrong password and sends nothing', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const sent: unknown[] = [];
    expect(await unlockFlow({env, send: async m => (sent.push(m), {ok: true})}, {password: 'nope nope nope nope', kdf})).toBe('wrong');
    expect(sent).toHaveLength(0);
  });

  it('says failed when the background refuses', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    expect(await unlockFlow({env, send: async () => ({ok: false, error: 'forbidden'})}, {password: 'correct horse battery', kdf})).toBe('failed');
  });

  it('returns failed and zeroes the unwrapped data key when decryptMnemonic throws', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    let captured: Uint8Array | undefined;
    const originalUnlock = envelopeModule.unlockWithPassword;
    const unlockSpy = vi.spyOn(envelopeModule, 'unlockWithPassword').mockImplementation(async (...args) => {
      captured = await originalUnlock(...args);
      return captured;
    });
    const decryptSpy = vi.spyOn(envelopeModule, 'decryptMnemonic').mockRejectedValue(new Error('corrupt seed'));
    try {
      const r = await unlockFlow({env, send: async () => ({ok: true})}, {password: 'correct horse battery', kdf});
      expect(r).toBe('failed');
      expect(captured).toBeDefined();
      expect(Array.from(captured ?? [])).toEqual(new Array(32).fill(0));
    } finally {
      unlockSpy.mockRestore();
      decryptSpy.mockRestore();
    }
  });

  it('returns failed when send() throws instead of resolving', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const r = await unlockFlow(
      {
        env,
        send: async () => {
          throw new Error('runtime.sendMessage rejected');
        },
      },
      {password: 'correct horse battery', kdf},
    );
    expect(r).toBe('failed');
  });

  it('zeroes the caller-owned prfOutput even when the passkey is wrong', async () => {
    const {env} = await passkeyEnvelope();
    const wrongPrf = randomBytes(32);
    const r = await unlockFlow({env, send: async () => ({ok: true})}, {prfOutput: wrongPrf});
    expect(r).toBe('wrong');
    expect(Array.from(wrongPrf)).toEqual(new Array(32).fill(0));
  });

  it('unlocks end-to-end with a valid passkey PRF output, and zeroes the caller-owned prfOutput', async () => {
    const {env, prfOutput} = await passkeyEnvelope();
    const sent: unknown[] = [];
    const r = await unlockFlow({env, send: async m => (sent.push(m), {ok: true})}, {prfOutput});
    expect(r).toBe('unlocked');
    expect(sent).toHaveLength(1);
    const json = JSON.stringify(sent[0]);
    expect(json).toContain('"type":"vault.setKeys"');
    expect(json).toContain('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
    expect(Array.from(prfOutput)).toEqual(new Array(32).fill(0));
  });

  it.each(['AAAA', '!!!not-base64'])('says damaged (not wrong) for a malformed wrapped key %j, and sends nothing', async wrapped => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const sent: unknown[] = [];
    const r = await unlockFlow({env: {...env, password: {wrapped}}, send: async m => (sent.push(m), {ok: true})}, {password: 'correct horse battery', kdf});
    expect(r).toBe('damaged');
    expect(sent).toHaveLength(0);
  });

  it('says damaged for a malformed passkey wrap, and still zeroes the prfOutput', async () => {
    const {env, prfOutput} = await passkeyEnvelope();
    const pk = env.passkey;
    if (!pk) throw new Error('no passkey wrap');
    const r = await unlockFlow({env: {...env, passkey: {...pk, wrapped: 'AAAA'}}, send: async () => ({ok: true})}, {prfOutput});
    expect(r).toBe('damaged');
    expect(Array.from(prfOutput)).toEqual(new Array(32).fill(0));
  });

  // Fable review (Minor 3): the vault page's path refuses a stored envelope declaring a weak cost
  // — there is no option on this path that would let small parameters through.
  it('refuses weak Argon2id parameters from the vault page path: damaged, the KDF never runs, nothing sent', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    let kdfCalls = 0;
    const countingKdf: Kdf = async (pw, salt, p) => (kdfCalls++, kdf(pw, salt, p));
    const sent: unknown[] = [];
    const weak = {...env, kdf: {...env.kdf, m: 64, t: 1, p: 1}};
    expect(await unlockFlow({env: weak, send: async m => (sent.push(m), {ok: true})}, {password: 'correct horse battery', kdf: countingKdf})).toBe('damaged');
    expect(kdfCalls).toBe(0);
    expect(sent).toHaveLength(0);
    // Positive control: the same envelope at its declared (production) cost unlocks.
    expect(await unlockFlow({env, send: async m => (sent.push(m), {ok: true})}, {password: 'correct horse battery', kdf: countingKdf})).toBe('unlocked');
    expect(kdfCalls).toBe(1);
  });

  it.each<[string, (e: EnvelopeV1) => EnvelopeV1]>([
    ['scheme', e => ({...e, scheme: 'cli'})],
    ['accounts[0].index', e => ({...e, accounts: [{...e.accounts[0]!, index: 1}]})],
    ['kdf.m', e => ({...e, kdf: {...e.kdf, m: e.kdf.m + 1}})],
  ])('a stored envelope with %s flipped does not unlock, and sends nothing', async (_, flip) => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const sent: unknown[] = [];
    const r = await unlockFlow({env: flip(env), send: async m => (sent.push(m), {ok: true})}, {password: 'correct horse battery', kdf});
    expect(r).not.toBe('unlocked');
    expect(sent).toHaveLength(0);
  });

  // Fable review (Minor 4): the keys handed to the background must be the keys the envelope
  // says this wallet has — a mismatch (a wrong public key written at create time, a derivation
  // bug) is a failed unlock, with nothing sent.
  it.each([
    ['a public key that is not account 0\'s', [{index: 0, name: 'Account 1', publicKey: '11111111111111111111111111111111'}]],
    ['account 0\'s public key stored under index 1', [{index: 1, name: 'Account 2', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}]],
    ['a second account whose key is account 0\'s', [...accounts, {index: 1, name: 'Account 2', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}]],
  ])('fails and sends nothing when the derived keys do not match the stored ones: %s', async (_, stored) => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts: stored, kdf});
    const sent: unknown[] = [];
    expect(await unlockFlow({env, send: async m => (sent.push(m), {ok: true})}, {password: 'correct horse battery', kdf})).toBe('failed');
    expect(sent).toHaveLength(0);
  });
});

