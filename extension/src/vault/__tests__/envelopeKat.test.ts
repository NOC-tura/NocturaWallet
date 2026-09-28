import {readFileSync} from 'node:fs';
import {decryptMnemonic, unlockWithPassword, unlockWithPrf, WrongPassword, type EnvelopeV1, type Kdf} from '../envelope';
import {argon2idKdf} from '../kdf';

// Spec §5: the envelope format is pinned by a COMMITTED v1 envelope, written once by
// scripts/make-envelope-v1-fixture.mjs (an independent WebCrypto implementation of the format)
// and never regenerated here. If envelope.ts changes how it reads a stored vault — the KDF
// wiring, the AES-KW wrap, the HKDF info or salt, the seed cipher — wallets already on disk
// stop opening, and this test says so.
const env = JSON.parse(readFileSync(new URL('./fixtures/envelope-v1.json', import.meta.url), 'utf8')) as EnvelopeV1;

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PASSWORD = 'correct horse battery staple';
// 0xa0, 0xa1, … 0xbf — the fixed PRF output the fixture's passkey wrap was made with.
const PRF_OUTPUT = Uint8Array.from({length: 32}, (_, i) => 0xa0 + i);
// The production KDF, so a change to its parameter mapping breaks this pinned format too.
const kdf: Kdf = argon2idKdf;

describe('envelope v1 known-answer fixture', () => {
  it('is the v1 slip10 envelope with a passkey wrap at the small test parameters', () => {
    expect(env.v).toBe(1);
    expect(env.scheme).toBe('slip10');
    expect(env.kdf).toMatchObject({alg: 'argon2id', m: 64, t: 1, p: 1});
    expect(env.passkey).toBeDefined();
  });

  it('the password opens it to the known mnemonic', async () => {
    expect(await decryptMnemonic(env, await unlockWithPassword(env, PASSWORD, kdf))).toBe(MNEMONIC);
  });

  it('the PRF output opens it to the known mnemonic', async () => {
    expect(await decryptMnemonic(env, await unlockWithPrf(env, PRF_OUTPUT.slice()))).toBe(MNEMONIC);
  });

  it('a wrong password does not (negative control)', async () => {
    await expect(unlockWithPassword(env, 'wrong horse battery staple', kdf)).rejects.toBeInstanceOf(WrongPassword);
  });
});
