import {readFileSync} from 'node:fs';
import {decryptMnemonic, unlockWithPassword, unlockWithPrf, WrongPassword, type EnvelopeV1, type Kdf} from '../envelope';
import {argon2idKdf} from '../kdf';

// Spec §5: the envelope format is pinned by a COMMITTED v1 envelope, written once by
// scripts/make-envelope-v1-fixture.mjs (an independent WebCrypto implementation of the format)
// and never regenerated here. If envelope.ts changes how it reads a stored vault — the KDF
// wiring, the AES-KW wrap, the HKDF info or salt, the seed cipher and its header binding —
// wallets already on disk stop opening, and this test says so.
//
// Regenerated once on 2026-09-29 (Fable review, Minor 3), when the seed's GCM additionalData
// became the canonical header and the declared cost became bounded below by production: no
// envelope had ever shipped (B1a is unreleased), so the v1 format changed without a version bump.
const env = JSON.parse(readFileSync(new URL('./fixtures/envelope-v1.json', import.meta.url), 'utf8')) as EnvelopeV1;

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PASSWORD = 'correct horse battery staple';
// 0xa0, 0xa1, … 0xbf — the fixed PRF output the fixture's passkey wrap was made with.
const PRF_OUTPUT = Uint8Array.from({length: 32}, (_, i) => 0xa0 + i);
// The production KDF at the production cost (~2 s per run in Node), so a change to its
// parameter mapping breaks this pinned format too.
const kdf: Kdf = argon2idKdf;
const SLOW = 60_000;

describe('envelope v1 known-answer fixture', () => {
  it('is the v1 slip10 envelope with a passkey wrap at the production cost', () => {
    expect(env.v).toBe(1);
    expect(env.scheme).toBe('slip10');
    expect(env.kdf).toMatchObject({alg: 'argon2id', m: 65536, t: 3, p: 1});
    expect(env.passkey).toBeDefined();
  });

  it('the password opens it to the known mnemonic', async () => {
    expect(await decryptMnemonic(env, await unlockWithPassword(env, PASSWORD, kdf))).toBe(MNEMONIC);
  }, SLOW);

  it('the PRF output opens it to the known mnemonic', async () => {
    expect(await decryptMnemonic(env, await unlockWithPrf(env, PRF_OUTPUT.slice()))).toBe(MNEMONIC);
  });

  it('a wrong password does not (negative control)', async () => {
    await expect(unlockWithPassword(env, 'wrong horse battery staple', kdf)).rejects.toBeInstanceOf(WrongPassword);
  }, SLOW);

  it('its seed is bound to its header: the right data key does not open it with the scheme flipped', async () => {
    const dk = await unlockWithPrf(env, PRF_OUTPUT.slice());
    await expect(decryptMnemonic({...env, scheme: 'cli'}, dk.slice())).rejects.toThrow();
    expect(await decryptMnemonic(env, dk)).toBe(MNEMONIC);
  });
});
