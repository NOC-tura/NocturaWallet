import {argon2idAsync} from '@noble/hashes/argon2.js';
import {addPasskeyWrap, createEnvelope, unlockWithPassword, type Kdf} from '../../vault/envelope';
import * as envelopeModule from '../../vault/envelope';
import {unlockFlow} from '../unlockFlow';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const kdf: Kdf = (pw, salt, p) => argon2idAsync(pw, salt, {m: p.m, t: p.t, p: p.p, dkLen: 32});
const accounts = [{index: 0, name: 'Account 1', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}];
const randomBytes = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** A real envelope with a passkey wrap added on top of the password wrap, the way unlock.html would. */
async function passkeyEnvelope() {
  const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: {m: 64, t: 1, p: 1}});
  const dataKey = await unlockWithPassword(env, 'correct horse battery', kdf);
  const prfOutput = randomBytes(32);
  const prfSalt = randomBytes(32);
  const credentialId = randomBytes(16);
  const withPasskey = await addPasskeyWrap(env, dataKey, prfOutput, credentialId, prfSalt);
  return {env: withPasskey, prfOutput, prfSalt, credentialId};
}

describe('unlockFlow', () => {
  it('sends the derived account keys, and nothing about the seed', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: {m: 64, t: 1, p: 1}});
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
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: {m: 64, t: 1, p: 1}});
    const sent: unknown[] = [];
    expect(await unlockFlow({env, send: async m => (sent.push(m), {ok: true})}, {password: 'nope nope nope nope', kdf})).toBe('wrong');
    expect(sent).toHaveLength(0);
  });

  it('says failed when the background refuses', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: {m: 64, t: 1, p: 1}});
    expect(await unlockFlow({env, send: async () => ({ok: false, error: 'forbidden'})}, {password: 'correct horse battery', kdf})).toBe('failed');
  });

  it('returns failed and zeroes the unwrapped data key when decryptMnemonic throws', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: {m: 64, t: 1, p: 1}});
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
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: {m: 64, t: 1, p: 1}});
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
});
