import {argon2idAsync} from '@noble/hashes/argon2.js';
import {createEnvelope, type Kdf} from '../envelope';
import * as envelopeModule from '../envelope';
import {deriveSessionAccounts} from '../accounts';
import {proveWithPassword} from '../reauth';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const kdf: Kdf = (pw, salt, p) => argon2idAsync(pw, salt, {m: p.m, t: p.t, p: p.p, dkLen: 32});

describe('re-authentication is a proof', () => {
  it('passes with the right password against the right session', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts: [], kdf, params: {m: 64, t: 1, p: 1}});
    const session = await deriveSessionAccounts(MNEMONIC, 'slip10', [0]);
    expect(await proveWithPassword(env, 'correct horse battery', kdf, session)).toBe(true);
  });

  it('fails with the wrong password', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts: [], kdf, params: {m: 64, t: 1, p: 1}});
    const session = await deriveSessionAccounts(MNEMONIC, 'slip10', [0]);
    expect(await proveWithPassword(env, 'nope nope nope nope', kdf, session)).toBe(false);
  });

  it("fails when the session keys are not this vault's (a swapped session)", async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts: [], kdf, params: {m: 64, t: 1, p: 1}});
    const foreign = await deriveSessionAccounts(OTHER, 'slip10', [0]);
    expect(await proveWithPassword(env, 'correct horse battery', kdf, foreign)).toBe(false);
  });

  it('fails a right-password proof against an empty session (vacuous truth guard)', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts: [], kdf, params: {m: 64, t: 1, p: 1}});
    expect(await proveWithPassword(env, 'correct horse battery', kdf, [])).toBe(false);
  });

  it('zeroes the unwrapped data key even when decryptMnemonic throws', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts: [], kdf, params: {m: 64, t: 1, p: 1}});
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
